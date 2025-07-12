/**
 * API request/response types for MedGenEMR services
 */

import { Resource, Bundle, OperationOutcome, FHIRSearchParams } from './fhir';

/**
 * Base API response structure
 */
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: APIError;
  timestamp: Date;
  requestId?: string;
}

/**
 * API Error structure
 */
export interface APIError {
  message: string;
  code: string;
  status: number;
  details?: any;
  operationOutcome?: OperationOutcome;
}

/**
 * FHIR API specific responses
 */
export interface FHIRCreateResponse extends APIResponse<Resource> {
  location?: string;
  etag?: string;
}

export interface FHIRReadResponse extends APIResponse<Resource> {
  etag?: string;
  lastModified?: Date;
}

export interface FHIRUpdateResponse extends APIResponse<Resource> {
  location?: string;
  etag?: string;
}

export interface FHIRDeleteResponse extends APIResponse<void> {
  // Void response for successful deletion
}

export interface FHIRSearchResponse extends APIResponse<Bundle> {
  // Bundle contains the search results
}

export interface FHIRBatchResponse extends APIResponse<Bundle> {
  // Bundle contains batch operation results
}

/**
 * Search request parameters
 */
export interface SearchRequest extends FHIRSearchParams {
  resourceType: string;
}

/**
 * Batch operation request
 */
export interface BatchRequest {
  resourceType: 'Bundle';
  type: 'batch' | 'transaction';
  entry: BatchEntry[];
}

export interface BatchEntry {
  request: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    url: string;
  };
  resource?: Resource;
}

/**
 * Authentication and authorization
 */
export interface LoginRequest {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse extends APIResponse<AuthData> {
  // AuthData in the data field
}

export interface AuthData {
  token: string;
  refreshToken?: string;
  user: UserProfile;
  permissions: string[];
  expiresAt: Date;
}

export interface UserProfile {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role: string;
  practitioner?: {
    id: string;
    name: string;
    specialty?: string;
  };
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

/**
 * Clinical data service requests/responses
 */
export interface SearchConditionsRequest {
  query: string;
  limit?: number;
  category?: string;
}

export interface SearchConditionsResponse extends APIResponse<ConditionSearchResult[]> {
  // Array of condition search results
}

export interface ConditionSearchResult {
  code: string;
  display: string;
  system: string;
  category?: string;
}

export interface SearchMedicationsRequest {
  query: string;
  limit?: number;
  rxnorm?: boolean;
}

export interface SearchMedicationsResponse extends APIResponse<MedicationSearchResult[]> {
  // Array of medication search results
}

export interface MedicationSearchResult {
  rxcui?: string;
  name: string;
  synonym?: string;
  tty?: string;
  language?: string;
  suppress?: string;
}

/**
 * CDS Hooks API types
 */
export interface CDSServicesResponse extends APIResponse<CDSService[]> {
  // Array of available CDS services
}

export interface CDSService {
  id: string;
  hook: string;
  title: string;
  description: string;
  prefetch?: { [key: string]: string };
}

export interface CDSRequest {
  hookInstance: string;
  fhirServer: string;
  hook: string;
  fhirAuthorization?: {
    access_token: string;
    token_type: string;
    expires_in?: number;
    scope?: string;
    subject?: string;
  };
  context: CDSContext;
  prefetch?: { [key: string]: any };
}

export interface CDSContext {
  patientId?: string;
  encounterId?: string;
  userId?: string;
  selections?: string[];
  draftOrders?: Resource[];
  [key: string]: any;
}

export interface CDSResponse extends APIResponse<CDSCard[]> {
  // Array of CDS cards
}

export interface CDSCard {
  uuid?: string;
  summary: string;
  detail?: string;
  indicator: 'info' | 'warning' | 'critical';
  source: {
    label: string;
    url?: string;
    icon?: string;
    topic?: {
      system: string;
      code: string;
      display?: string;
    };
  };
  suggestions?: CDSSuggestion[];
  selectionBehavior?: 'at-most-one' | 'any';
  overrideReasons?: {
    code: string;
    display: string;
    system?: string;
  }[];
  links?: CDSLink[];
}

export interface CDSSuggestion {
  label: string;
  uuid?: string;
  isRecommended?: boolean;
  actions?: CDSAction[];
}

export interface CDSAction {
  type: 'create' | 'update' | 'delete';
  description?: string;
  resource?: Resource;
  resourceId?: string;
}

export interface CDSLink {
  label: string;
  url: string;
  type: 'absolute' | 'smart';
  appContext?: string;
}

/**
 * DICOM and imaging service types
 */
export interface DICOMStudyRequest {
  patientId: string;
  modality?: string;
  studyDate?: string;
}

export interface DICOMStudyResponse extends APIResponse<DICOMStudy[]> {
  // Array of DICOM studies
}

export interface DICOMStudy {
  studyInstanceUID: string;
  studyDate: string;
  studyTime?: string;
  modality: string;
  studyDescription?: string;
  seriesCount: number;
  instanceCount: number;
  series: DICOMSeries[];
}

export interface DICOMSeries {
  seriesInstanceUID: string;
  seriesNumber: number;
  seriesDescription?: string;
  modality: string;
  instanceCount: number;
  instances: DICOMInstance[];
}

export interface DICOMInstance {
  sopInstanceUID: string;
  instanceNumber: number;
  imageType?: string;
  rows?: number;
  columns?: number;
  bitsAllocated?: number;
  url: string;
}

/**
 * Analytics and reporting
 */
export interface AnalyticsRequest {
  resourceType?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  groupBy?: string;
  metrics?: string[];
}

export interface AnalyticsResponse extends APIResponse<AnalyticsData> {
  // Analytics data in response
}

export interface AnalyticsData {
  summary: {
    totalPatients: number;
    totalEncounters: number;
    totalObservations: number;
    totalConditions: number;
  };
  trends: AnalyticsTrend[];
  distributions: AnalyticsDistribution[];
}

export interface AnalyticsTrend {
  period: string;
  value: number;
  metric: string;
}

export interface AnalyticsDistribution {
  category: string;
  count: number;
  percentage: number;
}

/**
 * Export service types
 */
export interface ExportRequest {
  resourceTypes: string[];
  format: 'csv' | 'json' | 'fhir' | 'xlsx';
  patientId?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  includeHistory?: boolean;
}

export interface ExportResponse extends APIResponse<ExportResult> {
  // Export result with download information
}

export interface ExportResult {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  downloadUrl?: string;
  expiresAt?: Date;
  recordCount?: number;
  fileSize?: number;
}

/**
 * WebSocket message types
 */
export interface WebSocketAuthMessage {
  type: 'authenticate';
  token: string;
}

export interface WebSocketSubscribeMessage {
  type: 'subscribe';
  channel: string;
  resourceTypes?: string[];
  patientIds?: string[];
}

export interface WebSocketUnsubscribeMessage {
  type: 'unsubscribe';
  channel: string;
}

export interface WebSocketDataMessage {
  type: 'data';
  channel: string;
  action: 'created' | 'updated' | 'deleted';
  resource: Resource;
  timestamp: string;
}

export interface WebSocketErrorMessage {
  type: 'error';
  message: string;
  code?: string;
}

export type WebSocketMessage = 
  | WebSocketAuthMessage
  | WebSocketSubscribeMessage 
  | WebSocketUnsubscribeMessage
  | WebSocketDataMessage
  | WebSocketErrorMessage;

/**
 * Pagination types
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}