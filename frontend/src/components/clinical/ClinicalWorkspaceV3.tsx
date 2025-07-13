/**
 * ClinicalWorkspaceV3 Component
 * Modern tab-based clinical workspace with customizable layouts
 * 
 * Migrated to TypeScript with comprehensive type safety for clinical workspace management.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Tabs,
  Tab,
  Badge,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  CircularProgress,
  Alert,
  Button,
  Typography,
  useTheme,
  useMediaQuery,
  Fab,
  SpeedDial,
  SpeedDialIcon,
  SpeedDialAction,
  Snackbar,
  SxProps,
  Theme,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Assignment as ChartIcon,
  EventNote as EncountersIcon,
  Science as ResultsIcon,
  LocalPharmacy as PharmacyIcon,
  Description as DocumentationIcon,
  Assignment as CarePlanIcon,
  Assignment,
  Assignment as OrdersIcon,
  Timeline as TimelineIcon,
  Image as ImagingIcon,
  Psychology as CDSIcon,
  ViewModule as LayoutIcon,
  Add as AddIcon,
  Print as PrintIcon,
  Settings as SettingsIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

// Contexts
import { useFHIRResource } from '../../contexts/FHIRResourceContext';
import { useAuth } from '../../contexts/AuthContext';
import { decodeFhirId } from '../../utils/navigationUtils';

// Components
import EnhancedPatientHeader from './workspace/EnhancedPatientHeader';
import WorkspaceContent from './workspace/WorkspaceContent';
import LayoutBuilder from './workspace/LayoutBuilder';
import CDSAlertsPanel from './cds/CDSAlertsPanel';

// Tab Components
import SummaryTab from './workspace/tabs/SummaryTab';
import ChartReviewTab from './workspace/tabs/ChartReviewTab';
import EncountersTab from './workspace/tabs/EncountersTab';
import ResultsTab from './workspace/tabs/ResultsTab';
import OrdersTab from './workspace/tabs/OrdersTab';
import PharmacyTab from './workspace/tabs/PharmacyTab';
import DocumentationTab from './workspace/tabs/DocumentationTab';
import CarePlanTab from './workspace/tabs/CarePlanTab';
import TimelineTab from './workspace/tabs/TimelineTab';
import ImagingTab from './workspace/tabs/ImagingTab';

/**
 * Type definitions for ClinicalWorkspaceV3 component
 */
export type TabId = 
  | 'summary' 
  | 'chart' 
  | 'encounters' 
  | 'results' 
  | 'orders' 
  | 'pharmacy' 
  | 'imaging' 
  | 'documentation' 
  | 'careplan' 
  | 'timeline';

export type CDSHookType = 'patient-view' | 'medication-prescribe' | 'order-sign' | 'order-select';
export type CDSAlertAction = 'accept' | 'reject' | 'dismiss' | 'snooze';

export interface TabConfig {
  id: TabId;
  label: string;
  icon: React.ReactElement;
  component: React.ComponentType<TabComponentProps>;
}

export interface TabComponentProps {
  patientId: string;
  onNotificationUpdate?: (count: number) => void;
  newNoteDialogOpen?: boolean;
  onNewNoteDialogClose?: () => void;
  newOrderDialogOpen?: boolean;
  onNewOrderDialogClose?: () => void;
  sx?: SxProps<Theme>;
}

export interface CustomLayout {
  id: string;
  name: string;
  description?: string;
  components: LayoutComponent[];
  config?: LayoutConfig;
}

export interface LayoutComponent {
  id: string;
  type: string;
  props?: Record<string, any>;
  gridArea?: string;
}

export interface LayoutConfig {
  columns?: number;
  rows?: number;
  gap?: number;
  responsive?: boolean;
}

export interface SpeedDialActionItem {
  icon: React.ReactElement;
  name: string;
  onClick: () => void;
  disabled?: boolean;
  tooltip?: string;
}

export interface SnackbarState {
  open: boolean;
  message: string;
  severity?: 'success' | 'error' | 'warning' | 'info';
}

export interface TabNotifications {
  [key: string]: number;
}

