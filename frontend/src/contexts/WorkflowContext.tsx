/**
 * WorkflowContext - Comprehensive clinical workflow state management with TypeScript
 * Manages workflow modes, active resources, and clinical context with full type safety
 * 
 * Migrated to TypeScript with strongly typed workflow modes, clinical context state,
 * and comprehensive resource management interfaces.
 */
import * as React from 'react';
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useFHIRResource } from './FHIRResourceContext';
import { fhirClient } from '../services/fhirClient';
import {
  Encounter,
  Condition,
  MedicationRequest,
  CarePlan,
  Resource,
  FHIRResourceType,
  FHIRSearchParams
} from '../types/fhir';

/**
 * Time range filter options
 */
export type TimeRangeFilter = 'all' | '1y' | '6m' | '3m' | '1m';

/**
 * Workflow layout types
 */
export type WorkflowLayoutType = 
  | 'sidebar' 
  | 'split-vertical' 
  | 'three-column' 
  | 'split-horizontal' 
  | 'single';

/**
 * Panel configuration for workflow layouts
 */
export interface WorkflowPanels {
  sidebar?: string;
  main?: string;
  left?: string;
  right?: string;
  center?: string;
  top?: string;
  bottom?: string;
}

/**
 * Workflow mode definition
 */
export interface WorkflowMode {
  id: string;
  name: string;
  description: string;
  requiredResources: FHIRResourceType[];
  layout: WorkflowLayoutType;
  panels: WorkflowPanels;
}

/**
 * Resource filters for clinical context
 */
export interface ResourceFilters {
  status: string;
  category: string | null;
  priority: string | null;
}

/**
 * Clinical context state
 */
export interface ClinicalContext {
  activeEncounter: Encounter | null;
  selectedConditions: Condition[];
  selectedMedications: MedicationRequest[];
  activeCarePlan: CarePlan | null;
  focusedTimeRange: TimeRangeFilter;
  resourceFilters: ResourceFilters;
}

/**
 * Active resources storage
 */
export interface ActiveResources {
  [key: string]: Resource[] | undefined;
}

/**
 * Resource loading errors
 */
export interface ResourceErrors {
  [resourceType: string]: string;
}

/**
 * Quick workflow actions
 */
export interface QuickActions {
  reviewRecentResults: () => void;
  startDocumentation: (encounterId?: string) => void;
  reviewMedications: () => void;
  createOrders: () => void;
}

/**
 * Workflow context interface
 */
export interface WorkflowContextType {
  // Current state
  currentMode: WorkflowMode;
  clinicalContext: ClinicalContext;
  activeResources: ActiveResources;
  isLoadingResources: boolean;
  resourceErrors: ResourceErrors;
  workflowHistory: WorkflowMode[];

  // Actions
  changeWorkflowMode: (modeId: string) => void;
  updateClinicalContext: (updates: Partial<ClinicalContext>) => void;
  setActiveEncounter: (encounter: Encounter | null) => void;
  setTimeRangeFilter: (range: TimeRangeFilter) => void;
  setResourceFilter: (filterType: keyof ResourceFilters, value: string | null) => void;
  getFilteredResources: (resourceType: FHIRResourceType) => Resource[];
  quickActions: QuickActions;

  // Constants
  WORKFLOW_MODES: typeof WORKFLOW_MODES;
}

/**
 * Workflow mode definitions with const assertion for type safety
 */
export const WORKFLOW_MODES = {
  CHART_REVIEW: {
    id: 'chart-review',
    name: 'Chart Review',
    description: 'Review patient history, problems, medications, and recent encounters',
    requiredResources: ['Patient', 'Condition', 'MedicationRequest', 'Encounter', 'AllergyIntolerance'] as FHIRResourceType[],
    layout: 'sidebar' as WorkflowLayoutType,
    panels: {
      sidebar: 'problem-list',
      main: 'clinical-timeline'
    }
  },
  ENCOUNTER_DOCUMENTATION: {
    id: 'encounter-documentation',
    name: 'Documentation',
    description: 'Document patient encounter with clinical notes',
    requiredResources: ['Patient', 'Encounter', 'Condition', 'Observation'] as FHIRResourceType[],
    layout: 'split-vertical' as WorkflowLayoutType,
    panels: {
      left: 'note-editor',
      right: 'relevant-data'
    }
  },
  ORDERS_MANAGEMENT: {
    id: 'orders-management',
    name: 'Orders & Prescriptions',
    description: 'Create and manage clinical orders and prescriptions',
    requiredResources: ['Patient', 'MedicationRequest', 'ServiceRequest', 'DiagnosticReport'] as FHIRResourceType[],
    layout: 'three-column' as WorkflowLayoutType,
    panels: {
      left: 'order-catalog',
      center: 'active-orders',
      right: 'decision-support'
    }
  },
  RESULTS_REVIEW: {
    id: 'results-review',
    name: 'Results Review',
    description: 'Review lab results, imaging, and diagnostic reports',
    requiredResources: ['Patient', 'Observation', 'DiagnosticReport', 'ImagingStudy'] as FHIRResourceType[],
    layout: 'split-horizontal' as WorkflowLayoutType,
    panels: {
      top: 'results-summary',
      bottom: 'detailed-results'
    }
  },
  CARE_PLANNING: {
    id: 'care-planning',
    name: 'Care Planning',
    description: 'Manage care plans, goals, and care team coordination',
    requiredResources: ['Patient', 'CarePlan', 'Goal', 'CareTeam', 'Task'] as FHIRResourceType[],
    layout: 'split-vertical' as WorkflowLayoutType,
    panels: {
      left: 'care-plans',
      right: 'care-team'
    }
  },
  POPULATION_HEALTH: {
    id: 'population-health',
    name: 'Population Health',
    description: 'Analyze patient populations and quality measures',
    requiredResources: ['Patient', 'Measure', 'MeasureReport', 'Group'] as FHIRResourceType[],
    layout: 'single' as WorkflowLayoutType,
    panels: {
      main: 'population-analytics'
    }
  }
} as const;

