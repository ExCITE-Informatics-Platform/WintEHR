/**
 * EMR Client Service
 * 
 * Handles EMR-specific functionality that extends beyond FHIR.
 * Optional - degrades gracefully if EMR backend is not available.
 * 
 * Migrated to TypeScript with comprehensive type safety and error handling.
 */

import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';

/**
 * EMR Client configuration options
 */
interface EMRClientConfig {
  baseUrl?: string;
  enabled?: boolean;
  auth?: {
    token?: string;
    user?: any;
  } | null;
}

/**
 * EMR Capabilities interface
 */
interface EMRCapabilities {
  auth: boolean;
  workflow: boolean;
  uiState: boolean;
  clinicalTools: boolean;
  auditLogs: boolean;
}

/**
 * Authentication response
 */
interface AuthResponse {
  token: string;
  user: any;
}

/**
 * Login credentials
 */
interface LoginCredentials {
  username: string;
  password: string;
}

/**
 * User preferences
 */
interface UserPreferences {
  [key: string]: any;
}

/**
 * Workflow definition
 */
interface Workflow {
  id: string;
  name: string;
  type: string;
  active: boolean;
  description?: string;
}

/**
 * Workflow context for instantiation
 */
interface WorkflowContext {
  patientId?: string;
  encounterId?: string;
  userId?: string;
  parameters?: Record<string, any>;
}

/**
 * Task definition
 */
interface Task {
  id: string;
  fhirId: string;
  title: string;
  description?: string;
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: string;
  dueDate?: string;
  createdAt: string;
}

/**
 * UI State context types
 */
type UIContext = 'patient-list' | 'patient-chart' | 'clinical-canvas' | string;

/**
 * UI State structure
 */
interface UIState {
  [key: string]: any;
}

/**
 * Note template structure
 */
interface NoteTemplate {
  sections: Array<{
    title: string;
    content: string;
  }>;
}

/**
 * Note generation context
 */
interface NoteContext {
  noteType: string;
  patientId?: string;
  encounterId?: string;
  template?: string;
}

/**
 * Order recommendation context
 */
interface OrderRecommendationContext {
  patientId: string;
  conditions?: string[];
  currentMedications?: string[];
  allergens?: string[];
}

/**
 * Order recommendation
 */
interface OrderRecommendation {
  type: 'medication' | 'lab' | 'imaging' | 'procedure';
  code: string;
  display: string;
  rationale: string;
  priority: 'low' | 'medium' | 'high';
}

/**
 * Risk score parameters
 */
interface RiskScoreParameters {
  [key: string]: any;
}

/**
 * Risk score result
 */
interface RiskScoreResult {
  score: number;
  category: string;
  factors: Array<{
    factor: string;
    value: any;
    impact: number;
  }>;
}

/**
 * Drug interaction check result
 */
interface DrugInteraction {
  severity: 'minor' | 'moderate' | 'major' | 'contraindicated';
  description: string;
  medications: string[];
  recommendation: string;
}

/**
 * Clinical reminder
 */
interface ClinicalReminder {
  id: string;
  type: 'screening' | 'vaccination' | 'medication-review' | 'followup';
  title: string;
  description: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high';
}

/**
 * Audit log entry
 */
interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  action: string;
  resource: string;
  details: Record<string, any>;
}

/**
 * Clinical Canvas generation context
 */
interface ClinicalCanvasContext {
  patientId?: string;
  encounterId?: string;
  mode?: string;
  fhirData?: any;
}

/**
 * EMR API Error
 */
class EMRClientError extends Error {
  public status?: number;
  public code?: string;
  public details?: any;

