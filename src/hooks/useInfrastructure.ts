import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

export interface Zone {
    id: string;
    name: string;
    description: string | null;
}

export interface Category {
    id: string;
    name: string;
    icon: string | null;
}

export interface Status {
    id: string;
    name: string;
    severity_level: number;
    color_code: string | null;
}

export interface InfrastructureAsset {
    id: string;
    name: string;
    description: string | null;
    zone_id: string | null;
    category_id: string | null;
    status_id: string | null;
    latitude: number | null;
    longitude: number | null;
    installation_date: string | null;
    last_inspected: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;

    // Joined fields
    zones?: { name: string } | null;
    infrastructure_categories?: { name: string } | null;
    asset_status?: { name: string; color_code: string | null } | null;
}

export const useInfrastructure = () => {
    const { user } = useAuth();
    const [assets, setAssets] = useState<InfrastructureAsset[]>([]);
    const [zones, setZones] = useState<Zone[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [statuses, setStatuses] = useState<Status[]>([]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const fetchReferenceData = useCallback(async () => {
        try {
            const [zonesRes, categoriesRes, statusesRes] = await Promise.all([
                supabase.from('zones').select('*').order('name'),
                supabase.from('infrastructure_categories').select('*').order('name'),
                supabase.from('asset_status').select('*').order('severity_level')
            ]);

            if (zonesRes.error) throw zonesRes.error;
            if (categoriesRes.error) throw categoriesRes.error;
            if (statusesRes.error) throw statusesRes.error;

            setZones(zonesRes.data as Zone[]);
            setCategories(categoriesRes.data as Category[]);
            setStatuses(statusesRes.data as Status[]);
        } catch (err: any) {
            console.error('Error fetching reference data:', err);
            // Non-fatal, just log it. Real errors are caught in CRUD operations.
        }
    }, []);

    const fetchAssets = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error: fetchError } = await supabase
                .from('infrastructure_assets')
                .select(`
          *,
          zones(name),
          infrastructure_categories(name),
          asset_status(name, color_code)
        `)
                .order('created_at', { ascending: false })
                .order('id', { ascending: false })
                .limit(50);

            if (fetchError) throw fetchError;
            setAssets(data as InfrastructureAsset[]);
            setHasMore((data || []).length === 50);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch assets');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    const loadMore = useCallback(async () => {
        if (!hasMore || loadingMore || assets.length === 0) return;

        setLoadingMore(true);
        setError(null);

        const lastAsset = assets[assets.length - 1];

        try {
            const { data, error: fetchError } = await supabase
                .from('infrastructure_assets')
                .select(`
          *,
          zones(name),
          infrastructure_categories(name),
          asset_status(name, color_code)
        `)
                .or(`created_at.lt.${lastAsset.created_at},and(created_at.eq.${lastAsset.created_at},id.lt.${lastAsset.id})`)
                .order('created_at', { ascending: false })
                .order('id', { ascending: false })
                .limit(50);

            if (fetchError) throw fetchError;

            if (data && data.length > 0) {
                setAssets(prev => [...prev, ...(data as InfrastructureAsset[])]);
                setHasMore(data.length === 50);
            } else {
                setHasMore(false);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load more assets');
            console.error('Asset pagination error:', err);
        } finally {
            setLoadingMore(false);
        }
    }, [hasMore, loadingMore, assets]);

    useEffect(() => {
        fetchReferenceData();
        fetchAssets();

        // Set up Realtime Subscription
        const channel = supabase.channel('infrastructure_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'infrastructure_assets' },
                () => {
                    fetchAssets();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchAssets, fetchReferenceData]);

    const createAsset = async (assetData: Partial<InfrastructureAsset>) => {
        setLoading(true);
        setError(null);
        try {
            const { error: createError } = await supabase
                .from('infrastructure_assets')
                .insert({
                    ...assetData,
                    // Data contract: last_inspected must NEVER be NULL.
                    // If the caller omits it or sends null, default to now().
                    // The DB trigger is the final safety net; this is the frontend contract.
                    last_inspected: assetData.last_inspected ?? new Date().toISOString(),
                    created_by: user?.id
                });

            if (createError) throw createError;

            // Realtime subscription will handle refreshing the list, but we also manually refresh
            await fetchAssets();
            return true;
        } catch (err: any) {
            setError(err.message || 'Failed to create asset');
            console.error(err);
            return false;
        } finally {
            setLoading(false);
        }
    };

    const updateAsset = async (id: string, assetData: Partial<InfrastructureAsset>) => {
        setLoading(true);
        setError(null);
        try {
            const { error: updateError } = await supabase
                .from('infrastructure_assets')
                .update(assetData)
                .eq('id', id);

            if (updateError) throw updateError;

            await fetchAssets();
            return true;
        } catch (err: any) {
            setError(err.message || 'Failed to update asset');
            console.error(err);
            return false;
        } finally {
            setLoading(false);
        }
    };

    const deleteAsset = async (id: string) => {
        setLoading(true);
        setError(null);
        try {
            const { error: deleteError } = await supabase
                .from('infrastructure_assets')
                .delete()
                .eq('id', id);

            if (deleteError) throw deleteError;

            await fetchAssets();
            return true;
        } catch (err: any) {
            setError(err.message || 'Failed to delete asset');
            console.error(err);
            return false;
        } finally {
            setLoading(false);
        }
    };

    return {
        assets,
        zones,
        categories,
        statuses,
        loading,
        loadingMore,
        error,
        hasMore,
        loadMore,
        fetchAssets,
        createAsset,
        updateAsset,
        deleteAsset
    };
};
