/**
 * FHIR Reference Validation Library - TypeScript Migration
 * Comprehensive validation utilities for FHIR resources and references
 * 
 * Migrated to TypeScript with complete type safety for FHIR R4 validation,
 * using @ahryman40k/ts-fhir-types for strict compliance with FHIR specifications.
 */

import {
  Resource,
  BundleEntry,
  Patient,
  Condition,
  MedicationRequest,
  Observation,
  HumanName,
  OperationOutcome,
  OperationOutcomeIssue,
} from '../types/fhir';

// FHIR Resource Type Registry
export const FHIR_RESOURCE_TYPES = [
  'Account', 'ActivityDefinition', 'AdverseEvent', 'AllergyIntolerance', 'Appointment',
  'AppointmentResponse', 'AuditEvent', 'Basic', 'Binary', 'BiologicallyDerivedProduct',
  'BodyStructure', 'Bundle', 'CapabilityStatement', 'CarePlan', 'CareTeam',
  'CatalogEntry', 'ChargeItem', 'ChargeItemDefinition', 'Claim', 'ClaimResponse',
  'ClinicalImpression', 'CodeSystem', 'Communication', 'CommunicationRequest', 'CompartmentDefinition',
  'Composition', 'ConceptMap', 'Condition', 'Consent', 'Contract', 'Coverage',
  'CoverageEligibilityRequest', 'CoverageEligibilityResponse', 'DetectedIssue', 'Device',
  'DeviceDefinition', 'DeviceMetric', 'DeviceRequest', 'DeviceUseStatement', 'DiagnosticReport',
  'DocumentManifest', 'DocumentReference', 'Encounter', 'Endpoint', 'EnrollmentRequest',
  'EnrollmentResponse', 'EpisodeOfCare', 'EventDefinition', 'Evidence', 'EvidenceVariable',
  'ExampleScenario', 'ExplanationOfBenefit', 'FamilyMemberHistory', 'Flag', 'Goal',
  'GraphDefinition', 'Group', 'GuidanceResponse', 'HealthcareService', 'ImagingStudy',
  'Immunization', 'ImmunizationEvaluation', 'ImmunizationRecommendation', 'ImplementationGuide',
  'InsurancePlan', 'Invoice', 'Library', 'Linkage', 'List', 'Location', 'Measure',
  'MeasureReport', 'Media', 'Medication', 'MedicationAdministration', 'MedicationDispense',
  'MedicationKnowledge', 'MedicationRequest', 'MedicationStatement', 'MedicinalProduct',
  'MedicinalProductAuthorization', 'MedicinalProductContraindication', 'MedicinalProductIndication',
  'MedicinalProductIngredient', 'MedicinalProductInteraction', 'MedicinalProductManufactured',
  'MedicinalProductPackaged', 'MedicinalProductPharmaceutical', 'MedicinalProductUndesirableEffect',
  'MessageDefinition', 'MessageHeader', 'MolecularSequence', 'NamingSystem', 'NutritionOrder',
  'Observation', 'ObservationDefinition', 'OperationDefinition', 'OperationOutcome', 'Organization',
  'OrganizationAffiliation', 'Parameters', 'Patient', 'PaymentNotice', 'PaymentReconciliation',
  'Person', 'PlanDefinition', 'Practitioner', 'PractitionerRole', 'Procedure', 'Provenance',
  'Questionnaire', 'QuestionnaireResponse', 'RelatedPerson', 'RequestGroup', 'ResearchDefinition',
  'ResearchElementDefinition', 'ResearchStudy', 'ResearchSubject', 'RiskAssessment', 'RiskEvidenceSynthesis',
  'Schedule', 'SearchParameter', 'ServiceRequest', 'Slot', 'Specimen', 'SpecimenDefinition',
  'StructureDefinition', 'StructureMap', 'Subscription', 'Substance', 'SubstanceNucleicAcid',
  'SubstancePolymer', 'SubstanceProtein', 'SubstanceReferenceInformation', 'SubstanceSourceMaterial',
  'SubstanceSpecification', 'SupplyDelivery', 'SupplyRequest', 'Task', 'TerminologyCapabilities',
  'TestReport', 'TestScript', 'ValueSet', 'VerificationResult', 'VisionPrescription'
] as const;

