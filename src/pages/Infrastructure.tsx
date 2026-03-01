import { useState } from 'react';
import { Plus, Search, Filter, Loader2, RefreshCw } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useInfrastructure } from '../hooks/useInfrastructure';
import type { InfrastructureAsset } from '../hooks/useInfrastructure';
import { AssetTable } from '../components/infrastructure/AssetTable';
import { AddAssetModal } from '../components/infrastructure/AddAssetModal';
import { EditAssetModal } from '../components/infrastructure/EditAssetModal';
import { DeleteAssetDialog } from '../components/infrastructure/DeleteAssetDialog';

const Infrastructure = () => {
    const { role } = useAuth();
    const {
        assets, zones, categories, statuses,
        loading, loadingMore, error,
        hasMore, loadMore, fetchAssets,
        createAsset, updateAsset, deleteAsset
    } = useInfrastructure();

    const [searchTerm, setSearchTerm] = useState('');

    // Modals state
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editAsset, setEditAsset] = useState<InfrastructureAsset | null>(null);
    const [deleteAssetData, setDeleteAssetData] = useState<InfrastructureAsset | null>(null);

    const canAdd = role === 'admin' || role === 'operator';

    const filteredAssets = assets.filter(asset =>
        asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (asset.description && asset.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Infrastructure Assets</h1>
                    <p className="text-slate-400">Manage and monitor city infrastructure inventory</p>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={() => fetchAssets()}
                        className="flex items-center justify-center p-2.5 bg-[#112240] hover:bg-[#1d3b5a] text-slate-300 rounded-lg transition-colors border border-[#233554]"
                        title="Refresh Data"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin text-teal-400' : ''} />
                    </button>

                    {canAdd && (
                        <button
                            onClick={() => setIsAddOpen(true)}
                            className="flex items-center gap-2 px-4 py-2.5 bg-teal-500 hover:bg-teal-400 text-black rounded-lg text-sm font-bold transition-colors shadow-lg shadow-teal-500/20"
                        >
                            <Plus size={18} />
                            Add Asset
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg flex items-center gap-3">
                    <span className="font-medium">Error:</span> {error}
                </div>
            )}

            {/* Filters & Search */}
            <div className="glass-panel p-4 rounded-xl flex flex-col md:flex-row gap-4 items-center justify-between shadow-lg shadow-black/10">
                <div className="relative w-full md:w-96 group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-teal-400 transition-colors" size={18} />
                    <input
                        type="text"
                        placeholder="Search assets..."
                        className="w-full bg-[#0a192f] border border-[#233554] rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-teal-500/50 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex gap-3 w-full md:w-auto">
                    <button className="flex items-center gap-2 px-4 py-2.5 bg-[#112240] border border-[#233554] rounded-lg text-slate-300 hover:text-white hover:border-slate-500 transition-colors text-sm">
                        <Filter size={16} />
                        Filters
                    </button>
                </div>
            </div>

            {/* Data Section */}
            {loading && assets.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-400 glass-panel rounded-2xl">
                    <Loader2 className="animate-spin text-teal-400 mb-4" size={32} />
                    <p>Loading infrastructure data...</p>
                </div>
            ) : (
                <>
                    <AssetTable
                        assets={filteredAssets}
                        onEdit={(asset) => setEditAsset(asset)}
                        onDelete={(asset) => setDeleteAssetData(asset)}
                    />

                    {/* Cursor Pagination Anchor */}
                    {hasMore && filteredAssets.length > 0 && !searchTerm && (
                        <div className="pt-6 flex justify-center">
                            <button
                                onClick={loadMore}
                                disabled={loadingMore}
                                className="flex items-center gap-2 px-6 py-3 bg-[#112240] hover:bg-[#1a365d] border border-[#233554] transition-colors rounded-lg text-teal-400 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loadingMore ? (
                                    <><Loader2 className="animate-spin h-5 w-5" /> Loading Range...</>
                                ) : (
                                    'Load More Records'
                                )}
                            </button>
                        </div>
                    )}

                    {searchTerm && hasMore && (
                        <p className="text-center text-xs text-slate-500 pt-4">
                            Pagination is disabled while client-side search is active.
                        </p>
                    )}
                </>
            )}

            {/* Modals */}
            <AnimatePresence>
                {isAddOpen && (
                    <AddAssetModal
                        isOpen={isAddOpen}
                        onClose={() => setIsAddOpen(false)}
                        onSubmit={async (data) => { await createAsset(data); }}
                        zones={zones}
                        categories={categories}
                        statuses={statuses}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {editAsset && (
                    <EditAssetModal
                        isOpen={!!editAsset}
                        onClose={() => setEditAsset(null)}
                        onSubmit={async (id, data) => { await updateAsset(id, data); }}
                        asset={editAsset}
                        zones={zones}
                        categories={categories}
                        statuses={statuses}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {deleteAssetData && (
                    <DeleteAssetDialog
                        isOpen={!!deleteAssetData}
                        onClose={() => setDeleteAssetData(null)}
                        onConfirm={async (id) => { await deleteAsset(id); }}
                        asset={deleteAssetData}
                    />
                )}
            </AnimatePresence>

        </div>
    );
};

export default Infrastructure;
