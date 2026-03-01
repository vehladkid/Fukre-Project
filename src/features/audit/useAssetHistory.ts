import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabaseClient';

export interface AssetHistoryLog {
    id: string;
    asset_id: string;
    asset_name: string | null;
    action: 'INSERT' | 'UPDATE' | 'DELETE';
    before_data: any;
    after_data: any;
    changed_fields: any;
    created_at: string;
    user_id: string | null;
    operator_name: string | null;
    operator_role: string | null;
}

// ─── In-Memory Cache ───────────────────────────────────────────────────
// If admin re-clicks the same asset, serve cached history instantly.
const historyCache = new Map<string, AssetHistoryLog[]>();

export const useAssetHistory = (assetId: string | null, isOpen: boolean) => {
    const [history, setHistory] = useState<AssetHistoryLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Dual Race Protection tracking
    const requestCounterRef = useRef(0);
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (!assetId || !isOpen) {
            // Don't clear history when panel closes — keeps cached display for animation
            if (!isOpen) {
                setLoading(false);
                setError(null);
            }
            return;
        }

        // Serve from cache instantly if available
        const cached = historyCache.get(assetId);
        if (cached) {
            setHistory(cached);
            setLoading(false);
            setError(null);
            // Still fetch in background to refresh, but don't show loader
        }

        // Cancel any existing in-flight request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        // Setup new request identities
        const controller = new AbortController();
        abortControllerRef.current = controller;

        requestCounterRef.current += 1;
        const currentRequestId = requestCounterRef.current;

        const fetchHistory = async () => {
            // Only show loader if we don't have cached data
            if (!cached) {
                setLoading(true);
            }
            setError(null);

            try {
                const { data, error: fetchError } = await supabase
                    .from('asset_audit_history')
                    .select('*')
                    .eq('asset_id', assetId)
                    .order('created_at', { ascending: false })
                    .limit(30)
                    .abortSignal(controller.signal);

                if (fetchError) throw fetchError;

                // Strict identity guard: Only process if we are still the latest request
                if (currentRequestId === requestCounterRef.current && !controller.signal.aborted) {
                    const results = data || [];
                    setHistory(results);
                    // Update cache
                    historyCache.set(assetId, results);
                }
            } catch (err: any) {
                // Ignore intentional abort cancellations
                if (err.name === 'AbortError' || err.message?.includes('AbortError')) {
                    return;
                }

                if (currentRequestId === requestCounterRef.current) {
                    setError(err.message || 'Failed to fetch asset history');
                    console.error('Asset history fetch error:', err);
                }
            } finally {
                if (currentRequestId === requestCounterRef.current) {
                    setLoading(false);
                }
            }
        };

        fetchHistory();

        return () => {
            // Cleanup on unmount or assetId change
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }
        };
    }, [assetId, isOpen]);

    return { history, loading, error };
};
