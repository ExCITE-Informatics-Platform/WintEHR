/**
 * React hook for WebSocket subscriptions
 * 
 * Migrated to TypeScript with comprehensive type safety for WebSocket operations.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { R4 } from '@ahryman40k/ts-fhir-types';
import websocketClient from '../services/websocket';

/**
 * Type definitions for WebSocket operations
 */
export interface WebSocketUpdate {
  resourceType: string;
  resource: R4.IResourceList;
  action: 'created' | 'updated' | 'deleted';
  patientId?: string;
  timestamp: Date;
}

export interface WebSocketOptions {
  resourceTypes?: string[];
  patientIds?: string[];
  enabled?: boolean;
}

export interface WebSocketHookResult {
  connected: boolean;
  lastUpdate: WebSocketUpdate | null;
  error: string | null;
  onUpdate: (callback: (update: WebSocketUpdate) => void) => void;
  connect: (token?: string) => Promise<void>;
  disconnect: () => void;
}

export interface PatientData {
  [resourceType: string]: {
    [resourceId: string]: R4.IResourceList;
  };
}

export interface PatientUpdatesHookResult {
  connected: boolean;
  lastUpdate: WebSocketUpdate | null;
  error: string | null;
  patientData: PatientData;
}

export interface ClinicalEvent {
  type: string;
  data: any;
  patientId?: string;
  userId?: string;
  timestamp: Date;
}

export interface ClinicalEventsHookResult {
  connected: boolean;
  lastEvent: ClinicalEvent | null;
}

/**
 * Hook for subscribing to FHIR resource updates via WebSocket
 */
