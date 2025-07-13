/**
 * CDS Hooks Service
 * Handles CRUD operations for custom CDS hooks
 * 
 * Migrated to TypeScript with comprehensive type safety using modern 2024-2025 patterns.
 */
import axios, { AxiosResponse, AxiosError } from 'axios';
import {
  FrontendHookConfiguration,
  BackendHookConfiguration,
  HookCondition,
  BackendCondition,
  BackendAction,
  ServiceResult,
  ValidationError,
  ICDSHooksService,
  CDSHooksServiceError,
  ConditionType,
  ConditionOperator,
  CreateHookRequest,
  UpdateHookRequest
} from '../types/cds-hooks';

class CDSHooksService implements ICDSHooksService {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = '/cds-hooks';
  }

  /**
   * Transform frontend hook data to backend HookConfiguration format
   */
  transformToBackendFormat(hookData: FrontendHookConfiguration): BackendHookConfiguration {
    // Transform frontend cards to backend actions
    const actions: BackendAction[] = hookData.cards.map(card => ({
      type: 'show-card',
      parameters: {
        summary: card.summary,
        detail: card.detail,
        indicator: card.indicator,
        source: { label: hookData.title },
        suggestions: card.suggestions || [],
        links: card.links || []
      }
    }));

    // Transform frontend conditions to backend conditions
    const conditions: BackendCondition[] = hookData.conditions.map(condition => ({
      type: this.mapConditionType(condition.type),
      parameters: this.buildConditionParameters(condition)
    }));

    // Build the backend configuration
    const backendConfig: BackendHookConfiguration = {
      id: hookData.id,
      hook: hookData.hook,
      title: hookData.title,
      description: hookData.description,
      enabled: hookData.enabled,
      conditions: conditions,
      actions: actions,
      prefetch: hookData.prefetch || {},
      usageRequirements: null
    };

    return backendConfig;
  }

  /**
   * Transform backend HookConfiguration to frontend format
   */
  transformToFrontendFormat(backendConfig: BackendHookConfiguration): FrontendHookConfiguration {
    // Transform backend actions to frontend cards
    const cards = backendConfig.actions.map((action, index) => ({
      id: `${Date.now()}-${index}`,
      summary: action.parameters.summary || '',
      detail: action.parameters.detail || '',
      indicator: action.parameters.indicator as 'info' | 'warning' | 'critical' || 'info',
      suggestions: action.parameters.suggestions || [],
      links: action.parameters.links || []
    }));

    // Transform backend conditions to frontend conditions
    const conditions: HookCondition[] = backendConfig.conditions.map((condition, index) => ({
      id: `${Date.now()}-${index}`,
      type: this.mapBackendConditionType(condition.type),
      operator: (condition.parameters.operator as ConditionOperator) || 'equals',
      value: condition.parameters.value,
      enabled: true
    }));

    return {
      id: backendConfig.id,
      title: backendConfig.title,
      description: backendConfig.description,
      hook: backendConfig.hook,
      enabled: backendConfig.enabled,
      conditions: conditions,
      cards: cards,
      prefetch: backendConfig.prefetch || {}
    };
  }

  /**
   * Map frontend condition types to backend types
   */
  private mapConditionType(frontendType: string): ConditionType {
    const typeMap: Record<string, ConditionType> = {
      'age': 'patient-age',
      'gender': 'patient-gender',
      'condition': 'diagnosis-code',
      'medication': 'medication-active',
      'lab_value': 'lab-value',
      'vital_sign': 'vital-sign'
    };
    return typeMap[frontendType] || (frontendType as ConditionType);
  }

  /**
   * Map backend condition types to frontend types
   */
  private mapBackendConditionType(backendType: ConditionType): string {
    const typeMap: Record<ConditionType, string> = {
      'patient-age': 'age',
      'patient-gender': 'gender',
      'diagnosis-code': 'condition',
      'medication-active': 'medication',
      'lab-value': 'lab_value',
      'vital-sign': 'vital_sign'
    };
    return typeMap[backendType] || backendType;
  }

  /**
   * Build condition parameters from frontend condition
   */
  private buildConditionParameters(condition: HookCondition): Record<string, unknown> {
    const parameters: Record<string, unknown> = {
      operator: condition.operator,
      value: condition.value
    };

    // Add type-specific parameters
    if (condition.type === 'age') {
      // Convert operator for age conditions
      if (condition.operator === 'greater_than') {
        parameters.operator = '>=';
      } else if (condition.operator === 'less_than') {
        parameters.operator = '<=';
      } else if (condition.operator === 'equals') {
        parameters.operator = '==';
      }
    }

    return parameters;
  }

  /**
   * Validate hook data before sending to backend
   */
  validateHookData(hookData: FrontendHookConfiguration): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!hookData.id || !hookData.id.trim()) {
      errors.push({ field: 'id', message: 'Hook ID is required' });
    }

    if (!hookData.title || !hookData.title.trim()) {
      errors.push({ field: 'title', message: 'Hook title is required' });
    }

    if (!hookData.hook) {
      errors.push({ field: 'hook', message: 'Hook type is required' });
    }

    if (!hookData.cards || hookData.cards.length === 0) {
      errors.push({ field: 'cards', message: 'At least one card must be defined' });
    }

    // Validate cards
    hookData.cards.forEach((card, index) => {
      if (!card.summary || !card.summary.trim()) {
        errors.push({ 
          field: `cards[${index}].summary`, 
          message: `Card ${index + 1}: Summary is required` 
        });
      }
    });

    // Validate conditions
    hookData.conditions.forEach((condition, index) => {
      if (!condition.type) {
        errors.push({ 
          field: `conditions[${index}].type`, 
          message: `Condition ${index + 1}: Type is required` 
        });
      }
      if (!condition.operator) {
        errors.push({ 
          field: `conditions[${index}].operator`, 
          message: `Condition ${index + 1}: Operator is required` 
        });
      }
      if (condition.value === '' || condition.value === null || condition.value === undefined) {
        errors.push({ 
          field: `conditions[${index}].value`, 
          message: `Condition ${index + 1}: Value is required` 
        });
      }
    });

    return errors;
  }

  /**
   * Create a new CDS hook
   */
  async createHook(hookData: FrontendHookConfiguration): Promise<ServiceResult<BackendHookConfiguration>> {
    try {
      // Validate the hook data
      const validationErrors = this.validateHookData(hookData);
      if (validationErrors.length > 0) {
        throw new CDSHooksServiceError(
          `Validation failed: ${validationErrors.map(e => e.message).join(', ')}`,
          400,
          'VALIDATION_ERROR',
          undefined,
          validationErrors
        );
      }

      // Transform to backend format
      const backendConfig = this.transformToBackendFormat(hookData);

      // Send to backend
      const response: AxiosResponse<BackendHookConfiguration> = await axios.post(
        `${this.baseUrl}/hooks`, 
        backendConfig
      );
      
      return {
        success: true,
        data: response.data,
        message: 'Hook created successfully'
      };
    } catch (error) {
      if (error instanceof CDSHooksServiceError) {
        throw error;
      }

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response?.status === 409) {
          throw new CDSHooksServiceError(
            'Hook ID already exists. Please choose a different ID.',
            409,
            'DUPLICATE_ID'
          );
        } else if (axiosError.response?.status === 400) {
          const detail = (axiosError.response.data as any)?.detail || axiosError.message;
          throw new CDSHooksServiceError(
            `Invalid hook data: ${detail}`,
            400,
            'INVALID_DATA'
          );
        }
      }

      throw new CDSHooksServiceError(
        `Failed to create hook: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'INTERNAL_ERROR'
      );
    }
  }

  /**
   * Update an existing CDS hook
   */
  async updateHook(hookId: string, hookData: FrontendHookConfiguration): Promise<ServiceResult<BackendHookConfiguration>> {
    try {
      // Validate the hook data
      const validationErrors = this.validateHookData(hookData);
      if (validationErrors.length > 0) {
        throw new CDSHooksServiceError(
          `Validation failed: ${validationErrors.map(e => e.message).join(', ')}`,
          400,
          'VALIDATION_ERROR',
          undefined,
          validationErrors
        );
      }

      // Ensure ID matches
      const updatedHookData = { ...hookData, id: hookId };

      // Transform to backend format
      const backendConfig = this.transformToBackendFormat(updatedHookData);

      // Send to backend
      const response: AxiosResponse<BackendHookConfiguration> = await axios.put(
        `${this.baseUrl}/hooks/${hookId}`, 
        backendConfig
      );
      
      return {
        success: true,
        data: response.data,
        message: 'Hook updated successfully'
      };
    } catch (error) {
      if (error instanceof CDSHooksServiceError) {
        throw error;
      }

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response?.status === 404) {
          throw new CDSHooksServiceError(
            'Hook not found',
            404,
            'NOT_FOUND'
          );
        } else if (axiosError.response?.status === 400) {
          const detail = (axiosError.response.data as any)?.detail || axiosError.message;
          throw new CDSHooksServiceError(
            `Invalid hook data: ${detail}`,
            400,
            'INVALID_DATA'
          );
        }
      }

      throw new CDSHooksServiceError(
        `Failed to update hook: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'INTERNAL_ERROR'
      );
    }
  }

  /**
   * Delete a CDS hook
   */
  async deleteHook(hookId: string): Promise<ServiceResult<void>> {
    try {
      await axios.delete(`${this.baseUrl}/hooks/${hookId}`);
      
      return {
        success: true,
        message: 'Hook deleted successfully'
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response?.status === 404) {
          throw new CDSHooksServiceError(
            'Hook not found',
            404,
            'NOT_FOUND'
          );
        }
      }

      throw new CDSHooksServiceError(
        `Failed to delete hook: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'INTERNAL_ERROR'
      );
    }
  }

  /**
   * Get a specific CDS hook
   */
  async getHook(hookId: string): Promise<ServiceResult<FrontendHookConfiguration>> {
    try {
      const response: AxiosResponse<BackendHookConfiguration> = await axios.get(
        `${this.baseUrl}/hooks/${hookId}`
      );
      
      // Transform to frontend format
      const frontendHook = this.transformToFrontendFormat(response.data);
      
      return {
        success: true,
        data: frontendHook
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response?.status === 404) {
          throw new CDSHooksServiceError(
            'Hook not found',
            404,
            'NOT_FOUND'
          );
        }
      }

      throw new CDSHooksServiceError(
        `Failed to get hook: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'INTERNAL_ERROR'
      );
    }
  }

  /**
   * List all custom CDS hooks
   */
  async listCustomHooks(): Promise<ServiceResult<FrontendHookConfiguration[]>> {
    try {
      const response: AxiosResponse<BackendHookConfiguration[]> = await axios.get(
        `${this.baseUrl}/hooks`
      );
      
      // Transform each hook to frontend format
      const frontendHooks = response.data.map(hook => this.transformToFrontendFormat(hook));
      
      return {
        success: true,
        data: frontendHooks
      };
    } catch (error) {
      throw new CDSHooksServiceError(
        `Failed to list hooks: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500,
        'INTERNAL_ERROR'
      );
    }
  }

  /**
   * Test a hook with sample data
   */
  async testHook(
    hookData: FrontendHookConfiguration, 
    testContext: Record<string, unknown> = {}
  ): Promise<ServiceResult<any>> {
    try {
      // Transform to backend format
      const backendConfig = this.transformToBackendFormat(hookData);

      // Create test request
      const testRequest = {
        hook: hookData.hook,
        hookInstance: `test-${Date.now()}`,
        context: {
          patientId: testContext.patientId || 'test-patient-123',
          userId: testContext.userId || 'test-user-456',
          ...testContext
        }
      };

      // For now, simulate a test by calling the hook execution endpoint
      // In a real implementation, this would be a dedicated test endpoint
      const response: AxiosResponse<any> = await axios.post(
        `${this.baseUrl}/cds-services/${backendConfig.id}`, 
        testRequest
      );
      
      return {
        success: true,
        data: response.data,
        message: 'Hook tested successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Hook test failed'
      };
    }
  }
}

// Export singleton instance
export const cdsHooksService = new CDSHooksService();

// Also export class for custom instances
export default CDSHooksService;
export { CDSHooksService };