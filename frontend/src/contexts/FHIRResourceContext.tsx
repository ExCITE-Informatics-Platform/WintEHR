import { createContext, useContext, useReducer, useCallback, useEffect, ReactNode } from 'react';
import { fhirClient } from '../services/fhirClient';
import { intelligentCache } from '../utils/intelligentCache';
// @ts-ignore
import { 
  Resource, 
  Patient, 
  Encounter, 
  Observation, 
  Condition, 
  MedicationRequest, 
  Bundle, 
  FHIRResourceType 
} from '../types/fhir';

/**
 * FHIR Resource Context with TypeScript
 * 
 * Provides comprehensive FHIR resource management with caching, relationships, and progressive loading.
 * Migrated to TypeScript with full type safety.
 */

// Action Types Enum for better type safety
enum FHIRActionType {
  // Resource Management
  SET_RESOURCES = 'SET_RESOURCES',
  ADD_RESOURCE = 'ADD_RESOURCE',
  UPDATE_RESOURCE = 'UPDATE_RESOURCE',
  REMOVE_RESOURCE = 'REMOVE_RESOURCE',
  CLEAR_RESOURCES = 'CLEAR_RESOURCES',
  
  // Loading States
  SET_LOADING = 'SET_LOADING',
  SET_ERROR = 'SET_ERROR',
  CLEAR_ERROR = 'CLEAR_ERROR',
  SET_GLOBAL_LOADING = 'SET_GLOBAL_LOADING',
  
  // Patient Context
  SET_CURRENT_PATIENT = 'SET_CURRENT_PATIENT',
  SET_CURRENT_ENCOUNTER = 'SET_CURRENT_ENCOUNTER',
  
  // Cache Management
  SET_CACHE = 'SET_CACHE',
  INVALIDATE_CACHE = 'INVALIDATE_CACHE',
  
  // Relationships
  SET_RELATIONSHIPS = 'SET_RELATIONSHIPS',
  ADD_RELATIONSHIP = 'ADD_RELATIONSHIP',
  
  // Search and Filters
  SET_SEARCH_RESULTS = 'SET_SEARCH_RESULTS',
  SET_FILTERS = 'SET_FILTERS'
}

// Type definitions for state structure
interface ResourceMap {
  [resourceId: string]: Resource;
}

type ResourceStorage = {
  [K in FHIRResourceType]: ResourceMap;
};

interface PatientRelationships {
  [resourceType: string]: string[];
}

interface Relationships {
  [patientId: string]: PatientRelationships;
}

interface LoadingState {
  [resourceType: string]: boolean;
}

interface ErrorState {
  [resourceType: string]: string;
}

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface CacheStorage {
  searches: { [key: string]: CacheEntry };
  bundles: { [key: string]: CacheEntry };
  computed: { [key: string]: CacheEntry };
}

interface SearchResults {
  [searchKey: string]: any;
}

interface ActiveFilters {
  [resourceType: string]: any;
}

// Main state interface
interface FHIRResourceState {
  resources: ResourceStorage;
  relationships: Relationships;
  currentPatient: Patient | null;
  currentEncounter: Encounter | null;
  loading: LoadingState;
  isLoading: boolean;
  errors: ErrorState;
  cache: CacheStorage;
  searchResults: SearchResults;
  activeFilters: ActiveFilters;
}

