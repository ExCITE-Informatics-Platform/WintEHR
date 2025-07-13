/**
 * ClinicalLayout Component
 * Minimal layout for clinical workspace with maximum screen real estate
 * 
 * Migrated to TypeScript with comprehensive type safety for clinical workflow layout.
 */

import React, { useState, useContext, ReactNode, MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AppBar,
  Box,
  IconButton,
  Toolbar,
  Typography,
  useTheme,
  Menu,
  MenuItem,
  Avatar,
  Stack,
  Tooltip,
  ListItemIcon,
  Divider,
  alpha,
  SxProps,
  Theme,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  AccountCircle as AccountCircleIcon,
  Logout as LogoutIcon,
  Settings as SettingsIcon,
  Help as HelpIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { MedicalThemeContext } from '../App';
import NotificationBell from './NotificationBell';
import ThemeSwitcher from './theme/ThemeSwitcher';

/**
 * Type definitions for ClinicalLayout component
 */
export interface ClinicalLayoutProps {
  children: ReactNode;
  backPath?: string;
  title?: string;
  showBackButton?: boolean;
  showNotifications?: boolean;
  showThemeSwitcher?: boolean;
  showHelp?: boolean;
  sx?: SxProps<Theme>;
}

export interface User {
  id?: string;
  name?: string;
  display_name?: string;
  username?: string;
  email?: string;
  role?: string;
}

export interface MedicalThemeContextType {
  currentTheme?: string;
  currentMode?: 'light' | 'dark';
  onThemeChange?: (theme: string) => void;
  onModeChange?: (mode: 'light' | 'dark') => void;
}

/**
 * ClinicalLayout Component
 */
const ClinicalLayout: React.FC<ClinicalLayoutProps> = ({ 
  children,
  backPath = '/patients',
  title = 'MedGenEMR',
  showBackButton = true,
  showNotifications = true,
  showThemeSwitcher = true,
  showHelp = true,
  sx
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const medicalThemeContext = useContext<MedicalThemeContextType | null>(MedicalThemeContext);

  const handleProfileMenuOpen = (event: MouseEvent<HTMLElement>): void => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = (): void => {
    setAnchorEl(null);
  };

  const handleLogout = async (): Promise<void> => {
    try {
      await logout();
      handleProfileMenuClose();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Still close menu and navigate even if logout fails
      handleProfileMenuClose();
      navigate('/login');
    }
  };

  const handleBack = (): void => {
    navigate(backPath);
  };

  const handleProfileNavigation = (): void => {
    navigate('/profile');
    handleProfileMenuClose();
  };

  const handleSettingsNavigation = (): void => {
    navigate('/settings');
    handleProfileMenuClose();
  };

  const handleHelpClick = (): void => {
    // TODO: Implement help system or navigate to help page
    navigate('/help');
  };

  const getUserInitial = (): string => {
    if (!user) return 'U';
    return user.display_name?.[0] || user.name?.[0] || user.username?.[0] || 'U';
  };

  const isMenuOpen = Boolean(anchorEl);
  const isDarkMode = theme.palette.mode === 'dark';

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100vh', 
        overflow: 'hidden',
        ...sx
      }}
    >
      {/* Minimal App Bar */}
      <AppBar 
        position="static" 
        elevation={0}
        sx={{
          bgcolor: isDarkMode ? 'background.paper' : 'primary.main',
          color: isDarkMode ? 'text.primary' : 'primary.contrastText',
          borderBottom: 1,
          borderColor: 'divider',
          height: 48
        }}
      >
        <Toolbar variant="dense" sx={{ minHeight: 48, px: 1 }}>
          {/* Back Button */}
          {showBackButton && (
            <Tooltip title="Back to Patient List">
              <IconButton 
                color="inherit" 
                onClick={handleBack}
                size="small"
                sx={{ mr: 1 }}
                aria-label="Go back"
              >
                <BackIcon />
              </IconButton>
            </Tooltip>
          )}

          {/* App Name */}
          <Typography 
            variant="h6" 
            sx={{ 
              fontSize: '1rem', 
              fontWeight: 600,
              cursor: 'pointer'
            }}
            onClick={() => navigate('/dashboard')}
          >
            {title}
          </Typography>
          
          <Box sx={{ flexGrow: 1 }} />
          
          {/* Toolbar Actions */}
          <Stack direction="row" spacing={0.5} alignItems="center">
            {showThemeSwitcher && medicalThemeContext && (
              <ThemeSwitcher 
                currentTheme={medicalThemeContext.currentTheme}
                currentMode={medicalThemeContext.currentMode}
                onThemeChange={medicalThemeContext.onThemeChange}
                onModeChange={medicalThemeContext.onModeChange}
                compact
              />
            )}
            
            {showNotifications && (
              <NotificationBell sx={{ color: 'inherit' }} />
            )}
            
            {showHelp && (
              <Tooltip title="Help">
                <IconButton 
                  color="inherit" 
                  size="small"
                  onClick={handleHelpClick}
                  aria-label="Help"
                >
                  <HelpIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            
            <Tooltip title="Account">
              <IconButton 
                onClick={handleProfileMenuOpen} 
                color="inherit" 
                size="small"
                aria-label="User account"
              >
                <Avatar 
                  sx={{ 
                    width: 28, 
                    height: 28, 
                    bgcolor: alpha(theme.palette.common.white, 0.2),
                    fontSize: '0.875rem'
                  }}
                >
                  {getUserInitial()}
                </Avatar>
              </IconButton>
            </Tooltip>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Profile Menu */}
      <Menu
        anchorEl={anchorEl}
        open={isMenuOpen}
        onClose={handleProfileMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={handleProfileNavigation}>
          <ListItemIcon>
            <AccountCircleIcon fontSize="small" />
          </ListItemIcon>
          Profile
        </MenuItem>
        <MenuItem onClick={handleSettingsNavigation}>
          <ListItemIcon>
            <SettingsIcon fontSize="small" />
          </ListItemIcon>
          Settings
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          Logout
        </MenuItem>
      </Menu>

      {/* Main Content - No padding for maximum screen real estate */}
      <Box 
        component="main"
        sx={{ 
          flexGrow: 1, 
          overflow: 'hidden', 
          display: 'flex', 
          flexDirection: 'column',
          bgcolor: theme.palette.background.default
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

/**
 * Higher-order component for wrapping components with clinical layout
 */
export function withClinicalLayout<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  layoutProps?: Partial<ClinicalLayoutProps>
) {
  const WithClinicalLayoutComponent = (props: P) => (
    <ClinicalLayout {...layoutProps}>
      <WrappedComponent {...props} />
    </ClinicalLayout>
  );

  WithClinicalLayoutComponent.displayName = `withClinicalLayout(${WrappedComponent.displayName || WrappedComponent.name})`;

  return WithClinicalLayoutComponent;
}

export default ClinicalLayout;