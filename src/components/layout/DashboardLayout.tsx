import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopNavbar from './TopNavbar';
import { useAuth } from '../../context/AuthContext';
import { AssetHistoryPanel } from '../../features/audit/components/AssetHistoryPanel';

export type DashboardContextType = {
  requestAssetHistory: (assetId: string) => void;
};

const DashboardLayout = () => {
  const { loading } = useAuth();

  // Hoisted state prevents MapView re-render cascades
  const [historyAssetId, setHistoryAssetId] = useState<string | null>(null);
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);

  const requestAssetHistory = (assetId: string) => {
    setHistoryAssetId(assetId);
    setIsHistoryPanelOpen(true);
  };

  const closeHistoryPanel = () => {
    setIsHistoryPanelOpen(false);
  };

  if (loading) return null;

  return (
    <div className="min-h-screen bg-[#0a192f] text-slate-200 flex">
      <Sidebar />
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        <TopNavbar />
        <main className="flex-1 p-8 overflow-y-auto relative">
          <div className="max-w-7xl mx-auto w-full animate-fade-in">
            <Outlet context={{ requestAssetHistory } satisfies DashboardContextType} />
          </div>
        </main>
      </div>

      <AssetHistoryPanel
        assetId={historyAssetId}
        isOpen={isHistoryPanelOpen}
        onClose={closeHistoryPanel}
      />
    </div>
  );
};

export default DashboardLayout;
