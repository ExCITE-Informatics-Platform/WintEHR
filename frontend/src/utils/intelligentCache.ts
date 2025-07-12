/**
 * Intelligent Caching System - TypeScript Migration
 * Provides smart caching strategies for different types of EMR data
 * 
 * Migrated to TypeScript with comprehensive type safety for cache operations,
 * priority-based TTL management, and FHIR resource-specific caching strategies.
 */

import { FHIRResourceType } from '../types/fhir';

/**
 * Cache priority levels
 */
export enum CachePriority {
  CRITICAL = 'critical',   // 30 minutes
  IMPORTANT = 'important', // 15 minutes  
  NORMAL = 'normal',       // 10 minutes
  LOW = 'low'             // 5 minutes
}

/**
 * Cache entry interface
 */
export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  expiresAt: number;
  priority: CachePriority;
  resourceType?: FHIRResourceType;
  tags: string[];
  accessCount: number;
  lastAccessed: number;
}

/**
 * Cache options for set operation
 */
export interface CacheSetOptions {
  resourceType?: FHIRResourceType;
  priority?: CachePriority;
  customTTL?: number;
  tags?: string[];
}

/**
 * Cache statistics interface
 */
export interface CacheStats {
  totalEntries: number;
  expiredEntries: number;
  activeEntries: number;
  estimatedSizeBytes: number;
  estimatedSizeMB: string;
  priorityBreakdown: Record<CachePriority, number>;
  resourceTypeBreakdown: Record<string, number>;
  hitRate: string;
}

/**
 * Cache key generator types
 */
export type PatientResourceKey = `patient:${string}:${string}:${string}`;
export type SearchKey = `search:${string}:${string}:${string}`;
export type BundleKey = `bundle:${string}:${string}`;
export type CacheKey = string | PatientResourceKey | SearchKey | BundleKey;

/**
 * Intelligent cache implementation
 */
export class IntelligentCache {
  private cache: Map<CacheKey, CacheEntry>;
  private readonly priorityLevels = CachePriority;
  
  private readonly ttlMap: Record<CachePriority, number> = {
    [CachePriority.CRITICAL]: 30 * 60 * 1000,  // 30 minutes
    [CachePriority.IMPORTANT]: 15 * 60 * 1000, // 15 minutes
    [CachePriority.NORMAL]: 10 * 60 * 1000,    // 10 minutes
    [CachePriority.LOW]: 5 * 60 * 1000         // 5 minutes
  };
  
  // Define priority levels for different resource types
  private readonly resourcePriorities: Partial<Record<FHIRResourceType, CachePriority>> = {
    // Critical - rarely change, cache longer
    'Patient': CachePriority.CRITICAL,
    'AllergyIntolerance': CachePriority.CRITICAL,
    'Condition': CachePriority.IMPORTANT,
    'MedicationRequest': CachePriority.IMPORTANT,
    
    // Important - moderate change frequency
    'Encounter': CachePriority.IMPORTANT,
    'Procedure': CachePriority.IMPORTANT,
    'DiagnosticReport': CachePriority.IMPORTANT,
    
    // Normal - regular updates expected
    'Observation': CachePriority.NORMAL,
    'DocumentReference': CachePriority.NORMAL,
    'ImagingStudy': CachePriority.NORMAL,
    
    // Low - frequently updated or less critical
    'CareTeam': CachePriority.LOW,
    'CarePlan': CachePriority.LOW,
    'Coverage': CachePriority.LOW
  };
  
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly maxCacheSize = 1000;
  private readonly cleanupBatchSize = 100;
  
  constructor() {
    this.cache = new Map<CacheKey, CacheEntry>();
    // Automatically clean expired entries
    this.startCleanupTimer();
  }
  
  /**
   * Set cache entry with intelligent TTL based on data type
   */
  set<T = any>(key: CacheKey, data: T, options: CacheSetOptions = {}): CacheEntry<T> {
    const {
      resourceType,
      priority,
      customTTL,
      tags = []
    } = options;
    
    let ttl: number;
    if (customTTL !== undefined) {
      ttl = customTTL;
    } else if (priority) {
      ttl = this.ttlMap[priority];
    } else if (resourceType && this.resourcePriorities[resourceType]) {
      ttl = this.ttlMap[this.resourcePriorities[resourceType]];
    } else {
      ttl = this.ttlMap[CachePriority.NORMAL];
    }
    
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      expiresAt: Date.now() + ttl,
      priority: priority || (resourceType && this.resourcePriorities[resourceType]) || CachePriority.NORMAL,
      resourceType,
      tags,
      accessCount: 0,
      lastAccessed: Date.now()
    };
    
    this.cache.set(key, entry);
    
    // If cache is getting large, proactively clean low-priority items
    if (this.cache.size > this.maxCacheSize) {
      this.cleanupLowPriority();
    }
    
