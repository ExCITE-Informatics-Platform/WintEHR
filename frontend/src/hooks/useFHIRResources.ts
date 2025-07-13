/**
 * FHIR Resources Hooks
 * Comprehensive collection of hooks for managing FHIR resources with TypeScript type safety
 * 
 * Migrated to TypeScript with full FHIR R4 type integration and enhanced error handling.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { R4 } from '@ahryman40k/ts-fhir-types';
import { useFHIRResource } from '../contexts/FHIRResourceContext';

/**
 * Type definitions for hook return values
 */
export interface ResourceHookResult<T = R4.IResourceList> {
  resources: T[];
  loading: boolean;
  error: string | null;
  loadResources: (params?: Record<string, any>, forceRefresh?: boolean) => Promise<any>;
  refresh: () => Promise<any>;
  isEmpty: boolean;
}

export interface EncounterHookResult extends ResourceHookResult<R4.IEncounter> {
  encounters: R4.IEncounter[];
  activeEncounters: R4.IEncounter[];
  recentEncounters: R4.IEncounter[];
}

export interface ConditionHookResult extends ResourceHookResult<R4.ICondition> {
  conditions: R4.ICondition[];
  activeConditions: R4.ICondition[];
  resolvedConditions: R4.ICondition[];
  problemList: R4.ICondition[];
}

export interface MedicationHookResult extends ResourceHookResult<R4.IMedicationRequest> {
  medications: R4.IMedicationRequest[];
  activeMedications: R4.IMedicationRequest[];
  completedMedications: R4.IMedicationRequest[];
}

export interface ObservationHookResult extends ResourceHookResult<R4.IObservation> {
  observations: R4.IObservation[];
  vitalSigns: R4.IObservation[];
  labResults: R4.IObservation[];
  recentObservations: R4.IObservation[];
}

export interface PatientSummary {
  patientId: string;
  demographics: {
    age: number | null;
    gender: string;
    name: string;
  };
  encounters: {
    total: number;
    active: number;
    recent: number;
  };
  conditions: {
    total: number;
    active: number;
    problems: number;
  };
  medications: {
    total: number;
    active: number;
    completed: number;
  };
  observations: {
    total: number;
    vitals: number;
    labs: number;
  };
  allergies: {
    total: number;
    active: number;
  };
  procedures: {
    total: number;
    recent: number;
  };
  documents: {
    total: number;
    recent: number;
  };
  careTeams: {
    total: number;
    active: number;
  };
  imaging: {
    total: number;
    recent: number;
  };
  coverage: {
    total: number;
    active: number;
  };
  diagnosticReports: {
    total: number;
    final: number;
    recent: number;
  };
  immunizations: {
    total: number;
    completed: number;
    recent: number;
  };
}