export type FHIRResourceType = typeof FHIR_RESOURCE_TYPES[number];

// Common validation patterns
export const VALIDATION_PATTERNS = {
  id: /^[A-Za-z0-9\-.]{1,64}$/,
  uri: /^[a-z][a-z0-9+.-]*:\/\/[^\s]*$/i,
  url: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)$/,
  code: /^[^\s]+(\s[^\s]+)*$/,
  dateTime: /^\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?)?)?$/,
  date: /^\d{4}(-\d{2}(-\d{2})?)?$/,
  time: /^\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/,
  decimal: /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/,
  integer: /^-?(0|[1-9]\d*)$/,
  positiveInt: /^[1-9]\d*$/,
  unsignedInt: /^0|([1-9]\d*)$/,
  base64Binary: /^[A-Za-z0-9+/]*={0,2}$/,
  instant: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/,
  oid: /^urn:oid:[0-2](\.(0|[1-9]\d*))*$/,
  uuid: /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  canonical: /^[a-z][a-z0-9+.-]*:\/\/[^\s]*$/i
} as const;

/**
 * Validation error severity levels
 */
export type ValidationSeverity = 'error' | 'warning' | 'information';

/**
 * Validation error codes
 */
export type ValidationErrorCode = 
  | 'processing'
  | 'required'
  | 'structure'
  | 'value'
  | 'invariant'
  | 'business-rule'
  | 'invalid';

/**
 * Validation error class
 */
export class FHIRValidationError extends Error {
  public readonly path: string;
  public readonly severity: ValidationSeverity;
  public readonly code: ValidationErrorCode | null;

  constructor(
    message: string, 
    path: string, 
    severity: ValidationSeverity = 'error', 
    code: ValidationErrorCode | null = null
  ) {
    super(message);
    this.name = 'FHIRValidationError';
    this.path = path;
    this.severity = severity;
    this.code = code;
    
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FHIRValidationError);
    }
  }
}

/**
 * Validation result class
 */
export class ValidationResult {
  public errors: FHIRValidationError[] = [];
  public warnings: FHIRValidationError[] = [];
  public information: FHIRValidationError[] = [];

  addError(message: string, path: string, code: ValidationErrorCode | null = null): void {
    this.errors.push(new FHIRValidationError(message, path, 'error', code));
  }

  addWarning(message: string, path: string, code: ValidationErrorCode | null = null): void {
    this.warnings.push(new FHIRValidationError(message, path, 'warning', code));
  }

  addInfo(message: string, path: string, code: ValidationErrorCode | null = null): void {
    this.information.push(new FHIRValidationError(message, path, 'information', code));
  }

  get isValid(): boolean {
    return this.errors.length === 0;
  }

  get hasWarnings(): boolean {
    return this.warnings.length > 0;
  }

  get totalIssues(): number {
    return this.errors.length + this.warnings.length + this.information.length;
  }

  getIssuesByPath(path: string): FHIRValidationError[] {
    const allIssues = [...this.errors, ...this.warnings, ...this.information];
    return allIssues.filter(issue => issue.path === path || issue.path.startsWith(path + '.'));
  }

  toOperationOutcome(): OperationOutcome {
    const issues: OperationOutcomeIssue[] = [];
    
    [...this.errors, ...this.warnings, ...this.information].forEach(issue => {
      issues.push({
        severity: issue.severity,
        code: issue.code || 'processing',
        details: {
          text: issue.message
        },
        expression: [issue.path]
      } as OperationOutcomeIssue);
    });

    return {
      resourceType: 'OperationOutcome',
      issue: issues
    };
  }
}

/**
 * Validator options interface
 */
export interface FHIRValidatorOptions {
  strictMode?: boolean;
  validateReferences?: boolean;
  validateCoding?: boolean;
  validateProfiles?: boolean;
}

/**
 * Core FHIR validator class
 */
