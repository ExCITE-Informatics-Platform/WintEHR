/**
 * Clinical Workflow Context - TypeScript Migration
 * Manages cross-tab communication, workflow orchestration, and clinical context sharing
 * 
 * Migrated to TypeScript with comprehensive type safety for event-driven clinical workflows.
 */
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useFHIRResource } from './FHIRResourceContext';
import { useAuth } from './AuthContext';

/**
 * FHIR Resource Types for clinical context
 */
import type {
  Encounter,
  Observation,
  Condition,
  MedicationRequest,
  ServiceRequest
} from '../types/fhir';

/**
 * Clinical Event Types - Strongly typed event system
 */
export const CLINICAL_EVENTS = {
  ORDER_PLACED: 'order.placed',
  ORDER_COMPLETED: 'order.completed',
  RESULT_RECEIVED: 'result.received',
  RESULT_ACKNOWLEDGED: 'result.acknowledged',
  MEDICATION_DISPENSED: 'medication.dispensed',
  MEDICATION_ADMINISTERED: 'medication.administered',
  ENCOUNTER_CREATED: 'encounter.created',
  ENCOUNTER_UPDATED: 'encounter.updated',
  DOCUMENTATION_CREATED: 'documentation.created',
  PROBLEM_ADDED: 'problem.added',
  PROBLEM_RESOLVED: 'problem.resolved',
  CRITICAL_ALERT: 'alert.critical',
  WORKFLOW_NOTIFICATION: 'workflow.notification',
  TAB_UPDATE: 'tab.update',
  IMAGING_STUDY_AVAILABLE: 'imaging.study.available',
  CARE_PLAN_UPDATED: 'careplan.updated'
} as const;

/**
 * Workflow Types - Predefined clinical workflows
 */
export const WORKFLOW_TYPES = {
  ORDER_TO_RESULT: 'order-result',
  PRESCRIPTION_TO_DISPENSE: 'prescription-dispense',
  ENCOUNTER_TO_DOCUMENTATION: 'encounter-documentation',
  IMAGING_TO_REPORT: 'imaging-report',
  PROBLEM_TO_CAREPLAN: 'problem-careplan'
} as const;

/**
 * Type definitions for clinical events and workflows
 */
export type ClinicalEventType = typeof CLINICAL_EVENTS[keyof typeof CLINICAL_EVENTS];
export type WorkflowType = typeof WORKFLOW_TYPES[keyof typeof WORKFLOW_TYPES];

/**
 * Base event listener type
 */
export type EventListener<T = any> = (data: T) => Promise<void> | void;

/**
 * Event listener map structure
 */
export type EventListenerMap = Map<ClinicalEventType, EventListener[]>;

/**
 * Alert severity levels
 */
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Alert types
 */
export type AlertType = 'abnormal_result' | 'medication_interaction' | 'allergy_alert' | 'critical_value' | 'workflow' | 'system';

/**
 * Alert action interface
 */
export interface AlertAction {
  label: string;
  action: 'navigate' | 'document' | 'order' | 'acknowledge' | 'custom';
  target?: string;
  data?: any;
}

/**
 * Clinical alert interface
 */
