import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { useSimulation } from '../context/SimulationContext';
import type { SimulatedAsset } from '../hooks/useSimulationEngine';

export const SimulationOverlayLayer = () => {
    const map = useMap();
    const { simulatedAssets, isActive } = useSimulation();

    // Map to track active leaflet circle instances
    const circlesRef = useRef<Map<string, L.Circle>>(new Map());
    const rafRef = useRef<number>(0);

    // Ensure pane exists
    useEffect(() => {
        if (!map.getPane("simulationPane")) {
            const pane = map.createPane("simulationPane");
            pane.style.zIndex = "460"; // above flood pane
        }
    }, [map]);

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
                        radius: 50,
                        weight: 1,
                        interactive: false
                    }).addTo(map);
                    circlesRef.current.set(asset.asset_id, circle);
                }

                // Calculate visual state
                const isFailed = asset.animationState === 'FAILED';
                const isDegraded = asset.animationState === 'DEGRADED';
                const isStressed = asset.animationState === 'STRESSED';

                // Target Base Radius based on failure propagation
                let targetRadius = Math.max(80, asset.failureProgress * 3);
                if (isFailed) targetRadius = 600; // Large fixed area for failure

                // Sinusoidal Time Interpolation (breathing / pulsing)
                const pulseTime = elapsed / 1000; // seconds
                let displayRadius = targetRadius;
                let opacity = 0.15;
                let color = '#facc15'; // Default yellow

                if (isFailed) {
                    color = '#ef4444';
                    // Failed: rapid expanding shockwave and high opacity pulse
                    const shockwaveInterval = (pulseTime % 1.5) / 1.5;
                    displayRadius = targetRadius + (Math.sin(pulseTime * 4) * 50);
                    opacity = 0.2 + (0.2 * Math.max(0, 1 - shockwaveInterval));
                    circle.setStyle({ weight: 2 });
                } else if (isDegraded) {
                    color = '#f59e0b';
                    // Degraded: steady orange breathing
                    displayRadius = targetRadius + (Math.sin(pulseTime * 2) * 30);
                    opacity = 0.2 + (Math.sin(pulseTime * 2) * 0.1);
                    circle.setStyle({ weight: 1.5 });
                } else if (isStressed) {
                    color = '#facc15';
                    // Stressed: subtle yellow wobble
                    displayRadius = targetRadius + (Math.sin(pulseTime) * 10);
                    opacity = 0.1 + (Math.sin(pulseTime) * 0.05);
                    circle.setStyle({ weight: 1 });
                }

                // Propagation Wavefront (Task 6)
                if (asset.is_source_failure) {
                    const waveTime = elapsed / 1000;
                    const waveRadius = targetRadius + (waveTime * 50); // Expand indefinitely 
                    const maxWaveRadius = 2000;
                    const constrainedWaveRadius = waveRadius % maxWaveRadius;

                    const waveOpacity = 0.3 * (1 - (constrainedWaveRadius / maxWaveRadius));

                    // We reuse the existing circle for the source, but give it an epic expanding ring style
                    // Wait, a Leaflet Circle can only have one radius.
                    // Let's create a *second* circle for the wavefront if needed, OR just utilize `pathOptions.dashArray` 
                    // To keep it clean, we'll just pulse the source asset massively.
                    displayRadius = constrainedWaveRadius;
                    opacity = Math.max(0, waveOpacity);
                    color = asset.healthState === 'FAILED' ? '#ef4444' : '#3b82f6';
                    circle.setStyle({ weight: 2, dashArray: '4, 8' });
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
