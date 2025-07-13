/**
 * React Hook for FHIR Operations
 * 
 * Provides a clean interface for FHIR operations with:
 * - Loading states
 * - Error handling
 * - Caching
 * - Real-time updates (when available)
 * 
 * Migrated to TypeScript with comprehensive type safety using FHIR R4 types.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { R4 } from '@ahryman40k/ts-fhir-types';
import { fhirClient } from '../services/fhirClient';
import { emrClient } from '../services/emrClient';

/**
 * Type definitions for FHIR hook options and results
 */
export interface FHIRHookOptions {
  params?: Record<string, any>;
  autoFetch?: boolean;
  cacheKey?: string;
  cacheTTL?: number;
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

export interface FHIRHookResult<T = any> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  fetch: () => Promise<T>;
  create: (resource: any) => Promise<any>;
  update: (id: string, resource: any) => Promise<any>;
  delete: (id: string) => Promise<void>;
  operation: (name: string, params?: any) => Promise<any>;
  refresh: () => Promise<T>;
}

export interface PatientHookResult extends FHIRHookResult<R4.IPatient> {
  getEverything: () => Promise<any>;
}

export interface ClinicalCanvasResult {
  generate: (prompt: string, context: any) => Promise<any>;
  enhance: (currentUi: any, enhancement: string, context: any) => Promise<any>;
  loading: boolean;
  error: Error | null;
}

export interface EMRResult {
  user: any;
  loading: boolean;
  error: Error | null;
  getCurrentUser: () => Promise<any>;
  updateUserPreferences: (preferences: any) => Promise<any>;
  getSystemInfo: () => Promise<any>;
  checkFeature: (feature: string) => boolean;
}

// Cache interface
interface CacheEntry {
  data: any;
  timestamp: number;
}

// Simple in-memory cache
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Main FHIR hook for managing FHIR resources
 */