    return entry;
  }
  
  /**
   * Get cache entry with automatic cleanup of expired items
   */
  get<T = any>(key: CacheKey): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    
    return entry.data as T;
  }
  
  /**
   * Check if key exists and is not expired
   */
  has(key: CacheKey): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }
  
  /**
   * Delete specific cache entry
   */
  delete(key: CacheKey): boolean {
    return this.cache.delete(key);
  }
  
  /**
   * Clear all cache entries for a specific patient
   */
  clearPatient(patientId: string): number {
    const keysToDelete: CacheKey[] = [];
    
    for (const [key] of this.cache.entries()) {
      if (key.includes(patientId)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
    return keysToDelete.length;
  }
  
  /**
   * Clear entries by resource type
   */
  clearResourceType(resourceType: FHIRResourceType): number {
    const keysToDelete: CacheKey[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.resourceType === resourceType) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
    return keysToDelete.length;
  }
  
  /**
   * Clear entries by tags
   */
  clearByTag(tag: string): number {
    const keysToDelete: CacheKey[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags && entry.tags.includes(tag)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
    return keysToDelete.length;
  }
  
  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    let totalEntries = 0;
    let expiredEntries = 0;
    let totalSize = 0;
    const priorityStats: Partial<Record<CachePriority, number>> = {};
    const resourceTypeStats: Record<string, number> = {};
    
    const now = Date.now();
    
    for (const [, entry] of this.cache.entries()) {
      totalEntries++;
      
      if (now > entry.expiresAt) {
        expiredEntries++;
      }
      
      // Estimate size (rough approximation)
      try {
        totalSize += JSON.stringify(entry.data).length;
      } catch {
        // Handle circular references
        totalSize += 1000; // Rough estimate
      }
      
      // Priority stats
      if (!priorityStats[entry.priority]) {
        priorityStats[entry.priority] = 0;
      }
      priorityStats[entry.priority]!++;
      
      // Resource type stats
      if (entry.resourceType) {
        if (!resourceTypeStats[entry.resourceType]) {
          resourceTypeStats[entry.resourceType] = 0;
        }
        resourceTypeStats[entry.resourceType]++;
      }
    }
    
    return {
      totalEntries,
      expiredEntries,
      activeEntries: totalEntries - expiredEntries,
      estimatedSizeBytes: totalSize,
      estimatedSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      priorityBreakdown: priorityStats as Record<CachePriority, number>,
      resourceTypeBreakdown: resourceTypeStats,
      hitRate: this.calculateHitRate()
    };
  }
  
  /**
   * Calculate cache hit rate
   */
  private calculateHitRate(): string {
    let totalAccess = 0;
    let totalHits = 0;
    
    for (const [, entry] of this.cache.entries()) {
      totalAccess += entry.accessCount;
      if (entry.accessCount > 0) {
        totalHits++;
      }
    }
    
    return totalAccess > 0 ? ((totalHits / totalAccess) * 100).toFixed(2) : '0';
  }
  
  /**
   * Cleanup expired entries
   */
  cleanup(): number {
    const now = Date.now();
    const keysToDelete: CacheKey[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
    return keysToDelete.length;
  }
  
  /**
   * Cleanup low priority items when cache is full
   */
  private cleanupLowPriority(): void {
    const lowPriorityItems: Array<{ key: CacheKey; lastAccessed: number }> = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.priority === CachePriority.LOW) {
        lowPriorityItems.push({ key, lastAccessed: entry.lastAccessed });
      }
    }
    
    // Sort by least recently accessed and remove oldest
    lowPriorityItems
      .sort((a, b) => a.lastAccessed - b.lastAccessed)
      .slice(0, this.cleanupBatchSize)
      .forEach(item => this.cache.delete(item.key));
  }
  
  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    // Clean expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const cleaned = this.cleanup();
      if (cleaned > 0) {
        // Cleanup occurred - logged for monitoring
      }
    }, 5 * 60 * 1000);
  }
  
  /**
   * Stop automatic cleanup timer
   */
  stopCleanupTimer(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
  
  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }
  
  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size;
  }
  
  /**
   * Prefetch data for common access patterns
   */
  prefetch(patientId: string, priority: CachePriority = CachePriority.IMPORTANT): void {
    // Implementation would depend on specific prefetch strategy
    // This is a placeholder for prefetch logic that could:
    // 1. Analyze access patterns
    // 2. Predict likely next requests
    // 3. Pre-warm cache with anticipated data
    // For now, just mark the intention
    const prefetchKey = `prefetch:${patientId}:${priority}` as CacheKey;
    this.set(prefetchKey, { prefetched: true, patientId, priority }, { priority, tags: ['prefetch'] });
  }
}

// Create singleton instance
export const intelligentCache = new IntelligentCache();

/**
 * Cache utility functions with type-safe key generation
 */
export const cacheUtils = {
  /**
   * Generate cache key for patient resources
   */
  patientResourceKey: (
    patientId: string, 
    resourceType: string, 
    params: Record<string, any> = {}
  ): PatientResourceKey => {
    const paramString = Object.keys(params).length > 0 ? 
      JSON.stringify(params) : '';
    return `patient:${patientId}:${resourceType}:${paramString}`;
  },
  
  /**
   * Generate cache key for search results
   */
  searchKey: (
    query: string, 
    resourceType: string, 
    params: Record<string, any> = {}
  ): SearchKey => {
    return `search:${resourceType}:${query}:${JSON.stringify(params)}`;
  },
  
  /**
   * Generate cache key for bundles
   */
  bundleKey: (
    patientId: string, 
    priority: string = 'all'
  ): BundleKey => {
    return `bundle:${patientId}:${priority}`;
  },
  
  /**
   * Parse cache key to extract components
   */
  parseKey: (key: CacheKey): {
    type: 'patient' | 'search' | 'bundle' | 'other';
    components: string[];
  } => {
    const parts = key.split(':');
    const type = parts[0] as 'patient' | 'search' | 'bundle' | 'other';
    return {
      type: ['patient', 'search', 'bundle'].includes(type) ? type : 'other',
      components: parts.slice(1)
    };
  }
};

/**
 * Type guard for cache entries
 */
export function isCacheEntry<T = any>(obj: any): obj is CacheEntry<T> {
  return obj && 
    typeof obj === 'object' &&
    'data' in obj &&
    'timestamp' in obj &&
    'ttl' in obj &&
    'expiresAt' in obj &&
    'priority' in obj;
}

/**
 * Default export for backward compatibility
 */
export default intelligentCache;
