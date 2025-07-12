/**
 * FHIR R4 Type Definitions for MedGenEMR
 * 
 * This file exports all FHIR types needed by the application and provides
 * custom extensions and utilities for working with FHIR resources.
 */

// Import core FHIR R4 types from @ahryman40k/ts-fhir-types
export {
  // Core resources used in MedGenEMR
  Patient,
  Observation,
  Condition,
  MedicationRequest,
  MedicationDispense,
  AllergyIntolerance,
  Immunization,
  Procedure,
  DiagnosticReport,
  ServiceRequest,
  Encounter,
  CarePlan,
  CareTeam,
  DocumentReference,
  ImagingStudy,
  Practitioner,
  Organization,
  
  // Bundle and search
  Bundle,
  BundleEntry,
  
  // Common data types
  HumanName,
  Address,
  ContactPoint,
  Identifier,
  CodeableConcept,
  Coding,
  Quantity,
  Period,
  Reference,
  Meta,
  
  // Base resource type
  Resource,
  DomainResource,
  
  // Operation outcomes
  OperationOutcome,
  OperationOutcomeIssue,
  
} from '@ahryman40k/ts-fhir-types/lib/R4';

// Re-export R4 types for validation
import * as R4 from '@ahryman40k/ts-fhir-types/lib/R4';
export { R4 };

// Custom type definitions for MedGenEMR

/**
 * FHIR Resource types commonly used in the application
 */
export type FHIRResourceType = 
  | 'Patient'
  | 'Observation' 
  | 'Condition'
  | 'MedicationRequest'
  | 'MedicationDispense'
  | 'AllergyIntolerance'
  | 'Immunization'
  | 'Procedure'
  | 'DiagnosticReport'
  | 'ServiceRequest'
  | 'Encounter'
  | 'CarePlan'
  | 'CareTeam'
  | 'DocumentReference'
  | 'ImagingStudy'
  | 'Practitioner'
  | 'Organization';

/**
 * Search parameters interface for FHIR API calls
 */
export interface FHIRSearchParams {
  [key: string]: string | number | boolean | undefined;
  _count?: number;
  _offset?: number;
  _sort?: string;
  _include?: string;
  _revinclude?: string;
  patient?: string;
  subject?: string;
  code?: string;
  category?: string;
  status?: string;
  date?: string;
  _lastUpdated?: string;
}

/**
 * Bundle types used in MedGenEMR
 */
export type BundleType = 'searchset' | 'collection' | 'transaction' | 'batch';

/**
 * FHIR API Response wrapper
 */
export interface FHIRResponse<T = Resource> {
  resourceType: string;
  id?: string;
  meta?: Meta;
  resource?: T;
}

/**
 * Bundle response with proper typing
 */
export interface FHIRBundle extends Bundle {
  resourceType: 'Bundle';
  type: BundleType;
  entry?: FHIRBundleEntry[];
  total?: number;
  link?: BundleLink[];
}

export interface FHIRBundleEntry extends BundleEntry {
  resource?: Resource;
  fullUrl?: string;
  search?: {
    mode?: 'match' | 'include' | 'outcome';
    score?: number;
  };
}

export interface BundleLink {
  relation: string;
  url: string;
}

/**
 * Clinical workflow event types
 */
export interface ClinicalEvent {
  type: string;
  resourceType: FHIRResourceType;
  resourceId: string;
  patientId?: string;
  data?: any;
  timestamp: Date;
}

/**
 * Patient-centered resource collection
 */
export interface PatientResources {
  patient: Patient;
  observations?: Observation[];
  conditions?: Condition[];
  medications?: MedicationRequest[];
  allergies?: AllergyIntolerance[];
  immunizations?: Immunization[];
  procedures?: Procedure[];
  diagnosticReports?: DiagnosticReport[];
  serviceRequests?: ServiceRequest[];
  encounters?: Encounter[];
  carePlans?: CarePlan[];
  careTeams?: CareTeam[];
  documents?: DocumentReference[];
  imagingStudies?: ImagingStudy[];
}

