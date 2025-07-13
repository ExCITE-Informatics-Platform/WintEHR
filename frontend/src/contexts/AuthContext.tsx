/**
 * Authentication Context - TypeScript Migration
 * Real authentication context for the EMR system
 * 
 * Migrated to TypeScript with comprehensive type safety for user authentication,
 * authorization, and session management supporting both training and JWT modes.
 */
import * as React from 'react';
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import api from '../services/api';

/**
 * User role types for healthcare system
 */
export type UserRole = 'physician' | 'nurse' | 'pharmacist' | 'admin' | 'technician' | 'clerk';

/**
 * Permission types for RBAC
 */
export type Permission = 'read' | 'write' | 'prescribe' | 'dispense' | 'admin' | 'delete' | 'approve';

/**
 * Authentication modes
 */
export type AuthMode = 'training' | 'jwt';

/**
 * User interface for authenticated users
 */
export interface User {
  id: string;
  name: string;
  username?: string;
  email?: string;
  role: UserRole;
  permissions: Permission[];
  department?: string;
  licenseNumber?: string;
  npiNumber?: string;
  lastLogin?: string;
  sessionId?: string;
}

/**
 * Login credentials interface
 */
export interface LoginCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * Login response interface
 */
export interface LoginResponse {
  session_token: string;
  refresh_token?: string;
  token_type: 'bearer';
  expires_in?: number;
  provider: User;
}

/**
 * Authentication error interface
 */
export interface AuthError {
  message: string;
  code?: string;
  details?: any;
}

/**
 * Session validation result
 */
export interface SessionValidation {
  valid: boolean;
  user?: User;
  expiresAt?: string;
}

/**
 * Authentication state interface
 */
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  authMode: AuthMode;
  loading: boolean;
  error: AuthError | null;
  sessionExpiry: string | null;
}

/**
 * Authentication context interface
 */
export interface AuthContextType extends AuthState {
  // Authentication methods
  login: (credentials: LoginCredentials) => Promise<User>;
  logout: () => Promise<void>;
  
  // Session management
  checkSession: () => Promise<void>;
  refreshAuth: () => Promise<void>;
  validateSession: () => Promise<SessionValidation>;
  extendSession: () => Promise<void>;
  
  // Authorization methods
  hasPermission: (permission: Permission) => boolean;
  hasRole: (role: UserRole) => boolean;
  canAccess: (resource: string, action: Permission) => boolean;
  
  // Utility methods
  getUserRole: () => UserRole | null;
  getUserPermissions: () => Permission[];
  clearError: () => void;
  getCurrentUser: () => User | null;
}

/**
 * Provider props interface
 */
export interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Training mode user database
 */
const TRAINING_USERS: Record<string, User> = {
  demo: {
    id: 'demo',
    name: 'Dr. Demo',
    username: 'demo',
    email: 'demo@medgenemr.com',
    role: 'physician',
    permissions: ['read', 'write', 'prescribe'],
    department: 'Internal Medicine'
  },
  nurse: {
    id: 'nurse',
    name: 'Nurse Patricia',
    username: 'nurse',
    email: 'nurse@medgenemr.com',
    role: 'nurse',
    permissions: ['read', 'write'],
    department: 'Emergency'
  },
  pharmacist: {
    id: 'pharmacist',
    name: 'Dr. Pharmacist',
    username: 'pharmacist',
    email: 'pharmacist@medgenemr.com',
    role: 'pharmacist',
    permissions: ['read', 'dispense', 'approve'],
    department: 'Pharmacy'
  },
  admin: {
    id: 'admin',
    name: 'System Admin',
    username: 'admin',
    email: 'admin@medgenemr.com',
    role: 'admin',
    permissions: ['read', 'write', 'admin', 'delete'],
    department: 'IT'
  }
};

