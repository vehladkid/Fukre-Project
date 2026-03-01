import { useState, useEffect, useRef, useCallback } from 'react';
import { type MapAsset } from '../../map/useMapAssets';
import { useSimulationLogs } from './useSimulationLogs';

export type SimulatedStatus = 'HEALTHY' | 'STRESSED' | 'DEGRADED' | 'FAILED';

export interface SimulatedAsset {
    asset_id: string;
    latitude: number;
    longitude: number;
    original_risk: string;
    original_health: number;
    simulated_status: SimulatedStatus;
    stress_score: number;
    propagation_level: number;
    last_updated_sim_time: number;
    healthState: string;
    failureProgress: number;
    animationState: string;
    failedAt: number | null;
    is_source_failure?: boolean;
}

export interface TimelineEvent {
    id: string;
    timestamp: number;
    message: string;
    type: 'FAILURE' | 'FLOOD' | 'WARNING' | 'RECOVERY' | 'SYSTEM';
}

export interface SimulationState {
    isActive: boolean;
    isPaused: boolean;
    playbackSpeed: number;
    simTimeSeconds: number;
    formattedTime: string;
    isFloodActive: boolean;
    simulatedAssets: SimulatedAsset[];
    timeline: TimelineEvent[];
    simulatedCityHealth: number | null;
}

const DECAY_FACTOR = 0.6;
const MAX_PROCESS_PER_TICK = 25;
const MAX_ASSETS_RENDER = 400;
const CELL_SIZE_DEG = 0.01; // Approx 1km at equator

