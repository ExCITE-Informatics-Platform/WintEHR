/**
 * Custom hook for patient search functionality
 * 
 * Migrated to TypeScript with comprehensive type safety using FHIR R4 types.
 */

import { useState, useCallback } from 'react';
import { R4 } from '@ahryman40k/ts-fhir-types';
import api from '../services/api';
import { AxiosResponse } from 'axios';

/**
 * Type definitions for patient search
 */
export interface PatientSearchOptions {
  name?: string;
  identifier?: string;
  birthdate?: string;
  gender?: string;
  family?: string;
  given?: string;
  _count?: number;
  _sort?: string;
}

export interface PatientSearchResult {
  patients: R4.IPatient[];
  loading: boolean;
  error: string | null;
  searchPatients: (searchTerm?: string, options?: PatientSearchOptions) => Promise<R4.IPatient[]>;
  searchPatientsAdvanced: (options: PatientSearchOptions) => Promise<R4.IPatient[]>;
  clearResults: () => void;
  totalCount?: number;
}

/**
 * Hook for patient search functionality
 */
export const usePatientSearch = (): PatientSearchResult => {
  const [patients, setPatients] = useState<R4.IPatient[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number | undefined>();

  const searchPatients = useCallback(async (
    searchTerm: string = '', 
    options: PatientSearchOptions = {}
  ): Promise<R4.IPatient[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const searchParams = new URLSearchParams();
      
      // Add search term as name parameter if provided
      if (searchTerm.trim()) {
        searchParams.append('name', searchTerm.trim());
      }
      
      // Add other search options
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          searchParams.append(key, value.toString());
        }
      });
      
      // Default count if none specified
      if (!searchParams.has('_count')) {
        searchParams.append('_count', '20');
      }
      
      const queryString = searchParams.toString();
      const endpoint = `/fhir/R4/Patient${queryString ? `?${queryString}` : ''}`;
      
      const response: AxiosResponse<R4.IBundle> = await api.get(endpoint);
      
      const patientList = response.data.entry?.map(entry => entry.resource as R4.IPatient) || [];
      const total = response.data.total;
      
      setPatients(patientList);
      setTotalCount(total);
      
      return patientList;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Search failed';
      console.error('Patient search error:', err);
      setError(errorMessage);
      setPatients([]);
      setTotalCount(undefined);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const searchPatientsAdvanced = useCallback(async (
    options: PatientSearchOptions
  ): Promise<R4.IPatient[]> => {
    return searchPatients('', options);
  }, [searchPatients]);

  const clearResults = useCallback((): void => {
    setPatients([]);
    setError(null);
    setTotalCount(undefined);
  }, []);

  return {
    patients,
    loading,
    error,
    searchPatients,
    searchPatientsAdvanced,
    clearResults,
    totalCount
  };
};

/**
 * Hook for debounced patient search
 */
export const useDebouncedPatientSearch = (
  delay: number = 300
): PatientSearchResult & {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
} => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedTerm, setDebouncedTerm] = useState<string>('');
  const patientSearch = usePatientSearch();

  // Debounce search term
  useState(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(searchTerm);
    }, delay);

    return () => clearTimeout(timer);
  });

  // Trigger search when debounced term changes
  useState(() => {
    if (debouncedTerm) {
      patientSearch.searchPatients(debouncedTerm);
    } else {
      patientSearch.clearResults();
    }
  });

  return {
    ...patientSearch,
    searchTerm,
    setSearchTerm
  };
};

/**
 * Hook for patient search with caching
 */
export const useCachedPatientSearch = (): PatientSearchResult & {
  searchHistory: string[];
  clearCache: () => void;
} => {
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [cache, setCache] = useState<Map<string, R4.IPatient[]>>(new Map());
  const baseSearch = usePatientSearch();

  const searchPatients = useCallback(async (
    searchTerm: string = '', 
    options: PatientSearchOptions = {}
  ): Promise<R4.IPatient[]> => {
    const cacheKey = `${searchTerm}-${JSON.stringify(options)}`;
    
    // Check cache first
    if (cache.has(cacheKey)) {
      const cachedResults = cache.get(cacheKey)!;
      baseSearch.patients = cachedResults;
      return cachedResults;
    }

    // Perform search
    const results = await baseSearch.searchPatients(searchTerm, options);
    
    // Cache results and update history
    if (results.length > 0) {
      setCache(prev => new Map(prev.set(cacheKey, results)));
      
      if (searchTerm.trim()) {
        setSearchHistory(prev => {
          const newHistory = [searchTerm, ...prev.filter(term => term !== searchTerm)];
          return newHistory.slice(0, 10); // Keep last 10 searches
        });
      }
    }
    
    return results;
  }, [cache, baseSearch]);

  const searchPatientsAdvanced = useCallback(async (
    options: PatientSearchOptions
  ): Promise<R4.IPatient[]> => {
    return searchPatients('', options);
  }, [searchPatients]);

  const clearCache = useCallback((): void => {
    setCache(new Map());
    setSearchHistory([]);
  }, []);

  return {
    ...baseSearch,
    searchPatients,
    searchPatientsAdvanced,
    searchHistory,
    clearCache
  };
};

export default usePatientSearch;