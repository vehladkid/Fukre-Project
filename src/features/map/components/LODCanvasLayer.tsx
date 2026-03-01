import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import { type LODPoint, type LODMode } from '../hooks/useLODAssets';

interface LODCanvasLayerProps {
    points: LODPoint[];
    mode: LODMode;
    onClickAsset?: (id: string) => void;
}

// ─── Status animation state (module-level, stable) ──────────────────────────
// We drive a simple breathing cycle for critical/maintenance assets
// purely via requestAnimationFrame — zero React involvement.
let animFrame = 0;
let animT = 0;

// ─── LOD Canvas Layer ────────────────────────────────────────────────────────
// Renders all points onto a single Leaflet canvas layer.
// ZERO React JSX markers. All drawing is imperative Leaflet canvas API.
// Points update via useEffect — canvas clears and redraws entirely.
// This is the same pattern used by deck.gl / Mapbox GL overlays.

export function LODCanvasLayer({ points, mode, onClickAsset }: LODCanvasLayerProps) {
    const map = useMap();
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const rafRef = useRef<number | null>(null);

    // Stable ref to latest points (avoid closure stale state in RAF)
    const pointsRef = useRef<LODPoint[]>(points);
    const modeRef = useRef<LODMode>(mode);
    pointsRef.current = points;
    modeRef.current = mode;

    // ── Draw function — pure canvas painting ────────────────────────────────
    const draw = (t: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const { width, height } = canvas;
        ctx.clearRect(0, 0, width, height);

        // Breathing factor for animated markers (0→1→0 cycle)
        const breathe = (Math.sin(t / 600) + 1) / 2; // 0..1
        const currentMode = modeRef.current;

        pointsRef.current.forEach(pt => {
            const latlng = L.latLng(pt.lat, pt.lng);
            let pixel: L.Point;
            try {
                pixel = map.latLngToContainerPoint(latlng);
            } catch {
                return; // map not ready
            }

            const { x, y } = pixel;

            // Skip off-canvas points (bounds check)
            if (x < -20 || y < -20 || x > width + 20 || y > height + 20) return;

            const baseRadius = pt.radius;
            let glow = 0;

            // Animate critical assets
            const isAnimated = pt.color === '#ef4444' || pt.color === '#f59e0b';
            if (isAnimated) {
                glow = breathe * baseRadius * 0.6;
            }

            const drawRadius = baseRadius + (isAnimated ? breathe * 1.5 : 0);

            // ── Glow ring (for animated states) ───────────────────────────
            if (glow > 0) {
                const grd = ctx.createRadialGradient(x, y, drawRadius * 0.5, x, y, drawRadius + glow + 4);
                grd.addColorStop(0, pt.color + 'aa');
                grd.addColorStop(1, pt.color + '00');
                ctx.beginPath();
                ctx.arc(x, y, drawRadius + glow + 4, 0, Math.PI * 2);
                ctx.fillStyle = grd;
                ctx.fill();
            }

            // ── Main dot ──────────────────────────────────────────────────
            ctx.beginPath();
            ctx.arc(x, y, drawRadius, 0, Math.PI * 2);
            ctx.fillStyle = pt.color + Math.round(pt.opacity * 255).toString(16).padStart(2, '0');
            ctx.fill();

            // ── Stroke (aggregate clusters/district get outline) ──────────
            if (pt.count > 1 || currentMode !== 'street') {
                ctx.strokeStyle = pt.color;
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }

            // ── Count label (district + city aggregates) ──────────────────
            if (pt.label && currentMode !== 'street') {
                ctx.font = `bold ${Math.max(9, Math.min(12, drawRadius + 2))}px Inter, sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#ffffff';
                ctx.shadowColor = pt.color;
                ctx.shadowBlur = 4;
                ctx.fillText(pt.label, x, y);
                ctx.shadowBlur = 0;
            }
        });
    };

    // ── Animation loop ──────────────────────────────────────────────────────
    const startRAF = () => {
        const loop = (t: number) => {
            animT = t;
            draw(t);
            animFrame = requestAnimationFrame(loop);
            rafRef.current = animFrame;
        };
        rafRef.current = requestAnimationFrame(loop);
    };

    const stopRAF = () => {
        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
    };

    // ── Canvas setup — mount once, never recreate ───────────────────────────
    useEffect(() => {
        const container = map.getContainer();

        // Inject canvas as an absolutely-positioned sibling to Leaflet panes
        const canvas = document.createElement('canvas');
        canvas.style.cssText = `
            position: absolute;
            top: 0; left: 0;
            width: 100%; height: 100%;
            pointer-events: none;
            z-index: 450;
            opacity: 1;
        `;
        canvasRef.current = canvas;

        const resize = () => {
            const { clientWidth: w, clientHeight: h } = container;
            const dpr = window.devicePixelRatio || 1;
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            canvas.style.width = w + 'px';
            canvas.style.height = h + 'px';
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };

        resize();
        container.appendChild(canvas);

        // Redraw on every map repaint (move, zoom)
        const redraw = () => draw(animT);
        map.on('moveend', redraw);
        map.on('zoomend', redraw);
        map.on('move', redraw);
        map.on('zoom', redraw);

        const resizeObs = new ResizeObserver(resize);
        resizeObs.observe(container);

        startRAF();

        return () => {
            stopRAF();
            map.off('moveend', redraw);
            map.off('zoomend', redraw);
            map.off('move', redraw);
            map.off('zoom', redraw);
            resizeObs.disconnect();
            canvas.remove();
            canvasRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map]);

    // ── Click handler — hit-test against points ──────────────────────────────
    useEffect(() => {
        if (!onClickAsset) return;

        const handleClick = (e: L.LeafletMouseEvent) => {
            const clickPt = map.latLngToContainerPoint(e.latlng);
            let hit: string | null = null;
            let minDist = Infinity;

            pointsRef.current.forEach(pt => {
                if (pt.count > 1) return; // only individual assets clickable
                try {
                    const ptPx = map.latLngToContainerPoint(L.latLng(pt.lat, pt.lng));
                    const d = Math.hypot(clickPt.x - ptPx.x, clickPt.y - ptPx.y);
                    if (d <= pt.radius + 4 && d < minDist) {
                        minDist = d;
                        hit = pt.id;
                    }
                } catch { /* map not ready */ }
            });

            if (hit) onClickAsset(hit);
        };

        map.on('click', handleClick);
        return () => { map.off('click', handleClick); };
    }, [map, onClickAsset]);

    // ── Trigger redraw whenever points change ────────────────────────────────
    // RAF loop already runs continuously — pointsRef.current is always fresh.
    // Nothing extra needed here; the loop picks up changes automatically.

    return null;
}

export default LODCanvasLayer;
