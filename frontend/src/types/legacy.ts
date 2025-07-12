/**
 * Legacy type definitions for compatibility during migration
 * 
 * These types provide compatibility with existing JavaScript code
 * and will be removed after the migration is complete.
 */

/**
 * Temporary any types for JavaScript compatibility
 * These should be gradually replaced with proper types
 */
export type LegacyAny = any;

/**
 * Legacy prop types for components not yet migrated
 */
export interface LegacyComponentProps {
  [key: string]: any;
}

/**
 * Legacy context types
 */
export interface LegacyContextValue {
  [key: string]: any;
}

/**
 * Legacy hook return types
 */
export interface LegacyHookReturn {
  [key: string]: any;
}

/**
 * Legacy service types
 */
export interface LegacyServiceResponse {
  data?: any;
  error?: any;
  status?: number;
  [key: string]: any;
}

/**
 * Legacy FHIR types (to be replaced with proper types)
 */
export interface LegacyFHIRResource {
  resourceType: string;
  id?: string;
  meta?: any;
  [key: string]: any;
}

export interface LegacyBundle {
  resourceType: 'Bundle';
  type?: string;
  entry?: LegacyBundleEntry[];
  total?: number;
  [key: string]: any;
}

export interface LegacyBundleEntry {
  resource?: LegacyFHIRResource;
  fullUrl?: string;
  [key: string]: any;
}

/**
 * Legacy event types
 */
export interface LegacyEvent {
  type: string;
  data?: any;
  [key: string]: any;
}

/**
 * Migration utility types
 */
export type ToBeTyped = any; // Marker for items that need proper typing
export type MigrationTodo = any; // Marker for items pending migration

/**
 * Compatibility functions for gradual migration
 */
export function isLegacyResource(obj: any): obj is LegacyFHIRResource {
  return obj && typeof obj === 'object' && typeof obj.resourceType === 'string';
}

export function isLegacyBundle(obj: any): obj is LegacyBundle {
  return obj && obj.resourceType === 'Bundle';
}

/**
 * Type assertions for migration period
 */
export function assertResource<T>(obj: any): T {
  // Basic validation - to be enhanced during migration
  if (!obj || typeof obj !== 'object') {
    throw new Error('Invalid resource object');
  }
  return obj as T;
}

export function assertBundle(obj: any): LegacyBundle {
  if (!isLegacyBundle(obj)) {
    throw new Error('Invalid bundle object');
  }
  return obj;
}

/**
 * Migration helper types
 */
export interface MigrationStatus {
  file: string;
  status: 'pending' | 'in-progress' | 'completed';
  issues?: string[];
  lastUpdated: Date;
}

export interface TypeMigrationMap {
  [key: string]: {
    before: string;
    after: string;
    migrated: boolean;
  };
}