export interface ClinicalAlert {
  id: string;
  timestamp: string;
  patientId?: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  data?: any;
  actions?: AlertAction[];
  acknowledged?: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

/**
 * Workflow notification interface
 */
export interface WorkflowNotification {
  id: string;
  timestamp: string;
  patientId?: string;
  type: 'workflow';
  workflowType: WorkflowType;
  step: string;
  data: any;
  message: string;
}

/**
 * Tab update data interface
 */
export interface TabUpdateData {
  targetTabs: string[];
  updateType: string;
  data: any;
}

/**
 * Clinical context state interface
 */
export interface ClinicalContextState {
  activeProblems: Condition[];
  currentMedications: MedicationRequest[];
  pendingOrders: ServiceRequest[];
  recentResults: Observation[];
  activeEncounter: Encounter | null;
  careGoals: any[]; // TODO: Replace with CarePlan goals type
  alerts: ClinicalAlert[];
}

/**
 * Workflow state interface
 */
export interface WorkflowState {
  [workflowId: string]: {
    type: WorkflowType;
    status: 'pending' | 'in-progress' | 'completed' | 'failed';
    currentStep: string;
    data: any;
    startedAt: string;
    updatedAt: string;
  };
}

/**
 * Order data interface for workflow events
 */
export interface OrderData {
  id: string;
  category: 'laboratory' | 'imaging' | 'procedure' | 'medication' | 'consult';
  name: string;
  status: string;
  patientId: string;
  orderedBy: string;
  orderedAt: string;
}

/**
 * Result data interface for workflow events
 */
export interface ResultData {
  id: string;
  name: string;
  category: string;
  basedOn?: Array<{ reference: string }>;
  observations: Observation[];
  isAbnormal: boolean;
  severity?: AlertSeverity;
}

/**
 * Medication dispense data interface
 */
export interface MedicationDispenseData {
  id: string;
  medicationName: string;
  quantity: number;
  authorizingPrescription?: Array<{ reference: string }>;
  dispensedAt: string;
  dispensedBy: string;
}

/**
 * Encounter creation data interface
 */
export interface EncounterData {
  id: string;
  type: string;
  status: string;
  patientId: string;
  startedAt: string;
  provider?: string;
}

/**
 * Problem data interface
 */
export interface ProblemData {
  id: string;
  code: string;
  display: string;
  severity?: string;
  onsetDate?: string;
  patientId: string;
}

/**
 * Abnormal result interface
 */
export interface AbnormalResult {
  id: string;
  name: string;
  value: any;
  referenceRange: any;
  severity: AlertSeverity;
}

/**
 * Clinical workflow context interface
 */
export interface ClinicalWorkflowContextType {
  // Clinical context state
  clinicalContext: ClinicalContextState;
  getCurrentClinicalContext: () => ClinicalContextState & {
    patientId?: string;
    userId?: string;
    timestamp: string;
  };
  updateClinicalContext: (updater: Partial<ClinicalContextState> | ((prev: ClinicalContextState) => ClinicalContextState)) => void;
  
  // Event system
  subscribe: <T = any>(eventType: ClinicalEventType, callback: EventListener<T>) => () => void;
  publish: <T = any>(eventType: ClinicalEventType, data: T) => Promise<void>;
  
  // Constants
  CLINICAL_EVENTS: typeof CLINICAL_EVENTS;
  WORKFLOW_TYPES: typeof WORKFLOW_TYPES;
  
  // Notifications and alerts
  notifications: (ClinicalAlert | WorkflowNotification)[];
  clearNotification: (notificationId: string) => void;
  clearAllNotifications: () => void;
  createCriticalAlert: (alertData: Omit<ClinicalAlert, 'id' | 'timestamp' | 'patientId'>) => Promise<void>;
  createWorkflowNotification: (workflowType: WorkflowType, step: string, data: any) => Promise<void>;
  
  // Navigation
  navigateWithContext: (targetTab: string, contextData: any) => void;
  
