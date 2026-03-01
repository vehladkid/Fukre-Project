import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Building2, Map as MapIcon, FileText, Settings, LogOut, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';

const Sidebar = () => {
  const location = useLocation();
  const { role, logout } = useAuth();

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Building2, label: 'Infrastructure', path: '/infrastructure' },
    { icon: MapIcon, label: 'Map View', path: '/map' },
    ...(role === 'admin' ? [{ icon: ShieldAlert, label: 'Audit Logs', path: '/audit' }] : []),
    ...(role === 'admin' || role === 'operator' ? [{ icon: FileText, label: 'Reports', path: '/reports' }] : []),
    ...(role === 'admin' ? [{ icon: Settings, label: 'Settings', path: '/settings' }] : []),
  ];

  const handleLogout = async () => {
    await logout();
  };

  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="w-64 h-screen bg-[#112240] border-r border-[#233554] flex flex-col fixed left-0 top-0 z-20"
    >
      <div className="p-6 flex items-center gap-3 border-b border-[#233554]">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-teal-400 to-blue-500 flex items-center justify-center shadow-lg shadow-teal-500/20">
          <Building2 className="text-white w-5 h-5" />
        </div>
        <div>
          <h1 className="text-white font-bold text-lg tracking-tight leading-none">UIIP</h1>
          <p className="text-xs text-slate-400 font-medium">Urban Intel Portal</p>
        </div>
      </div>

      <nav className="flex-1 py-6 px-3 space-y-1">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `
                flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden
                ${isActive
                  ? 'bg-[#1d3b5a] text-teal-400 shadow-md shadow-black/20'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-[#1d3b5a]/50'}
              `}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute left-0 top-0 bottom-0 w-1 bg-teal-400 rounded-r-full"
                />
              )}
              <item.icon size={20} className={isActive ? 'text-teal-400' : 'text-slate-400 group-hover:text-slate-100'} />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[#233554]">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 w-full text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
        >
          <LogOut size={20} />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </motion.div>
  );
};

export default Sidebar;
