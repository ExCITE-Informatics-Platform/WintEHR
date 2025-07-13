/**
 * UI Composer Service
 * Handles communication with the backend UI Composer API
 * 
 * Migrated to TypeScript with comprehensive type safety for UI composition operations.
 */

/**
 * Type definitions for UI Composer service
 */
export interface UIComposerContext {
  patientId?: string;
  userId?: string;
  currentView?: string;
  availableData?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface UIComposerAnalysisResult {
  success: boolean;
  analysis: {
    intent: string;
    components_suggested: string[];
    complexity: 'low' | 'medium' | 'high';
    estimated_time: number;
  };
  specification?: UISpecification;
  session_id?: string;
  error?: string;
}

export interface UISpecification {
  version: string;
  metadata: {
    name: string;
    description: string;
    created_at: string;
    ui_type: string;
  };
  layout: {
    type: 'grid' | 'flex' | 'tabs' | 'accordion';
    columns?: number;
    spacing?: number;
  };
  components: UIComponent[];
}

export interface UIComponent {
  id: string;
  type: string;
  props: Record<string, unknown>;
  position: {
    row: number;
    column: number;
    width?: number;
    height?: number;
  };
  data_requirements?: string[];
  dependencies?: string[];
}

export interface UIGenerationResult {
  success: boolean;
  specification: UISpecification;
  code?: {
    jsx: string;
    css?: string;
    imports: string[];
  };
  session_id?: string;
  error?: string;
  progressive_status?: {
    step: number;
    total_steps: number;
    current_stage: string;
  };
}

export interface UIRefinementResult {
  success: boolean;
  specification: UISpecification;
  changes_applied: string[];
  session_id?: string;
  error?: string;
}

export interface UISaveResult {
  success: boolean;
  dashboard_id: string;
  message: string;
  error?: string;
}

export interface UISession {
  session_id: string;
  created_at: string;
  last_activity: string;
  request_count: number;
  total_cost?: number;
  specifications: UISpecification[];
}

export interface ClaudeTestResult {
  available: boolean;
  path?: string;
  version?: string;
  error?: string;
  method_status?: Record<string, boolean>;
}

export interface UIComposerStatus {
  serviceAvailable: boolean;
  claudeAvailable: boolean;
  claudePath?: string;
  claudeVersion?: string;
  error?: string;
  method_status?: Record<string, boolean>;
}

export interface SessionCostInfo {
  session_id: string;
  total_tokens: number;
  total_cost: number;
  request_count: number;
  cost_breakdown: {
    input_tokens: number;
    output_tokens: number;
    input_cost: number;
    output_cost: number;
  };
}

export type UIComposerMethod = 'claude' | 'fallback' | 'hybrid' | null;
export type FeedbackType = 'general' | 'component-specific' | 'layout' | 'styling' | 'functionality';

/**
 * UI Composer Service Error
 */
export class UIComposerServiceError extends Error {
  public status?: number;
  public code?: string;
  public details?: unknown;

