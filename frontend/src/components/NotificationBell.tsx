/**
 * NotificationBell Component
 * Displays notification count and dropdown menu for managing notifications
 * 
 * Migrated to TypeScript with comprehensive type safety for notification handling.
 */

import React, { useState, MouseEvent } from 'react';
import {
  IconButton,
  Badge,
  Menu,
  MenuItem,
  Typography,
  Box,
  Divider,
  Button,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  SxProps,
  Theme,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  NotificationsNone as NotificationsNoneIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  CheckCircle as SuccessIcon,
  MarkEmailRead as MarkReadIcon,
} from '@mui/icons-material';
import { useNotifications } from '../hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { R4 } from '@ahryman40k/ts-fhir-types';

/**
 * Type definitions for NotificationBell component
 */
export interface NotificationBellProps {
  sx?: SxProps<Theme>;
}

export type NotificationCategory = 'alert' | 'warning' | 'success' | 'info' | 'notification';
export type NotificationPriority = 'urgent' | 'asap' | 'routine';

export interface NotificationDisplay {
  id: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  message: string;
  sent?: string;
  isRead: boolean;
}

/**
 * NotificationBell Component
 */
const NotificationBell: React.FC<NotificationBellProps> = ({ sx }) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { count, notifications, loading, fetchNotifications, markAsRead, markAllAsRead } = useNotifications();
  const [loadingNotifications, setLoadingNotifications] = useState<boolean>(false);

  const handleClick = async (event: MouseEvent<HTMLElement>): Promise<void> => {
    setAnchorEl(event.currentTarget);
    
    // Fetch notifications when menu opens
    if (notifications.length === 0 && !loadingNotifications) {
      setLoadingNotifications(true);
      try {
        await fetchNotifications();
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      } finally {
        setLoadingNotifications(false);
      }
    }
  };

  const handleClose = (): void => {
    setAnchorEl(null);
  };

  const handleMarkAsRead = async (notificationId: string, event: MouseEvent): Promise<void> => {
    event.stopPropagation();
    try {
      await markAsRead(notificationId);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async (): Promise<void> => {
    try {
      await markAllAsRead();
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const getNotificationIcon = (category: NotificationCategory): JSX.Element => {
    switch (category) {
      case 'alert':
        return <ErrorIcon color="error" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      case 'success':
        return <SuccessIcon color="success" />;
      case 'info':
      case 'notification':
      default:
        return <InfoIcon color="info" />;
    }
  };

  const getPriorityColor = (priority: NotificationPriority): 'error' | 'warning' | 'default' => {
    switch (priority) {
      case 'urgent':
        return 'error';
      case 'asap':
        return 'warning';
      case 'routine':
      default:
        return 'default';
    }
  };

  const formatNotificationTime = (sent?: string): string => {
    if (!sent) return '';
    try {
      return formatDistanceToNow(new Date(sent), { addSuffix: true });
    } catch (error) {
      console.error('Failed to format notification time:', error);
      return '';
    }
  };

  const parseNotificationCategory = (notification: R4.ICommunication): NotificationCategory => {
    const categoryCode = notification.category?.[0]?.coding?.[0]?.code;
    if (categoryCode && ['alert', 'warning', 'success', 'info'].includes(categoryCode)) {
      return categoryCode as NotificationCategory;
    }
    return 'notification';
  };

  const parseNotificationPriority = (notification: R4.ICommunication): NotificationPriority => {
    const priority = notification.priority;
    if (priority && ['urgent', 'asap', 'routine'].includes(priority)) {
      return priority as NotificationPriority;
    }
    return 'routine';
  };

  const parseNotificationMessage = (notification: R4.ICommunication): string => {
    return notification.payload?.[0]?.contentString || 'No message';
  };

  const renderNotification = (notification: R4.ICommunication): JSX.Element => {
    const isRead = (notification as any)._isRead || false;
    const category = parseNotificationCategory(notification);
    const priority = parseNotificationPriority(notification);
    const message = parseNotificationMessage(notification);
    const sent = notification.sent;

    const handleNotificationClick = (event: MouseEvent): void => {
      if (!isRead && notification.id) {
        handleMarkAsRead(notification.id, event);
      }
      // TODO: Navigate to relevant resource
      handleClose();
    };

    const handleMarkReadClick = (event: MouseEvent): void => {
      if (notification.id) {
        handleMarkAsRead(notification.id, event);
      }
    };

    return (
      <ListItem
        key={notification.id}
        alignItems="flex-start"
        sx={{
          bgcolor: isRead ? 'transparent' : 'action.hover',
          cursor: 'pointer',
          '&:hover': {
            bgcolor: 'action.selected'
          }
        }}
        onClick={handleNotificationClick}
      >
        <ListItemAvatar>
          <Avatar sx={{ bgcolor: 'transparent' }}>
            {getNotificationIcon(category)}
          </Avatar>
        </ListItemAvatar>
        <ListItemText
          primary={
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="body2" sx={{ fontWeight: isRead ? 'normal' : 'bold' }}>
                {message}
              </Typography>
              {priority !== 'routine' && (
                <Chip
                  label={priority}
                  size="small"
                  color={getPriorityColor(priority)}
                  sx={{ height: 20 }}
                />
              )}
            </Box>
          }
          secondary={
            <Typography variant="caption" color="text.secondary">
              {formatNotificationTime(sent)}
            </Typography>
          }
        />
        {!isRead && (
          <IconButton
            edge="end"
            size="small"
            onClick={handleMarkReadClick}
            sx={{ ml: 1 }}
            aria-label="Mark as read"
          >
            <MarkReadIcon fontSize="small" />
          </IconButton>
        )}
      </ListItem>
    );
  };

  const isMenuOpen = Boolean(anchorEl);

  return (
    <>
      <IconButton
        color="inherit"
        onClick={handleClick}
        aria-label={`${count} notifications`}
        sx={sx}
      >
        <Badge badgeContent={count} color="error">
          {count > 0 ? <NotificationsIcon /> : <NotificationsNoneIcon />}
        </Badge>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={isMenuOpen}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: 400,
            maxHeight: 500
          }
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">Notifications</Typography>
          {count > 0 && (
            <Button size="small" onClick={handleMarkAllAsRead}>
              Mark all as read
            </Button>
          )}
        </Box>
        
        <Divider />
        
        {loadingNotifications ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress size={24} />
          </Box>
        ) : notifications.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <NotificationsNoneIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography color="text.secondary">
              No notifications
            </Typography>
          </Box>
        ) : (
          <List sx={{ p: 0, maxHeight: 400, overflow: 'auto' }}>
            {notifications.map(renderNotification)}
          </List>
        )}
        
        <Divider />
        
        <Box sx={{ p: 1 }}>
          <Button fullWidth size="small" onClick={handleClose}>
            View All Notifications
          </Button>
        </Box>
      </Menu>
    </>
  );
};

export default NotificationBell;