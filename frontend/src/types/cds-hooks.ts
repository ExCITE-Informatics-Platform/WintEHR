/**
 * CDS Hooks TypeScript Type Definitions
 * 
 * Comprehensive types for CDS Hooks 1.0/2.0 implementation with FHIR R4 integration.
 * Based on modern 2024-2025 TypeScript patterns and CDS Hooks specification.
 */

import { R4 } from '@ahryman40k/ts-fhir-types';

/**
 * CDS Hook types following CDS Hooks 1.0/2.0 specification
 */
export type HookType = 
  | 'patient-view'
  | 'medication-prescribe' 
  | 'order-sign'
  | 'order-select'
  | 'encounter-start'
  | 'encounter-discharge'
  | string; // Allow custom hooks

/**
 * Condition types for hook triggering
 */
export type ConditionType = 
  | 'patient-age'
  | 'patient-gender'
  | 'diagnosis-code'
  | 'medication-active'
  | 'lab-value'
  | 'vital-sign';

/**
 * Operators for condition evaluation
 */
export type ConditionOperator = 
  | 'equals'
  | 'not-equals'
  | 'greater-than'
  | 'less-than'
  | 'greater-than-or-equal'
  | 'less-than-or-equal'
  | 'contains'
  | 'in'
  | 'not-in'
  | '>='
  | '<='
  | '=='
  | '!='
  | '>'
  | '<';

/**
 * Hook condition interface
 */
export interface HookCondition {
  id: string;
  type: ConditionType;
  operator: ConditionOperator;
  value: string | number | boolean | string[];
  enabled: boolean;
  parameters?: Record<string, unknown>;
}

/**
 * Card suggestion action interface
 */
export interface CardSuggestionAction {
  type: string;
  description: string;
  resource?: R4.IResourceList;
  resourceId?: string;
}

/**
 * Card suggestion interface
 */
export interface CardSuggestion {
  label: string;
  uuid?: string;
  isRecommended?: boolean;
  actions?: CardSuggestionAction[];
}

/**
 * Card link interface
 */
export interface CardLink {
  label: string;
  url: string;
  type: string;
  appContext?: string;
}

/**
 * Card source interface
 */
export interface CardSource {
  label: string;
  url?: string;
  icon?: string;
  topic?: {
    system: string;
    code: string;
    display?: string;
  };
}

/**
 * Hook card interface
 */
export interface HookCard {
  id: string;
  summary: string;
  detail?: string;
  indicator: 'info' | 'warning' | 'critical';
  suggestions?: CardSuggestion[];
  links?: CardLink[];
  source?: CardSource;
  selectionBehavior?: 'absolute' | 'any' | 'all' | 'all-or-none' | 'exactly-one' | 'one-or-more';
  overrideReasons?: Array<{
    code: string;
    display: string;
    system?: string;
  }>;
}

/**
 * Frontend hook configuration (what users see/edit)
 */
export interface FrontendHookConfiguration {
  id: string;
  title: string;
  description: string;
  hook: HookType;
  enabled: boolean;
  conditions: HookCondition[];
  cards: HookCard[];
  prefetch?: Record<string, string>;
}

/**
 * Backend condition interface
 */
export interface BackendCondition {
  type: ConditionType;
  parameters: {
    operator: string;
    value: string | number | boolean;
    [key: string]: unknown;
  };
}

/**
 * Backend action interface
 */
export interface BackendAction {
  type: 'show-card';
  parameters: {
    summary: string;
    detail?: string;
    indicator: string;
    source: { label: string };
    suggestions?: CardSuggestion[];
    links?: CardLink[];
  };
}

/**
 * Backend hook configuration (what gets sent to server)
 */
export interface BackendHookConfiguration {
  id: string;
  hook: HookType;
  title: string;
  description: string;
  enabled: boolean;
  conditions: BackendCondition[];
  actions: BackendAction[];
  prefetch?: Record<string, string>;
  usageRequirements?: string | null;
}

/**
 * Service operation result interface
 */
export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

/**
 * Validation error interface
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * CDS Hooks service error class
 */
export class CDSHooksServiceError extends Error {
  public status?: number;
  public code?: string;
  public details?: unknown;
  public validationErrors?: ValidationError[];

  constructor(
    message: string, 
    status?: number, 
    code?: string, 
    details?: unknown,
    validationErrors?: ValidationError[]
  ) {
    super(message);
    this.name = 'CDSHooksServiceError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.validationErrors = validationErrors;
  }
}

/**
 * CDS Hooks service interface
 */
export interface ICDSHooksService {
  createHook(hookData: FrontendHookConfiguration): Promise<ServiceResult<BackendHookConfiguration>>;
  updateHook(hookId: string, hookData: FrontendHookConfiguration): Promise<ServiceResult<BackendHookConfiguration>>;
  deleteHook(hookId: string): Promise<ServiceResult<void>>;
  getHook(hookId: string): Promise<ServiceResult<FrontendHookConfiguration>>;
  listCustomHooks(): Promise<ServiceResult<FrontendHookConfiguration[]>>;
  testHook(hookData: FrontendHookConfiguration, testContext?: Record<string, unknown>): Promise<ServiceResult<any>>;
  validateHookData(hookData: FrontendHookConfiguration): ValidationError[];
  transformToBackendFormat(hookData: FrontendHookConfiguration): BackendHookConfiguration;
  transformToFrontendFormat(backendConfig: BackendHookConfiguration): FrontendHookConfiguration;
}

/**
 * Utility types for safer operations
 */
export type HookConfigurationWithId = FrontendHookConfiguration & { id: string };
export type PartialHookConfiguration = Partial<FrontendHookConfiguration>;
export type CreateHookRequest = Omit<FrontendHookConfiguration, 'id'>;
export type UpdateHookRequest = Partial<Omit<FrontendHookConfiguration, 'id'>>;

/**
 * Type guards for runtime type checking
 */
export function isValidHookType(hook: string): hook is HookType {
  const validHooks = ['patient-view', 'medication-prescribe', 'order-sign', 'order-select', 'encounter-start', 'encounter-discharge'];
  return validHooks.includes(hook) || typeof hook === 'string';
}

export function isValidConditionType(type: string): type is ConditionType {
  const validTypes = ['patient-age', 'patient-gender', 'diagnosis-code', 'medication-active', 'lab-value', 'vital-sign'];
  return validTypes.includes(type);
}

export function isValidConditionOperator(operator: string): operator is ConditionOperator {
  const validOperators = ['equals', 'not-equals', 'greater-than', 'less-than', 'greater-than-or-equal', 'less-than-or-equal', 'contains', 'in', 'not-in', '>=', '<=', '==', '!=', '>', '<'];
  return validOperators.includes(operator);
}