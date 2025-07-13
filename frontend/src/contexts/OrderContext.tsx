/**
 * Order Context Provider - TypeScript Migration
 * Manages clinical orders using FHIR ServiceRequest resources
 * 
 * Migrated to TypeScript with comprehensive type safety for clinical ordering,
 * FHIR ServiceRequest resource handling, and CPOE workflow orchestration.
 */
import * as React from 'react';
import { createContext, useContext, useState, ReactNode } from 'react';
import { fhirClient } from '../services/fhirClient';
import { useClinical } from './ClinicalContext';
import { useFHIRResource } from './FHIRResourceContext';
import api from '../services/api';
import { ServiceRequest, Questionnaire } from '../types/fhir';

/**
 * FHIR R4 ServiceRequest status values with complete workflow support
 */
export type ServiceRequestStatus = 
  | 'draft'
  | 'active'
  | 'on-hold'
  | 'revoked'
  | 'completed'
  | 'entered-in-error'
  | 'unknown';

/**
 * FHIR R4 ServiceRequest priority levels
 */
export type ServiceRequestPriority = 
  | 'routine'
  | 'urgent'
  | 'asap'
  | 'stat';

/**
 * FHIR R4 ServiceRequest intent classification
 */
export type ServiceRequestIntent = 
  | 'proposal'
  | 'plan'
  | 'directive'
  | 'order'
  | 'original-order'
  | 'reflex-order'
  | 'filler-order'
  | 'instance-order'
  | 'option';

/**
 * Clinical order type classification
 */
export type OrderType = 
  | 'medication'
  | 'laboratory'
  | 'imaging'
  | 'referral'
  | 'procedure'
  | 'other';

/**
 * Drug interaction severity levels
 */
export type InteractionSeverity = 
  | 'minor'
  | 'moderate'
  | 'major'
  | 'contraindicated';

/**
 * Order alert type classification
 */
export type AlertType = 
  | 'drug-drug'
  | 'drug-allergy'
  | 'drug-lab'
  | 'duplicate-therapy'
  | 'dosing'
  | 'renal-adjustment'
  | 'pregnancy'
  | 'geriatric';

/**
 * Medication details interface for prescription orders
 */
export interface MedicationDetails {
  medicationName: string;
  dosage?: string;
  route?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
  quantity?: string;
  refills?: number;
}

/**
 * Transformed order interface for internal use
 */
export interface TransformedOrder {
  id?: string;
  patientId: string;
  encounterId?: string;
  orderType: OrderType;
  status: ServiceRequestStatus;
  priority?: ServiceRequestPriority;
  intent?: ServiceRequestIntent;
  code?: string;
  display?: string;
  authoredOn?: string;
  requester?: string;
  performerType?: string;
  category?: string;
  instructions?: string;
  reason?: string;
  // Order type specific details
  medicationDetails?: MedicationDetails;
  specimen?: string;
  bodySite?: string;
  // Clinical context
  clinicalNotes?: string;
  expectedCompletionDate?: string;
}

/**
 * Order creation data interface
 */
export interface OrderCreationData {
  orderType: OrderType;
  priority?: ServiceRequestPriority;
  intent?: ServiceRequestIntent;
  code?: string;
  display?: string;
  name?: string;
  instructions?: string;
  reason?: string;
  // Medication specific
  medicationDetails?: MedicationDetails;
  dosage?: string;
  route?: string;
  frequency?: string;
  duration?: string;
  // Laboratory specific
  specimen?: string;
  // Imaging specific
  bodySite?: string;
  // Clinical context
  clinicalNotes?: string;
  expectedDate?: string;
}

/**
 * Order alert interface with comprehensive detail
 */
export interface OrderAlert {
  severity: InteractionSeverity;
  type: AlertType;
  message: string;
  drugs?: string[];
  clinicalConsequence?: string;
  management?: string;
  references?: string[];
  overridable?: boolean;
}

/**
 * Order set interface based on FHIR Questionnaire
 */
export interface OrderSet {
  id: string;
  name: string;
  description?: string;
  specialty: string;
  version?: string;
  status?: string;
  lastUpdated?: string;
  orders: OrderSetItem[];
}

/**
 * Individual order set item interface
 */
export interface OrderSetItem {
  linkId: string;
  type: OrderType;
  code?: string;
  display: string;
  priority?: ServiceRequestPriority;
  frequency?: string;
  selected: boolean;
  required?: boolean;
  category?: string;
  instructions?: string;
}

