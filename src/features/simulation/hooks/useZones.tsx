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

// ── Fallback: Comprehensive Delhi neighbourhoods ──────────────────────────────
const FALLBACK_ZONES: Zone[] = [
    { id: 'fall-1', name: 'Central Delhi', centroid_lat: 28.6448, centroid_lng: 77.2167 },
    { id: 'fall-2', name: 'South Delhi', centroid_lat: 28.5355, centroid_lng: 77.2500 },
    { id: 'fall-3', name: 'North Delhi', centroid_lat: 28.7041, centroid_lng: 77.1025 },
    { id: 'fall-4', name: 'East Delhi', centroid_lat: 28.6280, centroid_lng: 77.2990 },
    { id: 'fall-5', name: 'West Delhi', centroid_lat: 28.6530, centroid_lng: 77.0830 },
    { id: 'fall-6', name: 'New Delhi', centroid_lat: 28.6139, centroid_lng: 77.2090 },
    { id: 'fall-7', name: 'Dwarka', centroid_lat: 28.5921, centroid_lng: 77.0460 },
    { id: 'fall-8', name: 'Rohini', centroid_lat: 28.7330, centroid_lng: 77.1030 },
    { id: 'fall-9', name: 'Saket', centroid_lat: 28.5244, centroid_lng: 77.2100 },
    { id: 'fall-10', name: 'Lajpat Nagar', centroid_lat: 28.5700, centroid_lng: 77.2432 },
    { id: 'fall-11', name: 'Vasant Kunj', centroid_lat: 28.5292, centroid_lng: 77.1541 },
    { id: 'fall-12', name: 'Vasant Vihar', centroid_lat: 28.5607, centroid_lng: 77.1615 },
    { id: 'fall-13', name: 'Hauz Khas', centroid_lat: 28.5494, centroid_lng: 77.2044 },
    { id: 'fall-14', name: 'Greater Kailash', centroid_lat: 28.5482, centroid_lng: 77.2347 },
    { id: 'fall-15', name: 'Kalkaji', centroid_lat: 28.5400, centroid_lng: 77.2580 },
    { id: 'fall-16', name: 'Okhla', centroid_lat: 28.5460, centroid_lng: 77.2730 },
    { id: 'fall-17', name: 'Nehru Place', centroid_lat: 28.5480, centroid_lng: 77.2520 },
    { id: 'fall-18', name: 'Janakpuri', centroid_lat: 28.6210, centroid_lng: 77.0870 },
    { id: 'fall-19', name: 'Pitampura', centroid_lat: 28.7030, centroid_lng: 77.1320 },
    { id: 'fall-20', name: 'Paschim Vihar', centroid_lat: 28.6690, centroid_lng: 77.0930 },
    { id: 'fall-21', name: 'Vikaspuri', centroid_lat: 28.6340, centroid_lng: 77.0700 },
    { id: 'fall-22', name: 'Uttam Nagar', centroid_lat: 28.6180, centroid_lng: 77.0540 },
    { id: 'fall-23', name: 'Punjabi Bagh', centroid_lat: 28.6630, centroid_lng: 77.1270 },
    { id: 'fall-24', name: 'Karol Bagh', centroid_lat: 28.6550, centroid_lng: 77.1880 },
    { id: 'fall-25', name: 'Connaught Place', centroid_lat: 28.6315, centroid_lng: 77.2167 },
    { id: 'fall-26', name: 'Chandni Chowk', centroid_lat: 28.6600, centroid_lng: 77.2300 },
    { id: 'fall-27', name: 'Shahdara', centroid_lat: 28.6730, centroid_lng: 77.2860 },
    { id: 'fall-28', name: 'Laxmi Nagar', centroid_lat: 28.6300, centroid_lng: 77.2770 },
    { id: 'fall-29', name: 'Mayur Vihar', centroid_lat: 28.6010, centroid_lng: 77.2930 },
    { id: 'fall-30', name: 'Preet Vihar', centroid_lat: 28.6430, centroid_lng: 77.2850 },
    { id: 'fall-31', name: 'Patparganj', centroid_lat: 28.6280, centroid_lng: 77.2990 },
    { id: 'fall-32', name: 'Model Town', centroid_lat: 28.7060, centroid_lng: 77.1950 },
    { id: 'fall-33', name: 'Civil Lines', centroid_lat: 28.6760, centroid_lng: 77.2240 },
    { id: 'fall-34', name: 'Ashok Vihar', centroid_lat: 28.6940, centroid_lng: 77.1780 },
    { id: 'fall-35', name: 'Shalimar Bagh', centroid_lat: 28.7170, centroid_lng: 77.1530 },
    { id: 'fall-36', name: 'Rajendra Nagar', centroid_lat: 28.6390, centroid_lng: 77.1850 },
    { id: 'fall-37', name: 'Patel Nagar', centroid_lat: 28.6480, centroid_lng: 77.1650 },
    { id: 'fall-38', name: 'Palam', centroid_lat: 28.5880, centroid_lng: 77.0850 },
    { id: 'fall-40', name: 'Narela', centroid_lat: 28.8520, centroid_lng: 77.0940 },
    { id: 'fall-41', name: 'Bawana', centroid_lat: 28.7990, centroid_lng: 77.0420 },
    { id: 'fall-42', name: 'Sarita Vihar', centroid_lat: 28.5300, centroid_lng: 77.2900 },
    { id: 'fall-43', name: 'Badarpur', centroid_lat: 28.5000, centroid_lng: 77.3000 },
    { id: 'fall-44', name: 'Jasola', centroid_lat: 28.5350, centroid_lng: 77.2850 },
    { id: 'fall-45', name: 'Munirka', centroid_lat: 28.5560, centroid_lng: 77.1700 },
    { id: 'fall-46', name: 'RK Puram', centroid_lat: 28.5650, centroid_lng: 77.1780 },
    { id: 'fall-47', name: 'Mehrauli', centroid_lat: 28.5200, centroid_lng: 77.1800 },
    { id: 'fall-48', name: 'Chhatarpur', centroid_lat: 28.5000, centroid_lng: 77.1700 },
    { id: 'fall-49', name: 'Malviya Nagar', centroid_lat: 28.5330, centroid_lng: 77.2100 },
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
                        console.warn('[useZones] Centroid columns missing, using local neighborhood mapping fallback');
                        const res = await supabase
                            .from('zones')
                            .select('id,name')
                            .order('name');
                        if (res.error) throw res.error;

                        data = (res.data || []).map((z: { id: string; name: string }) => {
                            // 1. Precise Match
                            const match = FALLBACK_ZONES.find(f => f.name.toLowerCase() === z.name.toLowerCase());
                            if (match) {
                                return {
                                    id: z.id,
                                    name: z.name,
                                    centroid_lat: match.centroid_lat,
                                    centroid_lng: match.centroid_lng,
                                    population_density: undefined,
                                };
                            }

                            // 2. Partial Match / Fuzzy (e.g. "North West" matches "North")
                            const fuzzyMatch = FALLBACK_ZONES.find(f => z.name.toLowerCase().includes(f.name.toLowerCase()));

                            // 3. Last Resort: Jittered Center (prevents stacking)
                            const hash = z.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                            const jitterLat = (hash % 100) / 1000 - 0.05;
                            const jitterLng = (hash % 150) / 1000 - 0.075;

                            return {
                                id: z.id,
                                name: z.name,
                                centroid_lat: (fuzzyMatch?.centroid_lat ?? 28.6139) + jitterLat,
                                centroid_lng: (fuzzyMatch?.centroid_lng ?? 77.2090) + jitterLng,
                                population_density: undefined,
                            };
                        });
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
