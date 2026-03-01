import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

export interface AuditLog {
    id: string;
    action: 'INSERT' | 'UPDATE' | 'DELETE';
    record_id: string;
    before_data: any;
    after_data: any;
    changed_fields: any;
    created_at: string;
    user_id: string | null;
    operator_name: string | null;
    operator_role: string | null;
}

export const useAuditLogs = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    /**
     * Primary fetch. Resets pagination and grabs the latest 50 logs.
     */
    const fetchLogs = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error: fetchError } = await supabase
                .from('audit_logs_with_users')
                .select('*')
                .order('created_at', { ascending: false })
                .order('id', { ascending: false })
                .limit(50);

            if (fetchError) throw fetchError;

            setLogs(data || []);
            setHasMore((data || []).length === 50);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch audit logs');
            console.error('Audit fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Load initial batch on mount
    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    /**
     * Cursor Pagination.
     * Grabs the next 50 logs strictly older than the last loaded log's timestamp and ID.
     */
    const loadMore = useCallback(async () => {
        if (!hasMore || loadingMore || logs.length === 0) return;

        setLoadingMore(true);
        setError(null);

        const lastLog = logs[logs.length - 1];

        try {
            // Cursor strategy (created_at, id) < (cursor_created_at, cursor_id)
            const { data, error: fetchError } = await supabase
                .from('audit_logs_with_users')
                .select('*')
                .or(`created_at.lt.${lastLog.created_at},and(created_at.eq.${lastLog.created_at},id.lt.${lastLog.id})`)
                .order('created_at', { ascending: false })
                .order('id', { ascending: false })
                .limit(50);

            if (fetchError) throw fetchError;

            if (data && data.length > 0) {
                setLogs(prev => [...prev, ...data]);
                setHasMore(data.length === 50);
            } else {
                setHasMore(false);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load more audit logs');
            console.error('Audit pagination error:', err);
        } finally {
            setLoadingMore(false);
        }
    }, [hasMore, loadingMore, logs]);

    return {
        logs,
        loading,
        loadingMore,
        error,
        hasMore,
        loadMore,
        refreshLogs: fetchLogs
    };
};