export class FHIRValidator {
  private options: Required<FHIRValidatorOptions>;

  constructor(options: FHIRValidatorOptions = {}) {
    this.options = {
      strictMode: false,
      validateReferences: true,
      validateCoding: true,
      validateProfiles: false,
      ...options
    };
  }

  /**
   * Validate a FHIR resource
   */
  validateResource(resource: any): ValidationResult {
    const result = new ValidationResult();
    
    if (!resource) {
      result.addError('Resource is null or undefined', '', 'required');
      return result;
    }

    if (typeof resource !== 'object') {
      result.addError('Resource must be an object', '', 'structure');
      return result;
    }

    // Validate resourceType
    this.validateResourceType(resource, result);
    
    // Validate id
    if (resource.id !== undefined) {
      this.validateId(resource.id, 'id', result);
    }

    // Validate meta
    if (resource.meta) {
      this.validateMeta(resource.meta, 'meta', result);
    }

    // Validate implicit rules
    if (resource.implicitRules) {
      this.validateUri(resource.implicitRules, 'implicitRules', result);
    }

    // Validate language
    if (resource.language) {
      this.validateCode(resource.language, 'language', result);
    }

    // Resource-specific validation
    this.validateResourceSpecific(resource, result);

    return result;
  }

  /**
   * Validate resource type
   */
  private validateResourceType(resource: any, result: ValidationResult): void {
    if (!resource.resourceType) {
      result.addError('Missing required field: resourceType', 'resourceType', 'required');
      return;
    }

    if (!FHIR_RESOURCE_TYPES.includes(resource.resourceType as FHIRResourceType)) {
      result.addError(`Invalid resourceType: ${resource.resourceType}`, 'resourceType', 'value');
    }
  }

  /**
   * Validate FHIR id
   */
  validateId(value: any, path: string, result: ValidationResult): void {
    if (typeof value !== 'string') {
      result.addError(`${path} must be a string`, path, 'structure');
      return;
    }

    if (!VALIDATION_PATTERNS.id.test(value)) {
      result.addError(`${path} must match pattern [A-Za-z0-9\\-\\.]{1,64}`, path, 'value');
    }
  }

  /**
   * Validate meta element
   */
  validateMeta(meta: any, path: string, result: ValidationResult): void {
    if (meta.versionId !== undefined) {
      this.validateId(meta.versionId, `${path}.versionId`, result);
    }

    if (meta.lastUpdated !== undefined) {
      this.validateInstant(meta.lastUpdated, `${path}.lastUpdated`, result);
    }

    if (meta.source !== undefined) {
      this.validateUri(meta.source, `${path}.source`, result);
    }

    if (meta.profile) {
      if (Array.isArray(meta.profile)) {
        meta.profile.forEach((profile: any, index: number) => {
          this.validateCanonical(profile, `${path}.profile[${index}]`, result);
        });
      } else {
        result.addError(`${path}.profile must be an array`, `${path}.profile`, 'structure');
      }
    }

    if (meta.security) {
      if (Array.isArray(meta.security)) {
        meta.security.forEach((coding: any, index: number) => {
          this.validateCoding(coding, `${path}.security[${index}]`, result);
        });
      } else {
        result.addError(`${path}.security must be an array`, `${path}.security`, 'structure');
      }
    }

    if (meta.tag) {
      if (Array.isArray(meta.tag)) {
        meta.tag.forEach((coding: any, index: number) => {
          this.validateCoding(coding, `${path}.tag[${index}]`, result);
        });
      } else {
        result.addError(`${path}.tag must be an array`, `${path}.tag`, 'structure');
      }
    }
  }

