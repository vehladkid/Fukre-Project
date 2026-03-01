import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import { MapUIStateProvider } from './features/map/hooks/useMapUIState';
import { ZoneProvider } from './features/simulation/hooks/useZones';
import DashboardLayout from './components/layout/DashboardLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Infrastructure from './pages/Infrastructure';
import MapView from './features/map/MapView';
import AuditLogs from './pages/AuditLogs';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import SimulationSandbox from './pages/SimulationSandbox';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ZoneProvider>
          <MapUIStateProvider>
            <Routes>
              <Route path="/login" element={<Login />} />

              <Route path="/" element={<ProtectedRoute />}>
                <Route element={<DashboardLayout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="infrastructure" element={<Infrastructure />} />
                  <Route path="map" element={<MapView />} />

                  {/* Admin Only Routes */}
                  <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                    <Route path="audit" element={<AuditLogs />} />
                    <Route path="settings" element={<Settings />} />
                  </Route>

                  {/* Admin + Operator Routes */}
                  <Route element={<ProtectedRoute allowedRoles={['admin', 'operator']} />}>
                    <Route path="reports" element={<Reports />} />
                  </Route>
                </Route>

                {/* Fullscreen Sandbox Route */}
                <Route path="simulation" element={<SimulationSandbox />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </MapUIStateProvider>
        </ZoneProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