export interface PatientSummaryHookResult {
  summary: PatientSummary | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Hook for managing a specific resource type with loading and error states
 */
export function useResourceType<T = R4.IResourceList>(
  resourceType: string, 
  autoLoad: boolean = false, 
  searchParams: Record<string, any> = {}
): ResourceHookResult<T> {
  const {
    getResourcesByType,
    searchResources,
    isLoading,
    getError,
    currentPatient
  } = useFHIRResource();

  const [localLoading, setLocalLoading] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const resources = getResourcesByType(resourceType) as T[];
  const loading = isLoading(resourceType) || localLoading;
  const error = getError(resourceType) || localError;

  const loadResources = useCallback(async (params: Record<string, any> = {}, forceRefresh: boolean = false) => {
    setLocalLoading(true);
    setLocalError(null);

    try {
      const finalParams = { ...searchParams, ...params };
      if (currentPatient && !finalParams.patient && !finalParams.subject) {
        finalParams.patient = currentPatient.id;
      }
      
      const result = await searchResources(resourceType, finalParams, forceRefresh);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setLocalError(errorMessage);
      throw err;
    } finally {
      setLocalLoading(false);
    }
  }, [resourceType, searchResources, searchParams, currentPatient]);

  const refresh = useCallback(() => {
    return loadResources({}, true);
  }, [loadResources]);

  // Auto-load on mount if requested
  useEffect(() => {
    if (autoLoad && resources.length === 0 && !loading && !error) {
      loadResources();
    }
  }, [autoLoad, resources.length, loading, error, loadResources]);

  return {
    resources,
    loading,
    error,
    loadResources,
    refresh,
    isEmpty: resources.length === 0 && !loading
  };
}

/**
 * Hook for managing patient-specific resources
 */
export function usePatientResourceType<T = R4.IResourceList>(
  patientId: string | null, 
  resourceType: string, 
  autoLoad: boolean = true
): ResourceHookResult<T> {
  const {
    getPatientResources,
    searchResources,
    isLoading,
    getError
  } = useFHIRResource();

  const [localLoading, setLocalLoading] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const resources = useMemo(() => {
    return patientId ? getPatientResources(patientId, resourceType) as T[] : [];
  }, [patientId, getPatientResources, resourceType]);

  const loading = isLoading(resourceType) || localLoading;
  const error = getError(resourceType) || localError;

  const loadResources = useCallback(async (params: Record<string, any> = {}, forceRefresh: boolean = false) => {
    if (!patientId) return { resources: [] };

    setLocalLoading(true);
    setLocalError(null);

    try {
      const searchParams = { patient: patientId, _count: 1000, ...params };
      const result = await searchResources(resourceType, searchParams, forceRefresh);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setLocalError(errorMessage);
      throw err;
    } finally {
      setLocalLoading(false);
    }
  }, [patientId, resourceType, searchResources]);

  const refresh = useCallback(() => {
    return loadResources({}, true);
  }, [loadResources]);

  // Auto-load on mount and when patientId changes
  useEffect(() => {
    if (autoLoad && patientId && resources.length === 0 && !loading && !error) {
      loadResources();
    }
  }, [autoLoad, patientId, resources.length, loading, error, loadResources]);

  return {
    resources,
    loading,
    error,
    loadResources,
    refresh,
    isEmpty: resources.length === 0 && !loading && !!patientId
  };
}

/**
 * Hook for managing encounters with additional encounter-specific logic
 */
export function useEncounters(patientId: string | null, autoLoad: boolean = true): EncounterHookResult {
  const baseHook = usePatientResourceType<R4.IEncounter>(patientId, 'Encounter', autoLoad);
  
  const encounters = useMemo(() => {
    return baseHook.resources.sort((a, b) => {
      const dateA = new Date(a.period?.start || a.period?.end || '1970-01-01');
      const dateB = new Date(b.period?.start || b.period?.end || '1970-01-01');
      return dateB.getTime() - dateA.getTime(); // Most recent first
    });
  }, [baseHook.resources]);

  const activeEncounters = useMemo(() => {
    return encounters.filter(enc => enc.status === 'in-progress' || enc.status === 'arrived');
  }, [encounters]);

  const recentEncounters = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return encounters.filter(enc => {
      const encDate = new Date(enc.period?.start || enc.period?.end || '1970-01-01');
      return encDate >= thirtyDaysAgo;
    });
  }, [encounters]);

  return {
    ...baseHook,
    encounters,
    activeEncounters,
    recentEncounters
  };
}

/**
 * Hook for managing conditions with additional condition-specific logic
 */
export function useConditions(patientId: string | null, autoLoad: boolean = true): ConditionHookResult {
  const baseHook = usePatientResourceType<R4.ICondition>(patientId, 'Condition', autoLoad);
  
  const conditions = useMemo(() => {
    return baseHook.resources.sort((a, b) => {
      const dateA = new Date(a.recordedDate || a.onsetDateTime || '1970-01-01');
      const dateB = new Date(b.recordedDate || b.onsetDateTime || '1970-01-01');
      return dateB.getTime() - dateA.getTime(); // Most recent first
    });
  }, [baseHook.resources]);

  const activeConditions = useMemo(() => {
    return conditions.filter(condition => 
      condition.clinicalStatus?.coding?.[0]?.code === 'active'
    );
  }, [conditions]);

  const resolvedConditions = useMemo(() => {
    return conditions.filter(condition => 
      condition.clinicalStatus?.coding?.[0]?.code === 'resolved'
    );
  }, [conditions]);

  const problemList = useMemo(() => {
    return conditions.filter(condition => 
      condition.category?.some(cat => 
        cat.coding?.some(coding => coding.code === 'problem-list-item')
      )
    );
  }, [conditions]);

  return {
    ...baseHook,
    conditions,
    activeConditions,
    resolvedConditions,
    problemList
  };
}

