/**
 * CDS Hooks Client Service
 * Handles communication with CDS Hooks endpoints
 * 
 * Migrated to TypeScript with comprehensive type safety following CDS Hooks 1.0/2.0 specification.
 */

import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';

/**
 * CDS Hooks specification types (v1.0/2.0)
 */

/**
 * CDS Hook types as defined in specification
 */
type HookType = 'patient-view' | 'medication-prescribe' | 'order-sign' | 'order-select' | string;

/**
 * Card indicator types
 */
type CardIndicator = 'info' | 'warning' | 'critical';

/**
 * Selection behavior for links
 */
type SelectionBehavior = 'absolute' | 'any' | 'all' | 'all-or-none' | 'exactly-one' | 'one-or-more';

/**
 * CDS Service definition
 */
interface CDSService {
  hook: HookType;
  id: string;
  title: string;
  description: string;
  prefetch?: { [key: string]: string };
  usageRequirements?: string;
}

/**
 * Hook context base interface
 */
interface HookContext {
  hook: HookType;
  hookInstance: string;
  context: Record<string, any>;
  prefetch?: { [key: string]: any };
  fhirServer?: string;
  fhirAuthorization?: {
    access_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
    subject: string;
  };
}

/**
 * Patient-view hook context
 */
interface PatientViewContext extends HookContext {
  hook: 'patient-view';
  context: {
    patientId: string;
    userId: string;
    encounterId?: string;
  };
}

/**
 * Medication-prescribe hook context
 */
interface MedicationPrescribeContext extends HookContext {
  hook: 'medication-prescribe';
  context: {
    patientId: string;
    userId: string;
    medications: any[];
    encounterId?: string;
  };
}

/**
 * Order-sign hook context
 */
interface OrderSignContext extends HookContext {
  hook: 'order-sign';
  context: {
    patientId: string;
    userId: string;
    draftOrders: any[];
    encounterId?: string;
  };
}

/**
 * CDS Card Link
 */
interface CardLink {
  label: string;
  url: string;
  type: string;
  appContext?: string;
}

/**
 * CDS Card Source
 */
interface CardSource {
  label: string;
  url?: string;
  icon?: string;
  topic?: {
    system: string;
    code: string;
    display?: string;
  };
}

/**
 * CDS Card Suggestion Action
 */
interface CardSuggestionAction {
  type: string;
  description: string;
  resource?: any;
  resourceId?: string;
}

/**
 * CDS Card Suggestion
 */
interface CardSuggestion {
  label: string;
  uuid?: string;
  isRecommended?: boolean;
  actions?: CardSuggestionAction[];
}

/**
 * CDS Card
 */
interface CDSCard {
  uuid?: string;
  summary: string;
  detail?: string;
  indicator: CardIndicator;
  source: CardSource;
  suggestions?: CardSuggestion[];
  selectionBehavior?: SelectionBehavior;
  overrideReasons?: Array<{
    code: string;
    display: string;
    system?: string;
  }>;
  links?: CardLink[];
  // Extended properties for internal use
  serviceId?: string;
  serviceTitle?: string;
}

/**
 * CDS Hooks Response
 */
interface CDSHooksResponse {
  cards: CDSCard[];
  systemActions?: CardSuggestionAction[];
}

/**
 * CDS Services Discovery Response
 */
interface CDSServicesResponse {
  services: CDSService[];
}

/**
 * Cache entry for requests
 */
interface CacheEntry<T> {
  data: T;
  time: number;
}

/**
 * CDS Hooks Client Error
 */
class CDSHooksClientError extends Error {
  public status?: number;
  public code?: string;
  public details?: any;

