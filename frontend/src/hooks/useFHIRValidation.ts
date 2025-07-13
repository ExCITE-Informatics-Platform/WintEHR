/**
 * useFHIRValidation Hook
 * React hook for FHIR resource validation with caching and real-time feedback
 * 
 * Migrated to TypeScript with comprehensive type safety for FHIR validation operations.
 */
import { useState, useCallback, useMemo, useRef } from 'react';
import { R4 } from '@ahryman40k/ts-fhir-types';
import { validateResource, validateReference, validateBundle, FHIRValidator } from '../utils/fhirValidation';

/**
 * Type definitions for FHIR validation
 */
export interface ValidationResult {
  isValid: boolean;
  hasWarnings: boolean;
  errors: string[];
  warnings: string[];
  performance?: {
    validationTime: number;
    resourceSize: number;
  };
}

export interface ValidationOptions {
  strict?: boolean;
  validateReferences?: boolean;
  allowUnknownExtensions?: boolean;
  requireMeta?: boolean;
  customRules?: Array<(resource: any) => ValidationResult>;
  timeout?: number;
}

export interface FieldValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ValidationStats {
  totalValidations: number;
  validResources: number;
  invalidResources: number;
  averageValidationTime: number;
  cacheHitRate: number;
}

export interface FHIRValidationHookResult {
  // Main validation functions
  validateResource: (resource: any, useCache?: boolean) => Promise<ValidationResult>;
  validateResources: (resources: any[], useCache?: boolean) => Promise<ValidationResult[]>;
  validateBundle: (bundle: R4.IBundle, useCache?: boolean) => Promise<ValidationResult>;
  validateReference: (reference: R4.IReference, useCache?: boolean) => Promise<ValidationResult>;
  validateField: (value: any, fieldType: string, path: string) => FieldValidationResult;
  
  // Cache management
  clearCache: () => void;
  cacheSize: number;
  
  // State
  isValidating: boolean;
  
  // Configuration
  updateOptions: (newOptions: Partial<ValidationOptions>) => void;
  
  // Statistics
  getValidationStats: () => ValidationStats;
}

export interface ResourceValidationHookResult {
  validationResult: ValidationResult | null;
  isValid: boolean | null;
  hasWarnings: boolean;
  errors: string[];
  warnings: string[];
  isValidating: boolean;
  revalidate: () => Promise<void>;
}

export interface BatchValidationHookResult {
  validationResults: ValidationResult[] | null;
  overallValid: boolean;
  hasAnyWarnings: boolean;
  totalErrors: number;
  totalWarnings: number;
  isValidating: boolean;
  revalidate: () => Promise<void>;
}

/**
 * Cache entry interface
 */
interface CacheEntry {
  result: ValidationResult;
  timestamp: number;
}

/**
 * Main FHIR validation hook
 */