export interface WorkspacePreferences {
  defaultTab?: TabId;
  layoutPreference?: string;
  notificationSettings?: NotificationSettings;
}

export interface NotificationSettings {
  enableBadges?: boolean;
  enableSounds?: boolean;
  enableToasts?: boolean;
}

export interface CDSAlert {
  id: string;
  summary: string;
  detail?: string;
  indicator: 'info' | 'warning' | 'critical' | 'success';
  source?: {
    label: string;
    url?: string;
  };
  suggestions?: CDSSuggestion[];
}

export interface CDSSuggestion {
  label: string;
  type: 'create' | 'update' | 'delete';
  resource?: string;
  uuid?: string;
}

export interface AuthUser {
  id: string;
  username: string;
  email?: string;
  roles?: string[];
  permissions?: string[];
}

export interface FHIRResourceContextType {
  currentPatient: any; // Replace with proper FHIR Patient type
  setCurrentPatient: (patientId: string) => Promise<void>;
  isLoading: boolean;
}

export interface AuthContextType {
  currentUser: AuthUser | null;
  isAuthenticated: boolean;
  login: (credentials: any) => Promise<void>;
  logout: () => void;
}

/**
 * Constants
 */
const TAB_CONFIG: TabConfig[] = [
  { id: 'summary', label: 'Summary', icon: <DashboardIcon />, component: SummaryTab },
  { id: 'chart', label: 'Chart Review', icon: <ChartIcon />, component: ChartReviewTab },
  { id: 'encounters', label: 'Encounters', icon: <EncountersIcon />, component: EncountersTab },
  { id: 'results', label: 'Results', icon: <ResultsIcon />, component: ResultsTab },
  { id: 'orders', label: 'Orders', icon: <Assignment />, component: OrdersTab },
  { id: 'pharmacy', label: 'Pharmacy', icon: <PharmacyIcon />, component: PharmacyTab },
  { id: 'imaging', label: 'Imaging', icon: <ImagingIcon />, component: ImagingTab },
  { id: 'documentation', label: 'Documentation', icon: <DocumentationIcon />, component: DocumentationTab },
  { id: 'careplan', label: 'Care Plan', icon: <CarePlanIcon />, component: CarePlanTab },
  { id: 'timeline', label: 'Timeline', icon: <TimelineIcon />, component: TimelineTab },
];

const DEFAULT_PREFERENCES: WorkspacePreferences = {
  defaultTab: 'summary',
  notificationSettings: {
    enableBadges: true,
    enableSounds: false,
    enableToasts: true,
  },
};

/**
 * Helper functions
 */
const isValidTabId = (tabId: string): tabId is TabId => {
  return TAB_CONFIG.some(tab => tab.id === tabId);
};

const getStorageKey = (patientId: string, key: string): string => {
  return `workspace-${key}-${patientId}`;
};

const savePreference = (patientId: string, key: string, value: any): void => {
  try {
    localStorage.setItem(getStorageKey(patientId, key), JSON.stringify(value));
  } catch (error) {
    console.error('Failed to save preference:', error);
  }
};

const loadPreference = <T>(patientId: string, key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(getStorageKey(patientId, key));
    return stored ? JSON.parse(stored) : defaultValue;
  } catch (error) {
    console.error('Failed to load preference:', error);
    return defaultValue;
  }
};

/**
 * ClinicalWorkspaceV3 Component
 */
