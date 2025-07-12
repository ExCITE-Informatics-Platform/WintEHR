/**
 * WebSocket client for real-time FHIR updates
 * Implements reconnection logic, message queuing, and subscription management
 * 
 * Migrated to TypeScript with comprehensive type safety and event handling.
 */

/**
 * WebSocket message types
 */
type WebSocketMessageType = 'welcome' | 'ping' | 'pong' | 'update' | 'subscription' | 'subscribe' | 'unsubscribe' | 'error';

/**
 * WebSocket connection states
 */
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

/**
 * FHIR resource update actions
 */
type ResourceAction = 'create' | 'update' | 'delete' | 'clinical_event';

/**
 * Base WebSocket message interface
 */
interface WebSocketMessage {
  type: WebSocketMessageType;
  data?: any;
}

/**
 * Welcome message data
 */
interface WelcomeData {
  client_id: string;
  server_time: string;
}

/**
 * Resource update message data
 */
interface ResourceUpdateData {
  action: ResourceAction;
  resource_type: string;
  resource_id: string;
  patient_id?: string;
  resource?: any;
}

/**
 * Clinical event data
 */
interface ClinicalEventData {
  event_type: string;
  details: Record<string, any>;
}

/**
 * Subscription data
 */
interface SubscriptionData {
  subscription_id: string;
  resource_types: string[];
  patient_ids: string[];
  status?: 'active' | 'inactive' | 'error';
  message?: string;
}

/**
 * Subscription options
 */
interface SubscriptionOptions {
  resourceTypes?: string[];
  patientIds?: string[];
  onUpdate: (event: ResourceUpdateEvent) => void;
}

/**
 * Resource update event
 */
interface ResourceUpdateEvent {
  action: ResourceAction;
  resourceType: string;
  resourceId: string;
  patientId?: string;
  resource?: any;
}

/**
 * Clinical event
 */
interface ClinicalEvent {
  eventType: string;
  details: Record<string, any>;
  resourceType: string;
  patientId?: string;
}

/**
 * Stored subscription
 */
interface StoredSubscription {
  resourceTypes: string[];
  patientIds: string[];
  onUpdate: (event: ResourceUpdateEvent) => void;
}

/**
 * WebSocket client error
 */
class WebSocketClientError extends Error {
  public code?: string;
  public details?: any;

  constructor(message: string, code?: string, details?: any) {
    super(message);
    this.name = 'WebSocketClientError';
    this.code = code;
    this.details = details;
  }
}

/**
 * FHIR WebSocket Client with auto-reconnection and subscription management
 */
class FHIRWebSocketClient {
  private ws: WebSocket | null = null;
  private clientId: string | null = null;
  private subscriptions: Map<string, StoredSubscription> = new Map();
  private eventHandlers: Map<string, (event: ResourceUpdateEvent | ClinicalEvent) => void> = new Map();
  private messageQueue: WebSocketMessage[] = [];
  private isConnected = false;
  private reconnectAttempts = 0;
  private connectionState: ConnectionState = 'disconnected';
  
  // Configuration
  private readonly maxReconnectAttempts = 10;
  private readonly initialReconnectDelay = 1000; // 1 second
  private readonly maxReconnectDelay = 30000; // 30 seconds
  
  // Timers
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  
  // Connection promise for managing concurrent connection attempts
  private connectionPromise: Promise<boolean> | null = null;

  constructor() {
    // Bind methods to preserve context
    this.handleOpen = this.handleOpen.bind(this);
    this.handleMessage = this.handleMessage.bind(this);
    this.handleClose = this.handleClose.bind(this);
    this.handleError = this.handleError.bind(this);
  }