/**
 * Create the authentication context
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Authentication Provider Component
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<AuthError | null>(null);
  const [sessionExpiry, setSessionExpiry] = useState<string | null>(null);

  // Determine auth mode from environment
  const authMode: AuthMode = process.env.REACT_APP_JWT_ENABLED === 'true' ? 'jwt' : 'training';

  // Check for existing session on mount
  useEffect(() => {
    checkSession();
  }, []);

  // Clear error after timeout
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const checkSession = useCallback(async (): Promise<void> => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      if (authMode === 'training') {
        // For training mode, just use cached user data
        const cachedUser = localStorage.getItem('auth_user');
        if (cachedUser) {
          try {
            const userData = JSON.parse(cachedUser) as User;
            setUser(userData);
          } catch (e) {
            console.error('Error parsing cached user:', e);
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_user');
          }
        }
      } else {
        // For JWT mode, validate with server
        try {
          const response = await api.get<SessionValidation>('/api/auth/validate');
          if (response.data.valid && response.data.user) {
            setUser(response.data.user);
            setSessionExpiry(response.data.expiresAt || null);
          } else {
            // Invalid session, clear storage
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_user');
          }
        } catch (error) {
          console.error('Session validation failed:', error);
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
        }
      }
    }
    setLoading(false);
  }, [authMode]);

  const login = useCallback(async (credentials: LoginCredentials): Promise<User> => {
    setLoading(true);
    setError(null);
    
    try {
      if (authMode === 'training') {
        // Training mode - simple authentication
        const userData = TRAINING_USERS[credentials.username.toLowerCase()];
        if (userData && credentials.password === 'password') {
          // Store training token and user data
          localStorage.setItem('auth_token', 'training_token');
          localStorage.setItem('auth_user', JSON.stringify(userData));
          
          setUser(userData);
          return userData;
        } else {
          throw new Error('Invalid credentials. Use demo/nurse/pharmacist/admin with password "password"');
        }
      } else {
        // JWT mode - authenticate with server
        const response = await api.post<LoginResponse>('/api/auth/login', {
          username: credentials.username,
          password: credentials.password
        });
        
        const { session_token, refresh_token, provider, expires_in } = response.data;
        
        // Store tokens and user data
        localStorage.setItem('auth_token', session_token);
        if (refresh_token) {
          localStorage.setItem('refresh_token', refresh_token);
        }
        localStorage.setItem('auth_user', JSON.stringify(provider));
        
        // Calculate session expiry
        if (expires_in) {
          const expiryTime = new Date(Date.now() + expires_in * 1000).toISOString();
          setSessionExpiry(expiryTime);
        }
        
        setUser(provider);
        return provider;
      }
    } catch (error: any) {
      const authError: AuthError = {
        message: error.response?.data?.message || error.message || 'Login failed',
        code: error.response?.status?.toString() || 'UNKNOWN',
        details: error.response?.data
      };
      setError(authError);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [authMode]);

  const logout = useCallback(async (): Promise<void> => {
    try {
      if (authMode === 'jwt') {
        // Notify server of logout for JWT mode
        await api.post('/api/auth/logout');
      }
    } catch (error) {
      console.error('Logout API call failed:', error);
      // Continue with client-side logout even if server call fails
    } finally {
      // Clear all authentication data
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('auth_user');
      setUser(null);
      setSessionExpiry(null);
      setError(null);
    }
  }, [authMode]);

  const refreshAuth = useCallback(async (): Promise<void> => {
    if (authMode === 'training') {
      // Training mode doesn't need refresh
      return;
    }

    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await api.post<LoginResponse>('/api/auth/refresh', {
        refresh_token: refreshToken
      });

      const { session_token, refresh_token: newRefreshToken, provider, expires_in } = response.data;

      // Update stored tokens
      localStorage.setItem('auth_token', session_token);
      if (newRefreshToken) {
        localStorage.setItem('refresh_token', newRefreshToken);
      }
      localStorage.setItem('auth_user', JSON.stringify(provider));

      // Update state
      setUser(provider);
      if (expires_in) {
        const expiryTime = new Date(Date.now() + expires_in * 1000).toISOString();
        setSessionExpiry(expiryTime);
      }
    } catch (error: any) {
      const authError: AuthError = {
        message: 'Session refresh failed',
        code: 'REFRESH_FAILED',
        details: error.response?.data
      };
      setError(authError);
      
      // If refresh fails, force logout
      await logout();
      throw error;
    }
  }, [authMode, logout]);

  const validateSession = useCallback(async (): Promise<SessionValidation> => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      return { valid: false };
    }

    if (authMode === 'training') {
      // Training mode sessions are always valid if token exists
      return { valid: true, user: user || undefined };
    }

    try {
      const response = await api.get<SessionValidation>('/api/auth/validate');
      return response.data;
    } catch (error) {
      return { valid: false };
    }
  }, [authMode, user]);

  const extendSession = useCallback(async (): Promise<void> => {
    if (authMode === 'training') {
      // Training mode doesn't need session extension
      return;
    }

    try {
      const response = await api.post<{ expires_in: number }>('/api/auth/extend');
      if (response.data.expires_in) {
        const expiryTime = new Date(Date.now() + response.data.expires_in * 1000).toISOString();
        setSessionExpiry(expiryTime);
      }
    } catch (error) {
      console.error('Session extension failed:', error);
      throw error;
    }
  }, [authMode]);

  // Authorization methods
  const hasPermission = useCallback((permission: Permission): boolean => {
    return user?.permissions.includes(permission) || false;
  }, [user]);

  const hasRole = useCallback((role: UserRole): boolean => {
    return user?.role === role;
  }, [user]);

  const canAccess = useCallback((resource: string, action: Permission): boolean => {
    if (!user) return false;

    // Admin can access everything
    if (user.role === 'admin') return true;

    // Check if user has the required permission
    if (!hasPermission(action)) return false;

    // Resource-specific access control
    switch (resource) {
      case 'patient-data':
        return hasPermission('read');
      case 'prescriptions':
        return hasPermission('prescribe') || hasPermission('dispense');
      case 'lab-results':
        return hasPermission('read');
      case 'pharmacy':
        return hasRole('pharmacist') || hasRole('admin');
      case 'admin-panel':
        return hasRole('admin');
      default:
        return hasPermission('read');
    }
  }, [user, hasPermission, hasRole]);

  // Utility methods
  const getUserRole = useCallback((): UserRole | null => {
    return user?.role || null;
  }, [user]);

  const getUserPermissions = useCallback((): Permission[] => {
    return user?.permissions || [];
  }, [user]);

  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  const getCurrentUser = useCallback((): User | null => {
    return user;
  }, [user]);

  // Check for session expiry
  useEffect(() => {
    if (sessionExpiry && authMode === 'jwt') {
      const checkExpiry = () => {
        const now = new Date();
        const expiry = new Date(sessionExpiry);
        const timeToExpiry = expiry.getTime() - now.getTime();
        
        // If session expires in less than 5 minutes, try to refresh
        if (timeToExpiry < 5 * 60 * 1000 && timeToExpiry > 0) {
          refreshAuth().catch(() => {
            // If refresh fails, the error is already handled in refreshAuth
          });
        } else if (timeToExpiry <= 0) {
          // Session has expired
          logout();
        }
      };

      const interval = setInterval(checkExpiry, 60 * 1000); // Check every minute
      return () => clearInterval(interval);
    }
  }, [sessionExpiry, authMode, refreshAuth, logout]);

  const value: AuthContextType = {
    // State
    user,
    isAuthenticated: !!user,
    authMode,
    loading,
    error,
    sessionExpiry,
    
    // Authentication methods
    login,
    logout,
    
    // Session management
    checkSession,
    refreshAuth,
    validateSession,
    extendSession,
    
    // Authorization methods
    hasPermission,
    hasRole,
    canAccess,
    
    // Utility methods
    getUserRole,
    getUserPermissions,
    clearError,
    getCurrentUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook for using the authentication context
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * Higher-order component for protecting routes
 */
export function withAuthenticationRequired<P extends object>(
  Component: React.ComponentType<P>,
  options: {
    onRedirecting?: () => React.ReactElement;
    requiredRole?: UserRole;
    requiredPermission?: Permission;
  } = {}
): React.FC<P> {
  return function AuthenticatedComponent(props: P) {
    const { isAuthenticated, loading, hasRole, hasPermission } = useAuth();
    
    if (loading) {
      return options.onRedirecting ? options.onRedirecting() : <div>Loading...</div>;
    }
    
    if (!isAuthenticated) {
      return options.onRedirecting ? options.onRedirecting() : <div>Access denied. Please log in.</div>;
    }
    
    if (options.requiredRole && !hasRole(options.requiredRole)) {
      return <div>Access denied. Insufficient role permissions.</div>;
    }
    
    if (options.requiredPermission && !hasPermission(options.requiredPermission)) {
      return <div>Access denied. Insufficient permissions.</div>;
    }
    
    return <Component {...props} />;
  };
}

export default AuthContext;