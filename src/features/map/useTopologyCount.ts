import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabaseClient';

export interface TopologyCount {
    status_name: string;
    color_code: string;
    count: number;
}

export interface TopologyState {
    counts: TopologyCount[];
    total: number;
    loading: boolean;
}

const PAGE_SIZE = 1000; // Supabase hard max per request

// ─── Paginated full-DB count ─────────────────────────────────────────────────
// Supabase PostgREST enforces a server-side max-rows of 1000 regardless of
// .limit(). The only way past it is .range() pagination — we loop until
// the page returns fewer than PAGE_SIZE rows, then we know we have everything.

async function fetchAllStatusRows(): Promise<{ status_name: string; color_code: string }[]> {
    const allRows: { status_name: string; color_code: string }[] = [];
    let page = 0;

    while (true) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const { data, error } = await supabase
            .from('infrastructure_health_view')
            .select('status_name, color_code')
            .not('latitude', 'is', null)
            .not('longitude', 'is', null)
            .range(from, to);

        if (error || !data || data.length === 0) break;

        allRows.push(...(data as { status_name: string; color_code: string }[]));

        // If we got fewer than a full page, there are no more rows
        if (data.length < PAGE_SIZE) break;

        page++;
    }

    return allRows;
}

// ─── Aggregate rows → counts per status ─────────────────────────────────────
function aggregateCounts(rows: { status_name: string; color_code: string }[]): TopologyCount[] {
    const map: Record<string, { color: string; count: number }> = {};

    rows.forEach(row => {
        const s = row.status_name ?? 'Unknown';
        if (!map[s]) map[s] = { color: row.color_code ?? '#94a3b8', count: 0 };
        map[s].count++;
    });

    return Object.entries(map)
        .map(([status_name, v]) => ({ status_name, color_code: v.color, count: v.count }))
        .sort((a, b) => b.count - a.count);
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useTopologyCount(): TopologyState {
    const [state, setState] = useState<TopologyState>({
        counts: [],
        total: 0,
        loading: true,
    });

    const fetchCounts = useCallback(async () => {
        try {
            const rows = await fetchAllStatusRows();
            const counts = aggregateCounts(rows);
            const total = counts.reduce((acc, c) => acc + c.count, 0);
            setState({ counts, total, loading: false });
        } catch {
            setState(prev => ({ ...prev, loading: false }));
        }
    }, []);

    useEffect(() => {
        fetchCounts();

        // Re-count on any asset change (insert, update status, delete)
        const channel = supabase
            .channel('topology-count-live')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'infrastructure_assets' }, () => fetchCounts())
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'infrastructure_assets' }, () => fetchCounts())
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'infrastructure_assets' }, () => fetchCounts())
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [fetchCounts]);

    return state;
}
