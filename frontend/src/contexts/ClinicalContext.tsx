/**
 * Clinical Context Provider - TypeScript Migration
 * Manages clinical workflow state including current patient, encounter, and workspace
 * 
 * Migrated to TypeScript with comprehensive type safety for clinical data models,
 * FHIR transformations, and workspace management with real-time integration.
 */
import * as React from 'react';
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { fhirClient } from '../services/fhirClient';
import { usePatientUpdates } from '../hooks/useWebSocket';
import websocketClient from '../services/websocket';
import {
  Patient,
  Encounter,
  Condition,
  MedicationRequest,
  AllergyIntolerance
} from '../types/fhir';

/**
 * Workspace mode types for clinical interface
 */
export type WorkspaceMode = 'results' | 'chart-review' | 'orders' | 'notes' | 'imaging' | 'pharmacy' | 'encounters';

/**
 * Transformed allergy interface for UI display
 */
export interface TransformedAllergy {
  id: string;
  allergen: string;
  reaction?: string;
  severity?: string;
  criticality?: string;
  status: string;
  recordedDate?: string;
  snomed_code?: string;
}

/**
 * Transformed condition interface for UI display
 */
export interface TransformedCondition {
  id: string;
  display: string;
  clinicalStatus: string;
  clinical_status: string;
  onsetDate?: string;
  snomed_code?: string;
  icd10_code?: string;
}

/**
 * Transformed medication interface for UI display
 */
export interface TransformedMedication {
  id: string;
  medication: string;
  status: string;
  dosage?: string;
  frequency?: string;
  instructions?: string;
  authoredOn?: string;
  requester?: string;
  rxnorm_code?: string;
}

/**
 * Transformed patient interface for UI display
 */
export interface TransformedPatient {
  id: string;
  mrn?: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: string;
  race?: string;
  ethnicity?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
  email?: string;
  // Related clinical data
  allergies: TransformedAllergy[];
  problems: TransformedCondition[];
  medications: TransformedMedication[];
}

/**
 * Transformed encounter interface for UI display
 */
export interface TransformedEncounter {
  id: string;
  type?: string;
  status?: string;
  class?: string;
  startDate?: string;
  endDate?: string;
  provider?: string;
  location?: string;
  reasonCode?: string;
  reasonText?: string;
}

/**
 * Encounter creation data interface
 */
export interface EncounterCreationData {
  encounter_class?: string;
  encounter_type?: string;
  startDate?: string;
  provider?: {
    display: string;
  } | string;
  location?: {
    display: string;
  } | string;
  reasonCode?: string;
  reasonText?: string;
}

/**
 * Real-time update interface
 */
export interface RealTimeUpdate {
  id: string;
  type: string;
  action: 'created' | 'updated' | 'deleted';
  resource: any;
  timestamp: string;
}

/**
 * Clinical context interface
 */
export interface ClinicalContextType {
  // Current state
  currentPatient: TransformedPatient | null;
  currentEncounter: TransformedEncounter | null;
  currentNote: any | null;
  workspaceMode: WorkspaceMode;
  isLoading: boolean;
  wsConnected: boolean;
  realTimeUpdates: RealTimeUpdate[];

  // State setters
  setCurrentPatient: (patient: TransformedPatient | null) => void;
  setCurrentEncounter: (encounter: TransformedEncounter | null) => void;
  setCurrentNote: (note: any | null) => void;
  setWorkspaceMode: (mode: WorkspaceMode) => void;

  // Data operations
  loadPatient: (patientId: string) => Promise<TransformedPatient>;
  loadEncounter: (encounterId: string) => Promise<TransformedEncounter>;
  createEncounter: (encounterData: EncounterCreationData) => Promise<TransformedEncounter>;
  refreshPatientData: () => Promise<void>;
  clearClinicalContext: () => void;
}

/**
 * Create clinical context with proper typing
 */
const ClinicalContext = createContext<ClinicalContextType | undefined>(undefined);

/**
 * Custom hook to use clinical context with type safety
 */
export const useClinical = (): ClinicalContextType => {
  const context = useContext(ClinicalContext);
  if (!context) {
    throw new Error('useClinical must be used within a ClinicalProvider');
  }
  return context;
};

