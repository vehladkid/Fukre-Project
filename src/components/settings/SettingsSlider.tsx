

interface SettingsSliderProps {
    label: string;
    value: number;
    min: number;
    max: number;
    onChange: (value: number) => void;
    unit?: string;
    step?: number;
}

export const SettingsSlider = ({ label, value, min, max, onChange, unit = '', step = 1 }: SettingsSliderProps) => {
    const percentage = ((value - min) / (max - min)) * 100;

    return (
        <div>
            <div className="flex justify-between items-center mb-1.5">
                <label className="text-sm font-medium text-slate-300">{label}</label>
                <span className="text-xs font-mono text-teal-400 bg-teal-400/10 px-2 py-0.5 rounded">
                    {value}{unit}
                </span>
            </div>
            <div className="relative w-full h-8 flex items-center">
                {/* Custom Track */}
                <div className="absolute left-0 right-0 h-1.5 bg-[#0a192f] rounded-full border border-[#233554] overflow-hidden pointer-events-none">
                    <div
                        className="h-full bg-teal-400 transition-all duration-150 ease-out"
                        style={{ width: `${percentage}%` }}
                    />
                </div>

                {/* Native Slider (invisible but functional overlay) */}
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />

                {/* Thumb Indicator */}
                <div
                    className="absolute h-4 w-4 bg-white rounded-full shadow border-2 border-teal-400 pointer-events-none transition-all duration-150 ease-out z-10"
                    style={{ left: `calc(${percentage}% - 8px)` }}
                />
            </div>
        </div>
    );
};
