/**
 * Layout Component
 * Main application layout with navigation drawer and header
 * 
 * Migrated to TypeScript with comprehensive type safety for navigation and theme management.
 */

import React, { useState, useContext, ReactNode, MouseEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Divider,
  useTheme,
  useMediaQuery,
  Menu,
  MenuItem,
  Chip,
  SxProps,
  Theme,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  EventNote as EventNoteIcon,
  LocalPharmacy as PharmacyIcon,
  Science as ScienceIcon,
  TrendingUp as TrendingUpIcon,
  Api as ApiIcon,
  Lightbulb as LightbulbIcon,
  Webhook as WebhookIcon,
  Assessment as AssessmentIcon,
  AccountCircle as AccountCircleIcon,
  Logout as LogoutIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { MedicalThemeContext } from '../App';
import NotificationBell from './NotificationBell';

/**
 * Type definitions for Layout component
 */
export interface LayoutProps {
  children: ReactNode;
}

export interface MenuItem {
  text: string;
  icon: ReactNode;
  emoji: string;
  path: string;
  divider?: never;
}

export interface MenuDivider {
  divider: true;
  text?: never;
  icon?: never;
  emoji?: never;
  path?: never;
}

export type MenuItemType = MenuItem | MenuDivider;

export interface MedicalThemeContextType {
  currentMode: 'light' | 'dark';
  onModeChange: (mode: 'light' | 'dark') => void;
}

export interface User {
  display_name?: string;
  name?: string;
  username?: string;
  id?: string;
  email?: string;
  role?: string;
}

/**
 * Constants
 */
const drawerWidth = 240;

const menuItems: MenuItemType[] = [
  { text: 'Dashboard', icon: <DashboardIcon />, emoji: '🏠', path: '/dashboard' },
  { text: 'Patients', icon: <PeopleIcon />, emoji: '👥', path: '/patients' },
  { text: 'Encounters', icon: <EventNoteIcon />, emoji: '📋', path: '/encounters' },
  { text: 'Lab Results', icon: <ScienceIcon />, emoji: '🧪', path: '/lab-results' },
  { text: 'Medications', icon: <PharmacyIcon />, emoji: '💊', path: '/medications' },
  { divider: true },
  { text: 'Population Analytics', icon: <TrendingUpIcon />, emoji: '📊', path: '/analytics' },
  { text: 'Quality Measures', icon: <AssessmentIcon />, emoji: '✅', path: '/quality' },
  { divider: true },
  { text: 'FHIR Explorer', icon: <ApiIcon />, emoji: '🔍', path: '/fhir' },
  { text: 'CDS Demo', icon: <LightbulbIcon />, emoji: '💡', path: '/cds-demo' },
  { text: 'CDS Hooks Builder', icon: <WebhookIcon />, emoji: '🎯', path: '/cds-hooks' },
  { divider: true },
  { text: 'Audit Trail', icon: <SecurityIcon />, emoji: '🔐', path: '/audit-trail' },
];

/**
 * Main Layout Component
 */
function Layout({ children }: LayoutProps): JSX.Element {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const medicalThemeContext = useContext<MedicalThemeContextType | null>(MedicalThemeContext);

  const handleDrawerToggle = (): void => {
    setMobileOpen(!mobileOpen);
  };

  const handleNavigation = (path: string): void => {
    navigate(path);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

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

  const handleSettingsNavigation = (): void => {
    navigate('/settings');
    handleProfileMenuClose();
  };

  const handleThemeToggle = (): void => {
    if (medicalThemeContext) {
      const newMode = medicalThemeContext.currentMode === 'light' ? 'dark' : 'light';
      medicalThemeContext.onModeChange(newMode);
    }
  };

  const getCurrentPageTitle = (): string => {
    const currentItem = menuItems.find(
      (item): item is MenuItem => !('divider' in item) && item.path === location.pathname
    );
    return currentItem?.text || 'EMR';
  };

  const getUserDisplayName = (): string => {
    if (!user) return 'Provider';
    return user.display_name || user.name || user.username || 'Provider';
  };

  const drawer = (
    <div>
      <Toolbar 
        sx={{ 
          backgroundColor: theme.palette.primary.main,
          color: 'white',
          borderBottom: `1px solid ${theme.palette.primary.dark}`,
        }}
      >
        <Typography 
          variant="h6" 
          noWrap 
          component="div" 
          sx={{ 
            fontWeight: 700,
            letterSpacing: 0.5,
            fontSize: '1.3rem',
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          <Box sx={{ 
            width: 36, 
            height: 36, 
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(255, 255, 255, 0.3)',
          }}>
            <span style={{ fontSize: '1.4rem' }}>🏥</span>
          </Box>
          MedFlow EMR
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item, index) => {
          if ('divider' in item && item.divider) {
            return <Divider key={index} sx={{ my: 1 }} />;
          }
          
          const menuItem = item as MenuItem;
          const isSelected = location.pathname === menuItem.path;
          
          return (
            <ListItem key={menuItem.text} disablePadding>
              <ListItemButton
                selected={isSelected}
                onClick={() => handleNavigation(menuItem.path)}
                sx={{
                  borderRadius: '8px',
                  margin: '4px 12px',
                  transition: 'all 0.2s ease',
                  '&.Mui-selected': {
                    backgroundColor: theme.palette.primary.light + '20',
                    color: theme.palette.primary.dark,
                    borderLeft: `3px solid ${theme.palette.primary.main}`,
                    '& .MuiListItemIcon-root': {
                      color: theme.palette.primary.main,
                    },
                    '&:hover': {
                      backgroundColor: theme.palette.primary.light + '30',
                    },
                  },
                  '&:hover': {
                    backgroundColor: theme.palette.action.hover,
                    transform: 'translateX(2px)',
                  },
                }}
              >
                <ListItemIcon
                  sx={{
                    color: isSelected ? theme.palette.primary.main : 'inherit',
                    minWidth: 40,
                  }}
                >
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    fontSize: '1.3rem',
                  }}>
                    {menuItem.emoji}
                  </Box>
                </ListItemIcon>
                <ListItemText 
                  primary={menuItem.text} 
                  primaryTypographyProps={{
                    fontWeight: isSelected ? 600 : 400,
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </div>
  );

  const drawerSx: SxProps<Theme> = {
    display: { xs: isMobile ? 'block' : 'none', sm: 'block' },
    '& .MuiDrawer-paper': {
      boxSizing: 'border-box',
      width: drawerWidth,
      backgroundColor: '#FAFBFC',
      borderRight: '1px solid #E8ECF0',
    },
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          backgroundColor: theme.palette.primary.main,
          color: 'white',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {getCurrentPageTitle()}
          </Typography>
          
          {/* Theme Toggle */}
          {medicalThemeContext && (
            <IconButton
              color="inherit"
              onClick={handleThemeToggle}
              sx={{ mr: 2 }}
              title={medicalThemeContext.currentMode === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              <span style={{ fontSize: '1.5rem' }}>🌙</span>
            </IconButton>
          )}
          
          {/* Provider Info */}
          {user && (
            <Chip
              label={getUserDisplayName()}
              variant="outlined"
              sx={{ 
                mr: 2, 
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                color: theme.palette.primary.dark,
                fontWeight: 500,
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                },
              }}
            />
          )}
          
          <NotificationBell />
          <IconButton color="inherit" onClick={handleProfileMenuOpen}>
            <AccountCircleIcon />
          </IconButton>
          
          {/* Profile Menu */}
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleProfileMenuClose}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          >
            <MenuItem onClick={handleSettingsNavigation}>
              <ListItemIcon>
                <AccountCircleIcon fontSize="small" />
              </ListItemIcon>
              Profile & Settings
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant={isMobile ? 'temporary' : 'permanent'}
          open={isMobile ? mobileOpen : true}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better open performance on mobile
          }}
          sx={drawerSx}
        >
          {drawer}
        </Drawer>
      </Box>
      
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          backgroundColor: theme.palette.background.default,
          mt: '64px',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

export default Layout;