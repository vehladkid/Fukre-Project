import { useState, useMemo } from 'react';
import { Shield, Search, Filter, Loader2, Database } from 'lucide-react';
import { useAuditLogs } from '../features/audit/useAuditLogs';
import { AuditCard } from '../features/audit/components/AuditCard';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

const AuditLogs = () => {
  // 1. Auth & Role Guarding (Immediate UI blockade if somehow rendered)
  const { role, loading: authLoading } = useAuth();

  // 2. Fetch Hooks
  const { logs, loading: dataLoading, loadingMore, hasMore, loadMore, error } = useAuditLogs();

  // 3. Client-Side Filtering State
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Wait until profile is hydrated to prevent unauthorized flash rendering
  if (authLoading) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
        <Loader2 className="animate-spin text-teal-400 h-10 w-10" />
      </div>
    );
  }

  if (role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  // 4. Derive Filtered List
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Action Match
      if (actionFilter !== 'ALL' && log.action !== actionFilter) return false;

      // Search Match (Asset ID primarily)
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        const idMatch = log.record_id.toLowerCase().includes(searchLower);
        const userMatch = (log.operator_name || '').toLowerCase().includes(searchLower);
        if (!idMatch && !userMatch) return false;
      }

      return true;
    });
  }, [logs, actionFilter, searchQuery]);


  return (
    <div className="space-y-6 pb-12">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Shield className="text-teal-400" size={28} />
            Intelligence Audit Trail
          </h1>
          <p className="text-slate-400 mt-1">Investigative timeline of all infrastructure modifications</p>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-slate-300 text-sm font-medium">
          <Database size={16} className="text-slate-400" />
          Secure Read-Only Logs
        </div>
      </div>

      {/* Filtering Controls */}
      <div className="glass-panel p-4 rounded-xl flex flex-col md:flex-row gap-4 items-center justify-between border border-[#233554]">
        <div className="relative w-full md:w-96 group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-teal-400 transition-colors" size={18} />
          <input
            type="text"
            placeholder="Search by Asset ID or Operator..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0a192f] border border-[#233554] rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-teal-500/50 transition-all shadow-inner"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <Filter className="text-slate-500" size={18} />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full md:w-48 bg-[#0a192f] border border-[#233554] rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-teal-500/50 transition-all cursor-pointer appearance-none"
          >
            <option value="ALL">All Actions</option>
            <option value="INSERT">Create (INSERT)</option>
            <option value="UPDATE">Update (UPDATE)</option>
            <option value="DELETE">Delete (DELETE)</option>
          </select>
        </div>
      </div>

      {/* Content Area */}
      {error ? (
        <div className="bg-red-900/10 border border-red-500/20 p-6 rounded-xl text-center">
          <p className="text-red-400 font-medium">Error loading audit logs: {error}</p>
        </div>
      ) : dataLoading ? (
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <Loader2 className="animate-spin text-teal-400 h-10 w-10 mb-4" />
          <span className="text-slate-400 text-sm">Synchronizing tamper-proof audit trail...</span>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-[#233554] rounded-xl bg-[#0a192f]/50">
                <Shield className="mx-auto h-12 w-12 text-slate-600 mb-3" />
                <h3 className="text-slate-300 font-medium text-lg">No audit records found.</h3>
                <p className="text-slate-500 mt-1 max-w-sm mx-auto">
                  {searchQuery || actionFilter !== 'ALL'
                    ? "Try adjusting your filters to see more results."
                    : "No modifications have been tracked in the system yet."}
                </p>
              </div>
            ) : (
              filteredLogs.map(log => (
                <AuditCard key={log.id} log={log} />
              ))
            )}
          </div>

          {/* Cursor Pagination Anchor */}
          {hasMore && filteredLogs.length > 0 && actionFilter === 'ALL' && !searchQuery && (
            <div className="pt-6 flex justify-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 px-6 py-3 bg-[#112240] hover:bg-[#1a365d] border border-[#233554] transition-colors rounded-lg text-teal-400 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingMore ? (
                  <><Loader2 className="animate-spin h-5 w-5" /> Loading History...</>
                ) : (
                  'Load Older Records'
                )}
              </button>
            </div>
          )}

          {(actionFilter !== 'ALL' || searchQuery) && (
            <p className="text-center text-xs text-slate-500 pt-4">
              Pagination is disabled while client-side filters are active.
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default AuditLogs;
