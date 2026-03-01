import { useState, useEffect, useCallback } from 'react';

export interface SimulationLog {
    id: string;
    timestamp: number;
    asset_id?: string;
    zone_id?: string;
    event_type: 'STRESSED' | 'DEGRADED' | 'FAILED' | 'SYSTEM' | 'PROPAGATION' | 'FLOOD';
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
}

let globalLogs: SimulationLog[] = [];
const listeners = new Set<() => void>();

const notify = () => listeners.forEach(l => l());

export const useSimulationLogs = () => {
    const [logs, setLogs] = useState<SimulationLog[]>(globalLogs);

    useEffect(() => {
        const update = () => setLogs([...globalLogs]);
        listeners.add(update);
        return () => { listeners.delete(update); };
    }, []);

    const addLog = useCallback((logInput: Omit<SimulationLog, 'id' | 'timestamp'>) => {
        const newLog: SimulationLog = {
            ...logInput,
            id: Math.random().toString(36).substring(7),
            timestamp: Date.now()
        };

        // Unshift to put newest at start
        globalLogs = [newLog, ...globalLogs].slice(0, 100);
        notify();
    }, []);

    const clearLogs = useCallback(() => {
        globalLogs = [];
        notify();
    }, []);

    return { logs, addLog, clearLogs };
};