/**
 * Workflow mode ID type derived from const object
 */
export type WorkflowModeId = keyof typeof WORKFLOW_MODES;

/**
 * Create initial clinical context with proper typing
 */
const createInitialClinicalContext = (): ClinicalContext => ({
  activeEncounter: null,
  selectedConditions: [],
  selectedMedications: [],
  activeCarePlan: null,
  focusedTimeRange: 'all',
  resourceFilters: {
    status: 'active',
    category: null,
    priority: null
  }
});

/**
 * Create workflow context with proper typing
 */
const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined);

/**
 * Custom hook to use workflow context with type safety
 */
export const useWorkflow = (): WorkflowContextType => {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error('useWorkflow must be used within WorkflowProvider');
  }
  return context;
};

/**
 * Workflow provider props interface
 */
export interface WorkflowProviderProps {
  children: ReactNode;
}

/**
 * Workflow provider component with comprehensive type safety
 */
export const WorkflowProvider: React.FC<WorkflowProviderProps> = ({ children }) => {
  const [currentMode, setCurrentMode] = useState<WorkflowMode>(WORKFLOW_MODES.CHART_REVIEW);
  const [clinicalContext, setClinicalContext] = useState<ClinicalContext>(createInitialClinicalContext());
  const [workflowHistory, setWorkflowHistory] = useState<WorkflowMode[]>([]);
  const [activeResources, setActiveResources] = useState<ActiveResources>({});
  const [isLoadingResources, setIsLoadingResources] = useState<boolean>(false);
  const [resourceErrors, setResourceErrors] = useState<ResourceErrors>({});

  // Get patient ID from FHIR context
  const { currentPatient } = useFHIRResource();

  // Load required resources when workflow mode changes
  useEffect(() => {
    const loadWorkflowResources = async (): Promise<void> => {
      if (!currentPatient?.id || !currentMode) return;

      setIsLoadingResources(true);
      setResourceErrors({});
      const newActiveResources: ActiveResources = {};

      for (const resourceType of currentMode.requiredResources) {
        try {
          let searchParams: FHIRSearchParams = { patient: currentPatient.id };

          // Add specific search parameters based on resource type
          switch (resourceType) {
            case 'Condition':
              searchParams['clinical-status'] = clinicalContext.resourceFilters.status || 'active';
              break;
            case 'MedicationRequest':
              searchParams.status = clinicalContext.resourceFilters.status || 'active';
              break;
            case 'Encounter':
              searchParams._sort = '-date';
              searchParams._count = 20;
              break;
            case 'Observation':
              if (clinicalContext.resourceFilters.category) {
                searchParams.category = clinicalContext.resourceFilters.category;
              }
              searchParams._sort = '-date';
              searchParams._count = 100;
              break;
            case 'DiagnosticReport':
              searchParams.status = 'final';
              searchParams._sort = '-date';
              break;
            case 'ServiceRequest':
              searchParams.status = 'active';
              searchParams._sort = '-authored';
              break;
            case 'CarePlan':
              searchParams.status = 'active';
              break;
            case 'AllergyIntolerance':
              searchParams['clinical-status'] = 'active';
              break;
            default:
              // Standard parameters for other resource types
              searchParams._count = 50;
              break;
          }

          // Apply time range filter if specified
          if (clinicalContext.focusedTimeRange !== 'all') {
            const dateFilter = getDateRangeForFilter(clinicalContext.focusedTimeRange);
            if (dateFilter) {
              switch (resourceType) {
                case 'Encounter':
                  searchParams.date = `ge${dateFilter}`;
                  break;
                case 'Observation':
                  searchParams.date = `ge${dateFilter}`;
                  break;
                case 'DiagnosticReport':
                  searchParams.date = `ge${dateFilter}`;
                  break;
                case 'MedicationRequest':
                  searchParams.authoredon = `ge${dateFilter}`;
                  break;
                default:
                  // Apply general date filter
                  searchParams._lastUpdated = `ge${dateFilter}`;
                  break;
              }
            }
          }

          const searchResult = await fhirClient.search(resourceType, searchParams);
          newActiveResources[resourceType] = searchResult.resources;

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error loading resource';
          setResourceErrors(prev => ({
            ...prev,
            [resourceType]: errorMessage
          }));
        }
      }

      setActiveResources(newActiveResources);
      setIsLoadingResources(false);
    };

    loadWorkflowResources();
  }, [currentMode, currentPatient?.id, clinicalContext.resourceFilters, clinicalContext.focusedTimeRange]);

  // Change workflow mode with history tracking
  const changeWorkflowMode = useCallback((modeId: string): void => {
    const mode = Object.values(WORKFLOW_MODES).find(m => m.id === modeId);
    if (mode) {
      setWorkflowHistory(prev => [...prev, currentMode]);
      setCurrentMode(mode);
    }
  }, [currentMode]);

  // Update clinical context
  const updateClinicalContext = useCallback((updates: Partial<ClinicalContext>): void => {
    setClinicalContext(prev => ({ ...prev, ...updates }));
  }, []);

  // Set active encounter
  const setActiveEncounter = useCallback((encounter: Encounter | null): void => {
    updateClinicalContext({ activeEncounter: encounter });
  }, [updateClinicalContext]);

  // Set time range filter
  const setTimeRangeFilter = useCallback((range: TimeRangeFilter): void => {
    updateClinicalContext({ focusedTimeRange: range });
  }, [updateClinicalContext]);

  // Set resource filters with proper typing
  const setResourceFilter = useCallback((filterType: keyof ResourceFilters, value: string | null): void => {
    updateClinicalContext({
      resourceFilters: {
        ...clinicalContext.resourceFilters,
        [filterType]: value
      }
    });
  }, [clinicalContext.resourceFilters, updateClinicalContext]);

  // Get filtered resources based on current context
  const getFilteredResources = useCallback((resourceType: FHIRResourceType): Resource[] => {
    const resources = activeResources[resourceType] || [];
    
    // Apply additional filtering based on clinical context
    if (clinicalContext.activeEncounter && resourceType !== 'Patient') {
      // Filter resources related to active encounter if applicable
      return resources.filter(resource => {
        const resourceWithEncounter = resource as any;
        if (resourceWithEncounter.encounter?.reference) {
          return resourceWithEncounter.encounter.reference.includes(clinicalContext.activeEncounter!.id!);
        }
        return true;
      });
    }

    return resources;
  }, [activeResources, clinicalContext.activeEncounter]);

  // Quick workflow actions with proper typing
  const quickActions: QuickActions = {
    reviewRecentResults: (): void => {
      changeWorkflowMode('results-review');
      setTimeRangeFilter('1m');
    },
    startDocumentation: (encounterId?: string): void => {
      changeWorkflowMode('encounter-documentation');
      if (encounterId) {
        const encounters = activeResources['Encounter'] as Encounter[] | undefined;
        const encounter = encounters?.find(e => e.id === encounterId);
        if (encounter) setActiveEncounter(encounter);
      }
    },
    reviewMedications: (): void => {
      changeWorkflowMode('chart-review');
      const medications = activeResources['MedicationRequest'] as MedicationRequest[] | undefined;
      updateClinicalContext({ selectedMedications: medications || [] });
    },
    createOrders: (): void => {
      changeWorkflowMode('orders-management');
    }
  };

  const value: WorkflowContextType = {
    // Current state
    currentMode,
    clinicalContext,
    activeResources,
    isLoadingResources,
    resourceErrors,
    workflowHistory,

    // Actions
    changeWorkflowMode,
    updateClinicalContext,
    setActiveEncounter,
    setTimeRangeFilter,
    setResourceFilter,
    getFilteredResources,
    quickActions,

    // Constants
    WORKFLOW_MODES
  };

  return (
    <WorkflowContext.Provider value={value}>
      {children}
    </WorkflowContext.Provider>
  );
};

/**
 * Helper function to get date range for time filters
 */
const getDateRangeForFilter = (filter: TimeRangeFilter): string | null => {
  const now = new Date();
  switch (filter) {
    case '1y':
      return new Date(now.setFullYear(now.getFullYear() - 1)).toISOString().split('T')[0];
    case '6m':
      return new Date(now.setMonth(now.getMonth() - 6)).toISOString().split('T')[0];
    case '3m':
      return new Date(now.setMonth(now.getMonth() - 3)).toISOString().split('T')[0];
    case '1m':
      return new Date(now.setMonth(now.getMonth() - 1)).toISOString().split('T')[0];
    default:
      return null;
  }
};

export default WorkflowProvider;