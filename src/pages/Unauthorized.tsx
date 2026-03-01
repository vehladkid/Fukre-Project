import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const Unauthorized = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-[#0a192f] flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background gradients */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-red-500/5 rounded-full blur-[120px] pointer-events-none"></div>

            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="max-w-md w-full bg-[#112240] border border-[#233554] rounded-2xl p-8 relative z-10 shadow-2xl shadow-black/50 text-center"
            >
                <div className="w-20 h-20 mx-auto bg-red-500/10 rounded-full flex items-center justify-center mb-6">
                    <ShieldAlert className="text-red-500 w-10 h-10" />
                </div>

                <h1 className="text-2xl font-bold text-white mb-3">Access Denied</h1>

                <p className="text-slate-400 mb-8 max-w-sm mx-auto">
                    Access denied. You do not have permission to view this page.
                </p>

                <button
                    onClick={() => navigate('/')}
                    className="flex items-center justify-center gap-2 w-full bg-[#1d3b5a] hover:bg-[#234b75] text-white font-medium py-3 rounded-xl transition-all"
                >
                    <ArrowLeft size={18} />
                    <span>Return to Dashboard</span>
                </button>
            </motion.div>
        </div>
    );
};

export default Unauthorized;