// Action type definitions
type FHIRResourceAction =
  | { type: FHIRActionType.SET_RESOURCES; payload: { resourceType: FHIRResourceType; resources: Resource | Resource[] } }
  | { type: FHIRActionType.ADD_RESOURCE; payload: { resourceType: FHIRResourceType; resource: Resource } }
  | { type: FHIRActionType.UPDATE_RESOURCE; payload: { resourceType: FHIRResourceType; resourceId: string; updates: Partial<Resource> } }
  | { type: FHIRActionType.REMOVE_RESOURCE; payload: { resourceType: FHIRResourceType; resourceId: string } }
  | { type: FHIRActionType.CLEAR_RESOURCES; payload: { resourceType: FHIRResourceType } }
  | { type: FHIRActionType.SET_LOADING; payload: { resourceType: FHIRResourceType; loading: boolean } }
  | { type: FHIRActionType.SET_ERROR; payload: { resourceType: FHIRResourceType; error: string } }
  | { type: FHIRActionType.CLEAR_ERROR; payload: { resourceType: FHIRResourceType } }
  | { type: FHIRActionType.SET_GLOBAL_LOADING; payload: boolean }
  | { type: FHIRActionType.SET_CURRENT_PATIENT; payload: Patient | null }
  | { type: FHIRActionType.SET_CURRENT_ENCOUNTER; payload: Encounter | null }
  | { type: FHIRActionType.SET_CACHE; payload: { cacheType: keyof CacheStorage; key: string; data: any; ttl?: number } }
  | { type: FHIRActionType.INVALIDATE_CACHE; payload: { cacheType: keyof CacheStorage; key?: string } }
  | { type: FHIRActionType.SET_RELATIONSHIPS; payload: { patientId: string; relationships: PatientRelationships } }
  | { type: FHIRActionType.ADD_RELATIONSHIP; payload: { patientId: string; resourceType: FHIRResourceType; resourceId: string } }
  | { type: FHIRActionType.SET_SEARCH_RESULTS; payload: { searchKey: string; results: any } }
  | { type: FHIRActionType.SET_FILTERS; payload: { resourceType: FHIRResourceType; filters: any } };

// Search parameters interface
interface SearchParams {
  [key: string]: string | number | boolean | undefined;
  patient?: string;
  subject?: string;
  _count?: number;
  _sort?: string;
}

// Bundle result interface
interface BundleResult {
  [resourceType: string]: Resource[];
}

// Search result interface
interface SearchResult {
  resources: Resource[];
  total: number;
  bundle: Bundle;
}

// Priority type for progressive loading
type LoadingPriority = 'critical' | 'important' | 'all';

// Cache types
type CacheType = keyof CacheStorage;

// Initial State
const createInitialResourceStorage = (): ResourceStorage => ({
  Patient: {},
  Encounter: {},
  Observation: {},
  Condition: {},
  MedicationRequest: {},
  MedicationDispense: {},
  Procedure: {},
  DiagnosticReport: {},
  DocumentReference: {},
  CarePlan: {},
  CareTeam: {},
  AllergyIntolerance: {},
  Immunization: {},
  Coverage: {},
  ImagingStudy: {},
  Practitioner: {},
  Organization: {},
  ServiceRequest: {},
  Goal: {},
  Task: {},
  Measure: {},
  MeasureReport: {},
  Group: {},
  Communication: {},
  Appointment: {},
  AppointmentResponse: {},
  Slot: {},
  Schedule: {}
});

const initialState: FHIRResourceState = {
  resources: createInitialResourceStorage(),
  relationships: {},
  currentPatient: null,
  currentEncounter: null,
  loading: {},
  isLoading: false,
  errors: {},
  cache: {
    searches: {},
    bundles: {},
    computed: {}
  },
  searchResults: {},
  activeFilters: {}
};

