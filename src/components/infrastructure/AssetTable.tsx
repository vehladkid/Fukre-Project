import React from 'react';
import { Edit2, Trash2, MapPin, Building2 } from 'lucide-react';
import type { InfrastructureAsset } from '../../hooks/useInfrastructure';
import { useAuth } from '../../context/AuthContext';

interface AssetTableProps {
    assets: InfrastructureAsset[];
    onEdit: (asset: InfrastructureAsset) => void;
    onDelete: (asset: InfrastructureAsset) => void;
}

export const AssetTable: React.FC<AssetTableProps> = ({ assets, onEdit, onDelete }) => {
    const { role } = useAuth();

    const canEdit = role === 'admin' || role === 'operator';
    const canDelete = role === 'admin';

    if (!assets || assets.length === 0) {
        return (
            <div className="glass-panel p-12 rounded-2xl flex flex-col items-center justify-center text-slate-400">
                <Building2 size={48} className="mb-4 opacity-50" />
                <h3 className="text-xl font-semibold text-slate-300">No assets found</h3>
                <p className="mt-2 text-sm">Get started by creating a new infrastructure asset.</p>
            </div>
        );
    }

    return (
        <div className="glass-panel rounded-2xl overflow-hidden shadow-xl shadow-black/20">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-[#112240] border-b border-[#233554] text-slate-400 text-xs uppercase tracking-wider">
                            <th className="p-4 font-semibold">Asset Name</th>
                            <th className="p-4 font-semibold">Category</th>
                            <th className="p-4 font-semibold">Zone</th>
                            <th className="p-4 font-semibold">Status</th>
                            <th className="p-4 font-semibold">Coordinates</th>
                            <th className="p-4 font-semibold">Last Inspected</th>
                            {(canEdit || canDelete) && (
                                <th className="p-4 font-semibold text-right">Actions</th>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#233554] bg-[#0a192f]/50">
                        {assets.map((asset) => {
                            const categoryName = asset.infrastructure_categories?.name || 'Unknown';
                            const isUtility = categoryName.toLowerCase().includes('utility');

                            const statusName = asset.asset_status?.name || 'Unknown';
                            const statusColor = asset.asset_status?.color_code || '#a8a29e';

                            return (
                                <tr key={asset.id} className="hover:bg-[#1d3b5a]/30 transition-colors group">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded bg-[#112240] flex items-center justify-center text-slate-400">
                                                {isUtility ? <Building2 size={16} /> : <MapPin size={16} />}
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-200">{asset.name}</p>
                                                {asset.description && (
                                                    <p className="text-xs text-slate-500 truncate max-w-[200px]" title={asset.description}>
                                                        {asset.description}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 text-slate-300 text-sm">{categoryName}</td>
                                    <td className="p-4 text-slate-300 text-sm">{asset.zones?.name || 'No Zone'}</td>
                                    <td className="p-4">
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-2.5 h-2.5 rounded-full shadow-sm"
                                                style={{ backgroundColor: statusColor }}
                                            />
                                            <span className="text-slate-300 text-sm font-medium">{statusName}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-slate-400 text-sm font-mono text-xs">
                                        {asset.latitude && asset.longitude
                                            ? `${Number(asset.latitude).toFixed(4)}, ${Number(asset.longitude).toFixed(4)}`
                                            : 'N/A'
                                        }
                                    </td>
                                    <td className="p-4 text-slate-400 text-sm">
                                        {asset.last_inspected ? new Date(asset.last_inspected).toLocaleDateString() : 'Never'}
                                    </td>

                                    {(canEdit || canDelete) && (
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {canEdit && (
                                                    <button
                                                        onClick={() => onEdit(asset)}
                                                        className="p-2 hover:bg-[#112240] rounded-lg text-slate-400 hover:text-teal-400 transition-colors"
                                                        title="Edit Asset"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                )}
                                                {canDelete && (
                                                    <button
                                                        onClick={() => onDelete(asset)}
                                                        className="p-2 hover:bg-[#112240] rounded-lg text-slate-400 hover:text-red-400 transition-colors"
                                                        title="Delete Asset"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
