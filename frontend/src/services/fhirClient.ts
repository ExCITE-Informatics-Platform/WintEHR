/**
 * FHIR Client Service - TypeScript Implementation
 * 
 * A FHIR-endpoint-agnostic client that can work with any FHIR R4 server.
 * Discovers server capabilities and adapts functionality accordingly.
 * 
 * Migrated to TypeScript with comprehensive type safety and error handling.
 */

import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import { 
  Resource, 
  Bundle, 
  BundleEntry, 
  CapabilityStatement, 
  Patient, 
  MedicationRequest, 
  Condition, 
  Encounter, 
  Observation, 
  AllergyIntolerance, 
  Coverage, 
  Organization, 
  ImagingStudy, 
  DocumentReference, 
  Procedure,
  Reference,
  FHIRResourceType,
  FHIRSearchParams
} from '../types/fhir';

/**
 * FHIR Client configuration options
 */
interface FHIRClientConfig {
  baseUrl?: string;
  auth?: {
    token?: string;
    type?: 'Bearer' | 'Basic';
  } | null;
  timeout?: number;
  retryAttempts?: number;
}

/**
 * FHIR Operation result
 */
interface FHIROperationResult<T extends Resource = Resource> {
  id?: string;
  location?: string;
  etag?: string;
  lastModified?: string;
  resource?: T;
}

/**
 * FHIR Create result
 */
interface FHIRCreateResult<T extends Resource = Resource> extends FHIROperationResult<T> {
  id: string;
  location: string;
}

/**
 * FHIR Update result
 */
interface FHIRUpdateResult {
  id: string;
  etag?: string;
  lastModified?: string;
}

/**
 * FHIR Delete result
 */
interface FHIRDeleteResult {
  deleted: true;
}

/**
 * FHIR Search result
 */
interface FHIRSearchResult<T extends Resource = Resource> {
  resources: T[];
  total: number;
  bundle: Bundle;
}

/**
 * FHIR History result
 */
interface FHIRHistoryResult {
  bundle: Bundle;
  entries: BundleEntry[];
}

/**
 * FHIR Batch/Transaction parameters
 */
interface FHIRBatchEntry {
  request: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    url: string;
    ifMatch?: string;
    ifNoneMatch?: string;
    ifModifiedSince?: string;
    ifNoneExist?: string;
  };
  resource?: Resource;
}

/**
 * Patient bundle optimization options
 */
interface PatientBundleOptions {
  resourceTypes?: FHIRResourceType[];
  limit?: number;
  priority?: 'critical' | 'important' | 'optional' | 'all';
}

/**
 * Patient timeline options
 */
interface PatientTimelineOptions {
  days?: number;
  limit?: number;
  resourceTypes?: FHIRResourceType[];
}

/**
 * Custom FHIR Client Error
 */