  /**
   * Validate FHIR reference
   */
  validateReference(reference: any, path: string, result: ValidationResult): void {
    if (!reference) {
      result.addError('Reference is null or undefined', path, 'required');
      return;
    }

    if (typeof reference !== 'object') {
      result.addError('Reference must be an object', path, 'structure');
      return;
    }

    // Must have either reference, identifier, or display
    if (!reference.reference && !reference.identifier && !reference.display) {
      result.addError('Reference must have at least one of: reference, identifier, display', path, 'required');
    }

    // Validate reference string
    if (reference.reference !== undefined) {
      this.validateReferenceString(reference.reference, `${path}.reference`, result);
    }

    // Validate identifier
    if (reference.identifier !== undefined) {
      this.validateIdentifier(reference.identifier, `${path}.identifier`, result);
    }

    // Validate display
    if (reference.display !== undefined) {
      this.validateString(reference.display, `${path}.display`, result);
    }

    // Validate type
    if (reference.type !== undefined) {
      this.validateUri(reference.type, `${path}.type`, result);
    }
  }

  /**
   * Validate reference string format
   */
  private validateReferenceString(reference: any, path: string, result: ValidationResult): void {
    if (typeof reference !== 'string') {
      result.addError(`${path} must be a string`, path, 'structure');
      return;
    }

    // Check for absolute URL
    if (reference.startsWith('http://') || reference.startsWith('https://')) {
      if (!VALIDATION_PATTERNS.url.test(reference)) {
        result.addError(`${path} contains invalid URL`, path, 'value');
      }
      return;
    }

    // Check for URN
    if (reference.startsWith('urn:')) {
      if (!VALIDATION_PATTERNS.uuid.test(reference) && !VALIDATION_PATTERNS.oid.test(reference)) {
        result.addError(`${path} contains invalid URN`, path, 'value');
      }
      return;
    }

    // Check for relative reference (ResourceType/id)
    const relativeParts = reference.split('/');
    if (relativeParts.length === 2) {
      const [resourceType, id] = relativeParts;
      
      if (!FHIR_RESOURCE_TYPES.includes(resourceType as FHIRResourceType)) {
        result.addWarning(`${path} references unknown resource type: ${resourceType}`, path);
      }
      
      if (!VALIDATION_PATTERNS.id.test(id)) {
        result.addError(`${path} contains invalid resource id: ${id}`, path, 'value');
      }
    } else if (relativeParts.length > 2) {
      // Could be ResourceType/id/_history/vid
      const [resourceType, id, ...rest] = relativeParts;
      
      if (!FHIR_RESOURCE_TYPES.includes(resourceType as FHIRResourceType)) {
        result.addWarning(`${path} references unknown resource type: ${resourceType}`, path);
      }
      
      if (!VALIDATION_PATTERNS.id.test(id)) {
        result.addError(`${path} contains invalid resource id: ${id}`, path, 'value');
      }

      if (rest.length >= 2 && rest[0] === '_history') {
        if (!VALIDATION_PATTERNS.id.test(rest[1])) {
          result.addError(`${path} contains invalid version id: ${rest[1]}`, path, 'value');
        }
      }
    } else {
      result.addError(`${path} is not a valid reference format`, path, 'value');
    }
  }

  /**
   * Validate coding
   */
  validateCoding(coding: any, path: string, result: ValidationResult): void {
    if (!coding || typeof coding !== 'object') {
      result.addError('Coding must be an object', path, 'structure');
      return;
    }

    if (coding.system !== undefined) {
      this.validateUri(coding.system, `${path}.system`, result);
    }

    if (coding.version !== undefined) {
      this.validateString(coding.version, `${path}.version`, result);
    }

    if (coding.code !== undefined) {
      this.validateCode(coding.code, `${path}.code`, result);
    }

    if (coding.display !== undefined) {
      this.validateString(coding.display, `${path}.display`, result);
    }

    if (coding.userSelected !== undefined) {
      this.validateBoolean(coding.userSelected, `${path}.userSelected`, result);
    }
  }