  constructor(message: string, status?: number, code?: string, details?: any) {
    super(message);
    this.name = 'CDSHooksClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * CDS Hooks Client
 */
class CDSHooksClient {
  private readonly baseUrl: string;
  private readonly httpClient: AxiosInstance;
  private servicesCache: CDSService[] | null = null;
  private servicesCacheTime: number | null = null;
  private readonly cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
  private readonly requestCache = new Map<string, CacheEntry<CDSHooksResponse>>();
  private readonly requestCacheTimeout = 30 * 1000; // 30 seconds cache for individual requests

  constructor() {
    // Use relative URL for production compatibility
    this.baseUrl = process.env.REACT_APP_CDS_HOOKS_URL || '/cds-hooks';
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
  }

  /**
   * Discover available CDS services
   */
  async discoverServices(): Promise<CDSService[]> {
    // Check cache first
    const now = Date.now();
    if (this.servicesCache && this.servicesCacheTime && (now - this.servicesCacheTime < this.cacheTimeout)) {
      return this.servicesCache;
    }

    try {
      const response: AxiosResponse<CDSServicesResponse> = await this.httpClient.get('/cds-services');
      this.servicesCache = response.data.services || [];
      this.servicesCacheTime = now;
      return this.servicesCache;
    } catch (error) {
      this.handleServiceError('Failed to discover CDS services', error);
      // Return cached data if available, even if expired
      return this.servicesCache || [];
    }
  }

  /**
   * Execute a specific CDS Hook
   */
  async executeHook(hookId: string, context: HookContext): Promise<CDSHooksResponse> {
    // Create cache key from hookId and context
    const cacheKey = `${hookId}-${JSON.stringify(context)}`;
    const now = Date.now();
    
    // Check cache
    const cached = this.requestCache.get(cacheKey);
    if (cached && (now - cached.time < this.requestCacheTimeout)) {
      return cached.data;
    }

    try {
      const response: AxiosResponse<CDSHooksResponse> = await this.httpClient.post(`/cds-services/${hookId}`, context);
      
      const result: CDSHooksResponse = response.data;
      
      // Cache the response
      this.requestCache.set(cacheKey, {
        data: result,
        time: now
      });
      
      // Clean old cache entries
      this.cleanRequestCache(now);
      
      return result;
    } catch (error) {
      this.handleServiceError(`Failed to execute hook ${hookId}`, error);
      return { cards: [] };
    }
  }

  /**
   * Call a CDS service (alias for executeHook for compatibility)
   */
  async callService(serviceId: string, context: HookContext): Promise<CDSHooksResponse> {
    return this.executeHook(serviceId, context);
  }

  /**
   * Fire patient-view hook
   */
  async firePatientView(patientId: string, userId: string, encounterId?: string): Promise<CDSCard[]> {
    const services = await this.discoverServices();
    const patientViewServices = services.filter(s => s.hook === 'patient-view');
    
    const allCards: CDSCard[] = [];
    
    for (const service of patientViewServices) {
      // Properly format context according to CDS Hooks v1.0 spec
      const hookContext: PatientViewContext = {
        hook: 'patient-view',
        hookInstance: `${service.id}-${Date.now()}`,
        context: {
          patientId,
          userId
        }
      };
      
      if (encounterId) {
        hookContext.context.encounterId = encounterId;
      }
      
      try {
        const result = await this.executeHook(service.id, hookContext);
        if (result.cards && result.cards.length > 0) {
          allCards.push(...result.cards.map(card => ({
            ...card,
            serviceId: service.id,
            serviceTitle: service.title
          })));
        }
      } catch (error) {
        this.handleServiceError(`Failed to execute patient-view hook for service ${service.id}`, error);
      }
    }

    return allCards;
  }

  /**
   * Fire medication-prescribe hook
   */
  async fireMedicationPrescribe(patientId: string, userId: string, medications: any[] = [], encounterId?: string): Promise<CDSCard[]> {
    const services = await this.discoverServices();
    const prescribeServices = services.filter(s => s.hook === 'medication-prescribe');
    
    const allCards: CDSCard[] = [];
    
    for (const service of prescribeServices) {
      // Properly format context according to CDS Hooks v1.0 spec
      const hookContext: MedicationPrescribeContext = {
        hook: 'medication-prescribe',
        hookInstance: `${service.id}-${Date.now()}`,
        context: {
          patientId,
          userId,
          medications
        }
      };
      
      if (encounterId) {
        hookContext.context.encounterId = encounterId;
      }
      
      try {
        const result = await this.executeHook(service.id, hookContext);
        if (result.cards && result.cards.length > 0) {
          allCards.push(...result.cards.map(card => ({
            ...card,
            serviceId: service.id,
            serviceTitle: service.title
          })));
        }
      } catch (error) {
        this.handleServiceError(`Failed to execute medication-prescribe hook for service ${service.id}`, error);
      }
    }

    return allCards;
  }

  /**
   * Fire order-sign hook
   */
  async fireOrderSign(patientId: string, userId: string, orders: any[] = [], encounterId?: string): Promise<CDSCard[]> {
    const services = await this.discoverServices();
    const orderServices = services.filter(s => s.hook === 'order-sign');
    
    const allCards: CDSCard[] = [];
    
    for (const service of orderServices) {
      // Properly format context according to CDS Hooks v1.0 spec
      const hookContext: OrderSignContext = {
        hook: 'order-sign',
        hookInstance: `${service.id}-${Date.now()}`,
        context: {
          patientId,
          userId,
          draftOrders: orders
        }
      };
      
      if (encounterId) {
        hookContext.context.encounterId = encounterId;
      }
      
      try {
        const result = await this.executeHook(service.id, hookContext);
        if (result.cards && result.cards.length > 0) {
          allCards.push(...result.cards.map(card => ({
            ...card,
            serviceId: service.id,
            serviceTitle: service.title
          })));
        }
      } catch (error) {
        this.handleServiceError(`Failed to execute order-sign hook for service ${service.id}`, error);
      }
    }

    return allCards;
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.servicesCache = null;
    this.servicesCacheTime = null;
    this.requestCache.clear();
  }

  /**
   * Clean expired entries from request cache
   */
  private cleanRequestCache(now: number): void {
    const keysToDelete: string[] = [];
    this.requestCache.forEach((value, key) => {
      if (now - value.time > this.requestCacheTimeout) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.requestCache.delete(key));
  }

  /**
   * Handle service errors consistently
   */
  private handleServiceError(message: string, error: any): void {
    if (error instanceof AxiosError) {
      // Log error but don't throw to maintain graceful degradation
      console.warn(`CDSHooksClient: ${message}`, {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
    } else {
      console.warn(`CDSHooksClient: ${message}`, error);
    }
  }

  /**
   * Get cached services without making a request
   */
  getCachedServices(): CDSService[] {
    return this.servicesCache || [];
  }

  /**
   * Check if services cache is valid
   */
  isServicesCacheValid(): boolean {
    const now = Date.now();
    return !!(this.servicesCache && this.servicesCacheTime && (now - this.servicesCacheTime < this.cacheTimeout));
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { 
    servicesCount: number; 
    requestCacheSize: number; 
    servicesCacheAge: number | null;
  } {
    const now = Date.now();
    return {
      servicesCount: this.servicesCache?.length || 0,
      requestCacheSize: this.requestCache.size,
      servicesCacheAge: this.servicesCacheTime ? now - this.servicesCacheTime : null
    };
  }
}

// Export singleton instance
export const cdsHooksClient = new CDSHooksClient();

// Export class and types
export default CDSHooksClient;
export type {
  HookType,
  CardIndicator,
  SelectionBehavior,
  CDSService,
  HookContext,
  PatientViewContext,
  MedicationPrescribeContext,
  OrderSignContext,
  CardLink,
  CardSource,
  CardSuggestionAction,
  CardSuggestion,
  CDSCard,
  CDSHooksResponse,
  CDSServicesResponse
};
export { CDSHooksClientError };