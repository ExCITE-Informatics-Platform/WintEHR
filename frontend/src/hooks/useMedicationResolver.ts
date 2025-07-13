/**
 * useMedicationResolver Hook
 * Resolves Medication references from MedicationRequest resources
 * 
 * Migrated to TypeScript with comprehensive type safety using FHIR R4 types.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { R4 } from '@ahryman40k/ts-fhir-types';
import { fhirClient } from '../services/fhirClient';

/**
 * Type definitions for medication resolution
 */
export interface ResolvedMedication {
  name: string;
  code?: R4.ICodeableConcept;
  form?: R4.ICodeableConcept;
  ingredient?: R4.IMedication_Ingredient[];
  medication?: R4.IMedication;
}

export interface MedicationResolverResult {
  resolvedMedications: Record<string, ResolvedMedication>;
  getMedicationDisplay: (medicationRequest: R4.IMedicationRequest) => string;
  loading: boolean;
  error: string | null;
}

// Cache for resolved medications to avoid repeated fetches
const medicationCache = new Map<string, R4.IMedication | null>();

/**
 * Hook for resolving medication references from medication requests
 */
export const useMedicationResolver = (
  medicationRequests: R4.IMedicationRequest[] = []
): MedicationResolverResult => {
  const [resolvedMedications, setResolvedMedications] = useState<Record<string, ResolvedMedication>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Memoize the medication requests array based on IDs to prevent unnecessary re-renders
  const medicationRequestIds = useMemo(() => 
    medicationRequests.map(req => req.id).join(','), 
    [medicationRequests]
  );

  useEffect(() => {
    const resolveMedications = async (): Promise<void> => {
      if (!medicationRequests || medicationRequests.length === 0) {
        setResolvedMedications({});
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const resolved: Record<string, ResolvedMedication> = {};

        // Extract unique medication references
        const medicationRefs = new Set<string>();
        medicationRequests.forEach(req => {
          // Handle different medication structures from Synthea
          if (req.medication?.reference?.reference) {
            // Handle nested reference structure from Synthea
            const ref = req.medication.reference.reference;
            if (ref.startsWith('urn:uuid:')) {
              const id = ref.substring(9);
              medicationRefs.add(id);
            }
          } else if (req.medicationReference?.reference) {
            // Handle standard FHIR structure
            const ref = req.medicationReference.reference;
            if (ref.startsWith('Medication/')) {
              const id = ref.substring(11);
              medicationRefs.add(id);
            }
          }
        });

        // Fetch medications not in cache
        const toFetch = Array.from(medicationRefs).filter(id => !medicationCache.has(id));
        
        if (toFetch.length > 0) {
          // Sequential fetch to ensure cache operations complete properly
          for (const id of toFetch) {
            try {
              const response = await fhirClient.read('Medication', id);
              
              // Handle both response.data and direct response formats
              const medicationData = (response as any).data || response;
              
              if (medicationData && medicationData.resourceType === 'Medication') {
                medicationCache.set(id, medicationData as R4.IMedication);
              } else {
                medicationCache.set(id, null);
              }
            } catch (err) {
              console.warn(`Failed to fetch medication ${id}:`, err);
              medicationCache.set(id, null);
            }
          }
        }

        // Build resolved medications map AFTER all fetches complete
        medicationRequests.forEach(req => {
          if (!req.id) return;
          
          let medicationId: string | null = null;
          
          // Handle reference-based medications
          if (req.medication?.reference?.reference) {
            const ref = req.medication.reference.reference;
            if (ref.startsWith('urn:uuid:')) {
              medicationId = ref.substring(9);
            }
          } else if (req.medicationReference?.reference) {
            const ref = req.medicationReference.reference;
            if (ref.startsWith('Medication/')) {
              medicationId = ref.substring(11);
            }
          }

          // Handle concept-based medications (inline)
          if (req.medication?.concept) {
            const concept = req.medication.concept;
            const medName = concept.text || concept.coding?.[0]?.display || 'Unknown medication';
            resolved[req.id] = {
              name: medName,
              code: concept
            };
            return; // Skip further processing for this request
          }

          if (medicationId) {
            if (medicationCache.has(medicationId)) {
              const medication = medicationCache.get(medicationId);
              
              if (medication) {
                const medName = medication.code?.text || medication.code?.coding?.[0]?.display || 'Unknown medication';
                resolved[req.id] = {
                  name: medName,
                  code: medication.code,
                  form: medication.form,
                  ingredient: medication.ingredient,
                  medication: medication
                };
              }
            }
          } else if (req.medicationCodeableConcept) {
            // Fallback to medicationCodeableConcept if available
            const medName = req.medicationCodeableConcept.text || 
                          req.medicationCodeableConcept.coding?.[0]?.display || 
                          'Unknown medication';
            resolved[req.id] = {
              name: medName,
              code: req.medicationCodeableConcept
            };
          }
        });

        setResolvedMedications(resolved);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to resolve medications';
        console.error('Medication resolution error:', err);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    resolveMedications();
  }, [medicationRequestIds]);

  // Helper function to get medication display name
  const getMedicationDisplay = useCallback((medicationRequest: R4.IMedicationRequest): string => {
    if (!medicationRequest?.id) {
      return 'Unknown medication';
    }
    
    const resolved = resolvedMedications[medicationRequest.id];
    if (resolved) {
      return resolved.name;
    }
    
    // Fallback to medicationCodeableConcept if no resolution
    if (medicationRequest.medicationCodeableConcept) {
      const fallbackName = medicationRequest.medicationCodeableConcept.text || 
                          medicationRequest.medicationCodeableConcept.coding?.[0]?.display || 
                          'Unknown medication';
      return fallbackName;
    }
    
    return 'Unknown medication';
  }, [resolvedMedications]);

  return {
    resolvedMedications,
    getMedicationDisplay,
    loading,
    error
  };
};

/**
 * Hook for resolving a single medication request
 */
export const useSingleMedicationResolver = (
  medicationRequest: R4.IMedicationRequest | null
): {
  resolvedMedication: ResolvedMedication | null;
  medicationDisplay: string;
  loading: boolean;
  error: string | null;
} => {
  const { resolvedMedications, getMedicationDisplay, loading, error } = useMedicationResolver(
    medicationRequest ? [medicationRequest] : []
  );

  const resolvedMedication = useMemo(() => {
    if (!medicationRequest?.id) return null;
    return resolvedMedications[medicationRequest.id] || null;
  }, [resolvedMedications, medicationRequest?.id]);

  const medicationDisplay = useMemo(() => {
    if (!medicationRequest) return 'No medication';
    return getMedicationDisplay(medicationRequest);
  }, [medicationRequest, getMedicationDisplay]);

  return {
    resolvedMedication,
    medicationDisplay,
    loading,
    error
  };
};

/**
 * Hook for batch medication resolution with caching
 */
export const useBatchMedicationResolver = (): {
  resolveMedications: (medicationRequests: R4.IMedicationRequest[]) => Promise<Record<string, ResolvedMedication>>;
  clearCache: () => void;
  getCacheStats: () => { size: number; keys: string[] };
} => {
  const resolveMedications = useCallback(async (
    medicationRequests: R4.IMedicationRequest[]
  ): Promise<Record<string, ResolvedMedication>> => {
    // This would use the same logic as the main hook but return a promise
    // Implementation details would be similar to the main useEffect
    const resolved: Record<string, ResolvedMedication> = {};
    
    // Extract medication references and resolve them
    for (const req of medicationRequests) {
      if (!req.id) continue;
      
      // Handle inline concepts
      if (req.medication?.concept) {
        const concept = req.medication.concept;
        const medName = concept.text || concept.coding?.[0]?.display || 'Unknown medication';
        resolved[req.id] = {
          name: medName,
          code: concept
        };
        continue;
      }
      
      // Handle codeable concepts
      if (req.medicationCodeableConcept) {
        const medName = req.medicationCodeableConcept.text || 
                      req.medicationCodeableConcept.coding?.[0]?.display || 
                      'Unknown medication';
        resolved[req.id] = {
          name: medName,
          code: req.medicationCodeableConcept
        };
      }
    }
    
    return resolved;
  }, []);

  const clearCache = useCallback((): void => {
    medicationCache.clear();
  }, []);

  const getCacheStats = useCallback((): { size: number; keys: string[] } => {
    return {
      size: medicationCache.size,
      keys: Array.from(medicationCache.keys())
    };
  }, []);

  return {
    resolveMedications,
    clearCache,
    getCacheStats
  };
};

export default useMedicationResolver;