  /**
   * Validate identifier
   */
  validateIdentifier(identifier: any, path: string, result: ValidationResult): void {
    if (!identifier || typeof identifier !== 'object') {
      result.addError('Identifier must be an object', path, 'structure');
      return;
    }

    if (identifier.use !== undefined) {
      const validUses = ['usual', 'official', 'temp', 'secondary', 'old'];
      if (!validUses.includes(identifier.use)) {
        result.addError(`${path}.use must be one of: ${validUses.join(', ')}`, `${path}.use`, 'value');
      }
    }

    if (identifier.type !== undefined) {
      this.validateCodeableConcept(identifier.type, `${path}.type`, result);
    }

    if (identifier.system !== undefined) {
      this.validateUri(identifier.system, `${path}.system`, result);
    }

    if (identifier.value !== undefined) {
      this.validateString(identifier.value, `${path}.value`, result);
    }

    if (identifier.period !== undefined) {
      this.validatePeriod(identifier.period, `${path}.period`, result);
    }

    if (identifier.assigner !== undefined) {
      this.validateReference(identifier.assigner, `${path}.assigner`, result);
    }
  }

  /**
   * Validate CodeableConcept
   */
  validateCodeableConcept(concept: any, path: string, result: ValidationResult): void {
    if (!concept || typeof concept !== 'object') {
      result.addError('CodeableConcept must be an object', path, 'structure');
      return;
    }

    if (concept.coding) {
      if (Array.isArray(concept.coding)) {
        concept.coding.forEach((coding: any, index: number) => {
          this.validateCoding(coding, `${path}.coding[${index}]`, result);
        });
      } else {
        result.addError(`${path}.coding must be an array`, `${path}.coding`, 'structure');
      }
    }

    if (concept.text !== undefined) {
      this.validateString(concept.text, `${path}.text`, result);
    }
  }

  /**
   * Validate Period
   */
  validatePeriod(period: any, path: string, result: ValidationResult): void {
    if (!period || typeof period !== 'object') {
      result.addError('Period must be an object', path, 'structure');
      return;
    }

    if (period.start !== undefined) {
      this.validateDateTime(period.start, `${path}.start`, result);
    }

    if (period.end !== undefined) {
      this.validateDateTime(period.end, `${path}.end`, result);
    }

    // Business rule: end >= start
    if (period.start && period.end) {
      const start = new Date(period.start);
      const end = new Date(period.end);
      if (end < start) {
        result.addError('Period end must be >= start', path, 'business-rule');
      }
    }
  }

  // Primitive type validators
  validateString(value: any, path: string, result: ValidationResult): void {
    if (typeof value !== 'string') {
      result.addError(`${path} must be a string`, path, 'structure');
    }
  }

  validateBoolean(value: any, path: string, result: ValidationResult): void {
    if (typeof value !== 'boolean') {
      result.addError(`${path} must be a boolean`, path, 'structure');
    }
  }

  validateInteger(value: any, path: string, result: ValidationResult): void {
    if (!Number.isInteger(value)) {
      result.addError(`${path} must be an integer`, path, 'structure');
    }
  }

  validateDecimal(value: any, path: string, result: ValidationResult): void {
    if (typeof value !== 'number' && typeof value !== 'string') {
      result.addError(`${path} must be a number or string`, path, 'structure');
      return;
    }

    const stringValue = String(value);
    if (!VALIDATION_PATTERNS.decimal.test(stringValue)) {
      result.addError(`${path} must be a valid decimal`, path, 'value');
    }
  }

  validateUri(value: any, path: string, result: ValidationResult): void {
    if (typeof value !== 'string') {
      result.addError(`${path} must be a string`, path, 'structure');
      return;
    }

    if (!VALIDATION_PATTERNS.uri.test(value)) {
      result.addError(`${path} must be a valid URI`, path, 'value');
    }
  }

  validateUrl(value: any, path: string, result: ValidationResult): void {
    if (typeof value !== 'string') {
      result.addError(`${path} must be a string`, path, 'structure');
      return;
    }

    if (!VALIDATION_PATTERNS.url.test(value)) {
      result.addError(`${path} must be a valid URL`, path, 'value');
    }
  }

  validateCanonical(value: any, path: string, result: ValidationResult): void {
    if (typeof value !== 'string') {
      result.addError(`${path} must be a string`, path, 'structure');
      return;
    }

    if (!VALIDATION_PATTERNS.canonical.test(value)) {
      result.addError(`${path} must be a valid canonical URL`, path, 'value');
    }
  }