export const useFHIRValidation = (options: ValidationOptions = {}): FHIRValidationHookResult => {
  const [validationCache, setValidationCache] = useState<Map<string, CacheEntry>>(new Map());
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const validatorRef = useRef<FHIRValidator>(new FHIRValidator(options));
  const statsRef = useRef<ValidationStats>({
    totalValidations: 0,
    validResources: 0,
    invalidResources: 0,
    averageValidationTime: 0,
    cacheHitRate: 0
  });

  // Update validator options
  const updateOptions = useCallback((newOptions: Partial<ValidationOptions>): void => {
    validatorRef.current = new FHIRValidator({ ...options, ...newOptions });
    setValidationCache(new Map()); // Clear cache when options change
  }, [options]);

  // Generate cache key for a resource
  const getCacheKey = useCallback((resource: any): string | null => {
    if (!resource || typeof resource !== 'object') return null;
    try {
      return JSON.stringify({
        resourceType: resource.resourceType,
        id: resource.id,
        meta: resource.meta,
        // Add other fields that affect validation
        checksum: JSON.stringify(resource).length // Simple checksum
      });
    } catch {
      return null;
    }
  }, []);

  // Clear validation cache
  const clearCache = useCallback((): void => {
    setValidationCache(new Map());
  }, []);

  // Get validation statistics
  const getValidationStats = useCallback((): ValidationStats => {
    return { ...statsRef.current };
  }, []);

  // Update statistics
  const updateStats = useCallback((wasValid: boolean, validationTime: number, wasFromCache: boolean): void => {
    const stats = statsRef.current;
    stats.totalValidations++;
    if (wasValid) {
      stats.validResources++;
    } else {
      stats.invalidResources++;
    }
    
    // Update average validation time
    const totalTime = stats.averageValidationTime * (stats.totalValidations - 1) + validationTime;
    stats.averageValidationTime = totalTime / stats.totalValidations;
    
    // Update cache hit rate
    const cacheHits = wasFromCache ? 1 : 0;
    const totalCacheHits = stats.cacheHitRate * (stats.totalValidations - 1) + cacheHits;
    stats.cacheHitRate = totalCacheHits / stats.totalValidations;
  }, []);

  // Validate a single resource
  const validateSingleResource = useCallback(async (resource: any, useCache: boolean = true): Promise<ValidationResult> => {
    const startTime = Date.now();
    const cacheKey = getCacheKey(resource);
    
    if (useCache && cacheKey && validationCache.has(cacheKey)) {
      const cached = validationCache.get(cacheKey)!;
      updateStats(cached.result.isValid, 0, true);
      return cached.result;
    }

    setIsValidating(true);
    
    try {
      // Use setTimeout to make validation async and avoid blocking UI
      const result = await new Promise<ValidationResult>((resolve) => {
        setTimeout(() => {
          resolve(validateResource(resource, options));
        }, 0);
      });

      const validationTime = Date.now() - startTime;
      result.performance = {
        validationTime,
        resourceSize: JSON.stringify(resource).length
      };

      // Cache the result
      if (cacheKey) {
        setValidationCache(prev => new Map(prev.set(cacheKey, {
          result,
          timestamp: Date.now()
        })));
      }

      updateStats(result.isValid, validationTime, false);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown validation error';
      const result: ValidationResult = {
        isValid: false,
        hasWarnings: false,
        errors: [errorMessage],
        warnings: [],
        performance: {
          validationTime: Date.now() - startTime,
          resourceSize: JSON.stringify(resource).length
        }
      };
      
      updateStats(false, Date.now() - startTime, false);
      return result;
    } finally {
      setIsValidating(false);
    }
  }, [getCacheKey, validationCache, options, updateStats]);

  // Validate multiple resources
  const validateMultipleResources = useCallback(async (resources: any[], useCache: boolean = true): Promise<ValidationResult[]> => {
    setIsValidating(true);
    
    try {
      const results = await Promise.all(
        resources.map(resource => validateSingleResource(resource, useCache))
      );
      return results;
    } finally {
      setIsValidating(false);
    }
  }, [validateSingleResource]);

  // Validate a bundle
  const validateBundleResource = useCallback(async (bundle: R4.IBundle, useCache: boolean = true): Promise<ValidationResult> => {
    const cacheKey = getCacheKey(bundle);
    
    if (useCache && cacheKey && validationCache.has(cacheKey)) {
      return validationCache.get(cacheKey)!.result;
    }

    setIsValidating(true);
    
    try {
      const result = await new Promise<ValidationResult>((resolve) => {
        setTimeout(() => {
          resolve(validateBundle(bundle, options));
        }, 0);
      });

      // Cache the result
      if (cacheKey) {
        setValidationCache(prev => new Map(prev.set(cacheKey, {
          result,
          timestamp: Date.now()
        })));
      }

      return result;
    } finally {
      setIsValidating(false);
    }
  }, [getCacheKey, validationCache, options]);

  // Validate a reference
  const validateReferenceResource = useCallback(async (reference: R4.IReference, useCache: boolean = true): Promise<ValidationResult> => {
    const cacheKey = getCacheKey(reference);
    
    if (useCache && cacheKey && validationCache.has(cacheKey)) {
      return validationCache.get(cacheKey)!.result;
    }

    setIsValidating(true);
    
    try {
      const result = await new Promise<ValidationResult>((resolve) => {
        setTimeout(() => {
          resolve(validateReference(reference, options));
        }, 0);
      });

      // Cache the result
      if (cacheKey) {
        setValidationCache(prev => new Map(prev.set(cacheKey, {
          result,
          timestamp: Date.now()
        })));
      }

      return result;
    } finally {
      setIsValidating(false);
    }
  }, [getCacheKey, validationCache, options]);

  // Validate individual field
  const validateField = useCallback((value: any, fieldType: string, path: string): FieldValidationResult => {
    const result: FieldValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      switch (fieldType) {
        case 'id':
          // FHIR ID validation
          const idPattern = /^[A-Za-z0-9\-\.]{1,64}$/;
          if (value && !idPattern.test(value)) {
            result.isValid = false;
            result.errors.push(`Invalid ID format: ${value}`);
          }
          break;
        
        case 'uri':
          // URI validation
          try {
            if (value) new URL(value);
          } catch {
            result.isValid = false;
            result.errors.push(`Invalid URI format: ${value}`);
          }
          break;
        
        case 'date':
          // Date validation
          if (value && isNaN(Date.parse(value))) {
            result.isValid = false;
            result.errors.push(`Invalid date format: ${value}`);
          }
          break;
        
        case 'email':
          // Email validation
          const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (value && !emailPattern.test(value)) {
            result.isValid = false;
            result.errors.push(`Invalid email format: ${value}`);
          }
          break;
        
        case 'code':
          // Code validation
          if (value && typeof value === 'string') {
            const codePattern = /^[^\s]+(\s[^\s]+)*$/;
            if (!codePattern.test(value)) {
              result.isValid = false;
              result.errors.push(`Invalid code format: ${value}`);
            }
          }
          break;
        
        default:
          // Generic validation
          if (value === null || value === undefined) {
            result.warnings.push(`Field ${path} is empty`);
          }
      }
    } catch (error) {
      result.isValid = false;
      result.errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }, []);

  return {
    // Main validation functions
    validateResource: validateSingleResource,
    validateResources: validateMultipleResources,
    validateBundle: validateBundleResource,
    validateReference: validateReferenceResource,
    validateField,
    
    // Cache management
    clearCache,
    cacheSize: validationCache.size,
    
    // State
    isValidating,
    
    // Configuration
    updateOptions,
    
    // Statistics
    getValidationStats
  };
};

