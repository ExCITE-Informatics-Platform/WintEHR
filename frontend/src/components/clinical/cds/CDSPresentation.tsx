/**
 * CDS Presentation Component
 * Handles different presentation modes for CDS cards according to CDS Hooks spec
 * 
 * Migrated to TypeScript with comprehensive type safety for CDS card presentation.
 */

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Alert,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Slide,
  Drawer,
  Typography,
  Stack,
  Chip,
  Badge,
  Tooltip,
  Card,
  CardContent,
  CardActions,
  AlertColor,
  SxProps,
  Theme,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Close as CloseIcon,
  CheckCircle as AcceptIcon,
  Cancel as RejectIcon,
  Lightbulb as SuggestionIcon,
  Link as LinkIcon,
  Launch as LaunchIcon,
} from '@mui/icons-material';

/**
 * Type definitions for CDSPresentation component
 */
export type AlertIndicator = 'info' | 'warning' | 'critical';

export type PresentationMode = 'banner' | 'sidebar' | 'inline' | 'popup' | 'toast' | 'card' | 'compact' | 'drawer';

export type Position = 'top' | 'bottom' | 'left' | 'right' | 'center';

export interface CDSCard {
  uuid: string;
  summary: string;
  detail?: string;
  indicator: AlertIndicator;
  source: {
    label: string;
    url?: string;
    icon?: string;
  };
  suggestions?: CDSSuggestion[];
  links?: CDSLink[];
  serviceId?: string;
  serviceTitle?: string;
}

export interface CDSSuggestion {
  uuid: string;
  label: string;
  description?: string;
  actions?: CDSAction[];
}

export interface CDSAction {
  type: 'create' | 'update' | 'delete';
  description: string;
  resource?: any;
}

export interface CDSLink {
  label: string;
  url: string;
  type: 'absolute' | 'smart';
  appContext?: string;
}

export interface CDSPresentationProps {
  alerts?: CDSCard[];
  mode?: PresentationMode;
  position?: Position;
  onAlertAction?: (alert: CDSCard, action: string, suggestion?: CDSSuggestion) => void;
  autoHide?: boolean;
  hideDelay?: number;
  maxAlerts?: number;
  allowInteraction?: boolean;
  patientId?: string | null;
  sx?: SxProps<Theme>;
}

export interface AlertRenderResult {
  content: React.ReactNode;
  actions: React.ReactNode;
}

export interface SelectedAlert {
  alert: CDSCard;
  suggestion: CDSSuggestion;
}

/**
 * Presentation modes according to CDS Hooks best practices
 */
export const PRESENTATION_MODES = {
  BANNER: 'banner' as const,           // Top banner (for critical alerts)
  SIDEBAR: 'sidebar' as const,         // Side panel
  INLINE: 'inline' as const,           // Inline with content
  POPUP: 'popup' as const,            // Modal dialog
  TOAST: 'toast' as const,            // Toast notification
  CARD: 'card' as const,              // Card format
  COMPACT: 'compact' as const,        // Minimal icon
  DRAWER: 'drawer' as const           // Slide-out drawer
};

/**
 * Helper functions
 */
const getSeverityIcon = (indicator: AlertIndicator): React.ReactElement => {
  switch (indicator) {
    case 'critical': return <ErrorIcon color="error" />;
    case 'warning': return <WarningIcon color="warning" />;
    case 'info': return <InfoIcon color="info" />;
    default: return <SuggestionIcon color="primary" />;
  }
};

const getSeverityColor = (indicator: AlertIndicator): AlertColor => {
  switch (indicator) {
    case 'critical': return 'error';
    case 'warning': return 'warning';
    case 'info': return 'info';
    default: return 'info';
  }
};

const createAlertKey = (alert: CDSCard): string => {
  return `${alert.serviceId || 'unknown'}-${alert.summary}`;
};

