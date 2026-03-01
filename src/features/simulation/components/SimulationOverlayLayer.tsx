import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { useSimulation } from '../context/SimulationContext';
import type { SimulatedAsset } from '../hooks/useSimulationEngine';

export const SimulationOverlayLayer = () => {
    const map = useMap();
    const { simulatedAssets, isActive, activeZone } = useSimulation();

    // Zone highlight reference
    const zoneCircleRef = useRef<L.Circle | null>(null);
    // Map to track active leaflet circle instances for assets
    const circlesRef = useRef<Map<string, L.Circle>>(new Map());
    const rafRef = useRef<number>(0);

    // Ensure pane exists
    useEffect(() => {
        if (!map.getPane("simulationPane")) {
            const pane = map.createPane("simulationPane");
            pane.style.zIndex = "460"; // above flood pane
        }
    }, [map]);

    // Handle Zone Highlight
    useEffect(() => {
        if (!isActive || !activeZone) {
            if (zoneCircleRef.current) {
                map.removeLayer(zoneCircleRef.current);
                zoneCircleRef.current = null;
            }
            return;
        }

        if (!zoneCircleRef.current) {
            zoneCircleRef.current = L.circle([activeZone.centroid_lat, activeZone.centroid_lng], {
                pane: 'simulationPane',
                radius: 1200, // 1.2km static highlight
                color: '#ef4444',
                fillColor: '#ef4444',
                fillOpacity: 0.15,
                weight: 1,
                dashArray: '5, 10',
                interactive: false
            }).addTo(map);
        } else {
            zoneCircleRef.current.setLatLng([activeZone.centroid_lat, activeZone.centroid_lng]);
        }
    }, [isActive, activeZone, map]);

    // Cleanup unmounted assets
    useEffect(() => {
        if (!isActive) {
            circlesRef.current.forEach(c => map.removeLayer(c));
            circlesRef.current.clear();
            return;
        }

        const validIds = new Set(simulatedAssets.map(a => a.asset_id));

        circlesRef.current.forEach((circle, id) => {
            if (!validIds.has(id)) {
                map.removeLayer(circle);
                circlesRef.current.delete(id);
            }
        });

    }, [simulatedAssets, isActive, map]);

    // High performance animation loop
    useEffect(() => {
        if (!isActive) return;

        let startTimestamp: number | null = null;

        const animate = (timestamp: number) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const elapsed = timestamp - startTimestamp;

            simulatedAssets.forEach((asset: SimulatedAsset) => {
                let circle = circlesRef.current.get(asset.asset_id);

                if (!circle) {
                    circle = L.circle([asset.latitude, asset.longitude], {
                        pane: 'simulationPane',
                        radius: 80,
                        weight: 2,
                        interactive: false
                    }).addTo(map);
                    circlesRef.current.set(asset.asset_id, circle);
                }

                // Calculate visual state
                const isFailed = asset.animationState === 'FAILED';
                const isDegraded = asset.animationState === 'DEGRADED';

                // Target Base Radius
                let targetRadius = Math.max(100, asset.failureProgress * 4);
                if (isFailed) targetRadius = 250;

                // Pulse Logic
                const pulseTime = elapsed / 1000;
                let displayRadius = targetRadius;
                let opacity = 0.4;
                let color = '#facc15';

                if (isFailed) {
                    color = '#ff0000';
                    const pulse = Math.sin(pulseTime * 6) * 40;
                    displayRadius = targetRadius + pulse;
                    opacity = 0.5 + (Math.sin(pulseTime * 6) * 0.2);
                    circle.setStyle({ weight: 3 });
                } else if (isDegraded) {
                    color = '#f97316';
                    displayRadius = targetRadius + (Math.sin(pulseTime * 3) * 20);
                    opacity = 0.3 + (Math.sin(pulseTime * 3) * 0.1);
                    circle.setStyle({ weight: 2 });
                } else {
                    displayRadius = targetRadius + (Math.sin(pulseTime) * 10);
                    opacity = 0.2 + (Math.sin(pulseTime) * 0.05);
                }

                // Source Failure Highlight (Expanding Shockwave)
                if (asset.is_source_failure) {
                    const wave = (pulseTime % 2) / 2; // 2s cycle
                    displayRadius = targetRadius + (wave * 800);
                    opacity = 0.6 * (1 - wave);
                    color = '#ef4444';
                    circle.setStyle({ weight: 4, dashArray: '10, 20' });
                }

                circle.setRadius(displayRadius);
                circle.setStyle({ color, fillColor: color, fillOpacity: opacity });
            });

            rafRef.current = requestAnimationFrame(animate);
        };

        rafRef.current = requestAnimationFrame(animate);

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [simulatedAssets, isActive, map]);

    return null; // Purely DOM node manipulation
};

export default SimulationOverlayLayer;