/**
 * Order set application result interface
 */
export interface OrderSetApplicationResult {
  created: number;
  orderSetName: string;
  orderIds: string[];
  alerts?: OrderAlert[];
}

/**
 * Search result interfaces for clinical catalogs
 */
export interface MedicationSearchResult {
  name: string;
  code: string;
  display: string;
  system: string;
  form?: string;
  strength?: string;
  manufacturer?: string;
}

export interface LaboratoryTestSearchResult {
  name: string;
  code: string;
  display: string;
  system: string;
  category?: string;
  specimen?: string;
  method?: string;
}

export interface ImagingStudySearchResult {
  name: string;
  code: string;
  display: string;
  system: string;
  modality?: string;
  bodyRegion?: string;
  contrast?: boolean;
}

/**
 * Order context interface with comprehensive typing
 */
export interface OrderContextType {
  // Current state
  activeOrders: TransformedOrder[];
  pendingOrders: TransformedOrder[];
  orderSets: OrderSet[];
  currentOrderAlerts: OrderAlert[];
  isProcessingOrder: boolean;

  // Order management
  loadActiveOrders: (patientId: string) => Promise<void>;
  loadOrderSets: (specialty?: string) => Promise<void>;
  
  // Order creation
  createMedicationOrder: (orderDetails: OrderCreationData, overrideAlerts?: boolean) => Promise<{ order?: TransformedOrder; alerts?: OrderAlert[] }>;
  createLaboratoryOrder: (orderDetails: OrderCreationData) => Promise<{ order: TransformedOrder }>;
  createImagingOrder: (orderDetails: OrderCreationData) => Promise<{ order: TransformedOrder }>;
  
  // Order modification
  discontinueOrder: (orderId: string, reason?: string) => Promise<void>;
  modifyOrder: (orderId: string, updates: Partial<OrderCreationData>) => Promise<void>;
  
  // Order sets
  applyOrderSet: (orderSetId: string, selectedOrders?: string[]) => Promise<OrderSetApplicationResult>;
  
  // Clinical decision support
  checkDrugInteractions: (order: OrderCreationData) => Promise<OrderAlert[]>;
  clearCurrentAlerts: () => void;
  
  // Search capabilities
  searchMedications: (query: string) => Promise<MedicationSearchResult[]>;
  searchLaboratoryTests: (query: string) => Promise<LaboratoryTestSearchResult[]>;
  searchImagingStudies: (query: string) => Promise<ImagingStudySearchResult[]>;
  
  // Utility functions
  transformFHIRServiceRequest: (fhirRequest: ServiceRequest) => TransformedOrder;
  transformToFHIRServiceRequest: (order: OrderCreationData) => Omit<ServiceRequest, 'id' | 'meta'>;
  getOrderTypeDisplay: (orderType: OrderType) => string;
  getCategoryCodeForOrderType: (orderType: OrderType) => string;
}

/**
 * Provider props interface
 */
export interface OrderProviderProps {
  children: ReactNode;
}

/**
 * SNOMED CT category codes for order types
 */
const ORDER_TYPE_CATEGORY_CODES: Record<OrderType, string> = {
  'medication': '387713003',
  'laboratory': '108252007', 
  'imaging': '363679005',
  'referral': '3457005',
  'procedure': '71388002',
  'other': '410321003'
} as const;

/**
 * Display names for order types
 */
const ORDER_TYPE_DISPLAYS: Record<OrderType, string> = {
  'medication': 'Medication request',
  'laboratory': 'Laboratory procedure',
  'imaging': 'Imaging procedure',
  'referral': 'Referral',
  'procedure': 'Clinical procedure',
  'other': 'Other service'
} as const;

/**
 * Code systems for different order types
 */
const ORDER_TYPE_CODE_SYSTEMS: Record<OrderType, string> = {
  'medication': 'http://www.nlm.nih.gov/research/umls/rxnorm',
  'laboratory': 'http://loinc.org',
  'imaging': 'http://loinc.org',
  'referral': 'http://snomed.info/sct',
  'procedure': 'http://snomed.info/sct',
  'other': 'http://snomed.info/sct'
} as const;

/**
 * Specialty mappings for order sets
 */
