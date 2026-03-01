import { useState } from 'react';
import { 
  Filter, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  MapPin, 
  X,
  Building2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const assetsData = [
  { id: 1, name: 'Downtown Bridge', type: 'Bridge', zone: 'Central', condition: 'Good', status: 'Active', updated: '2 mins ago' },
  { id: 2, name: 'Main St. Highway', type: 'Road', zone: 'North', condition: 'Critical', status: 'Maintenance', updated: '1 hour ago' },
  { id: 3, name: 'City General Hospital', type: 'Facility', zone: 'East', condition: 'Good', status: 'Active', updated: '3 hours ago' },
  { id: 4, name: 'Water Treatment Plant A', type: 'Utility', zone: 'West', condition: 'Fair', status: 'Active', updated: '5 hours ago' },
  { id: 5, name: 'Public Library', type: 'Facility', zone: 'Central', condition: 'Good', status: 'Active', updated: '1 day ago' },
  { id: 6, name: 'Solar Farm B2', type: 'Utility', zone: 'South', condition: 'Good', status: 'Active', updated: '2 days ago' },
  { id: 7, name: 'Metro Station 4', type: 'Transport', zone: 'Central', condition: 'Fair', status: 'Warning', updated: '2 days ago' },
];

const Assets = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  if (selectedAsset) console.log(selectedAsset); // Suppress unused warning

  const getConditionColor = (condition: string) => {
    switch(condition.toLowerCase()) {
      case 'good': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'fair': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'critical': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-slate-500/10 text-slate-500';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Infrastructure Assets</h1>
          <p className="text-slate-400">Manage and monitor city infrastructure inventory</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-black rounded-lg text-sm font-bold transition-colors shadow-lg shadow-teal-500/20"
        >
          <Plus size={18} />
          Add Asset
        </button>
      </div>

      {/* Filters & Search */}
      <div className="glass-panel p-4 rounded-xl flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-teal-400 transition-colors" size={18} />
          <input 
            type="text" 
            placeholder="Search assets by name, ID, or zone..." 
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
          <select className="px-4 py-2.5 bg-[#112240] border border-[#233554] rounded-lg text-slate-300 hover:text-white hover:border-slate-500 transition-colors text-sm outline-none">
            <option>Sort by: Recent</option>
            <option>Sort by: Status</option>
            <option>Sort by: Condition</option>
          </select>
        </div>
      </div>

      {/* Data Table */}
      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#112240] border-b border-[#233554] text-slate-400 text-xs uppercase tracking-wider">
                <th className="p-4 font-semibold">Asset Name</th>
                <th className="p-4 font-semibold">Type</th>
                <th className="p-4 font-semibold">Zone</th>
                <th className="p-4 font-semibold">Condition</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold">Last Updated</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#233554]">
              {assetsData.map((asset) => (
                <tr key={asset.id} className="hover:bg-[#1d3b5a]/30 transition-colors group">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-[#112240] flex items-center justify-center text-slate-400">
                        {asset.type === 'Bridge' ? <MapPin size={16} /> : 
                         asset.type === 'Road' ? <MapPin size={16} /> :
                         <Building2 size={16} />}
                      </div>
                      <div>
                        <p className="font-medium text-slate-200">{asset.name}</p>
                        <p className="text-xs text-slate-500">ID: AS-{1000 + asset.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-slate-300 text-sm">{asset.type}</td>
                  <td className="p-4 text-slate-300 text-sm">{asset.zone}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${getConditionColor(asset.condition)}`}>
                      {asset.condition}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${asset.status === 'Active' ? 'bg-teal-500' : 'bg-amber-500'}`}></div>
                      <span className="text-slate-300 text-sm">{asset.status}</span>
                    </div>
                  </td>
                  <td className="p-4 text-slate-400 text-sm">{asset.updated}</td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setSelectedAsset(asset)} className="p-2 hover:bg-[#112240] rounded-lg text-slate-400 hover:text-teal-400 transition-colors">
                        <Edit2 size={16} />
                      </button>
                      <button className="p-2 hover:bg-[#112240] rounded-lg text-slate-400 hover:text-red-400 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-[#233554] flex items-center justify-between text-sm text-slate-400">
          <span>Showing 7 of 128 assets</span>
          <div className="flex gap-2">
            <button className="px-3 py-1 rounded border border-[#233554] hover:bg-[#112240] disabled:opacity-50">Prev</button>
            <button className="px-3 py-1 rounded border border-[#233554] hover:bg-[#112240]">Next</button>
          </div>
        </div>
      </div>

      {/* Add Asset Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-[#0a192f] border border-[#233554] rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-[#233554] flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Add New Infrastructure Asset</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                  <X size={24} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-300">Asset Name</label>
                  <input type="text" className="w-full bg-[#112240] border border-[#233554] rounded-lg p-3 text-slate-200 focus:border-teal-500 outline-none" placeholder="e.g. North Bridge Extension" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-300">Type</label>
                    <select className="w-full bg-[#112240] border border-[#233554] rounded-lg p-3 text-slate-200 focus:border-teal-500 outline-none">
                      <option>Road</option>
                      <option>Bridge</option>
                      <option>Utility</option>
                      <option>Facility</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-slate-300">Zone</label>
                    <select className="w-full bg-[#112240] border border-[#233554] rounded-lg p-3 text-slate-200 focus:border-teal-500 outline-none">
                      <option>North</option>
                      <option>South</option>
                      <option>East</option>
                      <option>West</option>
                      <option>Central</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-300">Description</label>
                  <textarea className="w-full bg-[#112240] border border-[#233554] rounded-lg p-3 text-slate-200 focus:border-teal-500 outline-none h-24 resize-none" placeholder="Enter asset details..."></textarea>
                </div>
              </div>
              <div className="p-6 border-t border-[#233554] flex justify-end gap-3 bg-[#112240]/50">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-300 hover:text-white font-medium"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2 bg-teal-500 hover:bg-teal-400 text-black rounded-lg font-bold shadow-lg shadow-teal-500/20"
                >
                  Create Asset
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Assets;