  validateCode(value: any, path: string, result: ValidationResult): void {
    if (typeof value !== 'string') {
      result.addError(`${path} must be a string`, path, 'structure');
      return;
    }

    if (!VALIDATION_PATTERNS.code.test(value)) {
      result.addError(`${path} must be a valid code (no leading/trailing whitespace)`, path, 'value');
    }
  }

  validateDateTime(value: any, path: string, result: ValidationResult): void {
    if (typeof value !== 'string') {
      result.addError(`${path} must be a string`, path, 'structure');
      return;
    }

    if (!VALIDATION_PATTERNS.dateTime.test(value)) {
      result.addError(`${path} must be a valid dateTime`, path, 'value');
    }
  }

  validateDate(value: any, path: string, result: ValidationResult): void {
    if (typeof value !== 'string') {
      result.addError(`${path} must be a string`, path, 'structure');
      return;
    }

    if (!VALIDATION_PATTERNS.date.test(value)) {
      result.addError(`${path} must be a valid date`, path, 'value');
    }
  }

  validateTime(value: any, path: string, result: ValidationResult): void {
    if (typeof value !== 'string') {
      result.addError(`${path} must be a string`, path, 'structure');
      return;
    }

    if (!VALIDATION_PATTERNS.time.test(value)) {
      result.addError(`${path} must be a valid time`, path, 'value');
    }
  }

  validateInstant(value: any, path: string, result: ValidationResult): void {
    if (typeof value !== 'string') {
      result.addError(`${path} must be a string`, path, 'structure');
      return;
    }

    if (!VALIDATION_PATTERNS.instant.test(value)) {
      result.addError(`${path} must be a valid instant`, path, 'value');
    }
  }

  validateBase64Binary(value: any, path: string, result: ValidationResult): void {
    if (typeof value !== 'string') {
      result.addError(`${path} must be a string`, path, 'structure');
      return;
    }

    if (!VALIDATION_PATTERNS.base64Binary.test(value)) {
      result.addError(`${path} must be valid base64`, path, 'value');
    }
  }

  /**
   * Resource-specific validation logic
   */
  private validateResourceSpecific(resource: Resource, result: ValidationResult): void {
    switch (resource.resourceType) {
      case 'Patient':
        this.validatePatient(resource as Patient, result);
        break;
      case 'Condition':
        this.validateCondition(resource as Condition, result);
        break;
      case 'MedicationRequest':
        this.validateMedicationRequest(resource as MedicationRequest, result);
        break;
      case 'Observation':
        this.validateObservation(resource as Observation, result);
        break;
      // Add more resource-specific validations as needed
      default:
        // Generic validation for unknown resource types
        break;
    }
  }

  private validatePatient(patient: Patient, result: ValidationResult): void {
    // Patient must have at least name, telecom, gender, birthDate, or address
    const hasIdentifyingInfo = patient.name || patient.telecom || patient.gender || 
                              patient.birthDate || patient.address;
    
    if (!hasIdentifyingInfo) {
      result.addWarning('Patient should have at least one of: name, telecom, gender, birthDate, address', '');
    }

    if (patient.name && Array.isArray(patient.name)) {
      patient.name.forEach((name, index) => {
        this.validateHumanName(name, `name[${index}]`, result);
      });
    }

    if (patient.gender !== undefined) {
      const validGenders = ['male', 'female', 'other', 'unknown'];
      if (!validGenders.includes(patient.gender)) {
        result.addError(`gender must be one of: ${validGenders.join(', ')}`, 'gender', 'value');
      }
    }

    if (patient.birthDate !== undefined) {
      this.validateDate(patient.birthDate, 'birthDate', result);
    }
  }

  private validateCondition(condition: Condition, result: ValidationResult): void {
    // Condition must have subject
    if (!condition.subject) {
      result.addError('Condition must have subject', 'subject', 'required');
    } else {
      this.validateReference(condition.subject, 'subject', result);
    }

    // Condition must have code
    if (!condition.code) {
      result.addError('Condition must have code', 'code', 'required');
    } else {
      this.validateCodeableConcept(condition.code, 'code', result);
    }
  }

