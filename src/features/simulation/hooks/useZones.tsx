import { useState, useEffect, useRef, createContext, useContext } from 'react';
import type { ReactNode, MutableRefObject } from 'react';
import { supabase } from '../../../lib/supabaseClient';

export interface Zone {
    id: string;
    name: string;
    centroid_lat: number;
    centroid_lng: number;
    population_density?: number;
}

interface ZoneContextType {
    zones: Zone[];
    loading: boolean;
    error?: string;
    zonesRef: MutableRefObject<Map<string, Zone>>;
}

const ZoneContext = createContext<ZoneContextType | undefined>(undefined);

// Module-level cache — shared across all consumers
let cachedZones: Zone[] | null = null;
let fetchPromise: Promise<Zone[]> | null = null;

// ── Fallback: Delhi neighbourhoods — used when DB has no zones ────────────────
const FALLBACK_ZONES: Zone[] = [
    { id: 'fall-1', name: 'Central Delhi', centroid_lat: 28.6448, centroid_lng: 77.2167 },
    { id: 'fall-2', name: 'South Delhi', centroid_lat: 28.5355, centroid_lng: 77.2500 },
    { id: 'fall-3', name: 'North Delhi', centroid_lat: 28.7041, centroid_lng: 77.1025 },
    { id: 'fall-4', name: 'East Delhi', centroid_lat: 28.6280, centroid_lng: 77.2990 },
    { id: 'fall-5', name: 'West Delhi', centroid_lat: 28.6530, centroid_lng: 77.0830 },
    { id: 'fall-6', name: 'New Delhi', centroid_lat: 28.6139, centroid_lng: 77.2090 },
    { id: 'fall-7', name: 'Dwarka', centroid_lat: 28.5921, centroid_lng: 77.0460 },
    { id: 'fall-8', name: 'Rohini', centroid_lat: 28.7330, centroid_lng: 77.1030 },
    { id: 'fall-9', name: 'Saket', centroid_lat: 28.5244, centroid_lng: 77.2090 },
    { id: 'fall-10', name: 'Lajpat Nagar', centroid_lat: 28.5700, centroid_lng: 77.2432 },
];

export const ZoneProvider = ({ children }: { children: ReactNode }) => {
    const [zones, setZones] = useState<Zone[]>(cachedZones || []);
    const [loading, setLoading] = useState(!cachedZones);
    const [error, setError] = useState<string>();
    const zonesRef = useRef<Map<string, Zone>>(new Map());

    useEffect(() => {
        if (cachedZones) {
            const map = new Map<string, Zone>();
            cachedZones.forEach(z => map.set(z.id, z));
            zonesRef.current = map;
            return;
        }

        const fetchZones = async () => {
            if (!fetchPromise) {
                fetchPromise = (async (): Promise<Zone[]> => {
                    // Try full schema (centroid columns)
                    let { data, error: err } = await supabase
                        .from('zones')
                        .select('id,name,centroid_lat,centroid_lng,population_density')
                        .order('name');

                    if (err) {
                        // Centroid columns missing — fall back to id+name only
                        const res = await supabase
                            .from('zones')
                            .select('id,name')
                            .order('name');
                        if (res.error) throw res.error;
                        data = (res.data || []).map((z: { id: string; name: string }) => ({
                            id: z.id,
                            name: z.name,
                            centroid_lat: 28.6139,
                            centroid_lng: 77.2090,
                            population_density: undefined,
                        }));
                    }

                    const result = (data as Zone[] | null) ?? [];
                    // If DB returned nothing, use built-in fallback data
                    return result.length > 0 ? result : FALLBACK_ZONES;
                })();
            }

            try {
                const data = await fetchPromise;
                cachedZones = data;
                const map = new Map<string, Zone>();
                data.forEach(z => map.set(z.id, z));
                zonesRef.current = map;
                setZones(data);
            } catch (err: unknown) {
                console.error('[useZones] fetch failed — using fallback zones', err);
                cachedZones = FALLBACK_ZONES;
                const map = new Map<string, Zone>();
                FALLBACK_ZONES.forEach(z => map.set(z.id, z));
                zonesRef.current = map;
                setZones(FALLBACK_ZONES);
                setError((err as Error)?.message ?? 'unknown error');
            } finally {
                setLoading(false);
            }
        };

        fetchZones();
    }, []);

    return (
        <ZoneContext.Provider value={{ zones, loading, error, zonesRef }}>
            {children}
        </ZoneContext.Provider>
    );
};

export const useZones = () => {
    const context = useContext(ZoneContext);
    if (context === undefined) {
        throw new Error('useZones must be used within a ZoneProvider');
    }
    return context;
};
