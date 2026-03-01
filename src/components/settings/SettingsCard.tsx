import React from 'react';

interface SettingsCardProps {
    title: string;
    icon: React.ElementType;
    description?: string;
    children: React.ReactNode;
    warning?: string;
}

export const SettingsCard = ({ title, icon: Icon, description, children, warning }: SettingsCardProps) => {
    return (
        <div className="glass-card p-6 rounded-2xl border border-[#233554]">
            <div className="flex items-center gap-3 mb-4 border-b border-[#233554] pb-4">
                <div className="p-2 rounded-lg bg-[#112240]">
                    <Icon size={20} className="text-teal-400" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-white">{title}</h3>
                    {description && <p className="text-xs text-slate-400">{description}</p>}
                </div>
            </div>

            {warning && (
                <div className="mb-4 p-3 bg-red-900/10 border border-red-500/30 rounded-lg text-xs text-red-400 font-medium">
                    {warning}
                </div>
            )}

            <div className="space-y-5">
                {children}
            </div>
        </div>
    );
};