  private validateMedicationRequest(medRequest: MedicationRequest, result: ValidationResult): void {
    // Must have status
    if (!medRequest.status) {
      result.addError('MedicationRequest must have status', 'status', 'required');
    } else {
      const validStatuses = ['active', 'on-hold', 'cancelled', 'completed', 'entered-in-error', 'stopped', 'draft', 'unknown'];
      if (!validStatuses.includes(medRequest.status)) {
        result.addError(`status must be one of: ${validStatuses.join(', ')}`, 'status', 'value');
      }
    }

    // Must have intent
    if (!medRequest.intent) {
      result.addError('MedicationRequest must have intent', 'intent', 'required');
    }

    // Must have subject
    if (!medRequest.subject) {
      result.addError('MedicationRequest must have subject', 'subject', 'required');
    } else {
      this.validateReference(medRequest.subject, 'subject', result);
    }
  }

  private validateObservation(observation: Observation, result: ValidationResult): void {
    // Must have status
    if (!observation.status) {
      result.addError('Observation must have status', 'status', 'required');
    } else {
      const validStatuses = ['registered', 'preliminary', 'final', 'amended', 'corrected', 'cancelled', 'entered-in-error', 'unknown'];
      if (!validStatuses.includes(observation.status)) {
        result.addError(`status must be one of: ${validStatuses.join(', ')}`, 'status', 'value');
      }
    }

    // Must have code
    if (!observation.code) {
      result.addError('Observation must have code', 'code', 'required');
    } else {
      this.validateCodeableConcept(observation.code, 'code', result);
    }

    // Must have subject
    if (!observation.subject) {
      result.addError('Observation must have subject', 'subject', 'required');
    } else {
      this.validateReference(observation.subject, 'subject', result);
    }
  }

  private validateHumanName(name: HumanName, path: string, result: ValidationResult): void {
    if (!name || typeof name !== 'object') {
      result.addError('HumanName must be an object', path, 'structure');
      return;
    }

    if (name.use !== undefined) {
      const validUses = ['usual', 'official', 'temp', 'nickname', 'anonymous', 'old', 'maiden'];
      if (!validUses.includes(name.use)) {
        result.addError(`${path}.use must be one of: ${validUses.join(', ')}`, `${path}.use`, 'value');
      }
    }

    if (name.family !== undefined) {
      this.validateString(name.family, `${path}.family`, result);
    }

    if (name.given && Array.isArray(name.given)) {
      name.given.forEach((given, index) => {
        this.validateString(given, `${path}.given[${index}]`, result);
      });
    }
  }
}

/**
 * Convenience functions
 */
export const validateResource = (resource: any, options: FHIRValidatorOptions = {}): ValidationResult => {
  const validator = new FHIRValidator(options);
  return validator.validateResource(resource);
};

export const validateReference = (reference: any, options: FHIRValidatorOptions = {}): ValidationResult => {
  const validator = new FHIRValidator(options);
  const result = new ValidationResult();
  validator.validateReference(reference, 'reference', result);
  return result;
};

export const validateBundle = (bundle: any, options: FHIRValidatorOptions = {}): ValidationResult => {
  const validator = new FHIRValidator(options);
  const result = validator.validateResource(bundle);
  
  if (bundle.entry && Array.isArray(bundle.entry)) {
    bundle.entry.forEach((entry: BundleEntry, index: number) => {
      if (entry.resource) {
        const entryResult = validator.validateResource(entry.resource);
        entryResult.errors.forEach(error => {
          result.addError(error.message, `entry[${index}].resource.${error.path}`);
        });
        entryResult.warnings.forEach(warning => {
          result.addWarning(warning.message, `entry[${index}].resource.${warning.path}`);
        });
      }
    });
  }
  
  return result;
};

/**
 * Type guard for ValidationResult
 */
export function isValidationResult(obj: any): obj is ValidationResult {
  return obj instanceof ValidationResult;
}

/**
 * Type guard for FHIRValidationError
 */
export function isFHIRValidationError(obj: any): obj is FHIRValidationError {
  return obj instanceof FHIRValidationError;
}