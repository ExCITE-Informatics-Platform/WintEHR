/**
 * useMigrations Hook
 * React hook for managing FHIR data migrations
 * 
 * Migrated to TypeScript with comprehensive type safety for migration operations.
 */
import { useState, useCallback, useEffect, useMemo } from 'react';
import { R4 } from '@ahryman40k/ts-fhir-types';
import MigrationManager from '../utils/migrations';

/**
 * Type definitions for migration operations
 */
export interface MigrationOptions {
  onProgress?: (progress: MigrationProgress) => void;
  dryRun?: boolean;
  force?: boolean;
  backup?: boolean;
  batchSize?: number;
  timeout?: number;
}

export interface MigrationProgress {
  processed: number;
  total: number;
  migrated: number;
  errors: number;
  currentResource?: string;
  currentStep?: string;
  percentage?: number;
}

export interface MigrationResult {
  success: boolean;
  resourcesProcessed: number;
  resourcesMigrated: number;
  errors: MigrationError[];
  warnings: string[];
  duration: number;
  migratedResources?: R4.IResourceList[];
  summary?: {
    [resourceType: string]: {
      processed: number;
      migrated: number;
      errors: number;
    };
  };
}

export interface MigrationError {
  resourceId: string;
  resourceType: string;
  error: string;
  stack?: string;
}

export interface MigrationStatus {
  resourceType?: string;
  totalResources: number;
  migratedResources: number;
  pendingResources: number;
  lastMigrationDate?: string;
  availableMigrations: string[];
  errors: MigrationError[];
}

export interface Migration {
  id: string;
  name: string;
  description: string;
  version: string;
  resourceTypes: string[];
  shouldRun: (resource: R4.IResourceList) => boolean;
  migrate: (resource: R4.IResourceList) => Promise<R4.IResourceList>;
  rollback?: (resource: R4.IResourceList) => Promise<R4.IResourceList>;
}

export interface MigrationsHookResult {
  // Actions
  migrateResource: (resource: R4.IResourceList, options?: MigrationOptions) => Promise<MigrationResult>;
  migrateResources: (resources: R4.IResourceList[], options?: MigrationOptions) => Promise<MigrationResult>;
  getMigrationStatus: (resourceType?: string) => Promise<MigrationStatus>;
  needsMigration: (resource: R4.IResourceList) => boolean;
  addMigration: (migration: Migration) => void;
  clearResults: () => void;

  // State
  isRunning: boolean;
  progress: MigrationProgress | null;
  lastResult: MigrationResult | null;
  migrationStatus: MigrationStatus | null;

  // Computed
  availableMigrations: Migration[];
  hasResults: boolean;
}

export interface MigrationProgressHookResult {
  progress: MigrationProgress | null;
  progressPercentage: number;
  isActive: boolean;
  startProgress: (total: number) => void;
  updateProgress: (update: Partial<MigrationProgress>) => void;
  finishProgress: () => void;
}

export interface ResourceMigrationHookResult {
  needsMigration: boolean;
  migrationResult: MigrationResult | null;
  isLoading: boolean;
  runMigration: (options?: MigrationOptions) => Promise<MigrationResult | null>;
  clearResult: () => void;
  hasResult: boolean;
}

/**
 * Main migrations hook
 */
export const useMigrations = (): MigrationsHookResult => {
  const [migrationManager] = useState(() => new MigrationManager());
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<MigrationProgress | null>(null);
  const [lastResult, setLastResult] = useState<MigrationResult | null>(null);
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus | null>(null);

  // Run migration on a single resource
  const migrateResource = useCallback(async (
    resource: R4.IResourceList, 
    options: MigrationOptions = {}
  ): Promise<MigrationResult> => {
    setIsRunning(true);
    try {
      const result = await migrationManager.migrateResource(resource, options);
      setLastResult(result);
      return result;
    } catch (error) {
      console.error('Migration failed:', error);
      throw error;
    } finally {
      setIsRunning(false);
    }
  }, [migrationManager]);

  // Run migrations on multiple resources
  const migrateResources = useCallback(async (
    resources: R4.IResourceList[], 
    options: MigrationOptions = {}
  ): Promise<MigrationResult> => {
    setIsRunning(true);
    setProgress({ processed: 0, total: resources.length, migrated: 0, errors: 0 });

    try {
      const result = await migrationManager.migrateResources(resources, {
        ...options,
        onProgress: (progressInfo: MigrationProgress) => {
          const enhancedProgress = {
            ...progressInfo,
            percentage: progressInfo.total > 0 ? Math.round((progressInfo.processed / progressInfo.total) * 100) : 0
          };
          setProgress(enhancedProgress);
          options.onProgress?.(enhancedProgress);
        }
      });
      
      setLastResult(result);
      return result;
    } catch (error) {
      console.error('Batch migration failed:', error);
      throw error;
    } finally {
      setIsRunning(false);
      setProgress(null);
    }
  }, [migrationManager]);

  // Get migration status for resource types
  const getMigrationStatus = useCallback(async (resourceType?: string): Promise<MigrationStatus> => {
    try {
      const status = await migrationManager.getMigrationStatus(resourceType);
      setMigrationStatus(status);
      return status;
    } catch (error) {
      console.error('Failed to get migration status:', error);
      throw error;
    }
  }, [migrationManager]);

  // Check if a resource needs migration
  const needsMigration = useCallback((resource: R4.IResourceList): boolean => {
    return migrationManager.migrations.some(migration => migration.shouldRun(resource));
  }, [migrationManager]);

  // Add custom migration
  const addMigration = useCallback((migration: Migration): void => {
    migrationManager.addMigration(migration);
  }, [migrationManager]);

  // Clear results
  const clearResults = useCallback((): void => {
    setLastResult(null);
    setProgress(null);
    setMigrationStatus(null);
  }, []);

  return {
    // Actions
    migrateResource,
    migrateResources,
    getMigrationStatus,
    needsMigration,
    addMigration,
    clearResults,

    // State
    isRunning,
    progress,
    lastResult,
    migrationStatus,

    // Computed
    availableMigrations: migrationManager.migrations,
    hasResults: !!lastResult
  };
};

