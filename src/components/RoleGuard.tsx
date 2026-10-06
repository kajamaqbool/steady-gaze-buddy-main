import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth, getDashboardForRole } from '../context/AuthContext';

interface RoleGuardProps {
  allowedRoles: string[];
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles }) => {
  const { isAuthenticated, role, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!role) {
    console.error(`[RoleGuard] Authenticated user has no assigned role when accessing '${location.pathname}'. Redirecting to /login.`);
    return <Navigate to="/login" replace />;
  }

  const normalizedUserRole = role.trim().toUpperCase();
  const normalizedAllowedRoles = allowedRoles.map((r) => r.trim().toUpperCase());

  if (!normalizedAllowedRoles.includes(normalizedUserRole)) {
    const targetDashboard = getDashboardForRole(normalizedUserRole);
    if (!targetDashboard) {
      console.error(`[RoleGuard] User role '${normalizedUserRole}' cannot be mapped to a dashboard. Redirecting to /login.`);
      return <Navigate to="/login" replace />;
    }
    console.warn(`[RoleGuard] Role '${normalizedUserRole}' unauthorized for path '${location.pathname}'. Redirecting to '${targetDashboard}'.`);
    return <Navigate to={targetDashboard} replace />;
  }

  return <Outlet />;
};

export default RoleGuard;