/**
 * Hook for managing medications with additional medication-specific logic
 */
export function useMedications(patientId: string | null, autoLoad: boolean = true): MedicationHookResult {
  const baseHook = usePatientResourceType<R4.IMedicationRequest>(patientId, 'MedicationRequest', autoLoad);
  
  const medications = useMemo(() => {
    return baseHook.resources.sort((a, b) => {
      const dateA = new Date(a.authoredOn || '1970-01-01');
      const dateB = new Date(b.authoredOn || '1970-01-01');
      return dateB.getTime() - dateA.getTime(); // Most recent first
    });
  }, [baseHook.resources]);

  const activeMedications = useMemo(() => {
    return medications.filter(med => 
      med.status === 'active' || med.status === 'on-hold'
    );
  }, [medications]);

  const completedMedications = useMemo(() => {
    return medications.filter(med => 
      med.status === 'completed' || med.status === 'stopped'
    );
  }, [medications]);

  return {
    ...baseHook,
    medications,
    activeMedications,
    completedMedications
  };
}

/**
 * Hook for managing observations with additional observation-specific logic
 */
export function useObservations(
  patientId: string | null, 
  category: string | null = null, 
  autoLoad: boolean = true
): ObservationHookResult {
  const searchParams = category ? { category } : {};
  const baseHook = usePatientResourceType<R4.IObservation>(patientId, 'Observation', autoLoad);
  
  const observations = useMemo(() => {
    let filteredObs = baseHook.resources;
    
    if (category) {
      filteredObs = filteredObs.filter(obs =>
        obs.category?.some(cat =>
          cat.coding?.some(coding => coding.code === category)
        )
      );
    }
    
    return filteredObs.sort((a, b) => {
      const dateA = new Date(a.effectiveDateTime || a.effectivePeriod?.start || '1970-01-01');
      const dateB = new Date(b.effectiveDateTime || b.effectivePeriod?.start || '1970-01-01');
      return dateB.getTime() - dateA.getTime(); // Most recent first
    });
  }, [baseHook.resources, category]);

  const vitalSigns = useMemo(() => {
    return observations.filter(obs =>
      obs.category?.some(cat =>
        cat.coding?.some(coding => coding.code === 'vital-signs')
      )
    );
  }, [observations]);

  const labResults = useMemo(() => {
    return observations.filter(obs =>
      obs.category?.some(cat =>
        cat.coding?.some(coding => coding.code === 'laboratory')
      )
    );
  }, [observations]);

  const recentObservations = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    return observations.filter(obs => {
      const obsDate = new Date(obs.effectiveDateTime || obs.effectivePeriod?.start || '1970-01-01');
      return obsDate >= sevenDaysAgo;
    });
  }, [observations]);

  return {
    ...baseHook,
    observations,
    vitalSigns,
    labResults,
    recentObservations
  };
}

/**
 * Hook for managing document references
 */
export function useDocumentReferences(patientId: string | null, autoLoad: boolean = true): ResourceHookResult<R4.IDocumentReference> {
  const baseHook = usePatientResourceType<R4.IDocumentReference>(patientId, 'DocumentReference', autoLoad);
  
  const documents = useMemo(() => {
    return baseHook.resources.sort((a, b) => {
      const dateA = new Date(a.date || '1970-01-01');
      const dateB = new Date(b.date || '1970-01-01');
      return dateB.getTime() - dateA.getTime(); // Most recent first
    });
  }, [baseHook.resources]);

  return {
    ...baseHook,
    resources: documents
  };
}

/**
 * Hook for managing care teams
 */
export function useCareTeams(patientId: string | null, autoLoad: boolean = true): ResourceHookResult<R4.ICareTeam> {
  const baseHook = usePatientResourceType<R4.ICareTeam>(patientId, 'CareTeam', autoLoad);
  
  const careTeams = useMemo(() => {
    return baseHook.resources.filter(team => team.status === 'active');
  }, [baseHook.resources]);

  return {
    ...baseHook,
    resources: careTeams
  };
}

