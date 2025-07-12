/**
 * WebSocket Context - TypeScript Migration
 * Real-time WebSocket connection management for the EMR system
 * 
 * Migrated to TypeScript with comprehensive type safety for WebSocket operations,
 * authentication handling, subscription management, and auto-reconnection logic.
 */
import React, { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';

/**
 * WebSocket ready state enum
 */
export enum WebSocketReadyState {
  UNINSTANTIATED = -1,
  CONNECTING = 0,
  OPEN = 1,
  CLOSING = 2,
  CLOSED = 3,
}

/**
 * WebSocket message types
 */
export type WebSocketMessageType = 
  | 'subscribe'
  | 'unsubscribe'
  | 'authenticate'
  | 'ping'
  | 'pong'
  | 'update'
  | 'notification';

/**
 * WebSocket message structure
 */
export interface WebSocketMessage {
  type: WebSocketMessageType;
  data?: any;
  subscription_id?: string;
  token?: string;
  resource_types?: string[];
  patient_ids?: string[];
}

/**
 * Subscription configuration
 */
export interface SubscriptionConfig {
  resourceTypes: string[];
  patientIds: string[];
}

/**
 * Last message structure with metadata
 */
export interface LastMessage {
  data: string;
  timestamp: number;
}

/**
 * WebSocket connection error
 */
export interface WebSocketError {
  message: string;
  code?: string | number;
  event?: Event;
}

/**
 * WebSocket context state interface
 */
export interface WebSocketState {
  isConnected: boolean;
  lastMessage: LastMessage | null;
  subscriptions: Record<string, SubscriptionConfig>;
  isOnline: boolean;
  error: WebSocketError | null;
  reconnectAttempts: number;
  readyState: WebSocketReadyState;
}

/**
 * WebSocket context type interface
 */
export interface WebSocketContextType extends WebSocketState {
  // Core messaging methods
  sendMessage: (message: WebSocketMessage) => boolean;
  sendJsonMessage: (message: any) => boolean;
  
  // Subscription management
  subscribe: (subscriptionId: string, resourceTypes?: string[], patientIds?: string[]) => boolean;
  unsubscribe: (subscriptionId: string) => boolean;
  
  // Connection management
  connect: () => void;
  disconnect: () => void;
  
  // Utility methods
  getWebSocket: () => WebSocket | null;
  clearError: () => void;
  isConnectionReady: () => boolean;
}

/**
 * Provider props interface
 */
export interface WebSocketProviderProps {
  children: ReactNode;
}

/**
 * Connection configuration
 */
interface ConnectionConfig {
  maxReconnectAttempts: number;
  baseReconnectDelay: number;
  maxReconnectDelay: number;
  heartbeatInterval: number;
  connectionTimeout: number;
}

/**
 * Default connection configuration
 */
const DEFAULT_CONFIG: ConnectionConfig = {
  maxReconnectAttempts: 3,
  baseReconnectDelay: 1000,
  maxReconnectDelay: 30000,
  heartbeatInterval: 25000,
  connectionTimeout: 10000,
};

/**
 * WebSocket URL from environment
 */
const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8000/api/ws';

/**
 * Create the WebSocket context
 */
const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

/**
 * WebSocket Provider Component
 */
export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const { user } = useAuth();
  
  // State management
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastMessage, setLastMessage] = useState<LastMessage | null>(null);
  const [subscriptions, setSubscriptions] = useState<Record<string, SubscriptionConfig>>({});
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [error, setError] = useState<WebSocketError | null>(null);
  const [readyState, setReadyState] = useState<WebSocketReadyState>(WebSocketReadyState.UNINSTANTIATED);
  
  // Refs for connection management
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef<number>(0);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Clear error after timeout
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  /**
   * Send message to WebSocket
   */
  const sendMessage = useCallback((message: WebSocketMessage): boolean => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(message));
        return true;
      } catch (err) {
        const error: WebSocketError = {
          message: `Failed to send message: ${err instanceof Error ? err.message : 'Unknown error'}`,
          code: 'SEND_ERROR'
        };
        setError(error);
        return false;
      }
    }
    return false;
  }, []);

  /**
   * Send JSON message (alias for sendMessage)
   */
  const sendJsonMessage = useCallback((message: any): boolean => {
    return sendMessage(message);
  }, [sendMessage]);

  /**
   * Subscribe to resources
   */
  const subscribe = useCallback((
    subscriptionId: string, 
    resourceTypes: string[] = [], 
    patientIds: string[] = []
  ): boolean => {
    const message: WebSocketMessage = {
      type: 'subscribe',
      data: {
        subscription_id: subscriptionId,
        resource_types: resourceTypes,
        patient_ids: patientIds
      }
    };
    
    setSubscriptions(prev => ({
      ...prev,
      [subscriptionId]: { resourceTypes, patientIds }
    }));
    
    return sendMessage(message);
  }, [sendMessage]);

  /**
   * Unsubscribe from resources
   */
  const unsubscribe = useCallback((subscriptionId: string): boolean => {
    const message: WebSocketMessage = {
      type: 'unsubscribe',
      data: {
        subscription_id: subscriptionId
      }
    };
    
    setSubscriptions(prev => {
      const newSubs = { ...prev };
      delete newSubs[subscriptionId];
      return newSubs;
    });
    
    return sendMessage(message);
  }, [sendMessage]);

  /**
   * Start heartbeat ping/pong mechanism
   */
  const startHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    
    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        sendMessage({ type: 'ping' });
      }
    }, DEFAULT_CONFIG.heartbeatInterval);
  }, [sendMessage]);

  /**
   * Stop heartbeat
   */
  const stopHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  /**
   * Calculate exponential backoff delay
   */
  const calculateReconnectDelay = useCallback((attempt: number): number => {
    const delay = Math.min(
      DEFAULT_CONFIG.baseReconnectDelay * Math.pow(2, attempt),
      DEFAULT_CONFIG.maxReconnectDelay
    );
    return delay;
  }, []);

  /**
   * Connect to WebSocket
   */
  const connect = useCallback(() => {
    // Don't connect if already connected or not online
    if (isConnected || !isOnline) {
      return;
    }

    // Don't reconnect if max attempts reached
    if (reconnectAttempts.current >= DEFAULT_CONFIG.maxReconnectAttempts) {
      const error: WebSocketError = {
        message: 'Maximum reconnection attempts reached',
        code: 'MAX_RECONNECT_ATTEMPTS'
      };
      setError(error);
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      
      // Create new WebSocket connection
      wsRef.current = new WebSocket(WS_URL);
      setReadyState(WebSocketReadyState.CONNECTING);
      
      // Connection timeout
      const connectionTimeout = setTimeout(() => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.CONNECTING) {
          wsRef.current.close();
          const error: WebSocketError = {
            message: 'Connection timeout',
            code: 'CONNECTION_TIMEOUT'
          };
          setError(error);
        }
      }, DEFAULT_CONFIG.connectionTimeout);
      
      wsRef.current.onopen = () => {
        clearTimeout(connectionTimeout);
        setIsConnected(true);
        setReadyState(WebSocketReadyState.OPEN);
        reconnectAttempts.current = 0;
        setError(null);
        
        // Send authentication if JWT mode
        if (token && token !== 'null') {
          const authMessage: WebSocketMessage = {
            type: 'authenticate',
            token: token
          };
          sendMessage(authMessage);
        }
        
        // Start heartbeat
        startHeartbeat();
        
        // Re-subscribe to all active subscriptions after connection
        setTimeout(() => {
          Object.entries(subscriptions).forEach(([id, { resourceTypes, patientIds }]) => {
            subscribe(id, resourceTypes, patientIds);
          });
        }, 100); // Small delay to ensure auth is processed
      };

      wsRef.current.onmessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);
          setLastMessage({ data: event.data, timestamp: Date.now() });
          
          // Handle ping messages
          if (message.type === 'ping') {
            sendMessage({ type: 'pong' });
          }
          
          // Handle authentication responses
          if (message.type === 'auth_success') {
            // Authentication successful
          } else if (message.type === 'auth_error') {
            const error: WebSocketError = {
              message: message.message || 'Authentication failed',
              code: 'AUTH_ERROR'
            };
            setError(error);
          }
        } catch (err) {
          // Ignore JSON parse errors for binary or malformed messages
        }
      };

      wsRef.current.onclose = (event: CloseEvent) => {
        clearTimeout(connectionTimeout);
        setIsConnected(false);
        setReadyState(WebSocketReadyState.CLOSED);
        stopHeartbeat();
        wsRef.current = null;
        
        // Only attempt to reconnect if we have a valid token or in simple mode
        const token = localStorage.getItem('auth_token');
        const shouldReconnect = isOnline && 
                               reconnectAttempts.current < DEFAULT_CONFIG.maxReconnectAttempts &&
                               (token === 'training_token' || (token && token !== 'null'));
        
        if (shouldReconnect) {
          const delay = calculateReconnectDelay(reconnectAttempts.current);
          reconnectAttempts.current += 1;

          reconnectTimeoutRef.current = setTimeout(() => {
            if (user || token === 'training_token') {
              connect();
            }
          }, delay);
        } else if (!isOnline) {
          // Will reconnect when online
        } else {
          const error: WebSocketError = {
            message: `Connection closed: ${event.reason || 'Unknown reason'}`,
            code: event.code
          };
          setError(error);
        }
      };

      wsRef.current.onerror = (event: Event) => {
        const error: WebSocketError = {
          message: 'WebSocket connection error',
          code: 'CONNECTION_ERROR',
          event
        };
        setError(error);
      };
    } catch (err) {
      const error: WebSocketError = {
        message: `Failed to create WebSocket connection: ${err instanceof Error ? err.message : 'Unknown error'}`,
        code: 'CREATION_ERROR'
      };
      setError(error);
    }
  }, [user, subscriptions, subscribe, sendMessage, isConnected, isOnline, startHeartbeat, stopHeartbeat, calculateReconnectDelay]);

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    // Clear reconnection timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Stop heartbeat
    stopHeartbeat();

    // Close WebSocket connection
    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }

    setIsConnected(false);
    setReadyState(WebSocketReadyState.CLOSED);
    reconnectAttempts.current = 0;
    setError(null);
  }, [stopHeartbeat]);

  /**
   * Get WebSocket instance
   */
  const getWebSocket = useCallback((): WebSocket | null => {
    return wsRef.current;
  }, []);

  /**
   * Clear error
   */
  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  /**
   * Check if connection is ready for messages
   */
  const isConnectionReady = useCallback((): boolean => {
    return isConnected && wsRef.current?.readyState === WebSocket.OPEN;
  }, [isConnected]);

  // Connect when user logs in
  useEffect(() => {
    if (user) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [user, connect, disconnect]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (user) {
        connect();
      }
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      // Connection will be closed by the browser
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user, connect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      stopHeartbeat();
      disconnect();
    };
  }, [disconnect, stopHeartbeat]);

  const value: WebSocketContextType = {
    // State
    isConnected,
    lastMessage,
    subscriptions,
    isOnline,
    error,
    reconnectAttempts: reconnectAttempts.current,
    readyState,
    
    // Core messaging methods
    sendMessage,
    sendJsonMessage,
    
    // Subscription management
    subscribe,
    unsubscribe,
    
    // Connection management
    connect,
    disconnect,
    
    // Utility methods
    getWebSocket,
    clearError,
    isConnectionReady
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

/**
 * Hook for using the WebSocket context
 */
export const useWebSocket = (): WebSocketContextType => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

/**
 * Hook for WebSocket connection status
 */
export const useWebSocketStatus = () => {
  const { isConnected, readyState, isOnline, error } = useWebSocket();
  
  const connectionStatus = React.useMemo(() => {
    const statusMap = {
      [WebSocketReadyState.UNINSTANTIATED]: 'Uninstantiated',
      [WebSocketReadyState.CONNECTING]: 'Connecting',
      [WebSocketReadyState.OPEN]: 'Connected',
      [WebSocketReadyState.CLOSING]: 'Closing',
      [WebSocketReadyState.CLOSED]: 'Closed',
    };
    
    return statusMap[readyState] || 'Unknown';
  }, [readyState]);
  
  return {
    isConnected,
    readyState,
    isOnline,
    error,
    connectionStatus,
    isReady: isConnected && readyState === WebSocketReadyState.OPEN
  };
};

export default WebSocketContext;