export const useWebSocket = ({ 
  resourceTypes = [], 
  patientIds = [], 
  enabled = true 
}: WebSocketOptions = {}): WebSocketHookResult => {
  const [connected, setConnected] = useState<boolean>(websocketClient.connected);
  const [lastUpdate, setLastUpdate] = useState<WebSocketUpdate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const subscriptionRef = useRef<string | null>(null);
  const updateCallbackRef = useRef<((update: WebSocketUpdate) => void) | null>(null);

  // Connection status effect
  useEffect(() => {
    const checkConnection = setInterval(() => {
      setConnected(websocketClient.connected);
    }, 1000);

    return () => clearInterval(checkConnection);
  }, []);

  // Subscribe to updates
  useEffect(() => {
    if (!enabled) return;

    const handleUpdate = (update: Omit<WebSocketUpdate, 'timestamp'>) => {
      const timestampedUpdate: WebSocketUpdate = {
        ...update,
        timestamp: new Date()
      };
      
      setLastUpdate(timestampedUpdate);

      // Call custom update handler if provided
      if (updateCallbackRef.current) {
        updateCallbackRef.current(timestampedUpdate);
      }
    };

    // Create subscription
    const subscriptionId = websocketClient.subscribe({
      resourceTypes,
      patientIds,
      onUpdate: handleUpdate
    });

    subscriptionRef.current = subscriptionId;

    // Cleanup
    return () => {
      if (subscriptionRef.current) {
        websocketClient.unsubscribe(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [resourceTypes, patientIds, enabled]);

  // Method to set custom update handler
  const onUpdate = useCallback((callback: (update: WebSocketUpdate) => void): void => {
    updateCallbackRef.current = callback;
  }, []);

  // Method to manually connect
  const connect = useCallback(async (token?: string): Promise<void> => {
    try {
      await websocketClient.connect(token);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Connection failed';
      setError(errorMessage);
    }
  }, []);

  // Method to manually disconnect
  const disconnect = useCallback((): void => {
    websocketClient.disconnect();
  }, []);

  return {
    connected,
    lastUpdate,
    error,
    onUpdate,
    connect,
    disconnect
  };
};

/**
 * Hook for subscribing to patient-specific updates
 */
export const usePatientUpdates = (
  patientId: string | null, 
  options: Omit<WebSocketOptions, 'patientIds'> = {}
): PatientUpdatesHookResult => {
  const [patientData, setPatientData] = useState<PatientData>({});
  
  const { connected, lastUpdate, error, onUpdate } = useWebSocket({
    ...options,
    patientIds: patientId ? [patientId] : [],
    enabled: !!patientId && (options.enabled !== false)
  });

  // Handle updates
  useEffect(() => {
    onUpdate((update: WebSocketUpdate) => {
      const { resourceType, resource, action } = update;
      
      setPatientData(prev => {
        const newData = { ...prev };
        
        if (action === 'deleted') {
          // Remove resource from local state
          if (newData[resourceType] && resource.id) {
            const updatedResourceType = { ...newData[resourceType] };
            delete updatedResourceType[resource.id];
            newData[resourceType] = updatedResourceType;
          }
        } else {
          // Add or update resource
          if (!newData[resourceType]) {
            newData[resourceType] = {};
          }
          if (resource.id) {
            newData[resourceType] = {
              ...newData[resourceType],
              [resource.id]: resource
            };
          }
        }
        
        return newData;
      });
    });
  }, [onUpdate]);

  return {
    connected,
    lastUpdate,
    error,
    patientData
  };
};

/**
 * Hook for subscribing to clinical events
 */
export const useClinicalEvents = (
  eventType: string | null, 
  onEvent: ((event: ClinicalEvent) => void) | null
): ClinicalEventsHookResult => {
  const [connected, setConnected] = useState<boolean>(websocketClient.connected);
  const [lastEvent, setLastEvent] = useState<ClinicalEvent | null>(null);

  useEffect(() => {
    if (!eventType || !onEvent) return;

    const handleEvent = (event: Omit<ClinicalEvent, 'timestamp'>) => {
      const timestampedEvent: ClinicalEvent = {
        ...event,
        timestamp: new Date()
      };
      
      setLastEvent(timestampedEvent);
      onEvent(timestampedEvent);
    };

    const subscriptionId = websocketClient.subscribeToClinicalEvents(
      eventType,
      handleEvent
    );

    return () => {
      // Clean up subscription if websocketClient provides cleanup method
      if (subscriptionId && websocketClient.unsubscribeFromClinicalEvents) {
        websocketClient.unsubscribeFromClinicalEvents(subscriptionId);
      }
    };
  }, [eventType, onEvent]);

  // Connection status effect
  useEffect(() => {
    const checkConnection = setInterval(() => {
      setConnected(websocketClient.connected);
    }, 1000);

    return () => clearInterval(checkConnection);
  }, []);

  return {
    connected,
    lastEvent
  };
};

/**
 * Hook for subscribing to multiple resource types with filtering
 */
export const useResourceUpdates = <T extends R4.IResourceList>(
  resourceType: string,
  patientId?: string,
  filter?: (resource: T) => boolean
): {
  resources: T[];
  lastUpdate: WebSocketUpdate | null;
  connected: boolean;
  addResource: (resource: T) => void;
  updateResource: (resource: T) => void;
  removeResource: (resourceId: string) => void;
} => {
  const [resources, setResources] = useState<T[]>([]);
  
  const { connected, lastUpdate, onUpdate } = useWebSocket({
    resourceTypes: [resourceType],
    patientIds: patientId ? [patientId] : [],
    enabled: true
  });

  // Handle resource updates
  useEffect(() => {
    onUpdate((update: WebSocketUpdate) => {
      if (update.resourceType !== resourceType) return;
      
      const resource = update.resource as T;
      
      // Apply filter if provided
      if (filter && !filter(resource)) return;
      
      setResources(prev => {
        switch (update.action) {
          case 'created':
            return [...prev, resource];
          case 'updated':
            return prev.map(r => r.id === resource.id ? resource : r);
          case 'deleted':
            return prev.filter(r => r.id !== resource.id);
          default:
            return prev;
        }
      });
    });
  }, [onUpdate, resourceType, filter]);

  // Methods for manual resource management
  const addResource = useCallback((resource: T): void => {
    setResources(prev => [...prev, resource]);
  }, []);

  const updateResource = useCallback((resource: T): void => {
    setResources(prev => prev.map(r => r.id === resource.id ? resource : r));
  }, []);

  const removeResource = useCallback((resourceId: string): void => {
    setResources(prev => prev.filter(r => r.id !== resourceId));
  }, []);

  return {
    resources,
    lastUpdate,
    connected,
    addResource,
    updateResource,
    removeResource
  };
};