  /**
   * Connect to WebSocket server
   */
  async connect(token?: string): Promise<boolean> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this.doConnect(token);
    return this.connectionPromise;
  }

  /**
   * Internal connection logic
   */
  private async doConnect(token?: string): Promise<boolean> {
    try {
      this.connectionState = 'connecting';
      
      // Determine WebSocket URL based on current location
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      let host = window.location.host;
      
      // In development, use the backend port directly for WebSocket
      if (process.env.NODE_ENV === 'development' && !process.env.REACT_APP_API_URL) {
        // Extract port from package.json proxy or use default
        host = window.location.hostname + ':8000';
      } else if (process.env.REACT_APP_API_URL) {
        // Extract host from API URL
        const apiUrl = new URL(process.env.REACT_APP_API_URL);
        host = apiUrl.host;
      }
      
      const wsUrl = `${protocol}//${host}/api/ws`;

      this.ws = new WebSocket(wsUrl);

      // Set up event handlers
      this.ws.onopen = this.handleOpen;
      this.ws.onmessage = this.handleMessage;
      this.ws.onclose = this.handleClose;
      this.ws.onerror = this.handleError;

      // Wait for connection to open
      await new Promise<void>((resolve, reject) => {
        if (!this.ws) {
          reject(new WebSocketClientError('WebSocket creation failed'));
          return;
        }

        const originalOnOpen = this.ws.onopen;
        const originalOnError = this.ws.onerror;

        this.ws.onopen = (event) => {
          if (originalOnOpen) originalOnOpen.call(this.ws, event);
          resolve();
        };

        this.ws.onerror = (event) => {
          if (originalOnError) originalOnError.call(this.ws, event);
          reject(new WebSocketClientError('WebSocket connection failed', 'CONNECTION_FAILED', event));
        };
      });

      // Authenticate if token provided
      if (token) {
        this.sendMessage({
          type: 'subscribe',
          data: { token }
        });
      }

      return true;
    } catch (error) {
      this.connectionPromise = null;
      this.connectionState = 'disconnected';
      throw error;
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.clearReconnectTimeout();
    this.clearHeartbeat();
    
    if (this.ws) {
      // Remove event handlers to prevent reconnection
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      
      this.ws.close();
      this.ws = null;
    }
    
    this.isConnected = false;
    this.clientId = null;
    this.connectionState = 'disconnected';
    this.connectionPromise = null;
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen(event: Event): void {
    this.isConnected = true;
    this.reconnectAttempts = 0;
    this.connectionState = 'connected';
    this.connectionPromise = null;
    
    // Send queued messages
    this.flushMessageQueue();
  }

  /**
   * Handle WebSocket message event
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      this.processMessage(message);
    } catch (error) {
      console.warn('Failed to parse WebSocket message:', error);
    }
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(event: CloseEvent): void {
    this.isConnected = false;
    this.clientId = null;
    this.connectionState = 'disconnected';
    this.clearHeartbeat();
    
    // Attempt reconnection if not manually disconnected
    if (event.code !== 1000) { // Normal closure
      this.attemptReconnect();
    }
  }

  /**
   * Handle WebSocket error event
   */
  private handleError(event: Event): void {
    console.error('WebSocket error:', event);
  }

  /**
   * Process incoming WebSocket messages
   */
  private processMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'welcome':
        this.handleWelcome(message.data as WelcomeData);
        break;

      case 'ping':
        this.sendMessage({ type: 'pong' });
        break;

      case 'update':
        this.handleResourceUpdate(message.data as ResourceUpdateData);
        break;

      case 'subscription':
        this.handleSubscriptionResponse(message.data as SubscriptionData);
        break;

      case 'error':
        console.error('WebSocket server error:', message.data);
        break;

      default:
        console.warn('Unknown WebSocket message type:', message.type);
    }
  }

  /**
   * Handle welcome message
   */
  private handleWelcome(data: WelcomeData): void {
    this.clientId = data.client_id;
    this.resubscribeAll();
  }

  /**
   * Handle FHIR resource updates
   */
  private handleResourceUpdate(data: ResourceUpdateData): void {
    const { action, resource_type, resource_id, patient_id, resource } = data;

    const updateEvent: ResourceUpdateEvent = {
      action,
      resourceType: resource_type,
      resourceId: resource_id,
      patientId: patient_id,
      resource
    };

    // Notify all matching event handlers
    this.eventHandlers.forEach((handler, key) => {
      const [eventResourceType, eventPatientId] = key.split(':');
      
      if (
        (eventResourceType === '*' || eventResourceType === resource_type) &&
        (eventPatientId === '*' || eventPatientId === patient_id)
      ) {
        handler(updateEvent);
      }
    });

    // Handle clinical events specially
    if (action === 'clinical_event' && resource) {
      const { event_type, details } = resource as ClinicalEventData;
      this.handleClinicalEvent(event_type, details, resource_type, patient_id);
    }
  }

  /**
   * Handle clinical events (e.g., critical lab results)
   */
  private handleClinicalEvent(eventType: string, details: Record<string, any>, resourceType: string, patientId?: string): void {
    const key = `clinical:${eventType}`;
    const handler = this.eventHandlers.get(key);
    
    if (handler) {
      const clinicalEvent: ClinicalEvent = {
        eventType,
        details,
        resourceType,
        patientId
      };
      handler(clinicalEvent);
    }
  }

  /**
   * Handle subscription response
   */
  private handleSubscriptionResponse(data: SubscriptionData): void {
    console.log('Subscription response:', data);
  }

  /**
   * Subscribe to resource updates
   */
  subscribe(options: SubscriptionOptions): string {
    const { resourceTypes = [], patientIds = [], onUpdate } = options;
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store subscription locally
    this.subscriptions.set(subscriptionId, {
      resourceTypes,
      patientIds,
      onUpdate
    });

    // Register event handlers
    if (resourceTypes.length === 0 || resourceTypes.includes('*')) {
      // Subscribe to all resource types
      const key = `*:${patientIds.length === 0 ? '*' : patientIds[0]}`;
      this.eventHandlers.set(key, onUpdate);
    } else {
      // Subscribe to specific resource types
      resourceTypes.forEach(resourceType => {
        if (patientIds.length === 0) {
          const key = `${resourceType}:*`;
          this.eventHandlers.set(key, onUpdate);
        } else {
          patientIds.forEach(patientId => {
            const key = `${resourceType}:${patientId}`;
            this.eventHandlers.set(key, onUpdate);
          });
        }
      });
    }

    // Send subscription to server if connected
    if (this.isConnected) {
      this.sendMessage({
        type: 'subscribe',
        data: {
          subscription_id: subscriptionId,
          resource_types: resourceTypes,
          patient_ids: patientIds
        }
      });
    }

    return subscriptionId;
  }

  /**
   * Unsubscribe from resource updates
   */
  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return;

    // Remove event handlers
    const { resourceTypes, patientIds } = subscription;
    if (resourceTypes.length === 0 || resourceTypes.includes('*')) {
      const key = `*:${patientIds.length === 0 ? '*' : patientIds[0]}`;
      this.eventHandlers.delete(key);
    } else {
      resourceTypes.forEach(resourceType => {
        if (patientIds.length === 0) {
          const key = `${resourceType}:*`;
          this.eventHandlers.delete(key);
        } else {
          patientIds.forEach(patientId => {
            const key = `${resourceType}:${patientId}`;
            this.eventHandlers.delete(key);
          });
        }
      });
    }

    // Remove subscription
    this.subscriptions.delete(subscriptionId);

    // Notify server if connected
    if (this.isConnected) {
      this.sendMessage({
        type: 'unsubscribe',
        data: {
          subscription_id: subscriptionId
        }
      });
    }
  }

  /**
   * Subscribe to clinical events
   */
  subscribeToClinicalEvents(eventType: string, onEvent: (event: ClinicalEvent) => void): string {
    const key = `clinical:${eventType}`;
    this.eventHandlers.set(key, onEvent);
    return key;
  }

  /**
   * Send a message to the server
   */
  private sendMessage(message: WebSocketMessage): void {
    if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Queue message for later
      this.messageQueue.push(message);
    }
  }

  /**
   * Flush queued messages
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift();
      if (message) {
        this.sendMessage(message);
      }
    }
  }

  /**
   * Resubscribe all active subscriptions
   */
  private resubscribeAll(): void {
    this.subscriptions.forEach((subscription, subscriptionId) => {
      this.sendMessage({
        type: 'subscribe',
        data: {
          subscription_id: subscriptionId,
          resource_types: subscription.resourceTypes,
          patient_ids: subscription.patientIds
        }
      });
    });
  }

  /**
   * Attempt to reconnect after disconnection
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.connectionState = 'reconnecting';
    this.reconnectAttempts++;
    
    const delay = Math.min(
      this.initialReconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    );

    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      this.connectionPromise = null;
      this.connect().catch(error => {
        console.error('Reconnection failed:', error);
      });
    }, delay);
  }

  /**
   * Clear reconnection timeout
   */
  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  /**
   * Clear heartbeat interval
   */
  private clearHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Get connection status
   */
  getConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get connection state
   */
  getState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Get client ID
   */
  getId(): string | null {
    return this.clientId;
  }

  /**
   * Get number of active subscriptions
   */
  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  /**
   * Get reconnection attempt count
   */
  getReconnectAttemptCount(): number {
    return this.reconnectAttempts;
  }
}

// Create singleton instance
const websocketClient = new FHIRWebSocketClient();

// Export singleton and types
export default websocketClient;
export type {
  WebSocketMessageType,
  ConnectionState,
  ResourceAction,
  WebSocketMessage,
  WelcomeData,
  ResourceUpdateData,
  ClinicalEventData,
  SubscriptionData,
  SubscriptionOptions,
  ResourceUpdateEvent,
  ClinicalEvent,
  StoredSubscription
};
export { FHIRWebSocketClient, WebSocketClientError };