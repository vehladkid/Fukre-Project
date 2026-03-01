import React, { useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import type { InfrastructureAsset } from '../../hooks/useInfrastructure';

interface DeleteAssetDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (id: string) => Promise<void>;
    asset: InfrastructureAsset | null;
}

export const DeleteAssetDialog: React.FC<DeleteAssetDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    asset
}) => {
    const [isDeleting, setIsDeleting] = useState(false);

    if (!isOpen || !asset) return null;

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            await onConfirm(asset.id);
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setIsDeleting(false);
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
                className="relative w-full max-w-md bg-[#0a192f] border border-[#233554] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            >
                <div className="p-6">
                    <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                        <AlertTriangle className="text-red-500 w-6 h-6" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Delete Asset</h2>
                    <p className="text-slate-400 text-sm">
                        Are you sure you want to delete <strong className="text-white">{asset.name}</strong>?
                        This action cannot be undone and will permanently remove this infrastructure asset from the database.
                    </p>
                </div>

                <div className="p-6 pt-0 flex justify-end gap-3 mt-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isDeleting}
                        className="px-4 py-2 text-slate-300 hover:text-white font-medium transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="flex items-center gap-2 px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold shadow-lg shadow-red-500/20 disabled:opacity-50 transition-all"
                    >
                        {isDeleting ? 'Deleting...' : (
                            <>
                                <Trash2 size={18} />
                                Delete
                            </>
                        )}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};