// Reducer function with proper TypeScript typing
function fhirResourceReducer(state: FHIRResourceState, action: FHIRResourceAction): FHIRResourceState {
  switch (action.type) {
    case FHIRActionType.SET_RESOURCES: {
      const { resourceType, resources } = action.payload;
      const resourceMap: ResourceMap = {};
      
      if (Array.isArray(resources)) {
        resources.forEach(resource => {
          if (resource.id) {
            resourceMap[resource.id] = resource;
          }
        });
      } else if (resources.id) {
        resourceMap[resources.id] = resources;
      }
      
      return {
        ...state,
        resources: {
          ...state.resources,
          [resourceType]: {
            ...state.resources[resourceType],
            ...resourceMap
          }
        }
      };
    }
    
    case FHIRActionType.ADD_RESOURCE: {
      const { resourceType, resource } = action.payload;
      if (!resource.id) return state;
      
      return {
        ...state,
        resources: {
          ...state.resources,
          [resourceType]: {
            ...state.resources[resourceType],
            [resource.id]: resource
          }
        }
      };
    }
    
    case FHIRActionType.UPDATE_RESOURCE: {
      const { resourceType, resourceId, updates } = action.payload;
      const existingResource = state.resources[resourceType]?.[resourceId];
      if (!existingResource) return state;
      
      return {
        ...state,
        resources: {
          ...state.resources,
          [resourceType]: {
            ...state.resources[resourceType],
            [resourceId]: {
              ...existingResource,
              ...updates
            }
          }
        }
      };
    }
    
    case FHIRActionType.REMOVE_RESOURCE: {
      const { resourceType, resourceId } = action.payload;
      const { [resourceId]: removed, ...remaining } = state.resources[resourceType] || {};
      
      return {
        ...state,
        resources: {
          ...state.resources,
          [resourceType]: remaining
        }
      };
    }
    
    case FHIRActionType.CLEAR_RESOURCES: {
      const { resourceType } = action.payload;
      return {
        ...state,
        resources: {
          ...state.resources,
          [resourceType]: {}
        }
      };
    }
    
    case FHIRActionType.SET_LOADING: {
      const { resourceType, loading } = action.payload;
      return {
        ...state,
        loading: {
          ...state.loading,
          [resourceType]: loading
        }
      };
    }
    
    case FHIRActionType.SET_ERROR: {
      const { resourceType, error } = action.payload;
      return {
        ...state,
        errors: {
          ...state.errors,
          [resourceType]: error
        }
      };
    }
    
    case FHIRActionType.CLEAR_ERROR: {
      const { resourceType } = action.payload;
      const { [resourceType]: removed, ...remaining } = state.errors;
      return {
        ...state,
        errors: remaining
      };
    }
    
    case FHIRActionType.SET_GLOBAL_LOADING: {
      return {
        ...state,
        isLoading: action.payload
      };
    }
    
    case FHIRActionType.SET_CURRENT_PATIENT: {
      return {
        ...state,
        currentPatient: action.payload
      };
    }
    
    case FHIRActionType.SET_CURRENT_ENCOUNTER: {
      return {
        ...state,
        currentEncounter: action.payload
      };
    }
    
    case FHIRActionType.SET_CACHE: {
      const { cacheType, key, data, ttl = 300000 } = action.payload;
      return {
        ...state,
        cache: {
          ...state.cache,
          [cacheType]: {
            ...state.cache[cacheType],
            [key]: {
              data,
              timestamp: Date.now(),
              ttl
            }
          }
        }
      };
    }
    
    case FHIRActionType.INVALIDATE_CACHE: {
      const { cacheType, key } = action.payload;
      if (key) {
        const { [key]: removed, ...remaining } = state.cache[cacheType] || {};
        return {
          ...state,
          cache: {
            ...state.cache,
            [cacheType]: remaining
          }
        };
      } else {
        return {
          ...state,
          cache: {
            ...state.cache,
            [cacheType]: {}
          }
        };
      }
    }
    
    case FHIRActionType.SET_RELATIONSHIPS: {
      const { patientId, relationships } = action.payload;
      return {
        ...state,
        relationships: {
          ...state.relationships,
          [patientId]: relationships
        }
      };
    }
    
    case FHIRActionType.ADD_RELATIONSHIP: {
      const { patientId, resourceType, resourceId } = action.payload;
      const existing = state.relationships[patientId] || {};
      const existingType = existing[resourceType] || [];
      
      return {
        ...state,
        relationships: {
          ...state.relationships,
          [patientId]: {
            ...existing,
            [resourceType]: [...existingType, resourceId].filter((id, index, arr) => arr.indexOf(id) === index)
          }
        }
      };
    }
    
    case FHIRActionType.SET_SEARCH_RESULTS: {
      const { searchKey, results } = action.payload;
      return {
        ...state,
        searchResults: {
          ...state.searchResults,
          [searchKey]: results
        }
      };
    }
    
    case FHIRActionType.SET_FILTERS: {
      const { resourceType, filters } = action.payload;
      return {
        ...state,
        activeFilters: {
          ...state.activeFilters,
          [resourceType]: filters
        }
      };
    }
    
    default:
      return state;
  }
}

