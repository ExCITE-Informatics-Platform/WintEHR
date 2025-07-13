/**
 * LayoutV3 Component
 * Modern application layout with improved navigation, search, and workflow support
 * 
 * Migrated to TypeScript with comprehensive type safety for advanced layout management.
 */

import React, { useState, useContext, useMemo, ReactNode, MouseEvent } from 'react';
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
  Avatar,
  Badge,
  InputBase,
  Paper,
  Tooltip,
  Stack,
  Card,
  CardContent,
  Collapse,
  ListSubheader,
  alpha,
  Breadcrumbs,
  Link,
  Button,
  Fab,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
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
  Security as SecurityIcon,
  AccountCircle as AccountCircleIcon,
  Logout as LogoutIcon,
  Settings as SettingsIcon,
  Search as SearchIcon,
  Notifications as NotificationsIcon,
  ExpandLess,
  ExpandMore,
  Add as AddIcon,
  Upload as UploadIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  DashboardCustomize as DashboardCustomizeIcon,
  Timeline as TimelineIcon,
  Analytics as AnalyticsIcon,
  LocalHospital as MedicalIcon,
  NavigateNext as NavigateNextIcon,
  Home as HomeIcon,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { MedicalThemeContext } from '../App';
import NotificationBell from './NotificationBell';
import ThemeSwitcher from './theme/ThemeSwitcher';
import SearchBar from './SearchBar';

/**
 * Type definitions for LayoutV3 component
 */
export interface LayoutV3Props {
  children: ReactNode;
  sx?: SxProps<Theme>;
}

export interface NavigationItem {
  text: string;
  icon: ReactNode;
  path: string;
  description: string;
  badge?: string;
}

export interface NavigationSection {
  title: string;
  icon: ReactNode;
  items: NavigationItem[];
}

export interface NavigationConfig {
  [key: string]: NavigationSection;
}

export interface QuickAction {
  name: string;
  icon: ReactNode;
  action: string;
}

export interface NavigationSectionProps {
  section: NavigationSection;
  sectionKey: string;
  isOpen: boolean;
  onToggle: (sectionKey: string) => void;
  selectedPath: string;
  onNavigate: (path: string) => void;
}

export interface User {
  id?: string;
  name?: string;
  display_name?: string;
  username?: string;
  email?: string;
  role?: string;
  avatar?: string;
}

export interface MedicalThemeContextType {
  currentTheme?: string;
  currentMode?: 'light' | 'dark';
  onThemeChange?: (theme: string) => void;
  onModeChange?: (mode: 'light' | 'dark') => void;
}

/**
 * Constants
 */
const drawerWidth = 280;