const getDismissedAlertsFromSession = (patientId: string | null): Set<string> => {
  if (!patientId) return new Set();
  
  const sessionKey = `cds-dismissed-alerts-${patientId}`;
  try {
    const stored = sessionStorage.getItem(sessionKey);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch (e) {
    console.error('Error loading dismissed alerts from session storage:', e);
    return new Set();
  }
};

const saveDismissedAlertsToSession = (patientId: string | null, dismissedAlerts: Set<string>): void => {
  if (!patientId) return;
  
  const sessionKey = `cds-dismissed-alerts-${patientId}`;
  try {
    sessionStorage.setItem(sessionKey, JSON.stringify([...dismissedAlerts]));
  } catch (e) {
    console.error('Error saving dismissed alerts to session storage:', e);
  }
};

/**
 * CDSPresentation Component
 */
const CDSPresentation: React.FC<CDSPresentationProps> = ({ 
  alerts = [], 
  mode = PRESENTATION_MODES.INLINE,
  position = 'top',
  onAlertAction,
  autoHide = false,
  hideDelay = 5000,
  maxAlerts = 5,
  allowInteraction = true,
  patientId = null,
  sx
}) => {
  const [open, setOpen] = useState<boolean>(true);
  const [selectedAlert, setSelectedAlert] = useState<SelectedAlert | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(() => 
    getDismissedAlertsFromSession(patientId)
  );

  const handleAlertAction = (alert: CDSCard, action: string, suggestion?: CDSSuggestion): void => {
    const alertKey = createAlertKey(alert);
    
    if (action === 'dismiss') {
      setDismissedAlerts(prev => {
        const newSet = new Set([...prev, alertKey]);
        saveDismissedAlertsToSession(patientId, newSet);
        return newSet;
      });
    }
    
    if (onAlertAction) {
      onAlertAction(alert, action, suggestion);
    }
    
    if (action === 'accept' || action === 'reject') {
      setSelectedAlert(null);
    }
  };

  const handleSuggestionClick = (alert: CDSCard, suggestion: CDSSuggestion): void => {
    setSelectedAlert({ alert, suggestion });
  };

  const handleLinkClick = (link: CDSLink): void => {
    if (link.type === 'smart') {
      // Handle SMART app launch
      console.log('SMART app launch:', link);
      // TODO: Implement SMART app launch logic
    } else {
      window.open(link.url, '_blank', 'noopener,noreferrer');
    }
  };

  const renderSuggestionButton = (suggestion: CDSSuggestion, alert: CDSCard): React.ReactElement => (
    <Button
      key={suggestion.uuid}
      size="small"
      variant="outlined"
      startIcon={<SuggestionIcon />}
      onClick={() => handleSuggestionClick(alert, suggestion)}
    >
      {suggestion.label}
    </Button>
  );

  const renderLinks = (links?: CDSLink[]): React.ReactElement[] => 
    links?.map((link, index) => (
      <Button
        key={index}
        size="small"
        variant="text"
        startIcon={link.type === 'smart' ? <LaunchIcon /> : <LinkIcon />}
        onClick={() => handleLinkClick(link)}
      >
        {link.label}
      </Button>
    )) || [];

  const renderAlert = (alert: CDSCard, compact: boolean = false): AlertRenderResult => {
    const alertKey = createAlertKey(alert);
    if (dismissedAlerts.has(alertKey)) {
      return { content: null, actions: null };
    }

    const content = (
      <>
        <Typography variant={compact ? "caption" : "subtitle2"} gutterBottom>
          {alert.summary}
        </Typography>
        {!compact && alert.detail && (
          <Typography variant="body2" sx={{ mb: 1 }}>
            {alert.detail}
          </Typography>
        )}
        {!compact && alert.source && (
          <Typography variant="caption" color="text.secondary">
            Source: {alert.source.label}
          </Typography>
        )}
      </>
    );

    const actions = allowInteraction ? (
      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        {alert.suggestions?.map(suggestion => 
          renderSuggestionButton(suggestion, alert)
        )}
        {renderLinks(alert.links)}
        {!compact && (
          <IconButton
            size="small"
            onClick={() => handleAlertAction(alert, 'dismiss')}
            aria-label="Dismiss alert"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Stack>
    ) : null;

    return { content, actions };
  };

  const getVisibleAlerts = (): CDSCard[] => {
    return alerts.filter(alert => 
      !dismissedAlerts.has(createAlertKey(alert))
    ).slice(0, maxAlerts);
  };

  const visibleAlerts = getVisibleAlerts();

  if (visibleAlerts.length === 0) return null;

  // Banner mode - Critical alerts at top
  if (mode === PRESENTATION_MODES.BANNER) {
    const criticalAlerts = visibleAlerts.filter(a => a.indicator === 'critical');
    if (criticalAlerts.length === 0) return null;

    return (
      <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1300, ...sx }}>
        {criticalAlerts.map((alert, index) => {
          const { content, actions } = renderAlert(alert);
          return (
            <Alert
              key={index}
              severity="error"
              action={actions}
              sx={{ borderRadius: 0 }}
            >
              {content}
            </Alert>
          );
        })}
      </Box>
    );
  }

  // Toast mode - Auto-hiding notifications
  if (mode === PRESENTATION_MODES.TOAST) {
    return (
      <>
        {visibleAlerts.map((alert, index) => (
          <Snackbar
            key={index}
            open={open}
            autoHideDuration={autoHide ? hideDelay : null}
            onClose={() => setOpen(false)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            TransitionComponent={Slide}
            sx={sx}
          >
            <Alert severity={getSeverityColor(alert.indicator)}>
              {renderAlert(alert, true).content}
            </Alert>
          </Snackbar>
        ))}
      </>
    );
  }

  // Popup mode - Modal dialog
  if (mode === PRESENTATION_MODES.POPUP) {
    return (
      <Dialog 
        open={open} 
        onClose={() => setOpen(false)} 
        maxWidth="md" 
        fullWidth
        PaperProps={{ sx }}
      >
        <DialogTitle>
          Clinical Decision Support
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            {visibleAlerts.map((alert, index) => {
              const { content, actions } = renderAlert(alert);
              return (
                <Card key={index} variant="outlined">
                  <CardContent>
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      {getSeverityIcon(alert.indicator)}
                      <Box sx={{ flex: 1 }}>
                        {content}
                      </Box>
                    </Stack>
                  </CardContent>
                  {actions && <CardActions>{actions}</CardActions>}
                </Card>
              );
            })}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  }

  // Drawer mode - Slide-out panel
  if (mode === PRESENTATION_MODES.DRAWER) {
    return (
      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{ sx: { width: 400, ...sx } }}
      >
        <Box sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6">CDS Alerts</Typography>
            <IconButton onClick={() => setOpen(false)} aria-label="Close drawer">
              <CloseIcon />
            </IconButton>
          </Stack>
          <Stack spacing={2}>
            {visibleAlerts.map((alert, index) => {
              const { content, actions } = renderAlert(alert);
              return (
                <Alert
                  key={index}
                  severity={getSeverityColor(alert.indicator)}
                  action={actions}
                >
                  {content}
                </Alert>
              );
            })}
          </Stack>
        </Box>
      </Drawer>
    );
  }

  // Compact mode - Just icon with badge
  if (mode === PRESENTATION_MODES.COMPACT) {
    const criticalCount = visibleAlerts.filter(a => a.indicator === 'critical').length;
    const warningCount = visibleAlerts.filter(a => a.indicator === 'warning').length;

    return (
      <Tooltip title={`${visibleAlerts.length} CDS alerts`}>
        <Badge 
          badgeContent={criticalCount || warningCount} 
          color={criticalCount > 0 ? "error" : "warning"}
          sx={sx}
        >
          <IconButton 
            size="small" 
            color={criticalCount > 0 ? "error" : "warning"}
            onClick={() => setOpen(!open)}
            aria-label="Toggle CDS alerts"
          >
            {getSeverityIcon(visibleAlerts[0]?.indicator || 'info')}
          </IconButton>
        </Badge>
      </Tooltip>
    );
  }

  // Default inline mode
  return (
    <Stack spacing={1} sx={sx}>
      {visibleAlerts.map((alert, index) => {
        const { content, actions } = renderAlert(alert);
        return (
          <Alert
            key={index}
            severity={getSeverityColor(alert.indicator)}
            action={actions}
          >
            {content}
          </Alert>
        );
      })}

      {/* Suggestion Detail Dialog */}
      {selectedAlert && (
        <Dialog
          open={!!selectedAlert}
          onClose={() => setSelectedAlert(null)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            {selectedAlert.suggestion.label}
          </DialogTitle>
          <DialogContent>
            <Typography variant="body1">
              {selectedAlert.suggestion.description || 'No description available'}
            </Typography>
            {selectedAlert.suggestion.actions?.map((action, index) => (
              <Typography key={index} variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {action.description}
              </Typography>
            ))}
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => handleAlertAction(selectedAlert.alert, 'reject', selectedAlert.suggestion)}
            >
              Reject
            </Button>
            <Button
              variant="contained"
              onClick={() => handleAlertAction(selectedAlert.alert, 'accept', selectedAlert.suggestion)}
            >
              Accept
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Stack>
  );
};

export default CDSPresentation;