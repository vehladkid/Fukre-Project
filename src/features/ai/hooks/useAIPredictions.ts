import { useMemo, useRef, useState, useEffect } from 'react';
import { type MapAsset } from '../../map/useMapAssets';

export interface AIPrediction {
    id: string; // Asset ID
    name: string;
    score: number;
    timeline: string;
    confidence: number;
    latitude: number;
    longitude: number;
    category: string;
}

export interface AIOverlayCluster {
    id: string;
    latitude: number;
    longitude: number;
    assetCount: number;
    avgHealth: number;
    avgRiskRaw: number; // 0=LOW, 1=MEDIUM, 2=HIGH
    trafficWeight: number; // count of roads/bridges
}

export const useAIPredictions = (viewportAssets: MapAsset[], zoom: number) => {
    const previousScoreRef = useRef<Map<string, number>>(new Map());
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastHashRef = useRef<string>('');
    const lastComputeTimeRef = useRef<number>(0);

    const [stablePredictions, setStablePredictions] = useState<AIPrediction[]>([]);
    const [stableClusters, setStableClusters] = useState<AIOverlayCluster[]>([]);

    useEffect(() => {
        // STEP 1: SAFE COMPUTATION WINDOW
        const currentHash = viewportAssets.length + '_' + (viewportAssets[0]?.id || '') + '_' + zoom;
        const nowMs = Date.now();

        if (currentHash === lastHashRef.current) return;

        // Debounce calculation
        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(() => {
            if (nowMs - lastComputeTimeRef.current < 500 && lastComputeTimeRef.current !== 0) {
                return; // Respect 500ms safety window
            }

            // --- SPATIAL GRID AGGREGATION ---
            let gridSize = 0.05;
            if (zoom >= 10 && zoom <= 13) gridSize = 0.02;
            else if (zoom > 13) gridSize = 0.008;

            const gridMap = new Map<string, {
                latSum: number;
                lngSum: number;
                count: number;
                healthSum: number;
                riskSum: number;
                trafficCount: number;
            }>();

            const newPredictions: AIPrediction[] = [];
            const nowTime = Date.now();

            viewportAssets.forEach(asset => {
                // STEP 2: DERIVE INSPECTION AGE
                let inspection_age_days = 30;
                if (asset.last_inspected) {
                    const inspectedTime = new Date(asset.last_inspected).getTime();
                    inspection_age_days = Math.max(0, (nowTime - inspectedTime) / 86400000);
                }

                // STEP 3: FAILURE SCORE
                const rawFailureScore = (asset.severity_level * 0.45)
                    + (inspection_age_days / 40)
                    + ((100 - asset.health_score) / 25);

                const failure_score = Math.min(10, Math.max(0, rawFailureScore));

                // STEP 6: PREDICTION STABILIZER
                let finalScore = failure_score;
                const prevScore = previousScoreRef.current.get(asset.id);
                if (prevScore !== undefined) {
                    if (failure_score <= prevScore * 1.05 && failure_score >= prevScore * 0.95) {
                        finalScore = prevScore; // keep stable
                    } else {
                        previousScoreRef.current.set(asset.id, failure_score);
                    }
                } else {
                    previousScoreRef.current.set(asset.id, failure_score);
                }

                // STEP 4: TIMELINE FORECAST
                let timeline = 'Immediate Risk';
                if (finalScore < 3) timeline = 'Stable';
                else if (finalScore < 5) timeline = '6 Months';
                else if (finalScore < 7) timeline = '3 Months';

                // STEP 5: CONFIDENCE MODEL
                const noise = Math.random() * 5;
                let confidence = 85 - (inspection_age_days * 0.15) - noise;
                confidence = Math.min(95, Math.max(60, confidence));

                // Only consider for predictions if high risk
                if (asset.risk_level === 'HIGH' || asset.severity_level >= 5 || inspection_age_days > 120) {
                    newPredictions.push({
                        id: asset.id,
                        name: asset.name,
                        latitude: asset.latitude,
                        longitude: asset.longitude,
                        score: finalScore,
                        timeline,
                        confidence,
                        category: (asset as any).category_name || 'Infrastructure' // Fallback
                    });
                }

                // Clustering logic
                const gridX = Math.floor(asset.longitude / gridSize);
                const gridY = Math.floor(asset.latitude / gridSize);
                const cellKey = `${gridX}_${gridY}`;

                let cell = gridMap.get(cellKey);
                if (!cell) {
                    cell = { latSum: 0, lngSum: 0, count: 0, healthSum: 0, riskSum: 0, trafficCount: 0 };
                    gridMap.set(cellKey, cell);
                }

                cell.latSum += asset.latitude;
                cell.lngSum += asset.longitude;
                cell.count += 1;
                cell.healthSum += asset.health_score;

                const riskVal = asset.risk_level === 'HIGH' ? 2 : asset.risk_level === 'MEDIUM' ? 1 : 0;
                cell.riskSum += riskVal;

                // Simple traffic heuristic if name mentions road/bridge/street
                const lowerName = asset.name.toLowerCase();
                if (lowerName.includes('road') || lowerName.includes('bridge') || lowerName.includes('street')) {
                    cell.trafficCount += 1;
                }
            });

            // Finalize clusters
            let clusters: AIOverlayCluster[] = [];
            gridMap.forEach((cell, key) => {
                clusters.push({
                    id: key,
                    latitude: cell.latSum / cell.count,
                    longitude: cell.lngSum / cell.count,
                    assetCount: cell.count,
                    avgHealth: cell.healthSum / cell.count,
                    avgRiskRaw: cell.riskSum / cell.count,
                    trafficWeight: cell.trafficCount
                });
            });

            // MAX 40 Overlays - sort by density
            if (clusters.length > 40) {
                clusters.sort((a, b) => b.assetCount - a.assetCount);
                clusters = clusters.slice(0, 40);
            }

            // Top 3 Predictions
            newPredictions.sort((a, b) => b.score - a.score);
            const top3 = newPredictions.slice(0, 3);

            setStablePredictions(top3);
            setStableClusters(clusters);

            lastHashRef.current = currentHash;
            lastComputeTimeRef.current = Date.now();
        }, 500);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [viewportAssets, zoom]);

    // Derived clustered categorizations
    const riskClusters = useMemo(() => {
        return stableClusters.filter(c => c.avgRiskRaw >= 0.5); // At least significant medium risk
    }, [stableClusters]);

    const densityClusters = useMemo(() => { // Flood = high density + low average health
        return stableClusters.filter(c => c.assetCount > 5 && c.avgHealth < 70);
    }, [stableClusters]);

    const trafficClusters = useMemo(() => {
        return stableClusters.filter(c => c.trafficWeight >= 2);
    }, [stableClusters]);

    return {
        predictions: stablePredictions,
        riskClusters,
        densityClusters,
        trafficClusters
    };
};