  // Workflow states
  workflowStates: Map<string, WorkflowState[string]>;
  setWorkflowStates: React.Dispatch<React.SetStateAction<Map<string, WorkflowState[string]>>>;
}

/**
 * Provider props interface
 */
export interface ClinicalWorkflowProviderProps {
  children: ReactNode;
}

/**
 * Create the clinical workflow context
 */
const ClinicalWorkflowContext = createContext<ClinicalWorkflowContextType | undefined>(undefined);

/**
 * Clinical Workflow Provider Component
 */
export const ClinicalWorkflowProvider: React.FC<ClinicalWorkflowProviderProps> = ({ children }) => {
  const { currentPatient, getPatientResources } = useFHIRResource();
  const { currentUser } = useAuth();
  
  // Clinical context state
  const [clinicalContext, setClinicalContext] = useState<ClinicalContextState>({
    activeProblems: [],
    currentMedications: [],
    pendingOrders: [],
    recentResults: [],
    activeEncounter: null,
    careGoals: [],
    alerts: []
  });
  
  // Event listeners and notifications
  const [eventListeners, setEventListeners] = useState<EventListenerMap>(new Map());
  const [notifications, setNotifications] = useState<(ClinicalAlert | WorkflowNotification)[]>([]);
  const [workflowStates, setWorkflowStates] = useState<Map<string, WorkflowState[string]>>(new Map());

  // Subscribe to clinical events
  const subscribe = useCallback(<T = any>(eventType: ClinicalEventType, callback: EventListener<T>): (() => void) => {
    const listeners = eventListeners.get(eventType) || [];
    listeners.push(callback as EventListener);
    setEventListeners(prev => new Map(prev).set(eventType, listeners));
    
    // Return unsubscribe function
    return () => {
      const currentListeners = eventListeners.get(eventType) || [];
      const updatedListeners = currentListeners.filter(cb => cb !== callback);
      setEventListeners(prev => new Map(prev).set(eventType, updatedListeners));
    };
  }, [eventListeners]);

  // Publish clinical events
  const publish = useCallback(async <T = any>(eventType: ClinicalEventType, data: T): Promise<void> => {
    const listeners = eventListeners.get(eventType) || [];
    
    // Execute all listeners
    for (const listener of listeners) {
      try {
        await listener(data);
      } catch (error) {
        console.error(`Error in event listener for ${eventType}:`, error);
      }
    }
    
    // Handle special event types with automated workflows
    await handleAutomatedWorkflows(eventType, data);
  }, [eventListeners]);

  // Handle automated workflows
  const handleAutomatedWorkflows = async (eventType: ClinicalEventType, data: any): Promise<void> => {
    switch (eventType) {
      case CLINICAL_EVENTS.ORDER_PLACED:
        await handleOrderPlaced(data as OrderData);
        break;
      case CLINICAL_EVENTS.RESULT_RECEIVED:
        await handleResultReceived(data as ResultData);
        break;
      case CLINICAL_EVENTS.MEDICATION_DISPENSED:
        await handleMedicationDispensed(data as MedicationDispenseData);
        break;
      case CLINICAL_EVENTS.ENCOUNTER_CREATED:
        await handleEncounterCreated(data as EncounterData);
        break;
      case CLINICAL_EVENTS.PROBLEM_ADDED:
        await handleProblemAdded(data as ProblemData);
        break;
      default:
        break;
    }
  };

  // Automated workflow handlers
  const handleOrderPlaced = async (orderData: OrderData): Promise<void> => {
    // Create pending result placeholder for lab orders
    if (orderData.category === 'laboratory') {
      await createPendingResultPlaceholder(orderData);
    }
    
    // Add to pending orders
    updateClinicalContext(prev => ({
      ...prev,
      pendingOrders: [...prev.pendingOrders, orderData as any] // TODO: Fix typing
    }));
    
    // Notify relevant tabs
    await publish(CLINICAL_EVENTS.TAB_UPDATE, {
      targetTabs: ['orders', 'results'],
      updateType: 'order_placed',
      data: orderData
    } as TabUpdateData);
  };

  const handleResultReceived = async (resultData: ResultData): Promise<void> => {
    // Check for abnormal values
    const abnormalResults = checkForAbnormalResults(resultData);
    
    if (abnormalResults.length > 0) {
      // Create critical alerts for abnormal results
      await createCriticalAlert({
        type: 'abnormal_result',
        severity: 'high',
        message: `Abnormal lab results detected: ${abnormalResults.map(r => r.name).join(', ')}`,
        data: resultData,
        actions: [
          { label: 'Review Results', action: 'navigate', target: 'results' },
          { label: 'Add to Note', action: 'document', target: 'documentation' }
        ]
      });
    }
    
    // Update recent results
    updateClinicalContext(prev => ({
      ...prev,
      recentResults: [resultData.observations[0], ...prev.recentResults.slice(0, 9)],
      pendingOrders: prev.pendingOrders.filter(order => 
        order.id !== resultData.basedOn?.[0]?.reference?.split('/')[1]
      )
    }));
    
    // Suggest follow-up orders for abnormal results
    if (abnormalResults.length > 0) {
      await suggestFollowUpOrders(abnormalResults);
    }
  };

  const handleMedicationDispensed = async (dispenseData: MedicationDispenseData): Promise<void> => {
    // Update medication status
    updateClinicalContext(prev => ({
      ...prev,
      currentMedications: prev.currentMedications.map(med => 
        med.id === dispenseData.authorizingPrescription?.[0]?.reference?.split('/')[1]
          ? { ...med, status: 'active' as any, dispensed: true } // TODO: Fix typing
          : med
      )
    }));
    
    // Schedule monitoring if required
    await scheduleMonitoringForMedication(dispenseData);
    
    // Notify pharmacy and chart review tabs
    await publish(CLINICAL_EVENTS.TAB_UPDATE, {
      targetTabs: ['pharmacy', 'chart'],
      updateType: 'medication_dispensed',
      data: dispenseData
    } as TabUpdateData);
  };

  const handleEncounterCreated = async (encounterData: EncounterData): Promise<void> => {
    // Set as active encounter
    updateClinicalContext(prev => ({
      ...prev,
      activeEncounter: encounterData as any // TODO: Fix typing to proper Encounter
    }));
    
    // Create documentation template
    await createDocumentationTemplate(encounterData);
    
    // Apply problem-based order sets
    await applyOrderSets(encounterData);
    
    // Notify relevant tabs
    await publish(CLINICAL_EVENTS.TAB_UPDATE, {
      targetTabs: ['encounters', 'documentation', 'orders'],
      updateType: 'encounter_created',
      data: encounterData
    } as TabUpdateData);
  };

  const handleProblemAdded = async (problemData: ProblemData): Promise<void> => {
    // Add to active problems
    updateClinicalContext(prev => ({
      ...prev,
      activeProblems: [...prev.activeProblems, problemData as any] // TODO: Fix typing
    }));
    
    // Suggest care plan goals
    await suggestCareGoals(problemData);
    
    // Suggest relevant order sets
    await suggestOrderSets(problemData);
    
    // Notify chart review and care plan tabs
    await publish(CLINICAL_EVENTS.TAB_UPDATE, {
      targetTabs: ['chart', 'careplan', 'orders'],
      updateType: 'problem_added',
      data: problemData
    } as TabUpdateData);
  };

  // Clinical decision support functions
  const checkForAbnormalResults = (resultData: ResultData): AbnormalResult[] => {
    const abnormal: AbnormalResult[] = [];
    const observations = Array.isArray(resultData) ? resultData as any : [resultData];
    
    for (const obs of observations) {
      if (obs.resourceType === 'Observation' && obs.valueQuantity) {
        const referenceRange = obs.referenceRange?.[0];
        if (referenceRange) {
          const value = obs.valueQuantity.value;
          const low = referenceRange.low?.value;
          const high = referenceRange.high?.value;
          
          if ((low && value < low) || (high && value > high)) {
            abnormal.push({
              id: obs.id,
              name: obs.code?.text || obs.code?.coding?.[0]?.display,
              value: obs.valueQuantity,
              referenceRange: referenceRange,
              severity: determineSeverity(value, low, high)
            });
          }
        }
      }
    }
    
    return abnormal;
  };

  const determineSeverity = (value: number, low?: number, high?: number): AlertSeverity => {
    if (low && value < low) {
      const deviation = (low - value) / low;
      if (deviation > 0.5) return 'critical';
      if (deviation > 0.2) return 'high';
      return 'medium';
    }
    if (high && value > high) {
      const deviation = (value - high) / high;
      if (deviation > 0.5) return 'critical';
      if (deviation > 0.2) return 'high';
      return 'medium';
    }
    return 'low';
  };

  const createCriticalAlert = async (alertData: Omit<ClinicalAlert, 'id' | 'timestamp' | 'patientId'>): Promise<void> => {
    const alert: ClinicalAlert = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      patientId: currentPatient?.id,
      ...alertData
    };
    
    setNotifications(prev => [alert, ...prev]);
    
    // Publish critical alert event
    await publish(CLINICAL_EVENTS.CRITICAL_ALERT, alert);
  };