/**
 * Hook for managing imaging studies
 */
export function useImagingStudies(patientId: string | null, autoLoad: boolean = true): ResourceHookResult<R4.IImagingStudy> {
  const baseHook = usePatientResourceType<R4.IImagingStudy>(patientId, 'ImagingStudy', autoLoad);
  
  const studies = useMemo(() => {
    return baseHook.resources.sort((a, b) => {
      const dateA = new Date(a.started || '1970-01-01');
      const dateB = new Date(b.started || '1970-01-01');
      return dateB.getTime() - dateA.getTime(); // Most recent first
    });
  }, [baseHook.resources]);

  return {
    ...baseHook,
    resources: studies
  };
}

/**
 * Hook for managing coverage
 */
export function useCoverage(patientId: string | null, autoLoad: boolean = true): ResourceHookResult<R4.ICoverage> {
  const baseHook = usePatientResourceType<R4.ICoverage>(patientId, 'Coverage', autoLoad);
  
  const coverage = useMemo(() => {
    return baseHook.resources.filter(cov => cov.status === 'active');
  }, [baseHook.resources]);

  return {
    ...baseHook,
    resources: coverage
  };
}

/**
 * Hook for managing procedures
 */
export function useProcedures(patientId: string | null, autoLoad: boolean = true): ResourceHookResult<R4.IProcedure> {
  const baseHook = usePatientResourceType<R4.IProcedure>(patientId, 'Procedure', autoLoad);
  
  const procedures = useMemo(() => {
    return baseHook.resources.sort((a, b) => {
      const dateA = new Date(a.performedDateTime || a.performedPeriod?.start || '1970-01-01');
      const dateB = new Date(b.performedDateTime || b.performedPeriod?.start || '1970-01-01');
      return dateB.getTime() - dateA.getTime(); // Most recent first
    });
  }, [baseHook.resources]);

  return {
    ...baseHook,
    resources: procedures
  };
}

/**
 * Hook for managing diagnostic reports
 */
export function useDiagnosticReports(patientId: string | null, autoLoad: boolean = true): ResourceHookResult<R4.IDiagnosticReport> {
  const baseHook = usePatientResourceType<R4.IDiagnosticReport>(patientId, 'DiagnosticReport', autoLoad);
  
  const reports = useMemo(() => {
    return baseHook.resources.sort((a, b) => {
      const dateA = new Date(a.effectiveDateTime || a.effectivePeriod?.start || '1970-01-01');
      const dateB = new Date(b.effectiveDateTime || b.effectivePeriod?.start || '1970-01-01');
      return dateB.getTime() - dateA.getTime(); // Most recent first
    });
  }, [baseHook.resources]);

  return {
    ...baseHook,
    resources: reports
  };
}

/**
 * Hook for managing immunizations
 */
export function useImmunizations(patientId: string | null, autoLoad: boolean = true): ResourceHookResult<R4.IImmunization> {
  const baseHook = usePatientResourceType<R4.IImmunization>(patientId, 'Immunization', autoLoad);
  
  const immunizations = useMemo(() => {
    return baseHook.resources.sort((a, b) => {
      const dateA = new Date(a.occurrenceDateTime || '1970-01-01');
      const dateB = new Date(b.occurrenceDateTime || '1970-01-01');
      return dateB.getTime() - dateA.getTime(); // Most recent first
    });
  }, [baseHook.resources]);

  return {
    ...baseHook,
    resources: immunizations
  };
}

/**
 * Hook for getting comprehensive patient summary
 */
