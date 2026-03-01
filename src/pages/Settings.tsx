import { useState } from 'react';
import { SettingsCard } from '../components/settings/SettingsCard';
import { SettingsInput } from '../components/settings/SettingsInput';
import { SettingsSelect } from '../components/settings/SettingsSelect';
import { SettingsSlider } from '../components/settings/SettingsSlider';
import { SettingsToggle } from '../components/settings/SettingsToggle';
import {
    Globe,
    BrainCircuit,
    BellRing,
    ShieldCheck,
    Database,
    Map as MapIcon,
    FlaskConical,
    Save
} from 'lucide-react';
import { motion } from 'framer-motion';

const Settings = () => {
    // 1️⃣ GENERAL SETTINGS
    const [general, setGeneral] = useState({
        city: 'New Delhi',
        lat: 28.6139,
        lng: 77.2090,
        zoom: 13,
        refreshInterval: '30s',
        theme: 'dark-glass',
        timezone: 'Asia/Kolkata'
    });

    // 2️⃣ AI HEALTH SCORE ENGINE
    const [aiEngine, setAiEngine] = useState({
        ageWeight: 30,
        delayWeight: 20,
        historyWeight: 50,
        autoRecalc: true
    });

    // 3️⃣ ALERT & RISK CONFIGURATION
    const [alerts, setAlerts] = useState({
        criticalRisk: 80,
        highRisk: 60,
        overdueBoundary: 30,
        autoAlerts: true,
        emailNotif: false
    });

    // 4️⃣ USER & SECURITY
    const [security, setSecurity] = useState({
        timeout: '15m',
        globalAudit: true
    });

    // 5️⃣ DATA & BACKUP CONFIGURATION
    const [backup, setBackup] = useState({
        exportFormat: 'csv',
        backupFreq: 'daily',
        auditRetain: '90d'
    });

    // 6️⃣ MAP CONFIGURATION
    const [mapConfig, setMapConfig] = useState({
        renderStyle: 'dynamic-lod',
        defaultFilter: 'all'
    });

    // 7️⃣ SIMULATION ENGINE (WARGAMING)
    const [sim, setSim] = useState({
        enabled: false,
        tickFreq: '1s',
        failureInjection: 0
    });

    const [saving, setSaving] = useState(false);

    const handleSave = () => {
        setSaving(true);
        setTimeout(() => setSaving(false), 800);
    };

    return (
        <div className="space-y-6 max-w-[1600px] mx-auto pb-10">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
                <div>
                    <h1 className="text-2xl font-bold text-white">System Configuration</h1>
                    <p className="text-slate-400">Manage enterprise platform parameters and AI engine thresholds.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-900 rounded-lg text-sm font-bold transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-teal-500/20"
                >
                    <Save size={16} />
                    {saving ? 'Saving Config...' : 'Save Changes'}
                </button>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 xl:grid-cols-2 gap-6"
            >
                {/* Left Column */}
                <div className="space-y-6">

                    <SettingsCard title="General Settings" icon={Globe}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <SettingsInput
                                label="Default City"
                                value={general.city}
                                onChange={(v) => setGeneral({ ...general, city: v })}
                            />
                            <SettingsSelect
                                label="Timezone"
                                value={general.timezone}
                                onChange={(v) => setGeneral({ ...general, timezone: v })}
                                options={[
                                    { label: 'Asia/Kolkata', value: 'Asia/Kolkata' },
                                    { label: 'UTC', value: 'UTC' },
                                    { label: 'America/New_York', value: 'America/New_York' }
                                ]}
                            />
                            <SettingsInput
                                label="Map Latitude"
                                type="number"
                                value={general.lat}
                                onChange={(v) => setGeneral({ ...general, lat: Number(v) })}
                            />
                            <SettingsInput
                                label="Map Longitude"
                                type="number"
                                value={general.lng}
                                onChange={(v) => setGeneral({ ...general, lng: Number(v) })}
                            />
                        </div>
                        <SettingsSlider
                            label="Default Zoom Level"
                            value={general.zoom}
                            min={5} max={18}
                            onChange={(v) => setGeneral({ ...general, zoom: v })}
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <SettingsSelect
                                label="Theme"
                                value={general.theme}
                                onChange={(v) => setGeneral({ ...general, theme: v })}
                                options={[{ label: 'Dark Glass', value: 'dark-glass' }, { label: 'High Contrast', value: 'high-contrast' }]}
                            />
                            <SettingsSelect
                                label="Auto Refresh Interval"
                                value={general.refreshInterval}
                                onChange={(v) => setGeneral({ ...general, refreshInterval: v })}
                                options={[{ label: 'Realtime (Sockets)', value: 'realtime' }, { label: '15 Seconds', value: '15s' }, { label: '30 Seconds', value: '30s' }]}
                            />
                        </div>
                    </SettingsCard>

                    <SettingsCard title="Alert & Risk Configuration" icon={BellRing}>
                        <SettingsSlider
                            label="Critical Risk Threshold"
                            value={alerts.criticalRisk}
                            min={1} max={100} unit="%"
                            onChange={(v) => setAlerts({ ...alerts, criticalRisk: v })}
                        />
                        <SettingsSlider
                            label="High Risk Threshold"
                            value={alerts.highRisk}
                            min={1} max={100} unit="%"
                            onChange={(v) => setAlerts({ ...alerts, highRisk: v })}
                        />
                        <div className="w-1/2">
                            <SettingsInput
                                label="Maintenance Overdue Boundary (Days)"
                                type="number"
                                value={alerts.overdueBoundary}
                                onChange={(v) => setAlerts({ ...alerts, overdueBoundary: Number(v) })}
                            />
                        </div>
                        <div className="pt-2 border-t border-[#233554] space-y-3">
                            <SettingsToggle
                                label="Auto Alert Generation"
                                description="Create system alerts when assets cross thresholds"
                                checked={alerts.autoAlerts}
                                onChange={(v) => setAlerts({ ...alerts, autoAlerts: v })}
                            />
                            <SettingsToggle
                                label="Email Notifications"
                                description="Send daily digest to active operators"
                                checked={alerts.emailNotif}
                                onChange={(v) => setAlerts({ ...alerts, emailNotif: v })}
                            />
                        </div>
                    </SettingsCard>

                    <SettingsCard title="Data & Backup Configuration" icon={Database}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <SettingsSelect
                                label="Global Export Format"
                                value={backup.exportFormat}
                                onChange={(v) => setBackup({ ...backup, exportFormat: v })}
                                options={[{ label: 'CSV/Excel', value: 'csv' }, { label: 'JSON Lines', value: 'json' }, { label: 'GeoJSON', value: 'geojson' }]}
                            />
                            <SettingsSelect
                                label="Auto Backup Frequency"
                                value={backup.backupFreq}
                                onChange={(v) => setBackup({ ...backup, backupFreq: v })}
                                options={[{ label: 'Daily Midnight', value: 'daily' }, { label: 'Weekly', value: 'weekly' }]}
                            />
                            <SettingsSelect
                                label="Audit Log Retention"
                                value={backup.auditRetain}
                                onChange={(v) => setBackup({ ...backup, auditRetain: v })}
                                options={[{ label: '30 Days', value: '30d' }, { label: '90 Days', value: '90d' }, { label: '1 Year', value: '1y' }]}
                            />
                        </div>
                    </SettingsCard>

                </div>

                {/* Right Column */}
                <div className="space-y-6">

                    <SettingsCard title="AI Health Score Engine" icon={BrainCircuit} description="Adjust parametric weights for automated health score distribution.">
                        <SettingsSlider
                            label="Asset Age Weight"
                            value={aiEngine.ageWeight}
                            min={0} max={100} unit="%"
                            onChange={(v) => setAiEngine({ ...aiEngine, ageWeight: v })}
                        />
                        <SettingsSlider
                            label="Inspection Delay Weight"
                            value={aiEngine.delayWeight}
                            min={0} max={100} unit="%"
                            onChange={(v) => setAiEngine({ ...aiEngine, delayWeight: v })}
                        />
                        <SettingsSlider
                            label="Status History Weight"
                            value={aiEngine.historyWeight}
                            min={0} max={100} unit="%"
                            onChange={(v) => setAiEngine({ ...aiEngine, historyWeight: v })}
                        />

                        <div className="flex items-center justify-between p-3 bg-[#112240] rounded-xl border border-[#233554]">
                            <span className="text-sm font-medium text-slate-300">Total Calculation Weight</span>
                            <span className={`text-sm font-bold font-mono px-2 py-0.5 rounded ${(aiEngine.ageWeight + aiEngine.delayWeight + aiEngine.historyWeight) === 100
                                ? 'text-teal-400 bg-teal-400/10'
                                : 'text-red-400 bg-red-400/10'
                                }`}>
                                {aiEngine.ageWeight + aiEngine.delayWeight + aiEngine.historyWeight}%
                            </span>
                        </div>

                        <div className="pt-2 border-t border-[#233554]">
                            <SettingsToggle
                                label="Automatic Recalculation Phase"
                                description="Run matrix operations when external data feeds update"
                                checked={aiEngine.autoRecalc}
                                onChange={(v) => setAiEngine({ ...aiEngine, autoRecalc: v })}
                            />
                        </div>
                    </SettingsCard>

                    <SettingsCard title="Map Configuration" icon={MapIcon}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <SettingsSelect
                                label="Marker Render Style"
                                value={mapConfig.renderStyle}
                                onChange={(v) => setMapConfig({ ...mapConfig, renderStyle: v })}
                                options={[{ label: 'Dynamic LOD (Canvas)', value: 'dynamic-lod' }, { label: 'Static Clusters', value: 'clusters' }]}
                            />
                            <SettingsSelect
                                label="Default Asset Filter"
                                value={mapConfig.defaultFilter}
                                onChange={(v) => setMapConfig({ ...mapConfig, defaultFilter: v })}
                                options={[{ label: 'All Assets', value: 'all' }, { label: 'Critical Only', value: 'critical' }, { label: 'Operational Hide', value: 'hide-op' }]}
                            />
                        </div>
                    </SettingsCard>

                    <SettingsCard title="User & Security Restrictions" icon={ShieldCheck}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <SettingsSelect
                                label="Session Timeout Limit"
                                value={security.timeout}
                                onChange={(v) => setSecurity({ ...security, timeout: v })}
                                options={[{ label: '15 Minutes', value: '15m' }, { label: '1 Hour', value: '1h' }, { label: '24 Hours', value: '24h' }]}
                            />
                        </div>
                        <div className="pt-4 mt-2 border-t border-[#233554]">
                            <SettingsToggle
                                label="Global Audit Logging"
                                description="Record every action taken by standard and admin operators"
                                checked={security.globalAudit}
                                onChange={(v) => setSecurity({ ...security, globalAudit: v })}
                            />
                        </div>
                    </SettingsCard>

                    <SettingsCard
                        title="Simulation Engine (Wargaming)"
                        icon={FlaskConical}
                        warning="WARNING: Enabling Simulation mode will pollute the dashboard and map with synthetic asset anomalies until disabled."
                    >
                        <SettingsToggle
                            label="Enable Live Mock Simulation"
                            checked={sim.enabled}
                            onChange={(v) => setSim({ ...sim, enabled: v })}
                        />
                        {sim.enabled && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                className="space-y-4 pt-4 border-t border-red-500/30"
                            >
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <SettingsSelect
                                        label="Engine Tick Frequency"
                                        value={sim.tickFreq}
                                        onChange={(v) => setSim({ ...sim, tickFreq: v })}
                                        options={[{ label: '1 Second', value: '1s' }, { label: '5 Seconds', value: '5s' }]}
                                    />
                                </div>
                                <SettingsSlider
                                    label="Runtime Failure Injection Rate"
                                    value={sim.failureInjection}
                                    min={0} max={20} unit="%"
                                    onChange={(v) => setSim({ ...sim, failureInjection: v })}
                                />
                            </motion.div>
                        )}
                    </SettingsCard>

                </div>
            </motion.div>
        </div>
    );
};

export default Settings;