const ClinicalWorkspaceV3: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.down('lg'));
  
  // Route params
  const { id: encodedPatientId } = useParams<{ id: string }>();
  const patientId = decodeFhirId(encodedPatientId || '');
  
  // Contexts
  const { currentUser } = useAuth() as AuthContextType;
  const { currentPatient, setCurrentPatient, isLoading: isGlobalLoading } = useFHIRResource() as FHIRResourceContextType;
  
  // State
  const [activeTab, setActiveTab] = useState<TabId>('summary');
  const [customLayout, setCustomLayout] = useState<CustomLayout | null>(null);
  const [isLayoutBuilderOpen, setIsLayoutBuilderOpen] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
  const [speedDialOpen, setSpeedDialOpen] = useState<boolean>(false);
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null);
  const [tabNotifications, setTabNotifications] = useState<TabNotifications>({});
  const [newNoteDialogOpen, setNewNoteDialogOpen] = useState<boolean>(false);
  const [newOrderDialogOpen, setNewOrderDialogOpen] = useState<boolean>(false);
  const [snackbar, setSnackbar] = useState<SnackbarState>({ open: false, message: '' });
  const [preferences, setPreferences] = useState<WorkspacePreferences>(DEFAULT_PREFERENCES);

  // Load patient data
  useEffect(() => {
    const loadPatient = async (): Promise<void> => {
      if (patientId && (!currentPatient || currentPatient.id !== patientId)) {
        try {
          setLoadError(null);
          await setCurrentPatient(patientId);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load patient';
          console.error('Error loading patient:', error);
          setLoadError(errorMessage);
        } finally {
          setIsInitialLoad(false);
        }
      } else if (currentPatient && currentPatient.id === patientId) {
        setIsInitialLoad(false);
      }
    };

    if (patientId) {
      loadPatient();
    }
  }, [patientId, currentPatient, setCurrentPatient]);

  // Handle URL parameters for tab
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const tab = searchParams.get('tab');
    if (tab && isValidTabId(tab)) {
      setActiveTab(tab);
    }
  }, [location.search]);

  // Load saved preferences
  useEffect(() => {
    if (currentPatient) {
      const savedTab = loadPreference(currentPatient.id, 'tab', 'summary');
      if (isValidTabId(savedTab)) {
        setActiveTab(savedTab);
      }
      
      const savedPreferences = loadPreference(currentPatient.id, 'preferences', DEFAULT_PREFERENCES);
      setPreferences(savedPreferences);
    }
  }, [currentPatient]);

  // Handle tab change
  const handleTabChange = useCallback((event: React.SyntheticEvent, newValue: TabId): void => {
    setActiveTab(newValue);
    
    // Update URL
    const searchParams = new URLSearchParams(location.search);
    searchParams.set('tab', newValue);
    navigate(`${location.pathname}?${searchParams.toString()}`, { replace: true });
    
    // Save preference
    if (currentPatient) {
      savePreference(currentPatient.id, 'tab', newValue);
    }

    // Clear notification for this tab
    setTabNotifications(prev => ({ ...prev, [newValue]: 0 }));
  }, [location.search, location.pathname, navigate, currentPatient]);

  // Handle custom layout selection
  const handleLayoutSelect = useCallback((layout: CustomLayout): void => {
    setCustomLayout(layout);
    setIsLayoutBuilderOpen(false);
    
    if (currentPatient) {
      savePreference(currentPatient.id, 'customLayout', layout);
    }
  }, [currentPatient]);

  // Handle print
  const handlePrint = useCallback((): void => {
    // Add print-specific styles temporarily
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        /* Hide navigation and controls during print */
        .MuiSpeedDial-root,
        .MuiTabs-root,
        .MuiIconButton-root,
        .MuiButton-root:not(.print-show) {
          display: none !important;
        }
        
        /* Ensure content fills the page */
        body { margin: 0; }
        .MuiBox-root { overflow: visible !important; }
        
        /* Show patient header clearly */
        .MuiPaper-root { box-shadow: none !important; }
      }
    `;
    document.head.appendChild(style);
    
    // Print and remove styles
    window.print();
    setTimeout(() => style.remove(), 100);
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(async (): Promise<void> => {
    if (currentPatient) {
      try {
        // Refresh patient data without full page reload
        await setCurrentPatient(patientId);
        // Show success feedback
        setSnackbar({ 
          open: true, 
          message: 'Patient data refreshed successfully', 
          severity: 'success' 
        });
      } catch (error) {
        console.error('Error refreshing data:', error);
        setSnackbar({ 
          open: true, 
          message: 'Failed to refresh data. Reloading page...', 
          severity: 'error' 
        });
        // Fallback to page reload after a short delay
        setTimeout(() => window.location.reload(), 1500);
      }
    } else {
      window.location.reload();
    }
  }, [currentPatient, patientId, setCurrentPatient]);

  // Speed dial actions
  const speedDialActions: SpeedDialActionItem[] = [
    { 
      icon: <AddIcon />, 
      name: 'New Note', 
      onClick: () => {
        setActiveTab('documentation');
        setNewNoteDialogOpen(true);
      }
    },
    { 
      icon: <OrdersIcon />, 
      name: 'New Order', 
      onClick: () => {
        setActiveTab('orders');
        setNewOrderDialogOpen(true);
      }
    },
    { 
      icon: <LayoutIcon />, 
      name: 'Customize Layout', 
      onClick: () => setIsLayoutBuilderOpen(true) 
    },
    { 
      icon: <PrintIcon />, 
      name: 'Print', 
      onClick: handlePrint 
    },
    { 
      icon: <RefreshIcon />, 
      name: 'Refresh', 
      onClick: handleRefresh 
    },
  ];

  // Tab notification handler (called by child components)
  const updateTabNotification = useCallback((tabId: string, count: number): void => {
    setTabNotifications(prev => ({ ...prev, [tabId]: count }));
  }, []);

  // Handle CDS alert actions
  const handleCDSAlertAction = useCallback((
    alert: CDSAlert, 
    action: CDSAlertAction, 
    suggestion?: CDSSuggestion
  ): void => {
    try {
      if (action === 'accept' && suggestion) {
        // Could trigger FHIR resource creation, navigation, etc.
        console.log('Accepting CDS suggestion:', suggestion);
        setSnackbar({
          open: true,
          message: `Applied suggestion: ${suggestion.label}`,
          severity: 'success'
        });
      } else if (action === 'reject') {
        console.log('Rejecting CDS alert:', alert.id);
      } else if (action === 'dismiss') {
        console.log('Dismissing CDS alert:', alert.id);
      }
    } catch (error) {
      console.error('Error handling CDS alert action:', error);
      setSnackbar({
        open: true,
        message: 'Failed to process alert action',
        severity: 'error'
      });
    }
  }, []);

  // Handle settings menu actions
  const handleSavePreferences = useCallback((): void => {
    if (currentPatient) {
      savePreference(currentPatient.id, 'tab', activeTab);
      savePreference(currentPatient.id, 'preferences', preferences);
      setSnackbar({ 
        open: true, 
        message: 'Preferences saved! Your current tab will be remembered for this patient.',
        severity: 'success'
      });
    }
    setSettingsAnchor(null);
  }, [currentPatient, activeTab, preferences]);

  // Error state
  if (loadError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert 
          severity="error" 
          action={
            <Button onClick={() => navigate('/patients')}>
              Back to Patients
            </Button>
          }
        >
          {loadError}
        </Alert>
      </Box>
    );
  }

  // Loading state
  if (isInitialLoad) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // No patient state
  if (!currentPatient) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">
          No patient selected. Please select a patient to access the clinical workspace.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: 'background.default',
      overflow: 'hidden'
    }}>
      {/* Enhanced Patient Header */}
      <EnhancedPatientHeader 
        patientId={patientId} 
        onPrint={handlePrint}
        onNavigateToTab={handleTabChange}
      />

      {/* CDS Alerts Panel - Enhanced with Multiple Presentation Modes */}
      <Box sx={{ px: 2, pt: 1, flexShrink: 0 }}>
        <CDSAlertsPanel 
          patientId={patientId}
          hook="patient-view"
          compact={true}
          maxAlerts={3}
          autoRefresh={false}
          useEnhancedHooks={true}
          debugMode={false}
          onAlertAction={handleCDSAlertAction}
        />
      </Box>

      {/* Tab Navigation or Custom Layout Toggle */}
      {!customLayout ? (
        <Paper 
          elevation={0} 
          sx={{ 
            borderBottom: 1, 
            borderColor: 'divider',
            backgroundColor: 'background.paper'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', px: 1 }}>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              variant={isMobile ? 'scrollable' : isTablet ? 'scrollable' : 'standard'}
              scrollButtons={isTablet ? 'auto' : false}
              allowScrollButtonsMobile
              sx={{ 
                flex: 1,
                '& .MuiTab-root': {
                  minHeight: 48,
                  py: 1
                }
              }}
            >
              {TAB_CONFIG.map((tab) => (
                <Tab
                  key={tab.id}
                  value={tab.id}
                  label={
                    <Badge 
                      badgeContent={tabNotifications[tab.id] || 0} 
                      color="error"
                      max={99}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {React.cloneElement(tab.icon, { fontSize: 'small' })}
                        {!isMobile && (
                          <Typography variant="caption" sx={{ fontWeight: 500 }}>
                            {tab.label}
                          </Typography>
                        )}
                      </Box>
                    </Badge>
                  }
                />
              ))}
            </Tabs>

            {/* Settings Menu */}
            <Tooltip title="Workspace Settings">
              <IconButton
                onClick={(e) => setSettingsAnchor(e.currentTarget)}
                size="small"
                sx={{ ml: 0.5 }}
                aria-label="Open workspace settings"
              >
                <SettingsIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Paper>
      ) : (
        <Paper 
          elevation={0} 
          sx={{ 
            p: 2, 
            borderBottom: 1, 
            borderColor: 'divider',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <Typography variant="h6">
            Custom Layout: {customLayout.name}
          </Typography>
          <Button
            variant="outlined"
            onClick={() => setCustomLayout(null)}
          >
            Back to Tabs
          </Button>
        </Paper>
      )}

      {/* Main Content Area */}
      <Box sx={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        {customLayout ? (
          <WorkspaceContent 
            layout={customLayout} 
            patientId={patientId}
          />
        ) : (
          <Box sx={{ height: '100%' }}>
            {TAB_CONFIG.map((tab) => (
              <Box
                key={tab.id}
                role="tabpanel"
                hidden={activeTab !== tab.id}
                sx={{ height: '100%' }}
                aria-labelledby={`tab-${tab.id}`}
              >
                {activeTab === tab.id && (
                  <tab.component 
                    patientId={patientId}
                    onNotificationUpdate={(count) => updateTabNotification(tab.id, count)}
                    newNoteDialogOpen={tab.id === 'documentation' ? newNoteDialogOpen : false}
                    onNewNoteDialogClose={() => setNewNoteDialogOpen(false)}
                    newOrderDialogOpen={tab.id === 'orders' ? newOrderDialogOpen : false}
                    onNewOrderDialogClose={() => setNewOrderDialogOpen(false)}
                  />
                )}
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* Floating Action Button / Speed Dial */}
      <SpeedDial
        ariaLabel="Clinical actions"
        sx={{ position: 'absolute', bottom: 16, right: 16 }}
        icon={<SpeedDialIcon />}
        onClose={() => setSpeedDialOpen(false)}
        onOpen={() => setSpeedDialOpen(true)}
        open={speedDialOpen}
      >
        {speedDialActions.map((action) => (
          <SpeedDialAction
            key={action.name}
            icon={action.icon}
            tooltipTitle={action.name}
            tooltipOpen
            onClick={() => {
              action.onClick();
              setSpeedDialOpen(false);
            }}
          />
        ))}
      </SpeedDial>

      {/* Settings Menu */}
      <Menu
        anchorEl={settingsAnchor}
        open={Boolean(settingsAnchor)}
        onClose={() => setSettingsAnchor(null)}
      >
        <MenuItem onClick={() => {
          setIsLayoutBuilderOpen(true);
          setSettingsAnchor(null);
        }}>
          <LayoutIcon sx={{ mr: 1 }} />
          Customize Layout
        </MenuItem>
        <MenuItem onClick={handleSavePreferences}>
          <SettingsIcon sx={{ mr: 1 }} />
          Save Preferences
        </MenuItem>
      </Menu>

      {/* Layout Builder Dialog */}
      <LayoutBuilder
        open={isLayoutBuilderOpen}
        onClose={() => setIsLayoutBuilderOpen(false)}
        onSelectLayout={handleLayoutSelect}
        patientId={patientId}
      />

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ open: false, message: '' })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar({ open: false, message: '' })} 
          severity={snackbar.severity || 'success'}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ClinicalWorkspaceV3;