  const createWorkflowNotification = async (workflowType: WorkflowType, step: string, data: any): Promise<void> => {
    const notification: WorkflowNotification = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      patientId: currentPatient?.id,
      type: 'workflow',
      workflowType,
      step,
      data,
      message: generateWorkflowMessage(workflowType, step, data)
    };
    
    setNotifications(prev => [notification, ...prev.slice(0, 19)]);
    
    await publish(CLINICAL_EVENTS.WORKFLOW_NOTIFICATION, notification);
  };

  const generateWorkflowMessage = (workflowType: WorkflowType, step: string, data: any): string => {
    switch (workflowType) {
      case WORKFLOW_TYPES.ORDER_TO_RESULT:
        return step === 'completed' ? 
          `Lab results available for ${data.name}` :
          `Lab order placed: ${data.name}`;
      case WORKFLOW_TYPES.PRESCRIPTION_TO_DISPENSE:
        return step === 'completed' ?
          `Medication dispensed: ${data.medicationName}` :
          `Prescription sent to pharmacy: ${data.medicationName}`;
      default:
        return `Workflow update: ${workflowType} - ${step}`;
    }
  };

  // Cross-tab navigation with context
  const navigateWithContext = useCallback((targetTab: string, contextData: any): void => {
    publish(CLINICAL_EVENTS.TAB_UPDATE, {
      targetTabs: [targetTab],
      updateType: 'navigate_with_context',
      data: contextData
    } as TabUpdateData);
  }, [publish]);

  // Get current clinical context
  const getCurrentClinicalContext = useCallback(() => {
    return {
      ...clinicalContext,
      patientId: currentPatient?.id,
      userId: (currentUser as any)?.id,
      timestamp: new Date().toISOString()
    };
  }, [clinicalContext, currentPatient, currentUser]);

  // Update clinical context
  const updateClinicalContext = useCallback((updater: Partial<ClinicalContextState> | ((prev: ClinicalContextState) => ClinicalContextState)): void => {
    if (typeof updater === 'function') {
      setClinicalContext(updater);
    } else {
      setClinicalContext(prev => ({ ...prev, ...updater }));
    }
  }, []);

  // Load clinical context when patient changes
  useEffect(() => {
    if (currentPatient?.id) {
      loadClinicalContext();
    }
  }, [currentPatient?.id]);

  const loadClinicalContext = async (): Promise<void> => {
    try {
      const patientId = currentPatient?.id;
      if (!patientId) return;
      
      // Load active problems (Conditions)
      const conditions = getPatientResources<Condition>(patientId, 'Condition') || [];
      const activeProblems = conditions.filter(c => 
        c.clinicalStatus?.coding?.[0]?.code === 'active'
      );
      
      // Load current medications (MedicationRequests)
      const medRequests = getPatientResources<MedicationRequest>(patientId, 'MedicationRequest') || [];
      const currentMedications = medRequests.filter(mr => 
        mr.status === 'active'
      );
      
      // Load pending orders
      const serviceRequests = getPatientResources<ServiceRequest>(patientId, 'ServiceRequest') || [];
      const pendingOrders = serviceRequests.filter(sr => 
        ['active', 'draft'].includes(sr.status || '')
      );
      
      // Load recent results
      const observations = getPatientResources<Observation>(patientId, 'Observation') || [];
      const recentResults = observations
        .sort((a, b) => new Date(b.effectiveDateTime || 0).getTime() - new Date(a.effectiveDateTime || 0).getTime())
        .slice(0, 10);
      
      // Load encounters
      const encounters = getPatientResources<Encounter>(patientId, 'Encounter') || [];
      const activeEncounter = encounters.find(e => e.status === 'in-progress') || null;
      
      updateClinicalContext({
        activeProblems,
        currentMedications,
        pendingOrders,
        recentResults,
        activeEncounter,
        careGoals: [], // TODO: Load from CarePlan resources
        alerts: []
      });
      
    } catch (error) {
      console.error('Error loading clinical context:', error);
    }
  };

  // Helper functions for automated workflows
  const createPendingResultPlaceholder = async (orderData: OrderData): Promise<void> => {
    // This would create a placeholder result that gets updated when actual results arrive
    // TODO: Implement pending result placeholder creation
    console.log('Creating pending result placeholder for order:', orderData.id);
  };

  const scheduleMonitoringForMedication = async (dispenseData: MedicationDispenseData): Promise<void> => {
    // This would schedule monitoring labs based on medication type
    // TODO: Implement medication monitoring scheduler
    console.log('Scheduling medication monitoring for:', dispenseData.medicationName);
  };

  const createDocumentationTemplate = async (encounterData: EncounterData): Promise<void> => {
    // This would create a SOAP note template for the encounter
    // TODO: Implement documentation template creation
    console.log('Creating documentation template for encounter:', encounterData.id);
  };

  const applyOrderSets = async (encounterData: EncounterData): Promise<void> => {
    // This would suggest order sets based on encounter type and patient problems
    // TODO: Implement order set application logic
    console.log('Applying order sets for encounter type:', encounterData.type);
  };

  const suggestCareGoals = async (problemData: ProblemData): Promise<void> => {
    // This would suggest care plan goals based on the problem
    // TODO: Implement care goal suggestion logic
    console.log('Suggesting care goals for problem:', problemData.code);
  };

  const suggestOrderSets = async (problemData: ProblemData): Promise<void> => {
    // This would suggest relevant order sets for the problem
    // TODO: Implement order set suggestion logic
    console.log('Suggesting order sets for problem:', problemData.display);
  };

  const suggestFollowUpOrders = async (abnormalResults: AbnormalResult[]): Promise<void> => {
    // This would suggest follow-up orders for abnormal results
    // TODO: Implement follow-up order suggestion logic
    console.log('Suggesting follow-up orders for', abnormalResults.length, 'abnormal results');
  };

  // Clear notifications
  const clearNotification = useCallback((notificationId: string): void => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  }, []);

  const clearAllNotifications = useCallback((): void => {
    setNotifications([]);
  }, []);

  const value: ClinicalWorkflowContextType = {
    // Clinical context
    clinicalContext,
    getCurrentClinicalContext,
    updateClinicalContext,
    
    // Event system
    subscribe,
    publish,
    CLINICAL_EVENTS,
    WORKFLOW_TYPES,
    
    // Notifications
    notifications,
    clearNotification,
    clearAllNotifications,
    createCriticalAlert,
    createWorkflowNotification,
    
    // Navigation
    navigateWithContext,
    
    // Workflow states
    workflowStates,
    setWorkflowStates
  };

  return (
    <ClinicalWorkflowContext.Provider value={value}>
      {children}
    </ClinicalWorkflowContext.Provider>
  );
};

/**
 * Hook for using the clinical workflow context
 */
export const useClinicalWorkflow = (): ClinicalWorkflowContextType => {
  const context = useContext(ClinicalWorkflowContext);
  if (!context) {
    throw new Error('useClinicalWorkflow must be used within a ClinicalWorkflowProvider');
  }
  return context;
};

export default ClinicalWorkflowContext;