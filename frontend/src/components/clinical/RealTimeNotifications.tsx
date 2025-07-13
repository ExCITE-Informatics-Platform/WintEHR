/**
 * Real-time notifications component for clinical updates
 * 
 * Migrated to TypeScript with comprehensive type safety for clinical notifications.
 */

import React, { useState, useEffect } from 'react';
import {
  Badge,
  IconButton,
  Popover,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Typography,
  Box,
  Chip,
  Divider,
  Alert,
  SxProps,
  Theme,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Science as LabIcon,
  MedicalServices as MedicalIcon,
  Assignment as OrderIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import { R4 } from '@ahryman40k/ts-fhir-types';
import { useClinical } from '../../contexts/ClinicalContext';
import { useClinicalEvents } from '../../hooks/useWebSocket';
import { formatDistanceToNow } from 'date-fns';

/**
 * Type definitions for RealTimeNotifications component
 */
export type NotificationType = 'lab' | 'report' | 'order' | 'critical' | 'general';
export type NotificationPriority = 'high' | 'normal' | 'low';
export type ResourceType = 'Observation' | 'DiagnosticReport' | 'ServiceRequest';

export interface Notification {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  resourceType?: ResourceType;
  resourceId?: string;
  patientId?: string;
  timestamp: Date;
  read: boolean;
  priority: NotificationPriority;
}

export interface CriticalEvent {
  details: {
    message?: string;
  };
  resourceType: ResourceType;
  patientId: string;
  timestamp: Date;
}

export interface RealTimeUpdate {
  resourceType: ResourceType;
  resource?: R4.IObservation | R4.IDiagnosticReport | R4.IServiceRequest;
  resourceId: string;
  patientId: string;
  timestamp: Date;
  action: 'created' | 'updated' | 'deleted';
}

export interface ClinicalContextType {
  wsConnected: boolean;
  realTimeUpdates: RealTimeUpdate[];
}

export interface RealTimeNotificationsProps {
  maxNotifications?: number;
  sx?: SxProps<Theme>;
}

/**
 * Constants
 */
const MAX_NOTIFICATIONS_DEFAULT = 50;

/**
 * Helper functions
 */
const getIcon = (type: NotificationType): JSX.Element => {
  switch (type) {
    case 'lab':
      return <LabIcon color="primary" />;
    case 'report':
      return <MedicalIcon color="primary" />;
    case 'order':
      return <OrderIcon color="primary" />;
    case 'critical':
      return <WarningIcon color="error" />;
    case 'general':
    default:
      return <CheckIcon color="success" />;
  }
};

const getPriorityColor = (priority: NotificationPriority): 'error' | 'primary' | 'default' => {
  switch (priority) {
    case 'high':
      return 'error';
    case 'normal':
      return 'primary';
    case 'low':
    default:
      return 'default';
  }
};

const isLabObservation = (resource: R4.IObservation): boolean => {
  return resource.category?.[0]?.coding?.[0]?.code === 'laboratory';
};

const getResourceName = (resource: R4.IObservation | R4.IDiagnosticReport | R4.IServiceRequest): string => {
  return resource.code?.text || resource.code?.coding?.[0]?.display || 'Unknown';
};

const createNotificationFromUpdate = (update: RealTimeUpdate): Notification | null => {
  const baseNotification = {
    id: Date.now(),
    resourceType: update.resourceType,
    resourceId: update.resourceId,
    patientId: update.patientId,
    timestamp: update.timestamp,
    read: false,
    priority: 'normal' as NotificationPriority
  };

  switch (update.resourceType) {
    case 'Observation':
      if (update.resource && isLabObservation(update.resource as R4.IObservation)) {
        return {
          ...baseNotification,
          type: 'lab',
          title: 'New Lab Result',
          message: `${getResourceName(update.resource)} available`
        };
      }
      break;
      
    case 'DiagnosticReport':
      if (update.resource) {
        return {
          ...baseNotification,
          type: 'report',
          title: 'New Diagnostic Report',
          message: `${getResourceName(update.resource)} ready`
        };
      }
      break;
      
    case 'ServiceRequest':
      if (update.resource) {
        return {
          ...baseNotification,
          type: 'order',
          title: update.action === 'created' ? 'New Order' : 'Order Updated',
          message: `${getResourceName(update.resource)} ${update.action}`
        };
      }
      break;
  }
  
  return null;
};

/**
 * RealTimeNotifications Component
 */
const RealTimeNotifications: React.FC<RealTimeNotificationsProps> = ({ 
  maxNotifications = MAX_NOTIFICATIONS_DEFAULT,
  sx 
}) => {
  const { wsConnected, realTimeUpdates } = useClinical() as ClinicalContextType;
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // Subscribe to critical clinical events
  useClinicalEvents('critical_result', (event: CriticalEvent) => {
    const notification: Notification = {
      id: Date.now(),
      type: 'critical',
      title: 'Critical Result',
      message: event.details.message || 'New critical result available',
      resourceType: event.resourceType,
      patientId: event.patientId,
      timestamp: new Date(),
      read: false,
      priority: 'high'
    };
    
    setNotifications(prev => [notification, ...prev].slice(0, maxNotifications));
    setUnreadCount(prev => prev + 1);
  });

  // Process real-time updates into notifications
  useEffect(() => {
    if (realTimeUpdates.length > 0) {
      const latestUpdate = realTimeUpdates[realTimeUpdates.length - 1];
      const notification = createNotificationFromUpdate(latestUpdate);
      
      if (notification) {
        setNotifications(prev => [notification, ...prev].slice(0, maxNotifications));
        setUnreadCount(prev => prev + 1);
      }
    }
  }, [realTimeUpdates, maxNotifications]);

  const handleClick = (event: React.MouseEvent<HTMLElement>): void => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = (): void => {
    setAnchorEl(null);
    // Mark all as read
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const handleNotificationClick = (notification: Notification): void => {
    // TODO: Navigate to specific resource or open detail view
    console.log('Clicked notification:', notification);
  };

  const open = Boolean(anchorEl);

  return (
    <Box sx={sx}>
      <IconButton
        color="inherit"
        onClick={handleClick}
        sx={{ position: 'relative' }}
        aria-label="View notifications"
      >
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
        {wsConnected && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 4,
              right: 4,
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: 'success.main',
              border: '2px solid white'
            }}
          />
        )}
      </IconButton>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <Box sx={{ width: 400, maxHeight: 600 }}>
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="h6" component="div">
              Notifications
              {wsConnected && (
                <Chip
                  label="Live"
                  size="small"
                  color="success"
                  sx={{ ml: 2 }}
                />
              )}
            </Typography>
          </Box>

          {!wsConnected && (
            <Alert severity="warning" sx={{ m: 2 }}>
              Real-time updates disconnected
            </Alert>
          )}

          <List sx={{ maxHeight: 500, overflow: 'auto' }}>
            {notifications.length === 0 ? (
              <ListItem>
                <ListItemText
                  primary="No notifications"
                  secondary="Real-time updates will appear here"
                />
              </ListItem>
            ) : (
              notifications.map((notification: Notification, index: number) => (
                <React.Fragment key={notification.id}>
                  {index > 0 && <Divider />}
                  <ListItem
                    sx={{
                      backgroundColor: notification.read ? 'transparent' : 'action.hover',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <ListItemIcon>
                      {getIcon(notification.type)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle2">
                            {notification.title}
                          </Typography>
                          <Chip
                            label={notification.priority}
                            size="small"
                            color={getPriorityColor(notification.priority)}
                            sx={{ height: 20 }}
                          />
                        </Box>
                      }
                      secondary={
                        <>
                          <Typography
                            component="span"
                            variant="body2"
                            color="text.primary"
                          >
                            {notification.message}
                          </Typography>
                          <br />
                          <Typography
                            component="span"
                            variant="caption"
                            color="text.secondary"
                          >
                            {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                          </Typography>
                        </>
                      }
                    />
                  </ListItem>
                </React.Fragment>
              ))
            )}
          </List>
        </Box>
      </Popover>
    </Box>
  );
};

export default RealTimeNotifications;