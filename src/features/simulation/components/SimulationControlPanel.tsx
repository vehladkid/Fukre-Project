/**
 * SimulationControlPanel.tsx
 * Map-side launch panel + in-sandbox runtime controls.
 *
 * In MapView: shows pre-launch configuration. ACTIVATE ENGINE navigates to /simulation.
 * In Sandbox: shows runtime controls (Pause, Speed, Shutdown, inject more events).
 */
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Play, Pause, Square, AlertTriangle, Droplets, RotateCcw,
    GripHorizontal, ChevronDown, ChevronUp, FastForward, Navigation, Check
} from 'lucide-react';
import { useSimulation } from '../context/SimulationContext';
import { useZones } from '../hooks/useZones';

// ─── Custom Zone Dropdown — uses React Portal to escape backdrop-filter stacking context ─
interface ZoneDropdownProps {
    zones: { id: string; name: string }[];
    loading: boolean;
    selectedZoneId: string;
    onSelect: (id: string) => void;
    placeholder?: string;
}

const ZoneDropdown = ({ zones, loading, selectedZoneId, onSelect, placeholder = 'Select a zone...' }: ZoneDropdownProps) => {
    const [open, setOpen] = useState(false);
    const [rect, setRect] = useState<DOMRect | null>(null);
    const btnRef = useRef<HTMLButtonElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const selectedZone = zones.find(z => z.id === selectedZoneId);

    // Close when clicking outside
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (
                btnRef.current && !btnRef.current.contains(e.target as Node) &&
                listRef.current && !listRef.current.contains(e.target as Node)
            ) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const handleOpen = () => {
        if (btnRef.current) {
            setRect(btnRef.current.getBoundingClientRect());
        }
        setOpen(prev => !prev);
    };

    // Dropdown portal content
    const dropdownPortal = open && rect && createPortal(
        <div
            ref={listRef}
            style={{
                position: 'fixed',
                top: rect.bottom + 8,
                left: rect.left,
                width: rect.width,
                zIndex: 2147483647, // max int, beats everything
            }}
            className="bg-[#0f2444] border border-[#2d4a7a] rounded-xl shadow-2xl overflow-y-auto max-h-48"
        >
            {loading && zones.length === 0 ? (
                <div className="px-3 py-3 text-sm text-slate-400 italic">Loading zones...</div>
            ) : zones.length === 0 ? (
                <div className="px-3 py-3 text-sm text-slate-400 italic">No zones available</div>
            ) : (
                zones.map(zone => (
                    <button
                        key={zone.id}
                        type="button"
                        onMouseDown={(e) => {
                            e.preventDefault(); // prevent blur before select
                            onSelect(zone.id);
                            setOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 text-sm text-left transition-colors
                            ${zone.id === selectedZoneId
                                ? 'text-teal-400 bg-teal-500/10'
                                : 'text-slate-300 hover:bg-white/5 hover:text-white'
                            }`}
                    >
                        {zone.name}
                        {zone.id === selectedZoneId && <Check size={13} className="text-teal-400 shrink-0" />}
                    </button>
                ))
            )}
        </div>,
        document.body
    );

    return (
        <div className="relative w-full">
            <button
                ref={btnRef}
                type="button"
                onClick={handleOpen}
                className="w-full flex items-center gap-2 bg-[#112240] border border-[#233554] hover:border-blue-500/50 text-slate-200 text-sm rounded-lg px-3 py-2.5 transition-colors"
            >
                <Navigation size={14} className="text-slate-500 shrink-0" />
                <span className="flex-1 text-left truncate">
                    {loading && zones.length === 0 ? 'Loading zones...' : (selectedZone?.name ?? placeholder)}
                </span>
                <ChevronDown size={14} className={`text-slate-400 shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
            </button>
            {dropdownPortal}
        </div>
    );
};

// ─── Main panel ───────────────────────────────────────────────────────────────
export const SimulationControlPanel = () => {
    const {
        isActive,
        isPaused,
        playbackSpeed,
        formattedTime,
        togglePause,
        setSpeed,
        triggerEvent,
        startSimulation,
        resetSimulation,
        stopSimulation,
    } = useSimulation();

    const [isExpanded, setIsExpanded] = useState(true);
    const [selectedZoneId, setSelectedZoneId] = useState<string>('');
    const [selectedEvent, setSelectedEvent] = useState<'INFRASTRUCTURE_FAILURE' | 'FLASH_FLOOD'>('INFRASTRUCTURE_FAILURE');
    const [intensity, setIntensity] = useState<number>(3);

    const { zones, loading } = useZones();

    const navigate = useNavigate();
    const location = useLocation();
    const isSandbox = location.pathname.includes('/simulation');

    // ACTIVATE ENGINE
    const handleActivate = () => {
        console.log('[SimPanel] handleActivate CLICKED');
        console.log('[SimPanel] selectedZoneId:', selectedZoneId);

        if (!selectedZoneId) {
            console.error('[SimPanel] No selectedZoneId found');
            return;
        }

        const selectedZone = zones.find(z => z.id === selectedZoneId) ?? null;
        console.log('[SimPanel] found zone object:', selectedZone, 'isSandbox:', isSandbox, 'isActive:', isActive);

        if (!selectedZone) {
            console.error('[SimPanel] Zone object not found in data!');
            return;
        }

        if (!isSandbox) {
            console.log('[SimPanel] Initiating navigation to /simulation');

            // Store state for secondary lookup
            sessionStorage.setItem('sim_launch_state', JSON.stringify({
                zone: selectedZone,
                eventType: selectedEvent,
                intensity,
            }));

            // Try router navigate first
            navigate('/simulation', {
                state: { zone: selectedZone, eventType: selectedEvent, intensity }
            });

            // Fallback: If we're still here after a short delay, try window.location
            setTimeout(() => {
                if (window.location.pathname !== '/simulation') {
                    console.log('[SimPanel] Router navigate failed to switch path, using window.location.href');
                    window.location.href = '/simulation';
                }
            }, 5000); // 5 sec is safer
        } else {
            if (!isActive) {
                console.log('[SimPanel] Sandbox mode: starting simulation');
                startSimulation(selectedEvent, selectedZone, intensity);
            } else {
                console.log('[SimPanel] Sandbox mode: triggering event');
                triggerEvent(selectedEvent, selectedZone, intensity);
            }
        }
    };

    const handleShutdown = () => {
        stopSimulation();
        resetSimulation();
        navigate('/map');
    };

    return createPortal(
        <div className="fixed bottom-6 right-6 z-[9999999] pointer-events-auto transition-all duration-300 w-80">
            {/* Panel card — NO overflow-hidden so the dropdown can escape */}
            <div className={`bg-[#0a192f]/95 backdrop-blur-md border ${isActive ? 'border-red-500/50 shadow-[0_8px_32px_rgba(239,68,68,0.2)]' : 'border-[#233554] shadow-2xl'} rounded-xl`}>

                {/* Header */}
                <div className={`flex items-center justify-between p-3 border-b rounded-t-xl ${isActive ? 'border-red-500/30 bg-red-500/10' : 'border-[#233554] bg-[#112240]'}`}>
                    <div className="flex items-center gap-2">
                        <GripHorizontal size={14} className="text-slate-500" />
                        {isActive
                            ? <span className="text-sm font-bold text-red-400 uppercase tracking-wider flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />TWIN ACTIVE</span>
                            : <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">Digital Twin</h3>
                        }
                    </div>

                    <div className="flex items-center gap-2">
                        {isActive && (
                            <span className="text-xs font-mono font-bold text-red-400 tabular-nums">{formattedTime}</span>
                        )}
                        <button onClick={() => setIsExpanded(!isExpanded)} className="text-slate-400 hover:text-white">
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                        </button>
                    </div>
                </div>

                {/* Controls Body */}
                {isExpanded && (
                    <div className="p-4 space-y-4 rounded-b-xl">

                        {/* ─── ACTIVE STATE ───────────────── */}
                        {isActive ? (
                            <>
                                {/* Pause / Speed */}
                                <div className="flex items-center bg-[#112240] rounded-lg p-1 border border-[#233554] gap-2">
                                    <button
                                        onClick={togglePause}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-md transition-colors"
                                    >
                                        {isPaused ? <Play size={12} fill="currentColor" /> : <Pause size={12} fill="currentColor" />}
                                        {isPaused ? 'Resume' : 'Pause'}
                                    </button>
                                    <div className="flex flex-wrap gap-1 ml-auto max-w-[120px] justify-end">
                                        {[1, 10, 60, 300, 3600].map(s => (
                                            <button
                                                key={s}
                                                onClick={() => setSpeed(s)}
                                                className={`px-1.5 py-1 text-[10px] font-bold rounded border ${playbackSpeed === s ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                                            >
                                                {s >= 3600 ? '1h/s' : s >= 60 ? `${s / 60}m/s` : `${s}x`}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Inject another event */}
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Inject Event</label>
                                    <ZoneDropdown
                                        zones={zones}
                                        loading={loading}
                                        selectedZoneId={selectedZoneId}
                                        onSelect={setSelectedZoneId}
                                        placeholder="Select zone..."
                                    />

                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            onClick={() => setSelectedEvent('INFRASTRUCTURE_FAILURE')}
                                            className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs font-medium transition-colors ${selectedEvent === 'INFRASTRUCTURE_FAILURE' ? 'bg-orange-500/20 border-orange-500/50 text-orange-400' : 'bg-[#112240] border-[#233554] text-slate-400'}`}
                                        >
                                            <AlertTriangle size={14} /> Cascade
                                        </button>
                                        <button
                                            onClick={() => setSelectedEvent('FLASH_FLOOD')}
                                            className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs font-medium transition-colors ${selectedEvent === 'FLASH_FLOOD' ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-[#112240] border-[#233554] text-slate-400'}`}
                                        >
                                            <Droplets size={14} /> Flood
                                        </button>
                                    </div>

                                    <button
                                        onClick={handleActivate}
                                        disabled={selectedZoneId === ''}
                                        className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all ${selectedZoneId === '' ? 'bg-red-900/50 text-red-400/50 cursor-not-allowed' : 'bg-orange-600/80 hover:bg-orange-700 text-white'}`}
                                    >
                                        <FastForward size={14} />
                                        {selectedZoneId === '' ? 'SELECT ZONE' : 'INJECT EVENT'}
                                    </button>
                                </div>

                                {/* Shutdown */}
                                <div className="pt-2 border-t border-[#233554]">
                                    <button
                                        onClick={handleShutdown}
                                        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors"
                                    >
                                        <Square size={13} fill="currentColor" />
                                        <span className="text-sm font-bold">SHUTDOWN ENGINE</span>
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* ─── PRE-LAUNCH ─────────────────── */}
                                <div className="space-y-3">

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Origin Zone</label>
                                        <ZoneDropdown
                                            zones={zones}
                                            loading={loading}
                                            selectedZoneId={selectedZoneId}
                                            onSelect={setSelectedZoneId}
                                            placeholder="Select a zone..."
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Event Profile</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                onClick={() => setSelectedEvent('INFRASTRUCTURE_FAILURE')}
                                                className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border text-xs font-medium transition-colors ${selectedEvent === 'INFRASTRUCTURE_FAILURE' ? 'bg-orange-500/20 border-orange-500/50 text-orange-400' : 'bg-[#112240] border-[#233554] text-slate-400'}`}
                                            >
                                                <AlertTriangle size={16} /> Cascade
                                            </button>
                                            <button
                                                onClick={() => setSelectedEvent('FLASH_FLOOD')}
                                                className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border text-xs font-medium transition-colors ${selectedEvent === 'FLASH_FLOOD' ? 'bg-blue-500/20 border-blue-500/50 text-blue-400' : 'bg-[#112240] border-[#233554] text-slate-400'}`}
                                            >
                                                <Droplets size={16} /> Flood
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Intensity</label>
                                            <span className="text-xs font-bold text-white">Level {intensity}</span>
                                        </div>
                                        <input
                                            type="range" min="1" max="5" step="1"
                                            value={intensity}
                                            onChange={(e) => setIntensity(parseInt(e.target.value))}
                                            className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-red-500"
                                        />
                                    </div>

                                    <button
                                        onClick={handleActivate}
                                        disabled={selectedZoneId === ''}
                                        className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg text-white text-sm font-bold transition-all ${selectedZoneId === ''
                                            ? 'bg-slate-700/50 text-slate-500 cursor-not-allowed border border-slate-700'
                                            : 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-900/40 animate-pulse'
                                            }`}
                                    >
                                        <FastForward size={16} />
                                        {selectedZoneId === '' ? 'SELECT ORIGIN ZONE FIRST' : 'ACTIVATE ENGINE →'}
                                    </button>
                                </div>

                                <div className="pt-2 border-t border-[#233554]">
                                    <button
                                        onClick={resetSimulation}
                                        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                                    >
                                        <RotateCcw size={14} />
                                        <span className="text-sm">Restore Infrastructure</span>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};