  constructor(message: string, status?: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'UIComposerServiceError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

class UIComposerService {
  private readonly baseUrl: string;
  private sessionId: string | null;

  constructor() {
    this.baseUrl = '/api/ui-composer';
    this.sessionId = null;
  }

  /**
   * Set session ID for conversation continuity
   */
  setSessionId(sessionId: string | null): void {
    this.sessionId = sessionId;
  }

  /**
   * Get current session ID
   */
  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Test if Claude CLI is available on the backend
   */
  async testClaude(): Promise<ClaudeTestResult> {
    try {
      const response = await fetch(`${this.baseUrl}/test-claude`);
      const data: ClaudeTestResult = await response.json();
      return data;
    } catch (error) {
      return {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Analyze natural language UI request
   */
  async analyzeRequest(
    request: string, 
    context: UIComposerContext = {}, 
    method: UIComposerMethod = null
  ): Promise<UIComposerAnalysisResult> {
    try {
      const response = await fetch(`${this.baseUrl}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          request,
          context,
          session_id: this.sessionId,
          method
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new UIComposerServiceError(
          error.detail || 'Failed to analyze request',
          response.status,
          'ANALYSIS_FAILED'
        );
      }

      const data: UIComposerAnalysisResult = await response.json();
      
      // Update session ID if returned
      if (data.session_id) {
        this.sessionId = data.session_id;
      }

      return data;
    } catch (error) {
      if (error instanceof UIComposerServiceError) {
        throw error;
      }
      throw new UIComposerServiceError(
        `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'INTERNAL_ERROR'
      );
    }
  }

  /**
   * Generate UI components from specification
   */
  async generateUI(
    specification: UISpecification, 
    progressive: boolean = true, 
    method: UIComposerMethod = null
  ): Promise<UIGenerationResult> {
    try {
      const response = await fetch(`${this.baseUrl}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          specification,
          session_id: this.sessionId,
          progressive,
          method
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new UIComposerServiceError(
          error.detail || 'Failed to generate UI',
          response.status,
          'GENERATION_FAILED'
        );
      }

      const data: UIGenerationResult = await response.json();
      
      // Update session ID if returned
      if (data.session_id) {
        this.sessionId = data.session_id;
      }

      return data;
    } catch (error) {
      if (error instanceof UIComposerServiceError) {
        throw error;
      }
      throw new UIComposerServiceError(
        `Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'INTERNAL_ERROR'
      );
    }
  }

  /**
   * Refine UI based on user feedback
   */
  async refineUI(
    feedback: string, 
    specification: UISpecification, 
    feedbackType: FeedbackType = 'general', 
    selectedComponent: string | null = null, 
    method: UIComposerMethod = null
  ): Promise<UIRefinementResult> {
    try {
      const response = await fetch(`${this.baseUrl}/refine`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          feedback,
          feedback_type: feedbackType,
          specification,
          selected_component: selectedComponent,
          session_id: this.sessionId,
          method
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new UIComposerServiceError(
          error.detail || 'Failed to refine UI',
          response.status,
          'REFINEMENT_FAILED'
        );
      }

      const data: UIRefinementResult = await response.json();
      
      // Update session ID if returned
      if (data.session_id) {
        this.sessionId = data.session_id;
      }

      return data;
    } catch (error) {
      if (error instanceof UIComposerServiceError) {
        throw error;
      }
      throw new UIComposerServiceError(
        `Refinement failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'INTERNAL_ERROR'
      );
    }
  }

  /**
   * Save dashboard specification
   */
  async saveDashboard(
    name: string, 
    description: string, 
    specification: UISpecification, 
    metadata: Record<string, unknown> = {}
  ): Promise<UISaveResult> {
    try {
      const response = await fetch(`${this.baseUrl}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          name,
          description,
          specification,
          metadata
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new UIComposerServiceError(
          error.detail || 'Failed to save dashboard',
          response.status,
          'SAVE_FAILED'
        );
      }

      const data: UISaveResult = await response.json();
      return data;
    } catch (error) {
      if (error instanceof UIComposerServiceError) {
        throw error;
      }
      throw new UIComposerServiceError(
        `Save failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'INTERNAL_ERROR'
      );
    }
  }

  /**
   * Get session information
   */
  async getSession(sessionId: string): Promise<UISession> {
    try {
      const response = await fetch(`${this.baseUrl}/sessions/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new UIComposerServiceError(
          error.detail || 'Failed to get session',
          response.status,
          'SESSION_NOT_FOUND'
        );
      }

      const data: UISession = await response.json();
      return data;
    } catch (error) {
      if (error instanceof UIComposerServiceError) {
        throw error;
      }
      throw new UIComposerServiceError(
        `Get session failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'INTERNAL_ERROR'
      );
    }
  }

  /**
   * Create a new session
   */
  createNewSession(): string | null {
    this.sessionId = null;
    return this.sessionId;
  }

  /**
   * Check if backend service is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const result = await this.testClaude();
      return result.available === true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get service status including Claude availability
   */
  async getStatus(): Promise<UIComposerStatus> {
    try {
      const claudeTest = await this.testClaude();
      return {
        serviceAvailable: true,
        claudeAvailable: claudeTest.available,
        claudePath: claudeTest.path,
        claudeVersion: claudeTest.version,
        error: claudeTest.error,
        method_status: claudeTest.method_status
      };
    } catch (error) {
      return {
        serviceAvailable: false,
        claudeAvailable: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        method_status: {}
      };
    }
  }

  /**
   * Get cost information for a session
   */
  async getSessionCost(sessionId: string): Promise<SessionCostInfo> {
    try {
      const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/cost`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new UIComposerServiceError(
          error.detail || 'Failed to get session cost',
          response.status,
          'COST_RETRIEVAL_FAILED'
        );
      }

      const data: SessionCostInfo = await response.json();
      return data;
    } catch (error) {
      if (error instanceof UIComposerServiceError) {
        throw error;
      }
      throw new UIComposerServiceError(
        `Get session cost failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'INTERNAL_ERROR'
      );
    }
  }
}

// Export singleton instance
export const uiComposerService = new UIComposerService();

// Also export class for testing
export default UIComposerService;
export { UIComposerService };