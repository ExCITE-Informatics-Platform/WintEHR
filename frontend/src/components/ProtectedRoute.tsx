/**
 * Protected Route Component
 * Redirects to login if user is not authenticated
 * 
 * Migrated to TypeScript with comprehensive type safety for route protection.
 */

import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { CircularProgress, Box, SxProps, Theme } from '@mui/material';

/**
 * Type definitions for ProtectedRoute component
 */
export interface ProtectedRouteProps {
  children: ReactNode;
  redirectTo?: string;
  requireRole?: string | string[];
  sx?: SxProps<Theme>;
}

export interface AuthContextType {
  isAuthenticated: boolean;
  loading: boolean;
  user?: {
    id?: string;
    username?: string;
    email?: string;
    role?: string;
    roles?: string[];
  } | null;
}

/**
 * ProtectedRoute Component
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  redirectTo = '/login',
  requireRole,
  sx
}) => {
  const { isAuthenticated, loading, user } = useAuth();

  // Show loading spinner while authentication status is being determined
  if (loading) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          ...sx
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  // Check role-based access if specified
  if (requireRole && user) {
    const userRoles = user.roles || (user.role ? [user.role] : []);
    const requiredRoles = Array.isArray(requireRole) ? requireRole : [requireRole];
    
    const hasRequiredRole = requiredRoles.some(role => 
      userRoles.includes(role) || 
      role.toLowerCase() === user.role?.toLowerCase()
    );

    if (!hasRequiredRole) {
      // Redirect to unauthorized page or dashboard
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
};

/**
 * Higher-order component for protecting routes
 */
export function withProtectedRoute<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  protectionOptions?: Omit<ProtectedRouteProps, 'children'>
) {
  const WithProtectedRouteComponent = (props: P) => (
    <ProtectedRoute {...protectionOptions}>
      <WrappedComponent {...props} />
    </ProtectedRoute>
  );

  WithProtectedRouteComponent.displayName = `withProtectedRoute(${WrappedComponent.displayName || WrappedComponent.name})`;

  return WithProtectedRouteComponent;
}

/**
 * Hook for checking authentication and role access
 */
export function useProtectedAccess(requireRole?: string | string[]) {
  const { isAuthenticated, loading, user } = useAuth();

  const hasAccess = React.useMemo(() => {
    if (!isAuthenticated || loading) return false;
    
    if (!requireRole) return true;
    
    if (!user) return false;
    
    const userRoles = user.roles || (user.role ? [user.role] : []);
    const requiredRoles = Array.isArray(requireRole) ? requireRole : [requireRole];
    
    return requiredRoles.some(role => 
      userRoles.includes(role) || 
      role.toLowerCase() === user.role?.toLowerCase()
    );
  }, [isAuthenticated, loading, user, requireRole]);

  return {
    isAuthenticated,
    loading,
    hasAccess,
    user
  };
}

export default ProtectedRoute;