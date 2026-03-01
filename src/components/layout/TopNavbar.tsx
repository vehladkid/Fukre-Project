import React from 'react';
import { Bell, Search, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const TopNavbar = () => {
  const [currentTime, setCurrentTime] = React.useState(new Date());
  const { user, profile, role } = useAuth();

  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-20 bg-[#0a192f]/90 backdrop-blur-md border-b border-[#233554] flex items-center justify-between px-8 sticky top-0 z-10 w-full">
      {/* Search */}
      <div className="flex-1 max-w-xl">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-teal-400 transition-colors" size={18} />
          <input
            type="text"
            placeholder="Search assets, zones, or reports..."
            className="w-full bg-[#112240] border border-[#233554] rounded-full pl-10 pr-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/50 transition-all placeholder:text-slate-600"
          />
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-6">
        {/* Time */}
        <div className="hidden md:flex flex-col items-end mr-4">
          <span className="text-sm font-semibold text-slate-200 tabular-nums">
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="text-xs text-slate-500 font-medium">
            {currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>

        {/* Notifications */}
        <button className="relative p-2 text-slate-400 hover:text-teal-400 transition-colors rounded-full hover:bg-[#112240]">
          <Bell size={20} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.6)]"></span>
        </button>

        {/* User Profile */}
        <div className="flex items-center gap-3 pl-4 border-l border-[#233554]">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-slate-200">{profile?.full_name || user?.email}</p>
            <div className="flex items-center justify-end gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
              <p className="text-xs text-teal-400 font-semibold uppercase tracking-wider">{role}</p>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#112240] to-[#233554] border border-[#233554] flex items-center justify-center overflow-hidden ring-2 ring-transparent hover:ring-teal-500/30 transition-all cursor-pointer">
            <User size={20} className="text-slate-300" />
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopNavbar;