export const useSimulationEngine = (viewportAssets: MapAsset[]) => {
    const { addLog } = useSimulationLogs();

    // ─── React Render State (Throttled output) ─────────────
    const [state, setState] = useState<SimulationState>({
        isActive: false,
        isPaused: false,
        playbackSpeed: 1,
        simTimeSeconds: 0,
        formattedTime: "T+00:00:00",
        isFloodActive: false,
        simulatedAssets: [],
        timeline: [],
        simulatedCityHealth: null
    });

    // ─── High-Performance Simulation Refs (No re-renders) ──
    const simActiveRef = useRef(false);
    const simPausedRef = useRef(false);
    const simStartRef = useRef(0);
    const speedRef = useRef(1);
    const simTimeRef = useRef(0);
    const lastSecondRef = useRef(0);
    const floodActiveRef = useRef(false);
    const floodRadiusRef = useRef(0);

    // Active simulated overrides
    const activeMutationsRef = useRef<Map<string, SimulatedAsset>>(new Map());

    // Wavefront queue for propagating stress (MAX 25 per tick)
    const propagationQueueRef = useRef<Set<string>>(new Set());
    const timelineRef = useRef<TimelineEvent[]>([]);

    // Animation Loop refs
    const requestRef = useRef<number>(0);
    const lastFrameRealMsRef = useRef<number>(0);
    const lastRenderRealMsRef = useRef<number>(0);

    // ─── Spatial Grid Index O(N) ───────────────────────────
    const getCellKey = (lat: number, lng: number) => {
        return `${Math.floor(lat / CELL_SIZE_DEG)}_${Math.floor(lng / CELL_SIZE_DEG)}`;
    };

    const getNeighborCells = (cellKey: string) => {
        const [latStr, lngStr] = cellKey.split('_');
        const lat = parseInt(latStr);
        const lng = parseInt(lngStr);

        return [
            cellKey, // Center
            `${lat + 1}_${lng}`, `${lat - 1}_${lng}`, // N, S
            `${lat}_${lng + 1}`, `${lat}_${lng - 1}`, // E, W
            `${lat + 1}_${lng + 1}`, `${lat + 1}_${lng - 1}`, // NE, NW
            `${lat - 1}_${lng + 1}`, `${lat - 1}_${lng - 1}` // SE, SW
        ];
    };

    // Calculate straight-line distance roughly (Pythagoras on degrees is fine for < 2km)
    const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const dx = lat1 - lat2;
        const dy = lon1 - lon2;
        // Rough conversion: 1 deg ~ 111km
        return Math.sqrt(dx * dx + dy * dy) * 111000;
    };

    // ─── Engine Tick Logic ─────────────────────────────────
    const processTick = useCallback((nowRealMs: number, simDeltaSec: number) => {
        if (!simActiveRef.current) return;

        // Advance simulation clock
        simTimeRef.current += simDeltaSec;

        // Expand Flood linearly (velocity: ~10 meters per simulation second)
        if (floodActiveRef.current) {
            floodRadiusRef.current += (10 * simDeltaSec);
        }

        const mutations = activeMutationsRef.current;
        if (mutations.size === 0 && !floodActiveRef.current) return; // Nothing actively degrading

        // 1. Build Spatial Grid of current viewport
        const grid = new Map<string, MapAsset[]>();
        const processingAssets = viewportAssets.slice(0, MAX_ASSETS_RENDER);

        for (const asset of processingAssets) {
            const cell = getCellKey(asset.latitude, asset.longitude);
            if (!grid.has(cell)) grid.set(cell, []);
            grid.get(cell)!.push(asset);
        }

        // 2. Process active sources and propagate (Queue-based, Max 25 per tick)
        const newMutations = new Map<string, SimulatedAsset>(mutations);
        const newEvents: TimelineEvent[] = [];
        let totalHealth = 0;
        const healthAssetsCount = processingAssets.length;

        // Extract items from propagation queue
        const queueSize = Math.min(propagationQueueRef.current.size, MAX_PROCESS_PER_TICK);
        const processingQueueIdList = Array.from(propagationQueueRef.current).slice(0, queueSize);
        processingQueueIdList.forEach(id => propagationQueueRef.current.delete(id));

        const floodMultiplier = floodActiveRef.current ? 2.5 : 1.0;

        for (const sourceId of processingQueueIdList) {
            const source = mutations.get(sourceId);
            if (!source || (source.simulated_status !== 'FAILED' && source.simulated_status !== 'DEGRADED')) continue;

            const baseCell = getCellKey(source.latitude, source.longitude);
            const searchCells = getNeighborCells(baseCell);

            // Influence radius 
            const propagationRadius = 800;

            for (const cell of searchCells) {
                const neighbors = grid.get(cell) || [];
                for (const neighbor of neighbors) {
                    if (neighbor.id === source.asset_id) continue;

                    const dist = getDistance(
                        source.latitude, source.longitude,
                        neighbor.latitude, neighbor.longitude
                    );

                    if (dist < propagationRadius) {
                        // Population density factor (assuming 1 if missing)
                        const populationFactor = 1.0;

                        // Inverse distance logic. As distance goes to propagationRadius, intensity approaches 0
                        const intensity = source.stress_score * (1 - (dist / propagationRadius));

                        // Stress accumulates over time (simDeltaSec)
                        const addedStress = intensity * DECAY_FACTOR * floodMultiplier * populationFactor * simDeltaSec * 0.1;

                        if (addedStress > 0.1) {
                            const existing = newMutations.get(neighbor.id);
                            const currentStress = existing ? existing.stress_score : 0;
                            const nextStress = Math.min(100, currentStress + addedStress);

                            let nextStatus: SimulatedStatus = 'HEALTHY';
                            if (nextStress > 90) nextStatus = 'FAILED';
                            else if (nextStress > 70) nextStatus = 'DEGRADED';
                            else if (nextStress > 40) nextStatus = 'STRESSED';

                            const previousStatus = existing?.simulated_status || 'HEALTHY';

                            if (nextStatus !== 'HEALTHY') {
                                // Re-queue neighbor if it has escalated to DEGRADED or FAILED
                                if (nextStatus === 'FAILED' || nextStatus === 'DEGRADED') {
                                    propagationQueueRef.current.add(neighbor.id);
                                }

                                if (previousStatus !== nextStatus) {
                                    if (nextStatus === 'FAILED') {
                                        newEvents.push({
                                            id: Math.random().toString(),
                                            timestamp: nowRealMs,
                                            message: `Cascade: Asset ${neighbor.name || neighbor.id} failed`,
                                            type: 'FAILURE'
                                        });
                                        addLog({
                                            event_type: 'FAILED',
                                            message: `Asset ${neighbor.name} failed due to cascading stress`,
                                            severity: 'critical'
                                        });
                                    } else if (nextStatus === 'DEGRADED') {
                                        addLog({
                                            event_type: 'DEGRADED',
                                            message: `Asset ${neighbor.name} performance critically degraded`,
                                            severity: 'high'
                                        });
                                    } else if (nextStatus === 'STRESSED') {
                                        addLog({
                                            event_type: 'STRESSED',
                                            message: `Asset ${neighbor.name} beginning to experience cascade stress`,
                                            severity: 'medium'
                                        });
                                    }
                                }

                                newMutations.set(neighbor.id, {
                                    asset_id: neighbor.id,
                                    latitude: neighbor.latitude,
                                    longitude: neighbor.longitude,
                                    original_risk: neighbor.risk_level,
                                    original_health: neighbor.health_score,
                                    simulated_status: nextStatus,
                                    stress_score: nextStress,
                                    propagation_level: (existing?.propagation_level || 0) + 1,
                                    last_updated_sim_time: simTimeRef.current,
                                    healthState: nextStatus,
                                    failureProgress: nextStress,
                                    animationState: nextStatus,
                                    failedAt: nextStatus === 'FAILED' ? simTimeRef.current : null
                                });
                            }
                        }
                    }
                }
            }
        }

        // 3. Flood Independent Processing
        if (floodActiveRef.current) {
            // Very simplified: assuming flood originates from map center and expands
            // Better to track zone centroids, but for simulation radius we just affect assets globally
            for (const asset of processingAssets) {
                const existing = newMutations.get(asset.id);
                // The flood radius sweeps out across the map.
                // We'll just add ambient stress to everyone under the flood radius for simplicity,
                // scaled by how long the flood has been active.
                const addedStress = (2.5 * simDeltaSec);
                const currentStress = existing ? existing.stress_score : 0;
                const nextStress = Math.min(100, currentStress + addedStress);

                let nextStatus: SimulatedStatus = 'HEALTHY';
                if (nextStress > 90) nextStatus = 'FAILED';
                else if (nextStress > 70) nextStatus = 'DEGRADED';
                else if (nextStress > 40) nextStatus = 'STRESSED';

                const previousStatus = existing?.simulated_status || 'HEALTHY';

                if (nextStatus !== 'HEALTHY') {
                    // Flood stress makes assets susceptible to cascading
                    if (nextStatus === 'FAILED' || nextStatus === 'DEGRADED') {
                        propagationQueueRef.current.add(asset.id);
                    }

                    if (previousStatus !== nextStatus && nextStatus === 'FAILED') {
                        addLog({
                            event_type: 'FAILED',
                            message: `Flood breach localized at ${asset.name}`,
                            severity: 'critical'
                        });
                    }

                    newMutations.set(asset.id, {
                        asset_id: asset.id,
                        latitude: asset.latitude,
                        longitude: asset.longitude,
                        original_risk: asset.risk_level,
                        original_health: asset.health_score,
                        simulated_status: nextStatus,
                        stress_score: nextStress,
                        propagation_level: (existing?.propagation_level || 0),
                        last_updated_sim_time: simTimeRef.current,
                        healthState: nextStatus,
                        failureProgress: nextStress,
                        animationState: nextStatus,
                        failedAt: nextStatus === 'FAILED' ? simTimeRef.current : null
                    });
                }
            }
        }

        // Calculate aggregated health
        for (const asset of processingAssets) {
            const sim = newMutations.get(asset.id);
            if (sim) {
                // FAILED = 0 health, otherwise scale down original health
                const simulatedHealth = sim.simulated_status === 'FAILED' ? 0 : Math.max(0, asset.health_score - (sim.stress_score * 0.5));
                totalHealth += simulatedHealth;
            } else {
                totalHealth += asset.health_score;
            }
        }

        // Commit active state
        activeMutationsRef.current = newMutations;

        if (newEvents.length > 0) {
            timelineRef.current = [...newEvents, ...timelineRef.current].slice(0, 20);
        }

        // 4. Time formatting
        const fmtTime = (secs: number) => {
            const h = Math.floor(secs / 3600).toString().padStart(2, '0');
            const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
            const s = Math.floor(secs % 60).toString().padStart(2, '0');
            return `T+${h}:${m}:${s}`;
        };

        // 5. React Render Throttling (Updates at 1 FPS exactly)
        const currentSecond = Math.floor(simTimeRef.current);
        if (currentSecond > lastSecondRef.current) {
            const simulatedCityHealth = healthAssetsCount > 0 ? Math.round(totalHealth / healthAssetsCount) : null;

            setState(prev => ({
                ...prev,
                simTimeSeconds: currentSecond,
                formattedTime: fmtTime(currentSecond),
                simulatedAssets: Array.from(newMutations.values()),
                timeline: timelineRef.current,
                simulatedCityHealth
            }));

            lastSecondRef.current = currentSecond;
        }

    }, [viewportAssets, addLog]);

    // ─── Animation Frame Loop ──────────────────────────────
    const tick = useCallback(function tickFn() {
        if (!simActiveRef.current) {
            requestRef.current = requestAnimationFrame(tickFn);
            return;
        }

        const now = Date.now();
        if (lastFrameRealMsRef.current === 0) lastFrameRealMsRef.current = now;

        const realDeltaMs = now - lastFrameRealMsRef.current;
        lastFrameRealMsRef.current = now;

        if (!simPausedRef.current) {
            const simDeltaSec = (realDeltaMs / 1000) * speedRef.current;
            processTick(now, simDeltaSec);
        }

        requestRef.current = requestAnimationFrame(tickFn);
    }, [processTick]);

    useEffect(() => {
        requestRef.current = requestAnimationFrame(tick);
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [tick]);

    // ─── Control APIs ──────────────────────────────────────
    const toggleSimulation = useCallback(() => {
        simActiveRef.current = !simActiveRef.current;

        if (simActiveRef.current) {
            timelineRef.current = [{
                id: Math.random().toString(),
                timestamp: Date.now(),
                message: 'Digital Twin Simulation Initialized',
                type: 'SYSTEM'
            }];
        }

        setState(prev => ({
            ...prev,
            isActive: simActiveRef.current,
            timeline: timelineRef.current
        }));
    }, []);

    const togglePause = useCallback(() => {
        simPausedRef.current = !simPausedRef.current;
        setState(p => ({ ...p, isPaused: simPausedRef.current }));
    }, []);

    const setSpeed = useCallback((multiplier: number) => {
        speedRef.current = multiplier;
        setState(p => ({ ...p, playbackSpeed: multiplier }));
    }, []);

    const simulationOriginRef = useRef<{ lat: number, lng: number } | null>(null);

    const triggerEvent = useCallback((type: 'INFRASTRUCTURE_FAILURE' | 'FLASH_FLOOD', zone: { id: string; name: string; centroid_lat: number; centroid_lng: number }, intensity: number) => {

        simulationOriginRef.current = { lat: zone.centroid_lat, lng: zone.centroid_lng };

        if (type === 'FLASH_FLOOD') {
            floodActiveRef.current = true;
            floodRadiusRef.current = 100 * intensity;

            const floodOriginId = 'SIM_FLOOD_ORIGIN_' + zone.id;
            activeMutationsRef.current.set(floodOriginId, {
                asset_id: floodOriginId,
                latitude: zone.centroid_lat,
                longitude: zone.centroid_lng,
                original_risk: 'HIGH',
                original_health: 100,
                simulated_status: 'FAILED',
                stress_score: 100,
                propagation_level: 0,
                last_updated_sim_time: simTimeRef.current,
                healthState: 'FAILED',
                failureProgress: 100,
                animationState: 'FAILED',
                failedAt: simTimeRef.current,
                is_source_failure: true
            });
            propagationQueueRef.current.add(floodOriginId);

            const newEvent: TimelineEvent = {
                id: Math.random().toString(),
                timestamp: Date.now(),
                message: `Urban Flash Flood warning at ${zone.name} (Cat ${intensity})`,
                type: 'FLOOD'
            };
            timelineRef.current = [newEvent, ...timelineRef.current].slice(0, 20);

            addLog({ event_type: 'FLOOD', message: `Flash Flood initiated at ${zone.name} — Intensity ${intensity}`, severity: 'critical' });

            setState(prev => ({
                ...prev,
                isFloodActive: true,
                timeline: timelineRef.current
            }));
            return;
        }

        // Infrastructure cascade starts at the centroid
        const originId = 'SIM_CASCADE_ORIGIN_' + zone.id;
        activeMutationsRef.current.set(originId, {
            asset_id: originId,
            latitude: zone.centroid_lat,
            longitude: zone.centroid_lng,
            original_risk: 'CRITICAL',
            original_health: 100,
            simulated_status: 'FAILED',
            stress_score: 100,
            propagation_level: 0,
            last_updated_sim_time: simTimeRef.current,
            healthState: 'FAILED',
            failureProgress: 100,
            animationState: 'FAILED',
            failedAt: simTimeRef.current,
            is_source_failure: true
        });

        propagationQueueRef.current.add(originId);

        const newEvent: TimelineEvent = {
            id: Math.random().toString(),
            timestamp: Date.now(),
            message: `CRITICAL: Failure Cascade Initiated at ${zone.name}`,
            type: 'FAILURE'
        };

        timelineRef.current = [newEvent, ...timelineRef.current].slice(0, 20);
        addLog({ event_type: 'FAILED', message: `Infrastructure cascade initiated at ${zone.name} — Intensity ${intensity}`, severity: 'critical' });

        setState(prev => ({
            ...prev,
            simulatedAssets: Array.from(activeMutationsRef.current.values()),
            timeline: timelineRef.current
        }));
    }, [addLog]);

    const resetSimulation = useCallback(() => {
        simActiveRef.current = false;
        simPausedRef.current = false;
        simStartRef.current = 0;
        speedRef.current = 1;
        simTimeRef.current = 0;
        lastSecondRef.current = 0;
        floodActiveRef.current = false;
        floodRadiusRef.current = 0;
        lastFrameRealMsRef.current = 0;
        lastRenderRealMsRef.current = 0;

        activeMutationsRef.current.clear();
        propagationQueueRef.current.clear();
        timelineRef.current = [];

        setState({
            isActive: false,
            isPaused: false,
            playbackSpeed: 1,
            simTimeSeconds: 0,
            formattedTime: "T+00:00:00",
            isFloodActive: false,
            simulatedAssets: [],
            timeline: [],
            simulatedCityHealth: null
        });
    }, []);

    // ─── Atomic Start: activates engine + triggers event with full zone object ────
    const startSimulation = useCallback((type: 'INFRASTRUCTURE_FAILURE' | 'FLASH_FLOOD', zone: { id: string; name: string; centroid_lat: number; centroid_lng: number }, intensity: number) => {
        // Reset + activate engine
        simActiveRef.current = true;
        simPausedRef.current = false;
        simTimeRef.current = 0;
        lastSecondRef.current = 0;
        lastFrameRealMsRef.current = 0;
        lastRenderRealMsRef.current = 0;
        floodActiveRef.current = false;
        floodRadiusRef.current = 0;
        activeMutationsRef.current.clear();
        propagationQueueRef.current.clear();

        timelineRef.current = [{
            id: Math.random().toString(),
            timestamp: Date.now(),
            message: 'Digital Twin Simulation Initialized',
            type: 'SYSTEM'
        }];

        setState(prev => ({
            ...prev,
            isActive: true,
            isPaused: false,
            simTimeSeconds: 0,
            formattedTime: 'T+00:00:00',
            simulatedAssets: [],
            isFloodActive: false,
            timeline: timelineRef.current
        }));

        // Trigger event immediately — zone data is passed directly, no async lookup needed
        triggerEvent(type, zone, intensity);
    }, [triggerEvent]);

    const stopSimulation = useCallback(() => {
        simActiveRef.current = false;
        setState(prev => ({ ...prev, isActive: false, isPaused: false }));
    }, []);

    return {
        ...state,
        toggleSimulation,
        togglePause,
        setSpeed,
        triggerEvent,
        startSimulation,
        stopSimulation,
        resetSimulation
    };
};