export function usePatientSummary(patientId: string | null): PatientSummaryHookResult {
  const { currentPatient } = useFHIRResource();
  
  const encounters = useEncounters(patientId);
  const conditions = useConditions(patientId);
  const medications = useMedications(patientId);
  const observations = useObservations(patientId);
  const allergies = usePatientResourceType<R4.IAllergyIntolerance>(patientId, 'AllergyIntolerance');
  const procedures = useProcedures(patientId);
  const documents = useDocumentReferences(patientId);
  const careTeams = useCareTeams(patientId);
  const imaging = useImagingStudies(patientId);
  const coverage = useCoverage(patientId);
  const diagnosticReports = useDiagnosticReports(patientId);
  const immunizations = useImmunizations(patientId);

  const loading = [
    encounters, conditions, medications, observations, allergies, procedures,
    documents, careTeams, imaging, coverage, diagnosticReports, immunizations
  ].some(hook => hook.loading);

  const summary: PatientSummary | null = useMemo(() => {
    if (!patientId || loading || !currentPatient) return null;

    const patient = currentPatient as R4.IPatient;
    const patientName = patient.name?.[0];
    const displayName = patientName 
      ? `${patientName.given?.join(' ') || ''} ${patientName.family || ''}`.trim()
      : 'Unknown Patient';

    return {
      patientId,
      demographics: {
        age: calculateAge(patient.birthDate),
        gender: patient.gender || 'unknown',
        name: displayName
      },
      encounters: {
        total: encounters.encounters.length,
        active: encounters.activeEncounters.length,
        recent: encounters.recentEncounters.length
      },
      conditions: {
        total: conditions.conditions.length,
        active: conditions.activeConditions.length,
        problems: conditions.problemList.length
      },
      medications: {
        total: medications.medications.length,
        active: medications.activeMedications.length,
        completed: medications.completedMedications.length
      },
      observations: {
        total: observations.observations.length,
        vitals: observations.vitalSigns.length,
        labs: observations.labResults.length
      },
      allergies: {
        total: allergies.resources.length,
        active: allergies.resources.filter(allergy => allergy.clinicalStatus?.coding?.[0]?.code === 'active').length
      },
      procedures: {
        total: procedures.resources.length,
        recent: procedures.resources.filter(proc => {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const procDate = new Date(proc.performedDateTime || proc.performedPeriod?.start || '1970-01-01');
          return procDate >= thirtyDaysAgo;
        }).length
      },
      documents: {
        total: documents.resources.length,
        recent: documents.resources.filter(doc => {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const docDate = new Date(doc.date || '1970-01-01');
          return docDate >= thirtyDaysAgo;
        }).length
      },
      careTeams: {
        total: careTeams.resources.length,
        active: careTeams.resources.filter(team => team.status === 'active').length
      },
      imaging: {
        total: imaging.resources.length,
        recent: imaging.resources.filter(study => {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const studyDate = new Date(study.started || '1970-01-01');
          return studyDate >= thirtyDaysAgo;
        }).length
      },
      coverage: {
        total: coverage.resources.length,
        active: coverage.resources.filter(cov => cov.status === 'active').length
      },
      diagnosticReports: {
        total: diagnosticReports.resources.length,
        final: diagnosticReports.resources.filter(report => report.status === 'final').length,
        recent: diagnosticReports.resources.filter(report => {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const reportDate = new Date(report.effectiveDateTime || report.effectivePeriod?.start || '1970-01-01');
          return reportDate >= thirtyDaysAgo;
        }).length
      },
      immunizations: {
        total: immunizations.resources.length,
        completed: immunizations.resources.filter(imm => imm.status === 'completed').length,
        recent: immunizations.resources.filter(imm => {
          const oneYearAgo = new Date();
          oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
          const immDate = new Date(imm.occurrenceDateTime || '1970-01-01');
          return immDate >= oneYearAgo;
        }).length
      }
    };
  }, [patientId, loading, currentPatient, encounters, conditions, medications, observations, allergies, procedures]);

  return {
    summary,
    loading,
    refresh: async () => {
      await Promise.all([
        encounters.refresh(),
        conditions.refresh(),
        medications.refresh(),
        observations.refresh(),
        allergies.refresh(),
        procedures.refresh(),
        documents.refresh(),
        careTeams.refresh(),
        imaging.refresh(),
        coverage.refresh(),
        diagnosticReports.refresh(),
        immunizations.refresh()
      ]);
    }
  };
}

// Utility function
function calculateAge(birthDate: string | undefined): number | null {
  if (!birthDate) return null;
  
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
}