// Context type definition
interface FHIRResourceContextType extends FHIRResourceState {
  // Resource Management
  setResources: (resourceType: FHIRResourceType, resources: Resource | Resource[]) => void;
  addResource: (resourceType: FHIRResourceType, resource: Resource) => void;
  updateResource: (resourceType: FHIRResourceType, resourceId: string, updates: Partial<Resource>) => void;
  removeResource: (resourceType: FHIRResourceType, resourceId: string) => void;
  getResource: <T extends Resource>(resourceType: FHIRResourceType, resourceId: string) => T | null;
  getResourcesByType: <T extends Resource>(resourceType: FHIRResourceType) => T[];
  getPatientResources: <T extends Resource>(patientId: string, resourceType?: FHIRResourceType) => T[];
  
  // FHIR Operations
  fetchResource: <T extends Resource>(resourceType: FHIRResourceType, resourceId: string, forceRefresh?: boolean) => Promise<T>;
  searchResources: (resourceType: FHIRResourceType, params?: SearchParams, forceRefresh?: boolean) => Promise<SearchResult>;
  fetchPatientBundle: (patientId: string, forceRefresh?: boolean, priority?: LoadingPriority) => Promise<BundleResult>;
  refreshPatientResources: (patientId: string) => Promise<void>;
  
  // Patient Context
  setCurrentPatient: (patientId: string) => Promise<Patient>;
  setCurrentEncounter: (encounterId: string) => Promise<Encounter>;
  
  // Utilities
  isResourceLoading: (resourceType: FHIRResourceType) => boolean;
  getError: (resourceType: FHIRResourceType) => string | null;
  clearCache: (cacheType?: CacheType) => void;
  getCachedData: <T = any>(cacheType: CacheType, key: string) => T | null;
  setCachedData: <T = any>(cacheType: CacheType, key: string, data: T, ttl?: number, resourceType?: FHIRResourceType) => void;
}

// Create Context
const FHIRResourceContext = createContext<FHIRResourceContextType | undefined>(undefined);

// Provider Component Props
interface FHIRResourceProviderProps {
  children: ReactNode;
}