class FHIRClientError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: any;

  constructor(message: string, status: number = 500, code: string = 'FHIR_ERROR', details?: any) {
    super(message);
    this.name = 'FHIRClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * FHIR Client Class with comprehensive TypeScript support
 */
class FHIRClient {
  private readonly baseUrl: string;
  private readonly auth: FHIRClientConfig['auth'];
  private readonly httpClient: AxiosInstance;
  private capabilities: CapabilityStatement | null = null;

  constructor(config: FHIRClientConfig = {}) {
    this.baseUrl = config.baseUrl || process.env.REACT_APP_FHIR_ENDPOINT || '/fhir/R4';
    this.auth = config.auth || null;
    
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/fhir+json',
        'Accept': 'application/fhir+json'
      }
    });

    // Add auth interceptor if configured
    if (this.auth?.token) {
      this.httpClient.interceptors.request.use((requestConfig) => {
        if (this.auth?.token && requestConfig.headers) {
          const authType = this.auth.type || 'Bearer';
          requestConfig.headers.Authorization = `${authType} ${this.auth.token}`;
        }
        return requestConfig;
      });
    }

    // Add response interceptor for error handling
    this.httpClient.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error: AxiosError) => {
        throw this.transformAxiosError(error);
      }
    );

    // Initialize capabilities on creation
    this.discoverCapabilities().catch(() => {
      // Silent fail - capabilities are optional
    });
  }

  /**
   * Transform Axios error to FHIRClientError
   */
  private transformAxiosError(error: AxiosError): FHIRClientError {
    const status = error.response?.status || 500;
    const message = error.message || 'Unknown FHIR error';
    const details = error.response?.data;
    
    let code = 'FHIR_ERROR';
    if (status === 400) code = 'BAD_REQUEST';
    else if (status === 401) code = 'UNAUTHORIZED';
    else if (status === 403) code = 'FORBIDDEN';
    else if (status === 404) code = 'NOT_FOUND';
    else if (status === 422) code = 'UNPROCESSABLE_ENTITY';
    else if (status >= 500) code = 'SERVER_ERROR';

    return new FHIRClientError(message, status, code, details);
  }

  /**
   * Discover server capabilities via metadata endpoint
   */
  async discoverCapabilities(): Promise<CapabilityStatement | null> {
    try {
      const response: AxiosResponse<CapabilityStatement> = await this.httpClient.get('/metadata');
      this.capabilities = response.data;
      return this.capabilities;
    } catch (error) {
      // Continue without capabilities - assume basic FHIR compliance
      return null;
    }
  }

  /**
   * Check if server supports a specific resource type
   */
  supportsResource(resourceType: FHIRResourceType): boolean {
    if (!this.capabilities) return true; // Assume support if no capabilities
    
    const resources = this.capabilities.rest?.[0]?.resource || [];
    return resources.some(r => r.type === resourceType);
  }

  /**
   * Check if server supports a specific operation
   */
  supportsOperation(resourceType: FHIRResourceType | null, operation: string): boolean {
    if (!this.capabilities) return true; // Assume support if no capabilities
    
    const resources = this.capabilities.rest?.[0]?.resource || [];
    const resource = resources.find(r => r.type === resourceType);
    if (!resource && resourceType) return false;
    
    return resource?.interaction?.some(i => i.code === operation) ?? true;
  }

  /**
   * Create a new resource
   */
  async create<T extends Resource>(
    resourceType: FHIRResourceType, 
    resource: Omit<T, 'id' | 'meta'>
  ): Promise<FHIRCreateResult<T>> {
    if (!this.supportsResource(resourceType)) {
      throw new FHIRClientError(`Server does not support ${resourceType} resources`, 400, 'UNSUPPORTED_RESOURCE');
    }

    const response: AxiosResponse<T> = await this.httpClient.post(`/${resourceType}`, resource);
    
    return {
      id: response.headers.location?.split('/').pop() || (resource as any).id,
      location: response.headers.location || '',
      etag: response.headers.etag,
      resource: response.data
    };
  }

  /**
   * Read a resource by ID
   */
  async read<T extends Resource>(resourceType: FHIRResourceType, id: string): Promise<T> {
    const response: AxiosResponse<T> = await this.httpClient.get(`/${resourceType}/${id}`);
    return response.data;
  }

  /**
   * Update a resource
   */
  async update<T extends Resource>(
    resourceType: FHIRResourceType, 
    id: string, 
    resource: Partial<T> & { resourceType: FHIRResourceType }
  ): Promise<FHIRUpdateResult> {
    // Ensure resource has correct ID
    const updateResource = { ...resource, id };
    
    const response: AxiosResponse<T> = await this.httpClient.put(`/${resourceType}/${id}`, updateResource);
    
    return {
      id: id,
      etag: response.headers.etag,
      lastModified: response.headers['last-modified']
    };
  }

  /**
   * Delete a resource
   */
  async delete(resourceType: FHIRResourceType, id: string): Promise<FHIRDeleteResult> {
    await this.httpClient.delete(`/${resourceType}/${id}`);
    return { deleted: true };
  }

  /**
   * Search for resources
   */
  async search<T extends Resource>(
    resourceType: FHIRResourceType, 
    params: FHIRSearchParams = {}
  ): Promise<FHIRSearchResult<T>> {
    const response: AxiosResponse<Bundle> = await this.httpClient.get(`/${resourceType}`, { params });
    
    // Extract resources from bundle
    const bundle = response.data;
    const resources = (bundle.entry?.map(entry => entry.resource) || []) as unknown as T[];
    
    return {
      resources,
      total: bundle.total || resources.length,
      bundle
    };
  }

  /**
   * Execute a custom operation
   */
  async operation<T = any>(
    operation: string, 
    resourceType?: FHIRResourceType, 
    id?: string, 
    parameters?: any
  ): Promise<T> {
    let url = '';
    
    if (resourceType && id) {
      // Instance level operation
      url = `/${resourceType}/${id}/$${operation}`;
    } else if (resourceType) {
      // Type level operation
      url = `/${resourceType}/$${operation}`;
    } else {
      // System level operation
      url = `/$${operation}`;
    }

    const response: AxiosResponse<T> = await this.httpClient.post(url, parameters);
    return response.data;
  }

  /**
   * Process a batch/transaction bundle
   */
  async batch(bundle: Bundle): Promise<Bundle> {
    if (!this.supportsOperation(null, 'transaction')) {
      throw new FHIRClientError('Server does not support transaction bundles', 400, 'UNSUPPORTED_OPERATION');
    }

    const response: AxiosResponse<Bundle> = await this.httpClient.post('/', bundle);
    return response.data;
  }

  /**
   * Get resource history
   */
  async history(resourceType: FHIRResourceType, id?: string): Promise<FHIRHistoryResult> {
    let url = '';
    
    if (id) {
      url = `/${resourceType}/${id}/_history`;
    } else {
      url = `/${resourceType}/_history`;
    }

    const response: AxiosResponse<Bundle> = await this.httpClient.get(url);
    const bundle = response.data;
    
    return {
      bundle,
      entries: bundle.entry || []
    };
  }

  /**
   * Helper: Build a reference object
   */
  static reference(resourceType: FHIRResourceType, id: string, display?: string): Reference {
    const ref: Reference = {
      reference: `${resourceType}/${id}`
    };
    if (display) {
      ref.display = display;
    }
    return ref;
  }

  /**
   * Helper: Extract ID from reference
   */
  static extractId(reference: string | Reference | undefined | null): string | null {
    if (!reference) return null;
    
    // Handle string references
    if (typeof reference === 'string') {
      // Handle absolute URLs
      if (reference.startsWith('http://') || reference.startsWith('https://')) {
        const parts = reference.split('/');
        return parts[parts.length - 1];
      }
      // Handle relative references (ResourceType/id)
      return reference.split('/').pop() || null;
    }
    
    // Handle reference objects
    if (typeof reference === 'object' && reference.reference) {
      return FHIRClient.extractId(reference.reference);
    }
    
    return null;
  }

  /**
   * Instance method for backward compatibility
   */
  extractId(reference: string | Reference | undefined | null): string | null {
    return FHIRClient.extractId(reference);
  }

  /**
   * Helper: Build search query string
   */
  static buildSearchParams(criteria: Record<string, any>): URLSearchParams {
    const params = new URLSearchParams();
    
    Object.entries(criteria).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(v => {
          if (v !== null && v !== undefined) {
            params.append(key, String(v));
          }
        });
      } else if (value !== null && value !== undefined) {
        params.append(key, String(value));
      }
    });
    
    return params;
  }

  // =============================================================================
  // CONVENIENCE METHODS - PATIENT
  // =============================================================================

  /**
   * Get patient by ID
   */
  async getPatient(id: string): Promise<Patient> {
    return this.read<Patient>('Patient', id);
  }

  /**
   * Search for patients
   */
  async searchPatients(params: FHIRSearchParams): Promise<FHIRSearchResult<Patient>> {
    return this.search<Patient>('Patient', params);
  }

  /**
   * Get everything for a patient
   */
  async getPatientEverything(id: string): Promise<Bundle> {
    return this.operation<Bundle>('everything', 'Patient', id);
  }

  // =============================================================================
  // CONVENIENCE METHODS - OBSERVATIONS
  // =============================================================================

  /**
   * Get observations for a patient
   */
  async getObservations(
    patientId: string, 
    category?: string, 
    count: number = 1000
  ): Promise<FHIRSearchResult<Observation>> {
    const params: FHIRSearchParams = { 
      patient: patientId,
      _count: count,
      _sort: '-date'
    };
    if (category) params.category = category;
    return this.search<Observation>('Observation', params);
  }

  /**
   * Get vital signs for a patient
   */
  async getVitalSigns(patientId: string, count: number = 1000): Promise<FHIRSearchResult<Observation>> {
    return this.getObservations(patientId, 'vital-signs', count);
  }

  /**
   * Get lab results for a patient
   */
  async getLabResults(patientId: string, count: number = 1000): Promise<FHIRSearchResult<Observation>> {
    return this.getObservations(patientId, 'laboratory', count);
  }

  // =============================================================================
  // CONVENIENCE METHODS - MEDICATIONS
  // =============================================================================

  /**
   * Get medication requests for a patient
   */
  async getMedications(
    patientId: string, 
    status?: string, 
    count: number = 1000
  ): Promise<FHIRSearchResult<MedicationRequest>> {
    const params: FHIRSearchParams = { 
      patient: patientId,
      _count: count,
      _sort: '-authoredon'
    };
    if (status) {
      params.status = status;
    }
    return this.search<MedicationRequest>('MedicationRequest', params);
  }

  // =============================================================================
  // CONVENIENCE METHODS - CONDITIONS
  // =============================================================================

  /**
   * Get conditions for a patient
   */
  async getConditions(
    patientId: string, 
    clinicalStatus: string = 'active', 
    count: number = 1000
  ): Promise<FHIRSearchResult<Condition>> {
    return this.search<Condition>('Condition', {
      patient: patientId,
      'clinical-status': clinicalStatus,
      _count: count,
      _sort: '-recorded-date'
    });
  }

  // =============================================================================
  // CONVENIENCE METHODS - ENCOUNTERS
  // =============================================================================

  /**
   * Get encounters for a patient
   */
  async getEncounters(
    patientId: string, 
    status?: string, 
    count: number = 1000
  ): Promise<FHIRSearchResult<Encounter>> {
    const params: FHIRSearchParams = { 
      patient: patientId,
      _count: count,
      _sort: '-date'
    };
    if (status) params.status = status;
    return this.search<Encounter>('Encounter', params);
  }

  // =============================================================================
  // CONVENIENCE METHODS - ALLERGIES
  // =============================================================================

  /**
   * Get allergies for a patient
   */
  async getAllergies(patientId: string, count: number = 1000): Promise<FHIRSearchResult<AllergyIntolerance>> {
    return this.search<AllergyIntolerance>('AllergyIntolerance', {
      patient: patientId,
      _count: count,
      _sort: '-date'
    });
  }

  // =============================================================================
  // CONVENIENCE METHODS - COVERAGE
  // =============================================================================

  /**
   * Get coverage for a patient
   */
  async getCoverage(patientId: string): Promise<FHIRSearchResult<Coverage>> {
    return this.search<Coverage>('Coverage', {
      beneficiary: patientId
    });
  }

  /**
   * Get coverage by ID
   */
  async getCoverageById(id: string): Promise<Coverage> {
    return this.read<Coverage>('Coverage', id);
  }

  /**
   * Get active coverage for a patient
   */
  async getActiveCoverage(patientId: string): Promise<FHIRSearchResult<Coverage>> {
    return this.search<Coverage>('Coverage', {
      beneficiary: patientId,
      status: 'active'
    });
  }

  /**
   * Create coverage
   */
  async createCoverage(coverage: Omit<Coverage, 'id' | 'meta'>): Promise<FHIRCreateResult<Coverage>> {
    return this.create<Coverage>('Coverage', coverage);
  }

  /**
   * Update coverage
   */
  async updateCoverage(id: string, coverage: Partial<Coverage>): Promise<FHIRUpdateResult> {
    return this.update<Coverage>('Coverage', id, { ...coverage, resourceType: 'Coverage' });
  }

  // =============================================================================
  // CONVENIENCE METHODS - ORGANIZATIONS
  // =============================================================================

  /**
   * Get payer organizations
   */
  async getPayers(): Promise<FHIRSearchResult<Organization>> {
    return this.search<Organization>('Organization', {
      type: 'payer'
    });
  }

  // =============================================================================
  // CONVENIENCE METHODS - IMAGING
  // =============================================================================

  /**
   * Get imaging studies for a patient
   */
  async getImagingStudies(patientId: string, count: number = 1000): Promise<FHIRSearchResult<ImagingStudy>> {
    return this.search<ImagingStudy>('ImagingStudy', {
      patient: patientId,
      _sort: '-started',
      _count: count
    });
  }

  /**
   * Get imaging study by ID
   */
  async getImagingStudy(studyId: string): Promise<ImagingStudy> {
    return this.read<ImagingStudy>('ImagingStudy', studyId);
  }

  // =============================================================================
  // CONVENIENCE METHODS - DOCUMENTS
  // =============================================================================

  /**
   * Get document references for a patient
   */
  async getDocumentReferences(patientId: string, count: number = 1000): Promise<FHIRSearchResult<DocumentReference>> {
    return this.search<DocumentReference>('DocumentReference', {
      patient: patientId,
      _sort: '-date',
      _count: count
    });
  }

  /**
   * Get document reference by ID
   */
  async getDocumentReference(documentId: string): Promise<DocumentReference> {
    return this.read<DocumentReference>('DocumentReference', documentId);
  }

  // =============================================================================
  // CONVENIENCE METHODS - PROCEDURES
  // =============================================================================

  /**
   * Get procedures for a patient
   */
  async getProcedures(patientId: string, count: number = 1000): Promise<FHIRSearchResult<Procedure>> {
    return this.search<Procedure>('Procedure', {
      patient: patientId,
      _sort: '-performed-date',
      _count: count
    });
  }

  /**
   * Get procedure by ID
   */
  async getProcedure(procedureId: string): Promise<Procedure> {
    return this.read<Procedure>('Procedure', procedureId);
  }

  /**
   * Create procedure
   */
  async createProcedure(procedure: Omit<Procedure, 'id' | 'meta'>): Promise<FHIRCreateResult<Procedure>> {
    return this.create<Procedure>('Procedure', procedure);
  }

  /**
   * Update procedure
   */
  async updateProcedure(id: string, procedure: Partial<Procedure>): Promise<FHIRUpdateResult> {
    return this.update<Procedure>('Procedure', id, { ...procedure, resourceType: 'Procedure' });
  }

  // =============================================================================
  // PERFORMANCE-OPTIMIZED ENDPOINTS
  // =============================================================================

  /**
   * Get optimized patient bundle
   */
  async getPatientBundleOptimized(
    patientId: string, 
    options: PatientBundleOptions = {}
  ): Promise<Bundle> {
    const {
      resourceTypes,
      limit = 100,
      priority = 'all'
    } = options;
    
    const params: Record<string, any> = {
      limit,
      priority
    };
    
    if (resourceTypes && Array.isArray(resourceTypes)) {
      params.resource_types = resourceTypes.join(',');
    }
    
    const response: AxiosResponse<Bundle> = await this.httpClient.get(
      `/Patient/${patientId}/$bundle-optimized`, 
      { params }
    );
    
    return response.data;
  }
  
  /**
   * Get optimized patient timeline
   */
  async getPatientTimelineOptimized(
    patientId: string, 
    options: PatientTimelineOptions = {}
  ): Promise<Bundle> {
    const {
      days = 365,
      limit = 100,
      resourceTypes
    } = options;
    
    const params: Record<string, any> = {
      days,
      limit
    };
    
    if (resourceTypes && Array.isArray(resourceTypes)) {
      params.resource_types = resourceTypes.join(',');
    }
    
    const response: AxiosResponse<Bundle> = await this.httpClient.get(
      `/Patient/${patientId}/$timeline`, 
      { params }
    );
    
    return response.data;
  }
  
  /**
   * Get optimized patient summary
   */
  async getPatientSummaryOptimized(patientId: string): Promise<Bundle> {
    const response: AxiosResponse<Bundle> = await this.httpClient.get(`/Patient/${patientId}/$summary`);
    return response.data;
  }
}

// Export singleton instance for common use
export const fhirClient = new FHIRClient();

// Export class for custom instances
export default FHIRClient;

// Export types for external use
export type {
  FHIRClientConfig,
  FHIROperationResult,
  FHIRCreateResult,
  FHIRUpdateResult,
  FHIRDeleteResult,
  FHIRSearchResult,
  FHIRHistoryResult,
  FHIRBatchEntry,
  PatientBundleOptions,
  PatientTimelineOptions,
  FHIRClientError
};