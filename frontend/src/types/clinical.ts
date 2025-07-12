/**
 * Clinical workflow and application-specific type definitions
 */

import { 
  Patient, 
  Observation, 
  Condition, 
  MedicationRequest,
  Resource,
  FHIRResourceType 
} from './fhir';

/**
 * Loading states for async operations
 */
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Clinical event types for workflow orchestration
 */
export const CLINICAL_EVENTS = {
  ORDER_PLACED: 'order-placed',
  RESULT_RECEIVED: 'result-received',
  MEDICATION_DISPENSED: 'medication-dispensed',
  PATIENT_SELECTED: 'patient-selected',
  RESOURCE_CREATED: 'resource-created',
  RESOURCE_UPDATED: 'resource-updated',
  RESOURCE_DELETED: 'resource-deleted',
  WORKFLOW_COMPLETED: 'workflow-completed',
  ERROR_OCCURRED: 'error-occurred',
} as const;

export type ClinicalEventType = typeof CLINICAL_EVENTS[keyof typeof CLINICAL_EVENTS];

/**
 * Clinical workflow event payload
 */
export interface ClinicalWorkflowEvent {
  type: ClinicalEventType;
  resourceType?: FHIRResourceType;
  resourceId?: string;
  patientId?: string;
  data?: any;
  timestamp: Date;
  source?: string;
}

/**
 * Resource loading and error states
 */
export interface ResourceState<T = Resource> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  lastUpdated?: Date;
}

export interface ResourceCollection<T = Resource> {
  items: T[];
  total?: number;
  loading: boolean;
  error: Error | null;
  lastUpdated?: Date;
}

/**
 * Patient context for clinical operations
 */
export interface PatientContext {
  patient: Patient | null;
  loading: boolean;
  error: Error | null;
  selectedPatientId?: string;
}

/**
 * Clinical tabs and navigation
 */
export type ClinicalTabType = 
  | 'chart-review'
  | 'results'
  | 'orders'
  | 'pharmacy'
  | 'imaging'
  | 'encounters';

export interface ClinicalTabConfig {
  id: ClinicalTabType;
  label: string;
  icon: string;
  component: React.ComponentType<any>;
  permissions?: string[];
  badgeCount?: number;
}

/**
 * Search and filter interfaces
 */
export interface SearchCriteria {
  query?: string;
  resourceType?: FHIRResourceType;
  patientId?: string;
  dateRange?: {
    start?: string;
    end?: string;
  };
  status?: string[];
  categories?: string[];
  limit?: number;
  offset?: number;
}

export interface FilterCriteria {
  status?: string[];
  category?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  severity?: string[];
  urgent?: boolean;
}

/**
 * Clinical decision support
 */
export interface CDSAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  resourceType?: FHIRResourceType;
  resourceId?: string;
  patientId?: string;
  actions?: CDSAction[];
  dismissed?: boolean;
  timestamp: Date;
}

export interface CDSAction {
  id: string;
  label: string;
  type: 'navigation' | 'creation' | 'update' | 'external';
  data?: any;
}

/**
 * Medication-specific types
 */
export interface MedicationSummary {
  request: MedicationRequest;
  display: string;
  status: string;
  prescriber?: string;
  dosage?: string;
  quantity?: string;
  refills?: number;
  lastFilled?: Date;
}

/**
 * Laboratory and diagnostic types
 */
export interface LabResult {
  observation: Observation;
  name: string;
  value: string | number;
  unit?: string;
  referenceRange?: string;
  status: 'normal' | 'high' | 'low' | 'critical' | 'unknown';
  date: Date;
}

export interface VitalSigns {
  temperature?: Observation;
  bloodPressure?: {
    systolic?: Observation;
    diastolic?: Observation;
  };
  heartRate?: Observation;
  respiratoryRate?: Observation;
  oxygenSaturation?: Observation;
  weight?: Observation;
  height?: Observation;
  bmi?: Observation;
}

/**
 * Problem list and condition management
 */
export interface ProblemSummary {
  condition: Condition;
  display: string;
  status: string;
  severity?: string;
  onset?: string;
  category: string;
  lastUpdated: Date;
}

/**
 * Encounter and visit management
 */
export interface EncounterSummary {
  id: string;
  type: string;
  status: string;
  date: Date;
  provider?: string;
  location?: string;
  diagnosis?: string[];
  procedures?: string[];
}

/**
 * Export and reporting types
 */
export interface ExportOptions {
  format: 'csv' | 'json' | 'pdf' | 'xlsx';
  includeHeaders: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
  resourceTypes?: FHIRResourceType[];
  patientId?: string;
}

export interface ReportConfiguration {
  id: string;
  name: string;
  description?: string;
  resourceTypes: FHIRResourceType[];
  filters: FilterCriteria;
  columns: string[];
  sortBy?: string;
  groupBy?: string;
}

/**
 * WebSocket and real-time types
 */
export interface WebSocketMessage {
  type: string;
  resourceType?: FHIRResourceType;
  resourceId?: string;
  patientId?: string;
  data?: any;
  timestamp: Date;
}

export interface RealTimeUpdate {
  action: 'created' | 'updated' | 'deleted';
  resource: Resource;
  previousResource?: Resource;
  source: string;
  timestamp: Date;
}

/**
 * Error handling types
 */
export interface AppError {
  message: string;
  code?: string;
  severity: 'low' | 'medium' | 'high';
  context?: {
    resourceType?: string;
    resourceId?: string;
    patientId?: string;
    operation?: string;
  };
  timestamp: Date;
  stack?: string;
}

export interface ValidationError extends AppError {
  field?: string;
  value?: any;
  constraint?: string;
}

/**
 * Notification types
 */
export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  duration?: number;
  persistent?: boolean;
  actions?: {
    label: string;
    action: () => void;
  }[];
  timestamp: Date;
}

/**
 * Performance monitoring
 */
export interface PerformanceMetric {
  operation: string;
  duration: number;
  resourceType?: string;
  resourceCount?: number;
  cacheHit?: boolean;
  timestamp: Date;
}

/**
 * Cache management
 */
export interface CacheEntry<T = any> {
  key: string;
  data: T;
  timestamp: Date;
  ttl: number;
  hits: number;
}

export interface CacheMetrics {
  totalEntries: number;
  hitRate: number;
  memoryUsage: number;
  oldestEntry: Date;
  newestEntry: Date;
}