// Provider Component
export function FHIRResourceProvider({ children }: FHIRResourceProviderProps) {
  const [state, dispatch] = useReducer(fhirResourceReducer, initialState);

  // Enhanced cache utilities using intelligent cache
  const getCachedData = useCallback(<T = any>(cacheType: CacheType, key: string): T | null => {
    // First check intelligent cache
    const intelligentCacheKey = `${cacheType}:${key}`;
    const intelligentData = intelligentCache.get(intelligentCacheKey);
    if (intelligentData) {
      return intelligentData as T;
    }
    
    // Fallback to state cache for backward compatibility
    const cached = state.cache[cacheType]?.[key];
    if (!cached) return null;
    
    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      // Cache expired, remove it
      dispatch({
        type: FHIRActionType.INVALIDATE_CACHE,
        payload: { cacheType, key }
      });
      return null;
    }
    
    return cached.data as T;
  }, [state.cache]);

  const setCachedData = useCallback(<T = any>(
    cacheType: CacheType, 
    key: string, 
    data: T, 
    ttl?: number, 
    resourceType?: FHIRResourceType
  ): void => {
    // Store in intelligent cache
    const intelligentCacheKey = `${cacheType}:${key}`;
    intelligentCache.set(intelligentCacheKey, data, {
      resourceType,
      customTTL: ttl,
      tags: [cacheType]
    });
    
    // Also store in state cache for backward compatibility
    dispatch({
      type: FHIRActionType.SET_CACHE,
      payload: { cacheType, key, data, ttl }
    });
  }, []);

  // Resource Management Functions
  const setResources = useCallback((resourceType: FHIRResourceType, resources: Resource | Resource[]): void => {
    dispatch({
      type: FHIRActionType.SET_RESOURCES,
      payload: { resourceType, resources }
    });
  }, []);

  const addResource = useCallback((resourceType: FHIRResourceType, resource: Resource): void => {
    dispatch({
      type: FHIRActionType.ADD_RESOURCE,
      payload: { resourceType, resource }
    });
    
    // Add relationship if patient context exists
    if (state.currentPatient && (resource as any).subject?.reference === `Patient/${state.currentPatient.id}`) {
      dispatch({
        type: FHIRActionType.ADD_RELATIONSHIP,
        payload: {
          patientId: state.currentPatient.id,
          resourceType,
          resourceId: resource.id!
        }
      });
    }
  }, [state.currentPatient]);

  const updateResource = useCallback((resourceType: FHIRResourceType, resourceId: string, updates: Partial<Resource>): void => {
    dispatch({
      type: FHIRActionType.UPDATE_RESOURCE,
      payload: { resourceType, resourceId, updates }
    });
  }, []);

  const removeResource = useCallback((resourceType: FHIRResourceType, resourceId: string): void => {
    dispatch({
      type: FHIRActionType.REMOVE_RESOURCE,
      payload: { resourceType, resourceId }
    });
  }, []);

  const getResource = useCallback(<T extends Resource>(resourceType: FHIRResourceType, resourceId: string): T | null => {
    return (state.resources[resourceType]?.[resourceId] as T) || null;
  }, [state.resources]);

  const getResourcesByType = useCallback(<T extends Resource>(resourceType: FHIRResourceType): T[] => {
    return Object.values(state.resources[resourceType] || {}) as T[];
  }, [state.resources]);

  const getPatientResources = useCallback(<T extends Resource>(patientId: string, resourceType?: FHIRResourceType): T[] => {
    const relationships = state.relationships[patientId];
    if (!relationships) return [];

    if (resourceType) {
      const resourceIds = relationships[resourceType] || [];
      return resourceIds.map(id => state.resources[resourceType]?.[id]).filter(Boolean) as T[];
    }

    // Return all resources for patient
    const allResources: T[] = [];
    Object.entries(relationships).forEach(([type, ids]) => {
      ids.forEach(id => {
        const resource = state.resources[type as FHIRResourceType]?.[id];
        if (resource) {
          allResources.push(resource as T);
        }
      });
    });

    return allResources;
  }, [state.resources, state.relationships]);

  // FHIR Operations with Caching
  const fetchResource = useCallback(async <T extends Resource>(
    resourceType: FHIRResourceType, 
    resourceId: string, 
    forceRefresh = false
  ): Promise<T> => {
    const cacheKey = `${resourceType}/${resourceId}`;
    
    if (!forceRefresh) {
      const cached = getCachedData<T>('searches', cacheKey);
      if (cached) return cached;
    }

    dispatch({ type: FHIRActionType.SET_LOADING, payload: { resourceType, loading: true } });
    dispatch({ type: FHIRActionType.CLEAR_ERROR, payload: { resourceType } });

    try {
      const resource = await fhirClient.read<T>(resourceType, resourceId);
      
      addResource(resourceType, resource);
      setCachedData('searches', cacheKey, resource, 600000, resourceType); // 10 minute default
      
      return resource;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      dispatch({ type: FHIRActionType.SET_ERROR, payload: { resourceType, error: errorMessage } });
      throw error;
    } finally {
      dispatch({ type: FHIRActionType.SET_LOADING, payload: { resourceType, loading: false } });
    }
  }, [getCachedData, setCachedData, addResource]);

  const searchResources = useCallback(async (
    resourceType: FHIRResourceType, 
    params: SearchParams = {}, 
    forceRefresh = false
  ): Promise<SearchResult> => {
    const searchKey = `${resourceType}_${JSON.stringify(params)}`;
    
    if (!forceRefresh) {
      const cached = getCachedData<SearchResult>('searches', searchKey);
      if (cached) {
        setResources(resourceType, cached.resources);
        return cached;
      }
    }

    dispatch({ type: FHIRActionType.SET_LOADING, payload: { resourceType, loading: true } });
    dispatch({ type: FHIRActionType.CLEAR_ERROR, payload: { resourceType } });

    try {
      const result = await fhirClient.search(resourceType, params);
      
      if (result.resources && result.resources.length > 0) {
        setResources(resourceType, result.resources);
        
        // Build relationships for patient resources
        if (params.patient || params.subject) {
          const patientId = params.patient || params.subject;
          if (typeof patientId === 'string') {
            result.resources.forEach(resource => {
              if (resource.id) {
                dispatch({
                  type: FHIRActionType.ADD_RELATIONSHIP,
                  payload: {
                    patientId,
                    resourceType,
                    resourceId: resource.id
                  }
                });
              }
            });
          }
        }
      }
      
      setCachedData('searches', searchKey, result, 300000, resourceType); // 5 minute cache for searches
      dispatch({ type: FHIRActionType.SET_SEARCH_RESULTS, payload: { searchKey, results: result } });
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      dispatch({ type: FHIRActionType.SET_ERROR, payload: { resourceType, error: errorMessage } });
      throw error;
    } finally {
      dispatch({ type: FHIRActionType.SET_LOADING, payload: { resourceType, loading: false } });
    }
  }, [getCachedData, setCachedData, setResources]);

  const fetchPatientBundle = useCallback(async (
    patientId: string, 
    forceRefresh = false, 
    priority: LoadingPriority = 'all'
  ): Promise<BundleResult> => {
    const cacheKey = `patient_bundle_${patientId}_${priority}`;
    
    if (!forceRefresh) {
      const cached = getCachedData<BundleResult>('bundles', cacheKey);
      if (cached) return cached;
    }

    // Define resource types by priority for progressive loading
    const resourceTypesByPriority = {
      critical: ['Encounter', 'Condition', 'MedicationRequest', 'AllergyIntolerance'] as FHIRResourceType[],
      important: ['Observation', 'Procedure', 'DiagnosticReport', 'Coverage'] as FHIRResourceType[],
      optional: ['Immunization', 'CarePlan', 'CareTeam', 'DocumentReference', 'ImagingStudy'] as FHIRResourceType[]
    };
    
    let resourceTypes: FHIRResourceType[];
    if (priority === 'critical') {
      resourceTypes = resourceTypesByPriority.critical;
    } else if (priority === 'important') {
      resourceTypes = [...resourceTypesByPriority.critical, ...resourceTypesByPriority.important];
    } else {
      resourceTypes = [...resourceTypesByPriority.critical, ...resourceTypesByPriority.important, ...resourceTypesByPriority.optional];
    }

    try {
      const promises = resourceTypes.map(async (resourceType) => {
        // Reduce initial count for better performance, increase for specific needs
        const counts = {
          critical: 100,
          important: 200,
          optional: 50
        };
        
        let baseCount = priority === 'critical' ? counts.critical : 
                       priority === 'important' ? counts.important : counts.optional;
        
        // Adjust count based on resource type
        let resourceCount = baseCount;
        if (resourceType === 'Observation' && priority !== 'critical') {
          resourceCount = 500; // Observations are numerous but important
        } else if (resourceType === 'Encounter') {
          resourceCount = 50;  // Usually fewer encounters
        }
        
        const params: SearchParams = { patient: patientId, _count: resourceCount };
        
        // Add appropriate sort parameters for each resource type
        switch (resourceType) {
          case 'Procedure':
            params._sort = '-performed-date';
            break;
          case 'Observation':
            params._sort = '-date';
            break;
          case 'Encounter':
            params._sort = '-date';
            break;
          case 'MedicationRequest':
            params._sort = '-authored';
            break;
          case 'Condition':
            params._sort = '-recorded-date';
            break;
          case 'DiagnosticReport':
            params._sort = '-date';
            break;
          case 'DocumentReference':
            params._sort = '-date';
            break;
          case 'ImagingStudy':
            params._sort = '-started';
            break;
          case 'AllergyIntolerance':
            params._sort = '-date';
            break;
          case 'Immunization':
            params._sort = '-date';
            break;
          default:
            // Most resources use -date as default
            params._sort = '-date';
        }
        
        try {
          return await searchResources(resourceType, params, forceRefresh);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          return { resourceType, error: errorMessage, resources: [] };
        }
      });

      const results = await Promise.all(promises);
      const bundle: BundleResult = {};
      
      results.forEach(result => {
        if ('error' in result) {
          console.warn(`Error fetching ${result.resourceType}:`, result.error);
        }
        const resourceType = ('resourceType' in result) ? result.resourceType : 'unknown';
        bundle[resourceType] = ('resources' in result) ? result.resources : [];
      });

      // Cache with intelligent TTL based on priority
      const cacheTTL = priority === 'critical' ? 900000 : // 15 minutes
                      priority === 'important' ? 600000 : // 10 minutes  
                      300000; // 5 minutes
      setCachedData('bundles', cacheKey, bundle, cacheTTL, 'Bundle' as FHIRResourceType);
      return bundle;
    } catch (error) {
      console.error('Error fetching patient bundle:', error);
      throw error;
    }
  }, [searchResources, getCachedData, setCachedData]);

  // Patient Context Management
  const setCurrentPatient = useCallback(async (patientId: string): Promise<Patient> => {
    // Prevent duplicate calls for the same patient
    if (state.currentPatient?.id === patientId) {
      return state.currentPatient;
    }
    
    dispatch({ type: FHIRActionType.SET_GLOBAL_LOADING, payload: true });
    
    try {
      const patient = await fetchResource<Patient>('Patient', patientId);
      dispatch({ type: FHIRActionType.SET_CURRENT_PATIENT, payload: patient });
      
      // Progressive loading: Load critical resources first, then important ones in background
      await fetchPatientBundle(patientId, false, 'critical');
      
      dispatch({ type: FHIRActionType.SET_GLOBAL_LOADING, payload: false });
      
      // Load important resources in background
      setTimeout(() => {
        fetchPatientBundle(patientId, false, 'important');
      }, 100);
      
      // Load optional resources after a delay
      setTimeout(() => {
        fetchPatientBundle(patientId, false, 'all');
      }, 2000);
      
      return patient;
    } catch (error) {
      console.error('Error setting current patient:', error);
      dispatch({ type: FHIRActionType.SET_GLOBAL_LOADING, payload: false });
      throw error;
    }
  }, [fetchResource, fetchPatientBundle, state.currentPatient]);

  const setCurrentEncounter = useCallback(async (encounterId: string): Promise<Encounter> => {
    try {
      const encounter = await fetchResource<Encounter>('Encounter', encounterId);
      dispatch({ type: FHIRActionType.SET_CURRENT_ENCOUNTER, payload: encounter });
      return encounter;
    } catch (error) {
      console.error('Error setting current encounter:', error);
      throw error;
    }
  }, [fetchResource]);

  // Utility Functions
  const isResourceLoading = useCallback((resourceType: FHIRResourceType): boolean => {
    return state.loading[resourceType] || false;
  }, [state.loading]);

  const getError = useCallback((resourceType: FHIRResourceType): string | null => {
    return state.errors[resourceType] || null;
  }, [state.errors]);

  const clearCache = useCallback((cacheType?: CacheType): void => {
    if (cacheType) {
      dispatch({ type: FHIRActionType.INVALIDATE_CACHE, payload: { cacheType } });
    } else {
      // Clear all caches
      Object.keys(state.cache).forEach(type => {
        dispatch({ type: FHIRActionType.INVALIDATE_CACHE, payload: { cacheType: type as CacheType } });
      });
    }
  }, [state.cache]);

  const refreshPatientResources = useCallback(async (patientId: string): Promise<void> => {
    try {
      console.log('Refreshing patient resources for:', patientId);
      // Clear the patient bundle cache
      const cacheKey = `patient_bundle_${patientId}`;
      dispatch({ type: FHIRActionType.INVALIDATE_CACHE, payload: { cacheType: 'bundles', key: cacheKey } });
      
      // Clear related search caches
      const resourceTypes: FHIRResourceType[] = [
        'Encounter', 'Condition', 'Observation', 'MedicationRequest', 
        'Procedure', 'DiagnosticReport', 'AllergyIntolerance', 'Immunization',
        'CarePlan', 'CareTeam', 'Coverage', 'DocumentReference', 'ImagingStudy'
      ];
      
      resourceTypes.forEach(resourceType => {
        const params: SearchParams = { patient: patientId, _count: 1000 };
        
        // Add appropriate sort parameters for each resource type
        switch (resourceType) {
          case 'Procedure':
            params._sort = '-performed-date';
            break;
          case 'Observation':
            params._sort = '-date';
            break;
          case 'Encounter':
            params._sort = '-date';
            break;
          case 'MedicationRequest':
            params._sort = '-authored';
            break;
          case 'Condition':
            params._sort = '-recorded-date';
            break;
          case 'DiagnosticReport':
            params._sort = '-date';
            break;
          case 'DocumentReference':
            params._sort = '-date';
            break;
          case 'ImagingStudy':
            params._sort = '-started';
            break;
          case 'AllergyIntolerance':
            params._sort = '-date';
            break;
          case 'Immunization':
            params._sort = '-date';
            break;
          default:
            // Most resources use -date as default
            params._sort = '-date';
        }
        
        const searchKey = `${resourceType}_${JSON.stringify(params)}`;
        dispatch({ type: FHIRActionType.INVALIDATE_CACHE, payload: { cacheType: 'searches', key: searchKey } });
      });
      
      // Force refresh the patient bundle
      await fetchPatientBundle(patientId, true);
      
    } catch (error) {
      console.error('Error refreshing patient resources:', error);
      throw error;
    }
  }, [fetchPatientBundle]);

  // Listen for refresh events from fhirService
  useEffect(() => {
    const handleResourcesUpdated = (event: CustomEvent<{ patientId: string }>) => {
      const { patientId } = event.detail;
      if (patientId && state.currentPatient && state.currentPatient.id === patientId) {
        refreshPatientResources(patientId);
      }
    };

    window.addEventListener('fhir-resources-updated', handleResourcesUpdated as EventListener);
    return () => {
      window.removeEventListener('fhir-resources-updated', handleResourcesUpdated as EventListener);
    };
  }, [refreshPatientResources, state.currentPatient]);

  // Context Value
  const contextValue: FHIRResourceContextType = {
    // State
    ...state,
    
    // Resource Management
    setResources,
    addResource,
    updateResource,
    removeResource,
    getResource,
    getResourcesByType,
    getPatientResources,
    
    // FHIR Operations
    fetchResource,
    searchResources,
    fetchPatientBundle,
    refreshPatientResources,
    
    // Patient Context
    setCurrentPatient,
    setCurrentEncounter,
    
    // Utilities
    isResourceLoading,
    getError,
    clearCache,
    getCachedData,
    setCachedData
  };

  return (
    <FHIRResourceContext.Provider value={contextValue}>
      {children}
    </FHIRResourceContext.Provider>
  );
}

