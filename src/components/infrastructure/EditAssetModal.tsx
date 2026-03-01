import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Zone, Category, Status, InfrastructureAsset } from '../../hooks/useInfrastructure';

interface EditAssetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (id: string, data: Partial<InfrastructureAsset>) => Promise<void>;
    asset: InfrastructureAsset | null;
    zones: Zone[];
    categories: Category[];
    statuses: Status[];
}

export const EditAssetModal: React.FC<EditAssetModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    asset,
    zones,
    categories,
    statuses
}) => {
    const [formData, setFormData] = useState<Partial<InfrastructureAsset>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (asset && isOpen) {
            setFormData({
                name: asset.name,
                description: asset.description || '',
                zone_id: asset.zone_id || '',
                category_id: asset.category_id || '',
                status_id: asset.status_id || '',
                latitude: asset.latitude || 0,
                longitude: asset.longitude || 0,
                installation_date: asset.installation_date ? asset.installation_date.split('T')[0] : ''
            });
        }
    }, [asset, isOpen]);

    if (!isOpen || !asset) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'latitude' || name === 'longitude' ? Number(value) : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await onSubmit(asset.id, {
                ...formData,
                zone_id: formData.zone_id || null,
                category_id: formData.category_id || null,
                status_id: formData.status_id || null,
                latitude: formData.latitude as number || null,
                longitude: formData.longitude as number || null,
                installation_date: formData.installation_date || null
            });
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="relative w-full max-w-2xl bg-[#0a192f] border border-[#233554] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
                <div className="p-6 border-b border-[#233554] flex items-center justify-between shrink-0">
                    <h2 className="text-xl font-bold text-white">Edit Asset: {asset.name}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto">
                    <form id="edit-asset-form" onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-1.5 md:col-span-2">
                                <label className="text-sm font-medium text-slate-300">Asset Name *</label>
                                <input
                                    required
                                    name="name"
                                    value={formData.name || ''}
                                    onChange={handleChange}
                                    type="text"
                                    className="w-full bg-[#112240] border border-[#233554] rounded-lg p-3 text-slate-200 focus:border-teal-500 outline-none"
                                    placeholder="e.g. North Bridge Extension"
                                />
                            </div>

                            <div className="space-y-1.5 md:col-span-2">
                                <label className="text-sm font-medium text-slate-300">Description</label>
                                <textarea
                                    name="description"
                                    value={formData.description || ''}
                                    onChange={handleChange}
                                    className="w-full bg-[#112240] border border-[#233554] rounded-lg p-3 text-slate-200 focus:border-teal-500 outline-none h-24 resize-none"
                                    placeholder="Enter asset details..."
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-slate-300">Category *</label>
                                <select
                                    required
                                    name="category_id"
                                    value={formData.category_id || ''}
                                    onChange={handleChange}
                                    className="w-full bg-[#112240] border border-[#233554] rounded-lg p-3 text-slate-200 focus:border-teal-500 outline-none"
                                >
                                    <option value="" disabled>Select Category</option>
                                    {categories.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-slate-300">Zone *</label>
                                <select
                                    required
                                    name="zone_id"
                                    value={formData.zone_id || ''}
                                    onChange={handleChange}
                                    className="w-full bg-[#112240] border border-[#233554] rounded-lg p-3 text-slate-200 focus:border-teal-500 outline-none"
                                >
                                    <option value="" disabled>Select Zone</option>
                                    {zones.map(z => (
                                        <option key={z.id} value={z.id}>{z.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-slate-300">Status *</label>
                                <select
                                    required
                                    name="status_id"
                                    value={formData.status_id || ''}
                                    onChange={handleChange}
                                    className="w-full bg-[#112240] border border-[#233554] rounded-lg p-3 text-slate-200 focus:border-teal-500 outline-none"
                                >
                                    <option value="" disabled>Select Status</option>
                                    {statuses.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-slate-300">Installation Date</label>
                                <input
                                    type="date"
                                    name="installation_date"
                                    value={formData.installation_date || ''}
                                    onChange={handleChange}
                                    className="w-full bg-[#112240] border border-[#233554] rounded-lg p-3 text-slate-200 text-sm focus:border-teal-500 outline-none"
                                    style={{ colorScheme: 'dark' }}
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-slate-300">Latitude</label>
                                <input
                                    type="number"
                                    step="any"
                                    name="latitude"
                                    value={formData.latitude || ''}
                                    onChange={handleChange}
                                    className="w-full bg-[#112240] border border-[#233554] rounded-lg p-3 text-slate-200 focus:border-teal-500 outline-none"
                                    placeholder="e.g. 40.7128"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-slate-300">Longitude</label>
                                <input
                                    type="number"
                                    step="any"
                                    name="longitude"
                                    value={formData.longitude || ''}
                                    onChange={handleChange}
                                    className="w-full bg-[#112240] border border-[#233554] rounded-lg p-3 text-slate-200 focus:border-teal-500 outline-none"
                                    placeholder="e.g. -74.0060"
                                />
                            </div>

                        </div>
                    </form>
                </div>

                <div className="p-6 border-t border-[#233554] flex justify-end gap-3 bg-[#112240]/50 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-slate-300 hover:text-white font-medium transition-colors"
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="edit-asset-form"
                        disabled={isSubmitting}
                        className="flex items-center gap-2 px-6 py-2 bg-teal-500 hover:bg-teal-400 text-black rounded-lg font-bold shadow-lg shadow-teal-500/20 disabled:opacity-50 transition-all"
                    >
                        {isSubmitting ? 'Saving...' : (
                            <>
                                <Save size={18} />
                                Save Changes
                            </>
                        )}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};