/**
 * Hook for monitoring migration progress
 */
export const useMigrationProgress = (
  onProgress?: (progress: MigrationProgress) => void
): MigrationProgressHookResult => {
  const [progress, setProgress] = useState<MigrationProgress | null>(null);
  const [isActive, setIsActive] = useState<boolean>(false);

  const startProgress = useCallback((total: number): void => {
    setIsActive(true);
    setProgress({ processed: 0, total, migrated: 0, errors: 0 });
  }, []);

  const updateProgress = useCallback((update: Partial<MigrationProgress>): void => {
    setProgress(prev => {
      if (!prev) return null;
      const newProgress = { ...prev, ...update };
      onProgress?.(newProgress);
      return newProgress;
    });
  }, [onProgress]);

  const finishProgress = useCallback((): void => {
    setIsActive(false);
  }, []);

  const progressPercentage = useMemo((): number => {
    if (!progress || progress.total === 0) return 0;
    return Math.round((progress.processed / progress.total) * 100);
  }, [progress]);

  return {
    progress,
    progressPercentage,
    isActive,
    startProgress,
    updateProgress,
    finishProgress
  };
};

/**
 * Hook for resource-specific migrations
 */
export const useResourceMigration = (
  resource: R4.IResourceList | null
): ResourceMigrationHookResult => {
  const { migrateResource, needsMigration: checkNeedsMigration } = useMigrations();
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const needsMigration = useMemo((): boolean => {
    if (!resource) return false;
    return checkNeedsMigration(resource);
  }, [resource, checkNeedsMigration]);

  const runMigration = useCallback(async (
    options: MigrationOptions = {}
  ): Promise<MigrationResult | null> => {
    if (!resource) return null;

    setIsLoading(true);
    try {
      const result = await migrateResource(resource, options);
      setMigrationResult(result);
      return result;
    } finally {
      setIsLoading(false);
    }
  }, [resource, migrateResource]);

  const clearResult = useCallback((): void => {
    setMigrationResult(null);
  }, []);

  return {
    needsMigration,
    migrationResult,
    isLoading,
    runMigration,
    clearResult,
    hasResult: !!migrationResult
  };
};

/**
 * Hook for batch migration operations with enhanced monitoring
 */
export const useBatchMigration = (): {
  migrateByResourceType: (resourceType: string, options?: MigrationOptions) => Promise<MigrationResult>;
  migrateAllPending: (options?: MigrationOptions) => Promise<MigrationResult>;
  getResourceTypeStatus: (resourceType: string) => Promise<MigrationStatus>;
  isRunning: boolean;
  progress: MigrationProgress | null;
  lastResult: MigrationResult | null;
} => {
  const { migrateResources, getMigrationStatus, isRunning, progress, lastResult } = useMigrations();

  const migrateByResourceType = useCallback(async (
    resourceType: string, 
    options: MigrationOptions = {}
  ): Promise<MigrationResult> => {
    // Implementation would fetch resources of specific type and migrate them
    // This is a placeholder - actual implementation would depend on data access layer
    throw new Error('migrateByResourceType not yet implemented');
  }, [migrateResources]);

  const migrateAllPending = useCallback(async (
    options: MigrationOptions = {}
  ): Promise<MigrationResult> => {
    // Implementation would fetch all pending resources and migrate them
    // This is a placeholder - actual implementation would depend on data access layer
    throw new Error('migrateAllPending not yet implemented');
  }, [migrateResources]);

  const getResourceTypeStatus = useCallback(async (
    resourceType: string
  ): Promise<MigrationStatus> => {
    return getMigrationStatus(resourceType);
  }, [getMigrationStatus]);

  return {
    migrateByResourceType,
    migrateAllPending,
    getResourceTypeStatus,
    isRunning,
    progress,
    lastResult
  };
};

export default useMigrations;