// Hook for using the context
export function useFHIRResource(): FHIRResourceContextType {
  const context = useContext(FHIRResourceContext);
  if (!context) {
    throw new Error('useFHIRResource must be used within a FHIRResourceProvider');
  }
  return context;
}

// Convenience hooks for specific resource types
export function usePatient(patientId?: string) {
  const { getResource, setCurrentPatient, currentPatient } = useFHIRResource();
  
  const patient = patientId ? getResource<Patient>('Patient', patientId) : currentPatient;
  
  const loadPatient = useCallback(async (id: string): Promise<Patient> => {
    return await setCurrentPatient(id);
  }, [setCurrentPatient]);

  return { patient, loadPatient };
}

export function usePatientResources<T extends Resource>(patientId?: string, resourceType?: FHIRResourceType) {
  const { getPatientResources, fetchPatientBundle, loading } = useFHIRResource();
  
  const resources = patientId ? getPatientResources<T>(patientId, resourceType) : [];
  const isLoading = loading[resourceType || 'Patient'] || false;
  
  const loadResources = useCallback(async (forceRefresh = false): Promise<BundleResult | undefined> => {
    if (patientId) {
      return await fetchPatientBundle(patientId, forceRefresh);
    }
  }, [patientId, fetchPatientBundle]);

  return { resources, loading: isLoading, loadResources };
}

export default FHIRResourceContext;