export function useFHIR<T = any>(
  resourceType: string, 
  id: string | null = null, 
  options: FHIRHookOptions = {}
): FHIRHookResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const mounted = useRef<boolean>(true);

  // Options with defaults
  const {
    params = {},
    autoFetch = true,
    cacheKey = null,
    cacheTTL = CACHE_TTL,
    onSuccess = null,
    onError = null
  } = options;

  // Generate cache key
  const getCacheKey = useCallback((): string => {
    if (cacheKey) return cacheKey;
    if (id) return `${resourceType}/${id}`;
    return `${resourceType}?${JSON.stringify(params)}`;
  }, [resourceType, id, params, cacheKey]);

  // Check cache
  const checkCache = useCallback((): T | null => {
    const key = getCacheKey();
    const cached = cache.get(key);
    
    if (cached && Date.now() - cached.timestamp < cacheTTL) {
      return cached.data as T;
    }
    
    return null;
  }, [getCacheKey, cacheTTL]);

  // Update cache
  const updateCache = useCallback((data: T): void => {
    const key = getCacheKey();
    cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }, [getCacheKey]);

  // Fetch data
  const fetch = useCallback(async (): Promise<T> => {
    // Check cache first
    const cached = checkCache();
    if (cached) {
      setData(cached);
      setLoading(false);
      return cached;
    }

    setLoading(true);
    setError(null);

    try {
      let result: T;
      
      if (id) {
        // Read single resource
        result = await fhirClient.read(resourceType, id) as T;
      } else {
        // Search resources
        const response = await fhirClient.search(resourceType, params);
        result = response.resources as T;
      }

      if (mounted.current) {
        setData(result);
        updateCache(result);
        if (onSuccess) onSuccess(result);
      }

      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      if (mounted.current) {
        setError(error);
        if (onError) onError(error);
      }
      throw error;
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  }, [resourceType, id, params, checkCache, updateCache, onSuccess, onError]);

  // Create resource
  const create = useCallback(async (resource: any): Promise<any> => {
    setLoading(true);
    setError(null);

    try {
      const result = await fhirClient.create(resourceType, resource);
      
      // Invalidate cache for this resource type
      cache.forEach((value, key) => {
        if (key.startsWith(resourceType)) {
          cache.delete(key);
        }
      });

      if (mounted.current) {
        if (onSuccess) onSuccess(result);
      }

      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      if (mounted.current) {
        setError(error);
        if (onError) onError(error);
      }
      throw error;
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  }, [resourceType, onSuccess, onError]);

  // Update resource
  const update = useCallback(async (updateId: string, resource: any): Promise<any> => {
    setLoading(true);
    setError(null);

    try {
      const result = await fhirClient.update(resourceType, updateId, resource);
      
      // Update cache
      const cacheKey = `${resourceType}/${updateId}`;
      updateCache(result as T);
      
      // Invalidate search caches for this resource type
      cache.forEach((value, key) => {
        if (key.startsWith(`${resourceType}?`)) {
          cache.delete(key);
        }
      });

      if (mounted.current) {
        if (onSuccess) onSuccess(result);
      }

      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      if (mounted.current) {
        setError(error);
        if (onError) onError(error);
      }
      throw error;
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  }, [resourceType, updateCache, onSuccess, onError]);

  // Delete resource
  const deleteResource = useCallback(async (deleteId: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      await fhirClient.delete(resourceType, deleteId);
      
      // Remove from cache
      const cacheKey = `${resourceType}/${deleteId}`;
      cache.delete(cacheKey);
      
      // Invalidate search caches for this resource type
      cache.forEach((value, key) => {
        if (key.startsWith(`${resourceType}?`)) {
          cache.delete(key);
        }
      });

      if (mounted.current) {
        setData(null);
        if (onSuccess) onSuccess(undefined);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      if (mounted.current) {
        setError(error);
        if (onError) onError(error);
      }
      throw error;
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  }, [resourceType, onSuccess, onError]);

  // Execute operation
  const operation = useCallback(async (name: string, params: any = {}): Promise<any> => {
    setLoading(true);
    setError(null);

    try {
      let result;
      
      if (id) {
        result = await fhirClient.operation(resourceType, id, name, params);
      } else {
        result = await fhirClient.systemOperation(name, params);
      }

      if (mounted.current) {
        if (onSuccess) onSuccess(result);
      }

      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      if (mounted.current) {
        setError(error);
        if (onError) onError(error);
      }
      throw error;
    } finally {
      if (mounted.current) {
        setLoading(false);
      }
    }
  }, [resourceType, id, onSuccess, onError]);

  // Refresh data
  const refresh = useCallback(async (): Promise<T> => {
    // Clear cache for this key
    const key = getCacheKey();
    cache.delete(key);
    return await fetch();
  }, [getCacheKey, fetch]);

  // Auto-fetch on mount and dependency changes
  useEffect(() => {
    if (autoFetch) {
      fetch();
    }
  }, [autoFetch, fetch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  return {
    data,
    loading,
    error,
    fetch,
    create,
    update,
    delete: deleteResource,
    operation,
    refresh
  };
}

/**
 * Hook for patient-specific operations
 */
export function usePatient(patientId: string, options: FHIRHookOptions = {}): PatientHookResult {
  const patient = useFHIR<R4.IPatient>('Patient', patientId, options);
  
  // Get everything for patient
  const getEverything = useCallback(async () => {
    return patient.operation('everything');
  }, [patient]);

  return {
    ...patient,
    getEverything
  };
}

/**
 * Hook for searching resources
 */
export function useFHIRSearch<T = any>(
  resourceType: string, 
  searchParams: Record<string, any> = {}, 
  options: FHIRHookOptions = {}
): FHIRHookResult<T[]> {
  return useFHIR<T[]>(resourceType, null, {
    ...options,
    params: searchParams
  });
}

/**
 * Hook for Clinical Canvas
 */
export function useClinicalCanvas(): ClinicalCanvasResult {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const generate = useCallback(async (prompt: string, context: any): Promise<any> => {
    setLoading(true);
    setError(null);

    try {
      const result = await emrClient.generateClinicalUI(prompt, context);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const enhance = useCallback(async (currentUi: any, enhancement: string, context: any): Promise<any> => {
    setLoading(true);
    setError(null);

    try {
      const result = await emrClient.enhanceClinicalUI(currentUi, enhancement, context);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    generate,
    enhance,
    loading,
    error
  };
}

/**
 * Hook for EMR features with graceful degradation
 */
export function useEMR(): EMRResult {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const getCurrentUser = useCallback(async (): Promise<any> => {
    setLoading(true);
    setError(null);

    try {
      const result = await emrClient.getCurrentUser();
      setUser(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateUserPreferences = useCallback(async (preferences: any): Promise<any> => {
    setLoading(true);
    setError(null);

    try {
      const result = await emrClient.updateUserPreferences(preferences);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const getSystemInfo = useCallback(async (): Promise<any> => {
    setLoading(true);
    setError(null);

    try {
      const result = await emrClient.getSystemInfo();
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const checkFeature = useCallback((feature: string): boolean => {
    // Implement feature checking logic
    return emrClient.isFeatureEnabled(feature);
  }, []);

  return {
    user,
    loading,
    error,
    getCurrentUser,
    updateUserPreferences,
    getSystemInfo,
    checkFeature
  };
}

/**
 * Cache management utilities
 */

// Invalidate all cache
export function invalidateCache(): void {
  cache.clear();
}

// Invalidate cache for specific resource type
export function invalidateResourceCache(resourceType: string): void {
  cache.forEach((value, key) => {
    if (key.startsWith(resourceType)) {
      cache.delete(key);
    }
  });
}

/**
 * Convenience search functions
 */
export function searchPatients(params: Record<string, any> = {}): Promise<any> {
  return fhirClient.search('Patient', params);
}

export function searchPractitioners(params: Record<string, any> = {}): Promise<any> {
  return fhirClient.search('Practitioner', params);
}

export function searchLocations(params: Record<string, any> = {}): Promise<any> {
  return fhirClient.search('Location', params);
}

export function searchAppointments(params: Record<string, any> = {}): Promise<any> {
  return fhirClient.search('Appointment', params);
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; keys: string[]; memoryUsage: number } {
  const keys = Array.from(cache.keys());
  const memoryUsage = JSON.stringify(Array.from(cache.values())).length;
  
  return {
    size: cache.size,
    keys,
    memoryUsage
  };
}

/**
 * Clean expired cache entries
 */
export function cleanExpiredCache(): void {
  const now = Date.now();
  const keysToDelete: string[] = [];

  cache.forEach((value, key) => {
    if (now - value.timestamp > CACHE_TTL) {
      keysToDelete.push(key);
    }
  });

  keysToDelete.forEach(key => cache.delete(key));
}