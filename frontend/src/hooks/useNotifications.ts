/**
 * Notifications Hook
 * React hook for managing notifications with WebSocket and polling fallback
 * 
 * Migrated to TypeScript with comprehensive type safety for notification operations.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { R4 } from '@ahryman40k/ts-fhir-types';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

/**
 * Type definitions for notifications
 */
export interface NotificationExtension extends R4.IExtension {
  url: string;
  valueBoolean?: boolean;
  valueString?: string;
  valueDateTime?: string;
}

export interface NotificationCommunication extends R4.ICommunication {
  extension?: NotificationExtension[];
}

export interface NotificationData {
  notifications: NotificationCommunication[];
  count?: number;
  hasMore?: boolean;
  nextPage?: string;
}

export interface NotificationsHookResult {
  count: number;
  notifications: NotificationCommunication[];
  loading: boolean;
  fetchNotifications: (unreadOnly?: boolean) => Promise<NotificationData | undefined>;
  markAsRead: (notificationId: string) => Promise<boolean>;
  markAllAsRead: () => Promise<boolean>;
  refetch: () => Promise<void>;
}

/**
 * Hook for managing notifications with real-time updates
 */
export const useNotifications = (): NotificationsHookResult => {
  const [count, setCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<NotificationCommunication[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const { user } = useAuth();
  const { lastMessage, sendMessage, subscribe, unsubscribe } = useWebSocket();
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Function to fetch notification count
  const fetchNotificationCount = useCallback(async (): Promise<void> => {
    if (!user) return;

    try {
      // TODO: Implement notifications endpoint in backend
      // For now, return 0 to prevent 404 errors
      setCount(0);
      return;
      
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/fhir/R4/notifications/count`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCount(data.count || 0);
      } else if (response.status === 404) {
        // Notifications endpoint not yet implemented - set count to 0
        setCount(0);
      }
    } catch (error) {
      // Silently handle error since notifications are not critical
      console.warn('Failed to fetch notification count:', error);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Function to fetch notifications list
  const fetchNotifications = useCallback(async (unreadOnly: boolean = false): Promise<NotificationData | undefined> => {
    if (!user) return;

    try {
      const token = localStorage.getItem('token');
      const url = new URL(`${API_BASE_URL}/fhir/R4/notifications`);
      if (unreadOnly) {
        url.searchParams.append('unread_only', 'true');
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data: NotificationData = await response.json();
        setNotifications(data.notifications || []);
        return data;
      }
    } catch (error) {
      console.warn('Failed to fetch notifications:', error);
    }
  }, [user]);

  // Function to mark notification as read
  const markAsRead = useCallback(async (notificationId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/fhir/R4/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Update local count
        setCount(prev => Math.max(0, prev - 1));
        
        // Update notifications list if loaded
        setNotifications(prev => 
          prev.map(notif => 
            notif.id === notificationId 
              ? { 
                  ...notif, 
                  extension: notif.extension?.map(ext => 
                    ext.url === 'http://medgenemr.com/fhir/StructureDefinition/notification-read'
                      ? { ...ext, valueBoolean: true } as NotificationExtension
                      : ext
                  ) as NotificationExtension[]
                }
              : notif
          )
        );
        
        return true;
      }
    } catch (error) {
      console.warn('Failed to mark notification as read:', error);
      return false;
    }
    
    return false;
  }, [user]);

  // Function to mark all as read
  const markAllAsRead = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/fhir/R4/notifications/mark-all-read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setCount(0);
        
        // Update all notifications in the list
        setNotifications(prev => 
          prev.map(notif => ({
            ...notif,
            extension: notif.extension?.map(ext => 
              ext.url === 'http://medgenemr.com/fhir/StructureDefinition/notification-read'
                ? { ...ext, valueBoolean: true } as NotificationExtension
                : ext
            ) as NotificationExtension[]
          }))
        );
        
        return true;
      }
    } catch (error) {
      console.warn('Failed to mark all notifications as read:', error);
      return false;
    }
    
    return false;
  }, [user]);

  // Handle WebSocket messages for real-time updates
  useEffect(() => {
    if (lastMessage && lastMessage.type === 'resource_update') {
      const { resourceType, patientId } = lastMessage.data;
      
      // If it's a Communication resource (notification), refresh count
      if (resourceType === 'Communication' && user && patientId === user.id) {
        fetchNotificationCount();
      }
    }
  }, [lastMessage, user, fetchNotificationCount]);

  // Set up subscription and polling on mount
  useEffect(() => {
    if (!user) return;

    // Subscribe to Communication resources
    const subscriptionId = `notifications-${user.id}`;
    subscribe(subscriptionId, ['Communication'], [`Practitioner/${user.id}`]);

    // Initial fetch
    fetchNotificationCount();

    // Set up polling as fallback (every 30 seconds)
    pollIntervalRef.current = setInterval(fetchNotificationCount, 30000);

    return () => {
      unsubscribe(subscriptionId);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [user, subscribe, unsubscribe, fetchNotificationCount]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, []);

  return {
    count,
    notifications,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotificationCount
  };
};