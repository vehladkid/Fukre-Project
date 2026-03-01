import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

interface MapUIState {
    showTopology: boolean;
    showPredictions: boolean;
    showIntelligenceLayers: boolean;
    isCleanMode: boolean;
    toggleTopology: () => void;
    togglePredictions: () => void;
    toggleLayers: () => void;
    hideAllPanels: () => void;
    triggerInteraction: () => void;
}

const MapUIContext = createContext<MapUIState | undefined>(undefined);

export const MapUIStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Hidden by default per instructions
    const [showTopology, setShowTopology] = useState(false);
    const [showPredictions, setShowPredictions] = useState(false);
    const [showIntelligenceLayers, setShowIntelligenceLayers] = useState(false);
    const [isCleanMode, setIsCleanMode] = useState(false);

    // Auto-hide timeout reference
    const interactionTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    const toggleTopology = useCallback(() => {
        if (isCleanMode) return;
        setShowTopology(prev => !prev);
        setShowIntelligenceLayers(false); // Only one popover/panel on the right usually, but keeping layers separate
    }, [isCleanMode]);

    const togglePredictions = useCallback(() => {
        if (isCleanMode) return;
        setShowPredictions(prev => !prev);
    }, [isCleanMode]);

    const toggleLayers = useCallback(() => {
        if (isCleanMode) return;
        setShowIntelligenceLayers(prev => !prev);
        setShowTopology(false); // Mutually exclusive with right-dock topology for cleanliness
    }, [isCleanMode]);

    const hideAllPanels = useCallback(() => {
        setShowTopology(false);
        setShowPredictions(false);
        setShowIntelligenceLayers(false);
    }, []);

    const triggerInteraction = useCallback(() => {
        if (interactionTimeoutRef.current) {
            clearTimeout(interactionTimeoutRef.current);
        }

        // Auto-hide panels after 2 seconds idle
        interactionTimeoutRef.current = setTimeout(() => {
            hideAllPanels();
        }, 2000);
    }, [hideAllPanels]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === 'm' && e.target instanceof Element && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
                setIsCleanMode(prev => !prev);
                hideAllPanels(); // Also hide everything dynamically
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [hideAllPanels]);

    return (
        <MapUIContext.Provider
            value={{
                showTopology,
                showPredictions,
                showIntelligenceLayers,
                isCleanMode,
                toggleTopology,
                togglePredictions,
                toggleLayers,
                hideAllPanels,
                triggerInteraction
            }}
        >
            {children}
        </MapUIContext.Provider>
    );
};

export const useMapUIState = () => {
    const context = useContext(MapUIContext);
    if (!context) {
        throw new Error('useMapUIState must be used within a MapUIStateProvider');
    }
    return context;
};