/**
 * FHIR Validation Result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  resource?: Resource;
}

/**
 * Type guards for runtime validation
 */

export function isPatient(resource: any): resource is Patient {
  return resource && resource.resourceType === 'Patient';
}

export function isObservation(resource: any): resource is Observation {
  return resource && resource.resourceType === 'Observation';
}

export function isCondition(resource: any): resource is Condition {
  return resource && resource.resourceType === 'Condition';
}

export function isMedicationRequest(resource: any): resource is MedicationRequest {
  return resource && resource.resourceType === 'MedicationRequest';
}

export function isMedicationDispense(resource: any): resource is MedicationDispense {
  return resource && resource.resourceType === 'MedicationDispense';
}

export function isAllergyIntolerance(resource: any): resource is AllergyIntolerance {
  return resource && resource.resourceType === 'AllergyIntolerance';
}

export function isImmunization(resource: any): resource is Immunization {
  return resource && resource.resourceType === 'Immunization';
}

export function isProcedure(resource: any): resource is Procedure {
  return resource && resource.resourceType === 'Procedure';
}

export function isDiagnosticReport(resource: any): resource is DiagnosticReport {
  return resource && resource.resourceType === 'DiagnosticReport';
}

export function isServiceRequest(resource: any): resource is ServiceRequest {
  return resource && resource.resourceType === 'ServiceRequest';
}

export function isEncounter(resource: any): resource is Encounter {
  return resource && resource.resourceType === 'Encounter';
}

export function isBundle(resource: any): resource is Bundle {
  return resource && resource.resourceType === 'Bundle';
}

/**
 * Utility function to extract resource from bundle entry
 */
export function extractResource<T extends Resource>(entry: BundleEntry): T | null {
  return entry.resource as T || null;
}

/**
 * Utility function to get all resources of a specific type from a bundle
 */
export function getResourcesByType<T extends Resource>(
  bundle: Bundle, 
  resourceType: FHIRResourceType
): T[] {
  if (!bundle.entry) return [];
  
  return bundle.entry
    .filter(entry => entry.resource?.resourceType === resourceType)
    .map(entry => entry.resource as T)
    .filter(Boolean);
}

/**
 * Reference resolution utilities
 */
export interface ResolvedReference<T = Resource> {
  reference: string;
  resource?: T;
  display?: string;
}

export function parseReference(reference: string): { resourceType: string; id: string } | null {
  if (!reference) return null;
  
  // Handle both 'ResourceType/id' and 'urn:uuid:id' formats
  if (reference.startsWith('urn:uuid:')) {
    return { resourceType: '', id: reference.replace('urn:uuid:', '') };
  }
  
  const parts = reference.split('/');
  if (parts.length === 2) {
    return { resourceType: parts[0], id: parts[1] };
  }
  
  return null;
}

/**
 * Common FHIR value extractors
 */
export function getCodeDisplay(codeableConcept?: CodeableConcept): string {
  if (!codeableConcept) return '';
  
  if (codeableConcept.text) return codeableConcept.text;
  
  if (codeableConcept.coding && codeableConcept.coding.length > 0) {
    const coding = codeableConcept.coding[0];
    return coding.display || coding.code || '';
  }
  
  return '';
}

export function getHumanNameDisplay(name?: HumanName[]): string {
  if (!name || name.length === 0) return '';
  
  const primaryName = name[0];
  const parts: string[] = [];
  
  if (primaryName.given) {
    parts.push(...primaryName.given);
  }
  
  if (primaryName.family) {
    parts.push(primaryName.family);
  }
  
  return parts.join(' ') || primaryName.text || '';
}

export function getIdentifierValue(identifiers?: Identifier[], system?: string): string {
  if (!identifiers || identifiers.length === 0) return '';
  
  if (system) {
    const identifier = identifiers.find(id => id.system === system);
    return identifier?.value || '';
  }
  
  return identifiers[0]?.value || '';
}