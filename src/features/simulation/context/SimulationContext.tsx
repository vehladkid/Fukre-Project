import { createContext, useContext, useState, type ReactNode } from 'react';
import { useSimulationEngine, type SimulatedAsset, type TimelineEvent } from '../hooks/useSimulationEngine';
import { type MapAsset } from '../../map/useMapAssets';

export interface SimZone {
    id: string;
    name: string;
    centroid_lat: number;
    centroid_lng: number;
}

interface SimulationContextType {
    isActive: boolean;
    isPaused: boolean;
    playbackSpeed: number;
    simTimeSeconds: number;
    formattedTime: string;
    isFloodActive: boolean;
    simulatedAssets: SimulatedAsset[];
    timeline: TimelineEvent[];
    simulatedCityHealth: number | null;
    toggleSimulation: () => void;
    togglePause: () => void;
    setSpeed: (speed: number) => void;
    triggerEvent: (type: 'INFRASTRUCTURE_FAILURE' | 'FLASH_FLOOD', zone: SimZone, intensity: number) => void;
    resetSimulation: () => void;
    setViewportAssets: (assets: MapAsset[]) => void;
    startSimulation: (type: 'INFRASTRUCTURE_FAILURE' | 'FLASH_FLOOD', zone: SimZone, intensity: number) => void;
    stopSimulation: () => void;
}

const SimulationContext = createContext<SimulationContextType | undefined>(undefined);

export const SimulationProvider = ({ children }: { children: ReactNode }) => {
    const [viewportAssets, setViewportAssets] = useState<MapAsset[]>([]);
    const engineState = useSimulationEngine(viewportAssets);

    return (
        <SimulationContext.Provider value={{ ...engineState, setViewportAssets }}>
            {children}
        </SimulationContext.Provider>
    );
};

export const useSimulation = () => {
    const context = useContext(SimulationContext);
    if (context === undefined) {
        // Return dummy context when used outside Sandbox (e.g. MapView launcher)
        return {
            isActive: false,
            isPaused: false,
            playbackSpeed: 1,
            simTimeSeconds: 0,
            formattedTime: 'T+00:00:00',
            isFloodActive: false,
            simulatedAssets: [],
            timeline: [],
            simulatedCityHealth: null,
            toggleSimulation: () => { },
            togglePause: () => { },
            setSpeed: () => { },
            triggerEvent: () => { },
            resetSimulation: () => { },
            setViewportAssets: () => { },
            startSimulation: () => { },
            stopSimulation: () => { }
        } as SimulationContextType;
    }
    return context;
};