// Enhanced navigation structure with categories and workflows
const navigationConfig: NavigationConfig = {
  clinical: {
    title: 'Clinical Workflows',
    icon: <MedicalIcon />,
    items: [
      { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard', description: 'Overview & quick actions' },
      { text: 'Patients', icon: <PeopleIcon />, path: '/patients', description: 'Patient management' },
      { text: 'Encounters', icon: <EventNoteIcon />, path: '/encounters', description: 'Visit management' },
      { text: 'Orders & Results', icon: <ScienceIcon />, path: '/lab-results', description: 'Lab & imaging' },
      { text: 'Medications', icon: <PharmacyIcon />, path: '/medications', description: 'Medication management' },
      { text: 'Pharmacy', icon: <PharmacyIcon />, path: '/pharmacy', description: 'Pharmacy workflow & dispensing', badge: 'New' }
    ]
  },
  analytics: {
    title: 'Population Health',
    icon: <AnalyticsIcon />,
    items: [
      { text: 'Population Analytics', icon: <TrendingUpIcon />, path: '/analytics', description: 'Health trends & metrics' },
      { text: 'Quality Measures', icon: <AssessmentIcon />, path: '/quality', description: 'Performance tracking' },
      { text: 'Care Gaps', icon: <TimelineIcon />, path: '/care-gaps', description: 'Preventive care tracking' }
    ]
  },
  tools: {
    title: 'Developer Tools',
    icon: <ApiIcon />,
    items: [
      { text: 'FHIR Explorer', icon: <ApiIcon />, path: '/fhir-explorer', description: 'Browse FHIR resources', badge: 'Enhanced' },
      { text: 'UI Composer', icon: <DashboardCustomizeIcon />, path: '/ui-composer', description: 'Dynamic UI generation', badge: 'Experimental' },
      { text: 'CDS Hooks', icon: <WebhookIcon />, path: '/cds-hooks', description: 'Clinical decision support' },
      { text: 'CDS Studio', icon: <LightbulbIcon />, path: '/cds-studio', description: 'Visual CDS builder', badge: 'New' },
      { text: 'Training Center', icon: <LightbulbIcon />, path: '/training', description: 'Learning & demos' }
    ]
  },
  admin: {
    title: 'Administration',
    icon: <SecurityIcon />,
    items: [
      { text: 'Audit Trail', icon: <SecurityIcon />, path: '/audit-trail', description: 'Security & compliance' },
      { text: 'System Settings', icon: <SettingsIcon />, path: '/settings', description: 'Configuration' }
    ]
  }
};

const quickActions: QuickAction[] = [
  { name: 'New Patient', icon: <AddIcon />, action: 'newPatient' },
  { name: 'Upload Data', icon: <UploadIcon />, action: 'uploadData' },
  { name: 'Export Report', icon: <DownloadIcon />, action: 'exportReport' },
  { name: 'Refresh Data', icon: <RefreshIcon />, action: 'refreshData' }
];

/**
 * NavigationSection Component
 */
const NavigationSection: React.FC<NavigationSectionProps> = ({ 
  section, 
  sectionKey, 
  isOpen, 
  onToggle, 
  selectedPath, 
  onNavigate 
}) => {
  return (
    <Box>
      <ListSubheader
        component="div"
        sx={{
          bgcolor: 'transparent',
          color: 'text.secondary',
          fontWeight: 600,
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: 1,
          py: 1
        }}
      >
        <ListItemButton onClick={() => onToggle(sectionKey)} sx={{ borderRadius: 1 }}>
          <ListItemIcon sx={{ minWidth: 36 }}>
            {section.icon}
          </ListItemIcon>
          <ListItemText primary={section.title} />
          {isOpen ? <ExpandLess /> : <ExpandMore />}
        </ListItemButton>
      </ListSubheader>
      
      <Collapse in={isOpen} timeout="auto" unmountOnExit>
        <List dense sx={{ pl: 1 }}>
          {section.items.map((item) => (
            <ListItem key={item.path} disablePadding>
              <ListItemButton
                onClick={() => onNavigate(item.path)}
                selected={selectedPath === item.path}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  '&.Mui-selected': {
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    '& .MuiListItemIcon-root': {
                      color: 'primary.contrastText'
                    },
                    '&:hover': {
                      bgcolor: 'primary.dark'
                    }
                  },
                  '&:hover': {
                    bgcolor: alpha('#000', 0.04)
                  }
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" fontWeight={selectedPath === item.path ? 600 : 400}>
                        {item.text}
                      </Typography>
                      {item.badge && (
                        <Chip
                          label={item.badge}
                          size="small"
                          color="secondary"
                          sx={{ height: 16, fontSize: '0.6rem' }}
                        />
                      )}
                    </Box>
                  }
                  secondary={item.description}
                  secondaryTypographyProps={{
                    variant: 'caption',
                    color: selectedPath === item.path ? 'inherit' : 'text.secondary'
                  }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Collapse>
    </Box>
  );
};

/**
 * LayoutV3 Component
 */
const LayoutV3: React.FC<LayoutV3Props> = ({ children, sx }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  
  // Navigation state
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    clinical: true,
    analytics: false,
    tools: false,
    admin: false
  });
  
  // Menu state
  const [profileAnchorEl, setProfileAnchorEl] = useState<null | HTMLElement>(null);
  const [speedDialOpen, setSpeedDialOpen] = useState<boolean>(false);
  
  // Context
  const medicalThemeContext = useContext<MedicalThemeContextType | null>(MedicalThemeContext);

  // Computed values
  const breadcrumbs = useMemo(() => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const crumbs = [{ label: 'Home', path: '/dashboard' }];
    
    let currentPath = '';
    pathSegments.forEach(segment => {
      currentPath += `/${segment}`;
      const item = Object.values(navigationConfig)
        .flatMap(section => section.items)
        .find(item => item.path === currentPath);
      
      if (item) {
        crumbs.push({ label: item.text, path: currentPath });
      }
    });
    
    return crumbs;
  }, [location.pathname]);

  // Event handlers
  const handleDrawerToggle = (): void => {
    setMobileOpen(!mobileOpen);
  };

  const handleSectionToggle = (sectionKey: string): void => {
    setOpenSections(prev => ({
      ...prev,
      [sectionKey]: !prev[sectionKey]
    }));
  };

  const handleNavigation = (path: string): void => {
    navigate(path);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const handleProfileMenuOpen = (event: MouseEvent<HTMLElement>): void => {
    setProfileAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = (): void => {
    setProfileAnchorEl(null);
  };

  const handleLogout = async (): Promise<void> => {
    try {
      await logout();
      handleProfileMenuClose();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      handleProfileMenuClose();
      navigate('/login');
    }
  };

  const handleQuickAction = (action: string): void => {
    switch (action) {
      case 'newPatient':
        navigate('/patients?action=new');
        break;
      case 'uploadData':
        // TODO: Implement data upload functionality
        console.log('Upload data action');
        break;
      case 'exportReport':
        // TODO: Implement export functionality
        console.log('Export report action');
        break;
      case 'refreshData':
        window.location.reload();
        break;
      default:
        console.log('Unknown action:', action);
    }
    setSpeedDialOpen(false);
  };

  const getUserDisplayName = (): string => {
    if (!user) return 'User';
    return user.display_name || user.name || user.username || 'User';
  };

  const getUserInitial = (): string => {
    const name = getUserDisplayName();
    return name.charAt(0).toUpperCase();
  };

  // Drawer content
  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Logo/Brand */}
      <Toolbar 
        sx={{ 
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
          color: 'white',
          minHeight: 72
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
          <Box 
            sx={{ 
              width: 40, 
              height: 40, 
              borderRadius: 2,
              background: 'rgba(255, 255, 255, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <MedicalIcon sx={{ color: 'white', fontSize: 24 }} />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={700} fontSize="1.1rem">
              MedGenEMR V3
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.8 }}>
              Advanced Clinical Platform
            </Typography>
          </Box>
        </Box>
      </Toolbar>

      {/* Search Bar */}
      <Box sx={{ p: 2 }}>
        <SearchBar compact />
      </Box>

      <Divider />

      {/* Navigation */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', px: 1 }}>
        <List>
          {Object.entries(navigationConfig).map(([key, section]) => (
            <NavigationSection
              key={key}
              section={section}
              sectionKey={key}
              isOpen={openSections[key]}
              onToggle={handleSectionToggle}
              selectedPath={location.pathname}
              onNavigate={handleNavigation}
            />
          ))}
        </List>
      </Box>

      {/* User Info */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Card variant="outlined">
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                {getUserInitial()}
              </Avatar>
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600} noWrap>
                  {getUserDisplayName()}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {user?.role || 'Healthcare Provider'}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', ...sx }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: { lg: `calc(100% - ${drawerWidth}px)` },
          ml: { lg: `${drawerWidth}px` },
          bgcolor: 'background.paper',
          color: 'text.primary',
          boxShadow: 1,
          borderBottom: 1,
          borderColor: 'divider'
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { lg: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          
          {/* Breadcrumbs */}
          <Box sx={{ flexGrow: 1 }}>
            <Breadcrumbs
              separator={<NavigateNextIcon fontSize="small" />}
              aria-label="breadcrumb"
            >
              {breadcrumbs.map((crumb, index) => (
                <Link
                  key={crumb.path}
                  color="inherit"
                  onClick={() => handleNavigation(crumb.path)}
                  sx={{ 
                    cursor: 'pointer',
                    textDecoration: 'none',
                    '&:hover': { textDecoration: 'underline' }
                  }}
                >
                  {crumb.label}
                </Link>
              ))}
            </Breadcrumbs>
          </Box>

          {/* Toolbar Actions */}
          <Stack direction="row" spacing={1} alignItems="center">
            {medicalThemeContext && (
              <ThemeSwitcher
                currentTheme={medicalThemeContext.currentTheme}
                currentMode={medicalThemeContext.currentMode}
                onThemeChange={medicalThemeContext.onThemeChange}
                onModeChange={medicalThemeContext.onModeChange}
                compact
              />
            )}
            
            <NotificationBell />
            
            <Tooltip title="Account settings">
              <IconButton onClick={handleProfileMenuOpen}>
                <Avatar sx={{ width: 32, height: 32 }}>
                  {getUserInitial()}
                </Avatar>
              </IconButton>
            </Tooltip>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Profile Menu */}
      <Menu
        anchorEl={profileAnchorEl}
        open={Boolean(profileAnchorEl)}
        onClose={handleProfileMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={() => { handleNavigation('/profile'); handleProfileMenuClose(); }}>
          <ListItemIcon><AccountCircleIcon fontSize="small" /></ListItemIcon>
          Profile
        </MenuItem>
        <MenuItem onClick={() => { handleNavigation('/settings'); handleProfileMenuClose(); }}>
          <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
          Settings
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
          Logout
        </MenuItem>
      </Menu>

      {/* Navigation Drawer */}
      <Box
        component="nav"
        sx={{ width: { lg: drawerWidth }, flexShrink: { lg: 0 } }}
      >
        <Drawer
          variant={isMobile ? 'temporary' : 'permanent'}
          open={isMobile ? mobileOpen : true}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            '& .MuiDrawer-paper': {
              boxSizing: 'border-box',
              width: drawerWidth,
              border: 'none',
              boxShadow: 2
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { lg: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          bgcolor: 'background.default',
          pt: '72px'
        }}
      >
        {children}
      </Box>

      {/* Speed Dial for Quick Actions */}
      <SpeedDial
        ariaLabel="Quick actions"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        icon={<SpeedDialIcon />}
        open={speedDialOpen}
        onOpen={() => setSpeedDialOpen(true)}
        onClose={() => setSpeedDialOpen(false)}
      >
        {quickActions.map((action) => (
          <SpeedDialAction
            key={action.action}
            icon={action.icon}
            tooltipTitle={action.name}
            onClick={() => handleQuickAction(action.action)}
          />
        ))}
      </SpeedDial>
    </Box>
  );
};

export default LayoutV3;