  constructor(message: string, status?: number, code?: string, details?: any) {
    super(message);
    this.name = 'EMRClientError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Main EMR Client class
 */
class EMRClient {
  private baseUrl: string;
  private enabled: boolean;
  private auth: { token?: string; user?: any } | null;
  private httpClient?: AxiosInstance;
  private capabilities: EMRCapabilities;

  constructor(config: EMRClientConfig = {}) {
    this.baseUrl = config.baseUrl || process.env.REACT_APP_EMR_API || '/api/emr';
    this.enabled = config.enabled !== false && process.env.REACT_APP_EMR_FEATURES !== 'false';
    
    // Disable EMR features by default if not explicitly enabled
    if (process.env.REACT_APP_EMR_FEATURES === undefined) {
      this.enabled = false;
    }
    
    this.auth = config.auth || null;
    this.capabilities = {
      auth: false,
      workflow: false,
      uiState: false,
      clinicalTools: false,
      auditLogs: false
    };

    if (this.enabled) {
      this.httpClient = axios.create({
        baseURL: this.baseUrl,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      // Add auth interceptor
      this.httpClient.interceptors.request.use(config => {
        const token = this.auth?.token || localStorage.getItem('emr_token');
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      });

      // Add response interceptor for auth errors
      this.httpClient.interceptors.response.use(
        (response: AxiosResponse) => response,
        (error: AxiosError) => {
          if (error.response?.status === 401) {
            // Token expired or invalid
            this.handleAuthError();
          }
          return Promise.reject(error);
        }
      );

      // Discover capabilities
      this.discoverCapabilities();
    }
  }

  /**
   * Discover EMR capabilities
   */
  async discoverCapabilities(): Promise<void> {
    if (!this.enabled || !this.httpClient) return;

    try {
      const response: AxiosResponse = await this.httpClient.get('/');
      const info = response.data;
      
      // Update capabilities based on response
      this.capabilities = {
        auth: !!info.endpoints?.auth,
        workflow: !!info.endpoints?.workflow,
        uiState: !!info.endpoints?.ui,
        clinicalTools: !!info.endpoints?.clinical,
        auditLogs: info.features?.includes('Audit logging')
      };
    } catch (error) {
      this.enabled = false;
      throw new EMRClientError(
        'Failed to discover EMR capabilities',
        error instanceof AxiosError ? error.response?.status : undefined,
        'DISCOVERY_FAILED',
        error
      );
    }
  }

  /**
   * Check if a feature is available
   */
  hasFeature(feature: keyof EMRCapabilities): boolean {
    return this.enabled && this.capabilities[feature];
  }

  /**
   * Handle authentication error
   */
  private handleAuthError(): void {
    localStorage.removeItem('emr_token');
    // Emit event for app to handle
    window.dispatchEvent(new CustomEvent('emr:auth:expired'));
  }

  /**
   * Authentication methods
   */
  async login(username: string, password: string): Promise<AuthResponse> {
    if (!this.hasFeature('auth')) {
      throw new EMRClientError('Authentication not available', 503, 'AUTH_UNAVAILABLE');
    }

    if (!this.httpClient) {
      throw new EMRClientError('HTTP client not initialized', 500, 'CLIENT_ERROR');
    }

    try {
      const response: AxiosResponse<AuthResponse> = await this.httpClient.post('/auth/login', {
        username,
        password
      });

      const { token, user } = response.data;
      
      // Store token
      localStorage.setItem('emr_token', token);
      this.auth = { token, user };

      return { token, user };
    } catch (error) {
      throw new EMRClientError(
        'Login failed',
        error instanceof AxiosError ? error.response?.status : undefined,
        'LOGIN_FAILED',
        error
      );
    }
  }

  async logout(): Promise<void> {
    if (!this.hasFeature('auth') || !this.httpClient) return;

    try {
      await this.httpClient.post('/auth/logout');
    } catch (error) {
      // Log error but don't throw - logout should always succeed locally
      console.warn('EMR logout request failed:', error);
    } finally {
      localStorage.removeItem('emr_token');
      this.auth = null;
    }
  }

  async getCurrentUser(): Promise<any> {
    if (!this.hasFeature('auth') || !this.httpClient) return null;

    try {
      const response: AxiosResponse = await this.httpClient.get('/auth/me');
      return response.data;
    } catch (error) {
      throw new EMRClientError(
        'Failed to get current user',
        error instanceof AxiosError ? error.response?.status : undefined,
        'USER_FETCH_FAILED',
        error
      );
    }
  }

  async updatePreferences(preferences: UserPreferences): Promise<any> {
    if (!this.hasFeature('auth') || !this.httpClient) return;

    try {
      const response: AxiosResponse = await this.httpClient.put('/auth/me/preferences', preferences);
      return response.data;
    } catch (error) {
      throw new EMRClientError(
        'Failed to update preferences',
        error instanceof AxiosError ? error.response?.status : undefined,
        'PREFERENCES_UPDATE_FAILED',
        error
      );
    }
  }

  /**
   * Workflow methods
   */
  async getWorkflows(type: string | null = null, activeOnly: boolean = true): Promise<{ workflows: Workflow[] }> {
    if (!this.hasFeature('workflow') || !this.httpClient) return { workflows: [] };

    try {
      const response: AxiosResponse<{ workflows: Workflow[] }> = await this.httpClient.get('/workflow/workflows', {
        params: { type, activeOnly }
      });
      return response.data;
    } catch (error) {
      throw new EMRClientError(
        'Failed to get workflows',
        error instanceof AxiosError ? error.response?.status : undefined,
        'WORKFLOWS_FETCH_FAILED',
        error
      );
    }
  }

  async instantiateWorkflow(workflowId: string, context: WorkflowContext): Promise<any> {
    if (!this.hasFeature('workflow')) {
      throw new EMRClientError('Workflow management not available', 503, 'WORKFLOW_UNAVAILABLE');
    }

    if (!this.httpClient) {
      throw new EMRClientError('HTTP client not initialized', 500, 'CLIENT_ERROR');
    }

    try {
      const response: AxiosResponse = await this.httpClient.post(
        `/workflow/workflows/${workflowId}/instantiate`,
        context
      );
      return response.data;
    } catch (error) {
      throw new EMRClientError(
        'Failed to instantiate workflow',
        error instanceof AxiosError ? error.response?.status : undefined,
        'WORKFLOW_INSTANTIATION_FAILED',
        error
      );
    }
  }

  async getMyTasks(status: string | null = null, priority: string | null = null): Promise<{ tasks: Task[] }> {
    if (!this.hasFeature('workflow') || !this.httpClient) return { tasks: [] };

    try {
      const response: AxiosResponse<{ tasks: Task[] }> = await this.httpClient.get('/workflow/tasks/my-tasks', {
        params: { status, priority }
      });
      return response.data;
    } catch (error) {
      throw new EMRClientError(
        'Failed to get tasks',
        error instanceof AxiosError ? error.response?.status : undefined,
        'TASKS_FETCH_FAILED',
        error
      );
    }
  }

  async assignTask(taskFhirId: string, userId: string): Promise<any> {
    if (!this.hasFeature('workflow')) {
      throw new EMRClientError('Task assignment not available', 503, 'WORKFLOW_UNAVAILABLE');
    }

    if (!this.httpClient) {
      throw new EMRClientError('HTTP client not initialized', 500, 'CLIENT_ERROR');
    }

    try {
      const response: AxiosResponse = await this.httpClient.put(
        `/workflow/tasks/${taskFhirId}/assign`,
        { userId }
      );
      return response.data;
    } catch (error) {
      throw new EMRClientError(
        'Failed to assign task',
        error instanceof AxiosError ? error.response?.status : undefined,
        'TASK_ASSIGNMENT_FAILED',
        error
      );
    }
  }

  /**
   * UI State methods
   */
  async getUIState(context: UIContext): Promise<{ state: UIState }> {
    if (!this.hasFeature('uiState') || !this.httpClient) {
      // Return default state
      return { state: this.getDefaultUIState(context) };
    }

    try {
      const response: AxiosResponse<{ state: UIState }> = await this.httpClient.get(`/ui/state/${context}`);
      return response.data;
    } catch (error) {
      throw new EMRClientError(
        'Failed to get UI state',
        error instanceof AxiosError ? error.response?.status : undefined,
        'UI_STATE_FETCH_FAILED',
        error
      );
    }
  }

  async saveUIState(context: UIContext, state: UIState): Promise<{ message: string }> {
    if (!this.hasFeature('uiState') || !this.httpClient) {
      // Store locally
      localStorage.setItem(`ui_state_${context}`, JSON.stringify(state));
      return { message: 'Saved locally' };
    }

    try {
      const response: AxiosResponse<{ message: string }> = await this.httpClient.put(`/ui/state/${context}`, state);
      return response.data;
    } catch (error) {
      throw new EMRClientError(
        'Failed to save UI state',
        error instanceof AxiosError ? error.response?.status : undefined,
        'UI_STATE_SAVE_FAILED',
        error
      );
    }
  }

  getDefaultUIState(context: UIContext): UIState {
    // Check local storage first
    const localState = localStorage.getItem(`ui_state_${context}`);
    if (localState) {
      try {
        return JSON.parse(localState);
      } catch (e) {
        // Invalid JSON, ignore
      }
    }

    // Return context-specific defaults
    const defaults: Record<string, UIState> = {
      'patient-list': {
        columns: ['name', 'mrn', 'dob', 'provider'],
        sortBy: 'name',
        pageSize: 20
      },
      'patient-chart': {
        layout: 'tabbed',
        activeTab: 'summary'
      },
      'clinical-canvas': {
        theme: 'light',
        aiAssistance: true
      }
    };

    return defaults[context] || {};
  }

  /**
   * Clinical Tools methods
   */
  async generateNoteAssistance(context: NoteContext): Promise<{ noteType: string; template: NoteTemplate }> {
    if (!this.hasFeature('clinicalTools') || !this.httpClient) {
      // Return basic template
      return this.getBasicNoteTemplate(context.noteType);
    }

    try {
      const response: AxiosResponse<{ noteType: string; template: NoteTemplate }> = await this.httpClient.post('/clinical/note-assist', context);
      return response.data;
    } catch (error) {
      throw new EMRClientError(
        'Failed to generate note assistance',
        error instanceof AxiosError ? error.response?.status : undefined,
        'NOTE_GENERATION_FAILED',
        error
      );
    }
  }

  async getOrderRecommendations(context: OrderRecommendationContext): Promise<{ recommendations: OrderRecommendation[] }> {
    if (!this.hasFeature('clinicalTools') || !this.httpClient) {
      return { recommendations: [] };
    }

    try {
      const response: AxiosResponse<{ recommendations: OrderRecommendation[] }> = await this.httpClient.post('/clinical/order-recommendations', context);
      return response.data;
    } catch (error) {
      throw new EMRClientError(
        'Failed to get order recommendations',
        error instanceof AxiosError ? error.response?.status : undefined,
        'ORDER_RECOMMENDATIONS_FAILED',
        error
      );
    }
  }

  async calculateRiskScore(scoreType: string, parameters: RiskScoreParameters): Promise<RiskScoreResult | { error: string }> {
    if (!this.hasFeature('clinicalTools') || !this.httpClient) {
      // Could implement basic calculations client-side
      return { error: 'Risk calculations not available' };
    }

    try {
      const response: AxiosResponse<RiskScoreResult> = await this.httpClient.post('/clinical/risk-scores/calculate', {
        scoreType,
        parameters
      });
      return response.data;
    } catch (error) {
      throw new EMRClientError(
        'Failed to calculate risk score',
        error instanceof AxiosError ? error.response?.status : undefined,
        'RISK_CALCULATION_FAILED',
        error
      );
    }
  }

  async checkDrugInteractions(medications: string[]): Promise<{ interactions: DrugInteraction[] }> {
    if (!this.hasFeature('clinicalTools') || !this.httpClient) {
      return { interactions: [] };
    }

    try {
      const response: AxiosResponse<{ interactions: DrugInteraction[] }> = await this.httpClient.post('/clinical/drug-interactions/check', medications);
      return response.data;
    } catch (error) {
      throw new EMRClientError(
        'Failed to check drug interactions',
        error instanceof AxiosError ? error.response?.status : undefined,
        'DRUG_INTERACTION_CHECK_FAILED',
        error
      );
    }
  }

  async getClinicalReminders(patientId: string): Promise<{ reminders: ClinicalReminder[] }> {
    if (!this.hasFeature('clinicalTools') || !this.httpClient) {
      return { reminders: [] };
    }

    try {
      const response: AxiosResponse<{ reminders: ClinicalReminder[] }> = await this.httpClient.get(`/clinical/clinical-reminders/${patientId}`);
      return response.data;
    } catch (error) {
      throw new EMRClientError(
        'Failed to get clinical reminders',
        error instanceof AxiosError ? error.response?.status : undefined,
        'CLINICAL_REMINDERS_FAILED',
        error
      );
    }
  }

  /**
   * Audit Log methods
   */
  async getAuditLogs(filters: Record<string, any> = {}): Promise<{ logs: AuditLogEntry[] }> {
    if (!this.hasFeature('auditLogs') || !this.httpClient) {
      return { logs: [] };
    }

    try {
      const response: AxiosResponse<{ logs: AuditLogEntry[] }> = await this.httpClient.get('/audit-logs', { params: filters });
      return response.data;
    } catch (error) {
      throw new EMRClientError(
        'Failed to get audit logs',
        error instanceof AxiosError ? error.response?.status : undefined,
        'AUDIT_LOGS_FAILED',
        error
      );
    }
  }

  /**
   * Clinical Canvas methods
   */
  async generateClinicalUI(prompt: string, context: ClinicalCanvasContext): Promise<any> {
    try {
      // Clinical Canvas is a separate service
      const response: AxiosResponse = await axios.post('/api/clinical-canvas/generate', {
        prompt,
        context,
        fhirBaseUrl: process.env.REACT_APP_FHIR_ENDPOINT
      });
      return response.data;
    } catch (error) {
      throw new EMRClientError(
        'Failed to generate clinical UI',
        error instanceof AxiosError ? error.response?.status : undefined,
        'CLINICAL_UI_GENERATION_FAILED',
        error
      );
    }
  }

  async enhanceClinicalUI(currentUi: any, enhancement: string, context: ClinicalCanvasContext): Promise<any> {
    try {
      const response: AxiosResponse = await axios.post('/api/clinical-canvas/enhance', {
        currentUi,
        enhancement,
        context
      });
      return response.data;
    } catch (error) {
      throw new EMRClientError(
        'Failed to enhance clinical UI',
        error instanceof AxiosError ? error.response?.status : undefined,
        'CLINICAL_UI_ENHANCEMENT_FAILED',
        error
      );
    }
  }

  /**
   * Helper methods
   */
  getBasicNoteTemplate(noteType: string): { noteType: string; template: NoteTemplate } {
    const templates: Record<string, NoteTemplate> = {
      progress: {
        sections: [
          { title: 'Chief Complaint', content: '' },
          { title: 'History of Present Illness', content: '' },
          { title: 'Physical Examination', content: '' },
          { title: 'Assessment and Plan', content: '' }
        ]
      },
      consultation: {
        sections: [
          { title: 'Reason for Consultation', content: '' },
          { title: 'History', content: '' },
          { title: 'Examination', content: '' },
          { title: 'Recommendations', content: '' }
        ]
      }
    };

    return {
      noteType,
      template: templates[noteType] || templates.progress
    };
  }
}

// Export singleton instance
export const emrClient = new EMRClient();

// Also export class and types
export default EMRClient;
export type {
  EMRClientConfig,
  EMRCapabilities,
  AuthResponse,
  LoginCredentials,
  UserPreferences,
  Workflow,
  WorkflowContext,
  Task,
  UIContext,
  UIState,
  NoteTemplate,
  NoteContext,
  OrderRecommendationContext,
  OrderRecommendation,
  RiskScoreParameters,
  RiskScoreResult,
  DrugInteraction,
  ClinicalReminder,
  AuditLogEntry,
  ClinicalCanvasContext
};
export { EMRClientError };