/**
 * Hook for validating a single resource with real-time updates
 */
export const useResourceValidation = (resource: any, options: ValidationOptions = {}): ResourceValidationHookResult => {
  const { validateResource, isValidating } = useFHIRValidation(options);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [lastValidatedResource, setLastValidatedResource] = useState<string | null>(null);

  // Validate when resource changes
  const validate = useCallback(async (): Promise<void> => {
    if (!resource) {
      setValidationResult(null);
      return;
    }

    // Only validate if resource actually changed
    const resourceStr = JSON.stringify(resource);
    if (resourceStr === lastValidatedResource) {
      return;
    }

    const result = await validateResource(resource);
    setValidationResult(result);
    setLastValidatedResource(resourceStr);
  }, [resource, validateResource, lastValidatedResource]);

  // Auto-validate on resource change
  useMemo(() => {
    validate();
  }, [validate]);

  const isValid = validationResult?.isValid ?? null;
  const hasWarnings = validationResult?.hasWarnings ?? false;
  const errors = validationResult?.errors ?? [];
  const warnings = validationResult?.warnings ?? [];

  return {
    validationResult,
    isValid,
    hasWarnings,
    errors,
    warnings,
    isValidating,
    revalidate: validate
  };
};

/**
 * Hook for batch validation of multiple resources
 */
export const useBatchValidation = (resources: any[] = [], options: ValidationOptions = {}): BatchValidationHookResult => {
  const { validateResources, isValidating } = useFHIRValidation(options);
  const [validationResults, setValidationResults] = useState<ValidationResult[] | null>(null);

  const validate = useCallback(async (): Promise<void> => {
    if (!resources.length) {
      setValidationResults(null);
      return;
    }

    const results = await validateResources(resources);
    setValidationResults(results);
  }, [resources, validateResources]);

  // Auto-validate when resources change
  useMemo(() => {
    validate();
  }, [validate]);

  const overallValid = validationResults?.every(result => result.isValid) ?? false;
  const hasAnyWarnings = validationResults?.some(result => result.hasWarnings) ?? false;
  const totalErrors = validationResults?.reduce((sum, result) => sum + result.errors.length, 0) ?? 0;
  const totalWarnings = validationResults?.reduce((sum, result) => sum + result.warnings.length, 0) ?? 0;

  return {
    validationResults,
    overallValid,
    hasAnyWarnings,
    totalErrors,
    totalWarnings,
    isValidating,
    revalidate: validate
  };
};

export default useFHIRValidation;