/**
 * Clinical provider props interface
 */
export interface ClinicalProviderProps {
  children: ReactNode;
}

/**
 * Clinical provider component with comprehensive type safety
 */
export const ClinicalProvider: React.FC<ClinicalProviderProps> = ({ children }) => {
  const { getCurrentUser } = useAuth();
  const currentUser = getCurrentUser();
  const [currentPatient, setCurrentPatient] = useState<TransformedPatient | null>(null);
  const [currentEncounter, setCurrentEncounter] = useState<TransformedEncounter | null>(null);
  const [currentNote, setCurrentNote] = useState<any | null>(null);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('results');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [realTimeUpdates, setRealTimeUpdates] = useState<RealTimeUpdate[]>([]);

  // Use WebSocket hook for patient updates
  const { connected: wsConnected } = usePatientUpdates(
    currentPatient?.id || '',
    { enabled: !!currentPatient }
  ) as any;

  // Initialize WebSocket connection
  useEffect(() => {
    if (currentUser) {
      // Note: WebSocket connection typically requires a token, but we'll use currentUser check
      websocketClient.connect('').catch(() => {
        // Silent error handling for WebSocket connection
      });
    }
    return () => {
      if (!currentUser) {
        websocketClient.disconnect();
      }
    };
  }, [currentUser]);

  /**
   * Helper function to transform FHIR Patient to UI interface
   */
  const transformFHIRPatient = (fhirPatient: Patient): TransformedPatient => {
    const name = fhirPatient.name?.[0] || {};
    const address = fhirPatient.address?.[0] || {};
    const telecom = fhirPatient.telecom || [];
    
    // Extract phone and email
    const phone = telecom.find(t => t.system === 'phone')?.value;
    const email = telecom.find(t => t.system === 'email')?.value;
    
    // Extract MRN from identifiers
    const mrn = fhirPatient.identifier?.find(id => 
      id.type?.coding?.[0]?.code === 'MR' || 
      id.system?.includes('mrn')
    )?.value || fhirPatient.identifier?.[0]?.value;

    return {
      id: fhirPatient.id!,
      mrn: mrn,
      firstName: name.given?.join(' ') || '',
      lastName: name.family || '',
      dateOfBirth: fhirPatient.birthDate,
      gender: fhirPatient.gender,
      race: fhirPatient.extension?.find(ext => 
        ext.url?.includes('race')
      )?.valueCodeableConcept?.text,
      ethnicity: fhirPatient.extension?.find(ext => 
        ext.url?.includes('ethnicity')
      )?.valueCodeableConcept?.text,
      address: address.line?.join(', ') || '',
      city: address.city,
      state: address.state,
      zipCode: address.postalCode,
      phone: phone,
      email: email,
      // These will be loaded separately
      allergies: [],
      problems: [],
      medications: []
    };
  };

  /**
   * Helper function to transform FHIR Encounter to UI interface
   */
  const transformFHIREncounter = (fhirEncounter: Encounter): TransformedEncounter => {
    const type = fhirEncounter.type?.[0];
    const period = fhirEncounter.period || {};
    const location = fhirEncounter.location?.[0]?.location;
    const participant = fhirEncounter.participant?.find(p => 
      p.type?.[0]?.coding?.[0]?.code === 'ATND' ||
      p.type?.[0]?.coding?.[0]?.code === 'PPRF'
    );

    return {
      id: fhirEncounter.id!,
      type: type?.text || type?.coding?.[0]?.display,
      status: fhirEncounter.status,
      class: fhirEncounter.class?.display || fhirEncounter.class?.code,
      startDate: period.start,
      endDate: period.end,
      provider: participant?.individual?.display,
      location: location?.display,
      reasonCode: fhirEncounter.reasonCode?.[0]?.coding?.[0]?.code,
      reasonText: fhirEncounter.reasonCode?.[0]?.text
    };
  };

  /**
   * Load patient data with comprehensive FHIR resource loading
   */
  const loadPatient = useCallback(async (patientId: string): Promise<TransformedPatient> => {
    setIsLoading(true);
    try {
      // Load patient basic info
      const patientResult = await fhirClient.getPatient(patientId);
      const patient = transformFHIRPatient(patientResult);
      
      // Load related clinical data in parallel
      const [allergiesResult, conditionsResult, medicationsResult] = await Promise.all([
        fhirClient.getAllergies(patientId),
        fhirClient.getConditions(patientId),
        fhirClient.getMedications(patientId)
      ]);
      
      // Transform allergies
      patient.allergies = allergiesResult.resources.map((allergy: AllergyIntolerance) => ({
        id: allergy.id!,
        allergen: allergy.code?.text || allergy.code?.coding?.[0]?.display || 'Unknown',
        reaction: allergy.reaction?.[0]?.manifestation?.[0]?.text,
        severity: allergy.reaction?.[0]?.severity,
        criticality: allergy.criticality,
        status: allergy.clinicalStatus?.coding?.[0]?.code || 'active',
        recordedDate: allergy.recordedDate,
        snomed_code: allergy.code?.coding?.find(c => c.system?.includes('snomed'))?.code
      }));
      
      // Transform conditions
      patient.problems = conditionsResult.resources.map((condition: Condition) => ({
        id: condition.id!,
        display: condition.code?.text || condition.code?.coding?.[0]?.display || 'Unknown',
        clinicalStatus: condition.clinicalStatus?.coding?.[0]?.code || 'active',
        clinical_status: condition.clinicalStatus?.coding?.[0]?.code || 'active',
        onsetDate: condition.onsetDateTime || condition.onsetPeriod?.start,
        snomed_code: condition.code?.coding?.find(c => c.system?.includes('snomed'))?.code,
        icd10_code: condition.code?.coding?.find(c => c.system?.includes('icd') || c.system?.includes('ICD'))?.code
      }));
      
      // Transform medications
      patient.medications = medicationsResult.resources.map((med: MedicationRequest) => {
        // Extract medication name - check multiple possible locations
        let medicationName = 'Unknown';
        const medAny = med as any;
        
        // Check for 'medication' field (used in some FHIR versions)
        if (medAny.medication?.text) {
          medicationName = medAny.medication.text;
        } else if (medAny.medication?.coding?.[0]?.display) {
          medicationName = medAny.medication.coding[0].display;
        } else if (med.medicationCodeableConcept?.text) {
          medicationName = med.medicationCodeableConcept.text;
        } else if (med.medicationCodeableConcept?.coding?.[0]?.display) {
          medicationName = med.medicationCodeableConcept.coding[0].display;
        } else if (medAny.medicationReference?.display) {
          // Handle medicationReference if used
          medicationName = medAny.medicationReference.display;
        } else if (medAny.contained?.[0]?.code?.text) {
          // Sometimes medication details are in contained resources
          medicationName = medAny.contained[0].code.text;
        } else if (medAny.contained?.[0]?.code?.coding?.[0]?.display) {
          medicationName = medAny.contained[0].code.coding[0].display;
        }
        
        // Extract dosage information
        let dosage = '';
        if (med.dosageInstruction?.[0]?.text) {
          // Use the text if available (more human-readable)
          dosage = med.dosageInstruction[0].text;
        } else if (med.dosageInstruction?.[0]?.doseAndRate?.[0]?.doseQuantity) {
          const dose = med.dosageInstruction[0].doseAndRate[0].doseQuantity;
          dosage = `${dose.value} ${dose.unit || ''}`.trim();
        } else if (med.dosageInstruction?.[0]?.doseAndRate?.[0]?.doseRange) {
          // Handle dose ranges
          const range = med.dosageInstruction[0].doseAndRate[0].doseRange;
          dosage = `${range.low?.value || ''}-${range.high?.value || ''} ${range.low?.unit || ''}`.trim();
        }
        
        // Extract frequency information
        let frequency = '';
        if (med.dosageInstruction?.[0]?.timing?.code?.text) {
          // Use timing code text if available
          frequency = med.dosageInstruction[0].timing.code.text;
        } else if (med.dosageInstruction?.[0]?.timing?.repeat?.frequency) {
          // Build frequency from repeat information
          const repeat = med.dosageInstruction[0].timing.repeat;
          frequency = `${repeat.frequency} times`;
          if (repeat.period && repeat.periodUnit) {
            frequency += ` per ${repeat.period} ${repeat.periodUnit}${repeat.period > 1 ? 's' : ''}`;
          }
        }
        
        return {
          id: med.id!,
          medication: medicationName,
          status: med.status || 'unknown',
          dosage: dosage,
          frequency: frequency,
          instructions: med.dosageInstruction?.[0]?.patientInstruction,
          authoredOn: med.authoredOn,
          requester: med.requester?.display,
          rxnorm_code: med.medicationCodeableConcept?.coding?.find(c => 
            c.system?.includes('rxnorm')
          )?.code
        };
      });
      
      setCurrentPatient(patient);
      return patient;
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Load encounter data
   */
  const loadEncounter = useCallback(async (encounterId: string): Promise<TransformedEncounter> => {
    try {
      const encounterResult = await fhirClient.read<Encounter>('Encounter', encounterId);
      const encounter = transformFHIREncounter(encounterResult);
      setCurrentEncounter(encounter);
      return encounter;
    } catch (error) {
      throw error;
    }
  }, []);

  /**
   * Create new encounter
   */
  const createEncounter = useCallback(async (encounterData: EncounterCreationData): Promise<TransformedEncounter> => {
    if (!currentPatient) {
      throw new Error('No patient selected');
    }

    try {
      const patientId = currentPatient.id;
      
      // Create FHIR Encounter resource
      const fhirEncounter: Partial<Encounter> = {
        resourceType: 'Encounter',
        status: 'planned' as any,
        class: {
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: encounterData.encounter_class || 'AMB',
          display: encounterData.encounter_class === 'IMP' ? 'Inpatient' : 'Ambulatory'
        },
        type: [{
          text: encounterData.encounter_type || 'Office Visit'
        }],
        subject: { reference: `Patient/${patientId}` },
        period: {
          start: encounterData.startDate || new Date().toISOString()
        }
      };
      
      // Add provider if specified
      if (encounterData.provider) {
        fhirEncounter.participant = [{
          type: [{
            coding: [{
              system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
              code: 'ATND',
              display: 'Attender'
            }]
          }],
          individual: {
            display: typeof encounterData.provider === 'string' 
              ? encounterData.provider 
              : encounterData.provider.display
          }
        }];
      }
      
      // Add location if specified
      if (encounterData.location) {
        fhirEncounter.location = [{
          location: {
            display: typeof encounterData.location === 'string'
              ? encounterData.location
              : encounterData.location.display
          }
        }];
      }
      
      const result = await fhirClient.create('Encounter', fhirEncounter);
      const newEncounter = transformFHIREncounter((result.resource as Encounter) || (fhirEncounter as Encounter));
      newEncounter.id = result.id;
      
      setCurrentEncounter(newEncounter);
      return newEncounter;
    } catch (error) {
      throw error;
    }
  }, [currentPatient]);

  /**
   * Refresh current patient data
   */
  const refreshPatientData = useCallback(async (): Promise<void> => {
    if (currentPatient?.id) {
      await loadPatient(currentPatient.id);
    }
  }, [currentPatient?.id, loadPatient]);

  /**
   * Clear all clinical context
   */
  const clearClinicalContext = useCallback((): void => {
    setCurrentPatient(null);
    setCurrentEncounter(null);
    setCurrentNote(null);
    setRealTimeUpdates([]);
  }, []);

  const value: ClinicalContextType = {
    currentPatient,
    currentEncounter,
    currentNote,
    workspaceMode,
    isLoading,
    wsConnected,
    realTimeUpdates,
    setCurrentPatient,
    setCurrentEncounter,
    setCurrentNote,
    setWorkspaceMode,
    loadPatient,
    loadEncounter,
    createEncounter,
    refreshPatientData,
    clearClinicalContext
  };

  return (
    <ClinicalContext.Provider value={value}>
      {children}
    </ClinicalContext.Provider>
  );
};

export default ClinicalProvider;