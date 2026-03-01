
import { ChevronDown } from 'lucide-react';

interface Option {
    label: string;
    value: string;
}

interface SettingsSelectProps {
    label: string;
    value: string;
    options: Option[];
    onChange: (value: string) => void;
}

export const SettingsSelect = ({ label, value, options, onChange }: SettingsSelectProps) => {
    return (
        <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
            <div className="relative">
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full bg-[#0a192f] border border-[#233554] rounded-lg pl-4 pr-10 py-2 text-sm text-white focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 transition-colors appearance-none cursor-pointer"
                >
                    {options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
        </div>
    );
};