const ORDER_SET_SPECIALTY_MAP: Record<string, string> = {
  'admission-basic': 'general',
  'cardiac-workup': 'cardiology',
  'diabetes-monitoring': 'endocrinology',
  'sepsis-bundle': 'critical-care',
  'preop-standard': 'surgery',
  'chest-pain-protocol': 'emergency'
} as const;

/**
 * Create order context with proper typing
 */
const OrderContext = createContext<OrderContextType | undefined>(undefined);

/**
 * Custom hook for using order context with type safety
 */
export const useOrders = (): OrderContextType => {
  const context = useContext(OrderContext);
  if (!context) {
    throw new Error('useOrders must be used within an OrderProvider');
  }
  return context;
};

/**
 * Order provider component with comprehensive type safety
 */
export const OrderProvider: React.FC<OrderProviderProps> = ({ children }) => {
  const { currentPatient, currentEncounter } = useClinical();
  const { refreshPatientResources } = useFHIRResource();
  
  // State management
  const [activeOrders, setActiveOrders] = useState<TransformedOrder[]>([]);
  const [pendingOrders] = useState<TransformedOrder[]>([]);
  const [orderSets, setOrderSets] = useState<OrderSet[]>([]);
  const [currentOrderAlerts, setCurrentOrderAlerts] = useState<OrderAlert[]>([]);
  const [isProcessingOrder, setIsProcessingOrder] = useState<boolean>(false);

  /**
   * Transform FHIR ServiceRequest to internal format with comprehensive type safety
   */
  const transformFHIRServiceRequest = (fhirRequest: ServiceRequest): TransformedOrder => {
    const orderType = determineOrderType(fhirRequest);
    
    return {
      id: fhirRequest.id,
      patientId: fhirRequest.subject?.reference?.split('/')[1] || '',
      encounterId: fhirRequest.encounter?.reference?.split('/')[1],
      orderType,
      status: (fhirRequest.status as ServiceRequestStatus) || 'unknown',
      priority: (fhirRequest.priority as ServiceRequestPriority) || 'routine',
      intent: (fhirRequest.intent as ServiceRequestIntent) || 'order',
      code: fhirRequest.code?.coding?.[0]?.code,
      display: fhirRequest.code?.coding?.[0]?.display || fhirRequest.code?.text || 'Unknown order',
      authoredOn: fhirRequest.authoredOn,
      requester: fhirRequest.requester?.reference?.split('/')[1],
      performerType: fhirRequest.performerType?.coding?.[0]?.display,
      category: fhirRequest.category?.[0]?.coding?.[0]?.code,
      instructions: fhirRequest.patientInstruction,
      reason: fhirRequest.reasonCode?.[0]?.text,
      // Extract order-type specific details
      medicationDetails: extractMedicationDetails(fhirRequest),
      specimen: fhirRequest.specimen?.[0]?.display,
      bodySite: fhirRequest.bodySite?.[0]?.coding?.[0]?.display,
      clinicalNotes: fhirRequest.note?.[0]?.text,
      expectedCompletionDate: (fhirRequest.occurrenceDateTime as string) || 
                             (fhirRequest.occurrencePeriod as any)?.end
    };
  };

  /**
   * Determine order type from FHIR ServiceRequest category
   */
  const determineOrderType = (fhirRequest: ServiceRequest): OrderType => {
    const category = fhirRequest.category?.[0]?.coding?.[0]?.code;
    
    // Map SNOMED CT codes to order types
    switch (category) {
      case '387713003': return 'medication';
      case '108252007': return 'laboratory';
      case '363679005': return 'imaging';
      case '3457005': return 'referral';
      case '71388002': return 'procedure';
      default: return 'other';
    }
  };

  /**
   * Extract medication details from FHIR extensions
   */
  const extractMedicationDetails = (fhirRequest: ServiceRequest): MedicationDetails | undefined => {
    const extension = fhirRequest.extension?.find(e => e.url === 'http://medgenemr.com/medication-details');
    if (!extension) return undefined;
    
    const getExtensionValue = (url: string): string | undefined => {
      return extension.extension?.find(e => e.url === url)?.valueString;
    };
    
    return {
      medicationName: extension.valueString || '',
      dosage: getExtensionValue('dosage'),
      route: getExtensionValue('route'),
      frequency: getExtensionValue('frequency'),
      duration: getExtensionValue('duration'),
      instructions: getExtensionValue('instructions'),
      quantity: getExtensionValue('quantity'),
      refills: extension.extension?.find(e => e.url === 'refills')?.valueInteger
    };
  };

  /**
   * Transform internal order to FHIR ServiceRequest format
   */
  const transformToFHIRServiceRequest = (order: OrderCreationData): Omit<ServiceRequest, 'id' | 'meta'> => {
    const fhirRequest: any = {
      resourceType: 'ServiceRequest',
      status: 'active',
      intent: order.intent || 'order',
      priority: order.priority || 'routine',
      subject: {
        reference: `Patient/${currentPatient?.id}`
      },
      authoredOn: new Date().toISOString(),
      code: {
        coding: [{
          system: getCodeSystemForOrderType(order.orderType),
          code: order.code || 'unknown',
          display: order.display || order.name || 'Unknown order'
        }],
        text: order.display || order.name
      },
      category: [{
        coding: [{
          system: 'http://snomed.info/sct',
          code: getCategoryCodeForOrderType(order.orderType),
          display: getOrderTypeDisplay(order.orderType)
        }]
      }]
    };

    // Add optional fields
    if (currentEncounter?.id) {
      fhirRequest.encounter = { reference: `Encounter/${currentEncounter.id}` };
    }

    if (order.instructions) {
      fhirRequest.patientInstruction = order.instructions;
    }

    if (order.reason) {
      fhirRequest.reasonCode = [{ text: order.reason }];
    }

    if (order.clinicalNotes) {
      fhirRequest.note = [{ text: order.clinicalNotes }];
    }

    if (order.expectedDate) {
      fhirRequest.occurrenceDateTime = order.expectedDate;
    }

    // Add order-type specific details
    if (order.orderType === 'medication' && order.medicationDetails) {
      const medicationExt = {
        url: 'http://medgenemr.com/medication-details',
        valueString: order.medicationDetails.medicationName,
        extension: []
      };

      // Add sub-extensions for medication details
      const addExtension = (url: string, value?: string | number) => {
        if (value !== undefined) {
          (medicationExt.extension as any[]).push({
            url,
            [typeof value === 'string' ? 'valueString' : 'valueInteger']: value
          });
        }
      };

      addExtension('dosage', order.medicationDetails.dosage);
      addExtension('route', order.medicationDetails.route);
      addExtension('frequency', order.medicationDetails.frequency);
      addExtension('duration', order.medicationDetails.duration);
      addExtension('instructions', order.medicationDetails.instructions);
      addExtension('quantity', order.medicationDetails.quantity);
      addExtension('refills', order.medicationDetails.refills);

      fhirRequest.extension = [medicationExt];
    }

    if (order.orderType === 'laboratory' && order.specimen) {
      fhirRequest.specimen = [{ display: order.specimen }];
    }

    if (order.orderType === 'imaging' && order.bodySite) {
      fhirRequest.bodySite = [{
        coding: [{ display: order.bodySite }]
      }];
    }

    return fhirRequest as Omit<ServiceRequest, 'id' | 'meta'>;
  };

  /**
   * Helper functions for code systems and categories
   */
  const getCodeSystemForOrderType = (orderType: OrderType): string => {
    return ORDER_TYPE_CODE_SYSTEMS[orderType];
  };

  const getCategoryCodeForOrderType = (orderType: OrderType): string => {
    return ORDER_TYPE_CATEGORY_CODES[orderType];
  };

  const getOrderTypeDisplay = (orderType: OrderType): string => {
    return ORDER_TYPE_DISPLAYS[orderType];
  };

  /**
   * Load active orders for patient with type safety
   */
  const loadActiveOrders = async (patientId: string): Promise<void> => {
    try {
      const result = await fhirClient.search('ServiceRequest' as any, {
        patient: patientId,
        status: 'active,on-hold',
        _sort: '-authored'
      });
      
      const orders = (result.resources || []).map((resource: any) => 
        transformFHIRServiceRequest(resource as ServiceRequest)
      );
      setActiveOrders(orders);
    } catch (error) {
      throw error;
    }
  };

  /**
   * Transform FHIR Questionnaire to order set with comprehensive typing
   */
  const transformQuestionnaireToOrderSet = (questionnaire: Questionnaire): OrderSet => {
    const code = questionnaire.code?.[0]?.code || questionnaire.id || '';
    
    return {
      id: questionnaire.id || '',
      name: questionnaire.title || questionnaire.name || 'Unnamed Order Set',
      description: questionnaire.description,
      specialty: getSpecialtyFromCode(code),
      version: questionnaire.version,
      status: questionnaire.status,
      lastUpdated: questionnaire.date,
      orders: (questionnaire.item || []).map(item => ({
        linkId: item.linkId || '',
        type: (item.extension?.find(e => e.url === 'http://medgenemr.com/order-type')?.valueCode as OrderType) || 'other',
        code: item.code?.[0]?.code,
        display: item.text || item.code?.[0]?.display || 'Unknown item',
        priority: (item.extension?.find(e => e.url === 'http://medgenemr.com/order-priority')?.valueCode as ServiceRequestPriority) || 'routine',
        frequency: item.extension?.find(e => e.url === 'http://medgenemr.com/order-frequency')?.valueString,
        selected: item.initial?.[0]?.valueBoolean || false,
        required: item.required || false,
        category: item.extension?.find(e => e.url === 'http://medgenemr.com/order-category')?.valueString,
        instructions: item.extension?.find(e => e.url === 'http://medgenemr.com/order-instructions')?.valueString
      }))
    };
  };

  /**
   * Map order set codes to specialties
   */
  const getSpecialtyFromCode = (code: string): string => {
    return ORDER_SET_SPECIALTY_MAP[code] || 'general';
  };

  /**
   * Load order sets from FHIR Questionnaires with filtering
   */
  const loadOrderSets = async (specialty?: string): Promise<void> => {
    try {
      // Search for questionnaires with order-set-type code
      const searchParams: Record<string, any> = {
        code: 'http://medgenemr.com/order-set-type|',
        _count: 50
      };
      
      const result = await fhirClient.search('Questionnaire' as any, searchParams);
      
      if (result.resources) {
        const orderSets = result.resources.map((resource: any) => 
          transformQuestionnaireToOrderSet(resource as Questionnaire)
        );
        
        const filtered = specialty 
          ? orderSets.filter(set => set.specialty === specialty)
          : orderSets;
        
        setOrderSets(filtered);
      }
    } catch (error) {
      // Fallback to empty array instead of throwing
      setOrderSets([]);
    }
  };

  /**
   * Create medication order with drug interaction checking
   */
  const createMedicationOrder = async (
    orderDetails: OrderCreationData, 
    overrideAlerts: boolean = false
  ): Promise<{ order?: TransformedOrder; alerts?: OrderAlert[] }> => {
    if (!currentPatient) {
      throw new Error('No patient selected');
    }

    setIsProcessingOrder(true);
    try {
      // Create the order object
      const order: OrderCreationData = {
        ...orderDetails,
        orderType: 'medication',
        priority: orderDetails.priority || 'routine',
        intent: orderDetails.intent || 'order'
      };

      // Check for drug interactions
      const alerts = await checkDrugInteractions(order);
      
      if (alerts.length > 0 && !overrideAlerts) {
        setCurrentOrderAlerts(alerts);
        return { alerts };
      }

      // Create FHIR ServiceRequest
      const fhirRequest = transformToFHIRServiceRequest(order);
      const result = await fhirClient.create('ServiceRequest' as any, fhirRequest);

      // Refresh patient resources to update all contexts
      if (currentPatient?.id) {
        await refreshPatientResources(currentPatient.id);
      }
      
      await loadActiveOrders(currentPatient.id);
      
      const createdOrder: TransformedOrder = {
        ...order,
        id: result.id,
        patientId: currentPatient.id,
        encounterId: currentEncounter?.id,
        status: 'active',
        priority: order.priority || 'routine',
        intent: order.intent || 'order',
        authoredOn: new Date().toISOString()
      };

      return { order: createdOrder };
    } catch (error) {
      throw error;
    } finally {
      setIsProcessingOrder(false);
    }
  };

  /**
   * Check drug interactions using the API with comprehensive alerts
   */
  const checkDrugInteractions = async (order: OrderCreationData): Promise<OrderAlert[]> => {
    try {
      // Get active medications
      const activeMeds = activeOrders
        .filter(o => o.orderType === 'medication' && o.status === 'active')
        .map(med => ({
          name: med.display || med.medicationDetails?.medicationName || 'Unknown',
          code: med.code || ''
        }));
      
      // Add the new medication
      const allMeds = [...activeMeds, {
        name: order.medicationDetails?.medicationName || order.display || order.name || 'Unknown',
        code: order.code || ''
      }];
      
      // Call drug interaction API
      const response = await api.post('/api/emr/clinical/drug-interactions/check-interactions', allMeds);
      
      // Transform interactions to alerts with comprehensive typing
      const alerts: OrderAlert[] = response.data.interactions.map((interaction: any) => ({
        severity: interaction.severity as InteractionSeverity,
        type: 'drug-drug' as AlertType,
        message: interaction.description || 'Drug interaction detected',
        drugs: interaction.drugs || [],
        clinicalConsequence: interaction.clinical_consequence,
        management: interaction.management,
        references: interaction.references || [],
        overridable: interaction.severity !== 'contraindicated'
      }));
      
      return alerts;
    } catch (error) {
      // Return empty array on error to allow order to proceed
      return [];
    }
  };

  /**
   * Create laboratory order with type safety
   */
  const createLaboratoryOrder = async (orderDetails: OrderCreationData): Promise<{ order: TransformedOrder }> => {
    if (!currentPatient) {
      throw new Error('No patient selected');
    }

    setIsProcessingOrder(true);
    try {
      const order: OrderCreationData = {
        ...orderDetails,
        orderType: 'laboratory',
        priority: orderDetails.priority || 'routine',
        intent: orderDetails.intent || 'order'
      };

      const fhirRequest = transformToFHIRServiceRequest(order);
      const result = await fhirClient.create('ServiceRequest' as any, fhirRequest);

      // Refresh patient resources to update all contexts
      if (currentPatient?.id) {
        await refreshPatientResources(currentPatient.id);
      }

      await loadActiveOrders(currentPatient.id);
      
      const createdOrder: TransformedOrder = {
        ...order,
        id: result.id,
        patientId: currentPatient.id,
        encounterId: currentEncounter?.id,
        status: 'active',
        priority: order.priority || 'routine',
        intent: order.intent || 'order',
        authoredOn: new Date().toISOString()
      };

      return { order: createdOrder };
    } catch (error) {
      throw error;
    } finally {
      setIsProcessingOrder(false);
    }
  };

  /**
   * Create imaging order with type safety
   */
  const createImagingOrder = async (orderDetails: OrderCreationData): Promise<{ order: TransformedOrder }> => {
    if (!currentPatient) {
      throw new Error('No patient selected');
    }

    setIsProcessingOrder(true);
    try {
      const order: OrderCreationData = {
        ...orderDetails,
        orderType: 'imaging',
        priority: orderDetails.priority || 'routine',
        intent: orderDetails.intent || 'order'
      };

      const fhirRequest = transformToFHIRServiceRequest(order);
      const result = await fhirClient.create('ServiceRequest' as any, fhirRequest);

      // Refresh patient resources to update all contexts
      if (currentPatient?.id) {
        await refreshPatientResources(currentPatient.id);
      }

      await loadActiveOrders(currentPatient.id);
      
      const createdOrder: TransformedOrder = {
        ...order,
        id: result.id,
        patientId: currentPatient.id,
        encounterId: currentEncounter?.id,
        status: 'active',
        priority: order.priority || 'routine',
        intent: order.intent || 'order',
        authoredOn: new Date().toISOString()
      };

      return { order: createdOrder };
    } catch (error) {
      throw error;
    } finally {
      setIsProcessingOrder(false);
    }
  };

  /**
   * Discontinue order with proper FHIR status management
   */
  const discontinueOrder = async (orderId: string, reason?: string): Promise<void> => {
    try {
      // Get the current order
      const fhirRequest = await fhirClient.read('ServiceRequest' as any, orderId) as any;
      
      // Update status to revoked
      fhirRequest.status = 'revoked';
      
      // Add extension for discontinuation reason
      if (reason) {
        if (!fhirRequest.extension) fhirRequest.extension = [];
        fhirRequest.extension.push({
          url: 'http://medgenemr.com/discontinuation-reason',
          valueString: reason
        });
      }
      
      await fhirClient.update('ServiceRequest' as any, orderId, fhirRequest);
      
      // Refresh patient resources to update all contexts
      if (currentPatient?.id) {
        await refreshPatientResources(currentPatient.id);
        await loadActiveOrders(currentPatient.id);
      }
    } catch (error) {
      throw error;
    }
  };

  /**
   * Modify existing order with type safety
   */
  const modifyOrder = async (orderId: string, updates: Partial<OrderCreationData>): Promise<void> => {
    try {
      // Get the current order
      const currentFhirRequest = await fhirClient.read('ServiceRequest' as any, orderId) as ServiceRequest;
      const currentOrder = transformFHIRServiceRequest(currentFhirRequest);
      
      // Merge updates
      const updatedOrder: OrderCreationData = {
        orderType: currentOrder.orderType,
        priority: updates.priority || currentOrder.priority,
        intent: updates.intent || currentOrder.intent,
        code: updates.code || currentOrder.code,
        display: updates.display || currentOrder.display,
        instructions: updates.instructions || currentOrder.instructions,
        reason: updates.reason || currentOrder.reason,
        medicationDetails: updates.medicationDetails || currentOrder.medicationDetails,
        specimen: updates.specimen || currentOrder.specimen,
        bodySite: updates.bodySite || currentOrder.bodySite,
        clinicalNotes: updates.clinicalNotes || currentOrder.clinicalNotes,
        expectedDate: updates.expectedDate || currentOrder.expectedCompletionDate
      };
      
      // Transform to FHIR and update
      const fhirRequest = transformToFHIRServiceRequest(updatedOrder);
      await fhirClient.update('ServiceRequest' as any, orderId, {
        ...fhirRequest,
        resourceType: 'ServiceRequest'
      });
      
      // Refresh patient resources to update all contexts
      if (currentPatient?.id) {
        await refreshPatientResources(currentPatient.id);
        await loadActiveOrders(currentPatient.id);
      }
    } catch (error) {
      throw error;
    }
  };

  /**
   * Apply order set with selected items and comprehensive result tracking
   */
  const applyOrderSet = async (
    orderSetId: string, 
    selectedOrders?: string[]
  ): Promise<OrderSetApplicationResult> => {
    if (!currentPatient) {
      throw new Error('No patient selected');
    }

    setIsProcessingOrder(true);
    try {
      const orderSet = orderSets.find(set => set.id === orderSetId);
      if (!orderSet) {
        throw new Error('Order set not found');
      }

      // Filter orders based on selection
      const ordersToCreate = selectedOrders 
        ? orderSet.orders.filter(order => selectedOrders.includes(order.linkId))
        : orderSet.orders.filter(order => order.selected);

      if (ordersToCreate.length === 0) {
        throw new Error('No orders selected');
      }

      // Create all selected orders with parallel processing
      const orderPromises = ordersToCreate.map(async (orderTemplate) => {
        const order: OrderCreationData = {
          orderType: orderTemplate.type,
          priority: orderTemplate.priority || 'routine',
          intent: 'order',
          code: orderTemplate.code,
          display: orderTemplate.display,
          instructions: orderTemplate.frequency || orderTemplate.instructions
        };

        const fhirRequest = transformToFHIRServiceRequest(order);
        
        // Add order set reference
        if (!fhirRequest.extension) fhirRequest.extension = [];
        fhirRequest.extension.push({
          url: 'http://medgenemr.com/order-set-reference',
          valueReference: {
            reference: `Questionnaire/${orderSetId}`,
            display: orderSet.name
          }
        });

        return fhirClient.create('ServiceRequest' as any, fhirRequest);
      });

      const results = await Promise.all(orderPromises);
      
      // Refresh patient resources to update all contexts
      if (currentPatient?.id) {
        await refreshPatientResources(currentPatient.id);
        await loadActiveOrders(currentPatient.id);
      }
      
      return {
        created: results.length,
        orderSetName: orderSet.name,
        orderIds: results.map(result => result.id).filter(Boolean)
      };
    } catch (error) {
      throw error;
    } finally {
      setIsProcessingOrder(false);
    }
  };

  /**
   * Clear current alerts
   */
  const clearCurrentAlerts = (): void => {
    setCurrentOrderAlerts([]);
  };

  /**
   * Search medications using external catalog API with type safety
   */
  const searchMedications = async (query: string): Promise<MedicationSearchResult[]> => {
    try {
      const response = await api.get('/api/emr/clinical/catalog/medications/search', {
        params: { query, limit: 20 }
      });
      
      return response.data.medications.map((med: any) => ({
        name: med.name,
        code: med.code,
        display: med.name,
        system: med.system || 'http://www.nlm.nih.gov/research/umls/rxnorm',
        form: med.form,
        strength: med.strength,
        manufacturer: med.manufacturer
      }));
    } catch (error) {
      // Fallback to common medications
      const fallbackMeds: MedicationSearchResult[] = [
        { name: 'Aspirin 81mg', code: '243670', display: 'Aspirin 81 MG Oral Tablet', system: 'http://www.nlm.nih.gov/research/umls/rxnorm' },
        { name: 'Metformin 500mg', code: '860974', display: 'Metformin hydrochloride 500 MG Oral Tablet', system: 'http://www.nlm.nih.gov/research/umls/rxnorm' },
        { name: 'Lisinopril 10mg', code: '314076', display: 'Lisinopril 10 MG Oral Tablet', system: 'http://www.nlm.nih.gov/research/umls/rxnorm' }
      ];
      return fallbackMeds.filter(med => med.name.toLowerCase().includes(query.toLowerCase()));
    }
  };

  /**
   * Search laboratory tests using external catalog API with type safety
   */
  const searchLaboratoryTests = async (query: string): Promise<LaboratoryTestSearchResult[]> => {
    try {
      const response = await api.get('/api/emr/clinical/catalog/lab-tests/search', {
        params: { query, limit: 20 }
      });
      
      return response.data.labTests.map((test: any) => ({
        name: test.display,
        code: test.code,
        display: test.display,
        system: test.system || 'http://loinc.org',
        category: test.category,
        specimen: test.specimen,
        method: test.method
      }));
    } catch (error) {
      // Fallback to common tests
      const fallbackTests: LaboratoryTestSearchResult[] = [
        { name: 'Complete Blood Count', code: '58410-2', display: 'Complete blood count (hemogram) panel', system: 'http://loinc.org' },
        { name: 'Basic Metabolic Panel', code: '24323-8', display: 'Comprehensive metabolic panel', system: 'http://loinc.org' },
        { name: 'Hemoglobin A1c', code: '4548-4', display: 'Hemoglobin A1c/Hemoglobin.total in Blood', system: 'http://loinc.org' }
      ];
      return fallbackTests.filter(test => test.name.toLowerCase().includes(query.toLowerCase()));
    }
  };

  /**
   * Search imaging studies using external catalog API with type safety
   */
  const searchImagingStudies = async (query: string): Promise<ImagingStudySearchResult[]> => {
    try {
      const response = await api.get('/api/emr/clinical/catalog/imaging-procedures/search', {
        params: { query, limit: 20 }
      });
      
      return response.data.imagingProcedures.map((proc: any) => ({
        name: proc.display,
        code: proc.code,
        display: proc.display,
        system: proc.system || 'http://loinc.org',
        modality: proc.modality,
        bodyRegion: proc.bodyRegion,
        contrast: proc.contrast
      }));
    } catch (error) {
      // Fallback to common procedures
      const fallbackStudies: ImagingStudySearchResult[] = [
        { name: 'Chest X-ray', code: '36643-5', display: 'Chest X-ray 2 Views', system: 'http://loinc.org' },
        { name: 'CT Head', code: '24725-4', display: 'CT Head without contrast', system: 'http://loinc.org' },
        { name: 'MRI Brain', code: '24590-2', display: 'MRI Brain without contrast', system: 'http://loinc.org' }
      ];
      return fallbackStudies.filter(study => study.name.toLowerCase().includes(query.toLowerCase()));
    }
  };

  // Context value with comprehensive typing
  const value: OrderContextType = {
    // Current state
    activeOrders,
    pendingOrders,
    orderSets,
    currentOrderAlerts,
    isProcessingOrder,

    // Order management
    loadActiveOrders,
    loadOrderSets,
    
    // Order creation
    createMedicationOrder,
    createLaboratoryOrder,
    createImagingOrder,
    
    // Order modification
    discontinueOrder,
    modifyOrder,
    
    // Order sets
    applyOrderSet,
    
    // Clinical decision support
    checkDrugInteractions,
    clearCurrentAlerts,
    
    // Search capabilities
    searchMedications,
    searchLaboratoryTests,
    searchImagingStudies,
    
    // Utility functions
    transformFHIRServiceRequest,
    transformToFHIRServiceRequest,
    getOrderTypeDisplay,
    getCategoryCodeForOrderType
  };

  return (
    <OrderContext.Provider value={value}>
      {children}
    </OrderContext.Provider>
  );
};

export default OrderContext;