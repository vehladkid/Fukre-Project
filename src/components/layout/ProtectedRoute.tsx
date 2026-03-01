import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { UserRole } from '../../context/AuthContext';
import Unauthorized from '../../pages/Unauthorized';

interface ProtectedRouteProps {
    allowedRoles?: UserRole[];
}

const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
    const { session, role, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a192f] flex flex-col items-center justify-center space-y-4">
                <div className="w-10 h-10 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin"></div>
                <p className="text-teal-500 font-mono text-sm">Authenticating...</p>
            </div>
        );
    }

    if (!session) {
        return <Navigate to="/login" replace />;
    }

    if (allowedRoles && role && !allowedRoles.includes(role)) {
        return <Unauthorized />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
