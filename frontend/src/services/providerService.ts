/**
 * Provider Service
 * Centralized service for resolving and managing provider information from FHIR resources
 * 
 * Migrated to TypeScript with comprehensive type safety using FHIR R4 types.
 */

import { R4 } from '@ahryman40k/ts-fhir-types';
import { fhirClient } from './fhirClient';

/**
 * Type definitions for provider service
 */
export interface ProviderInfo {
  id: string | null;
  name: string;
  display: string;
  firstName?: string;
  lastName?: string;
  prefix?: string;
  suffix?: string;
  specialty?: string;
  npi?: string;
  active?: boolean;
  type?: 'practitioner' | 'organization';
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Extended encounter interface for legacy support
 */
export interface EncounterWithExtensions extends R4.IEncounter {
  // Support for any additional extensions that might exist
}

class ProviderService {
  private readonly providerCache: Map<string, CacheEntry<ProviderInfo | R4.IOrganization | null>>;
  private readonly cacheTimeout: number;

  constructor() {
    this.providerCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Resolve provider information from an encounter
   */
  async resolveProviderFromEncounter(encounter: EncounterWithExtensions): Promise<ProviderInfo | null> {
    try {
      // Method 1: Check encounter participant for practitioner
      if (encounter.participant && encounter.participant.length > 0) {
        for (const participant of encounter.participant) {
          if (participant.individual && participant.individual.reference) {
            const providerRef = participant.individual.reference;
            if (providerRef.startsWith('Practitioner/')) {
              const providerId = providerRef.split('/').pop();
              if (providerId) {
                return await this.getProviderById(providerId);
              }
            }
          }
          
          // Check if display name is available directly
          if (participant.individual && participant.individual.display) {
            return {
              id: null,
              name: participant.individual.display,
              display: participant.individual.display
            };
          }
        }
      }

      // Method 2: Check encounter serviceProvider
      if (encounter.serviceProvider && encounter.serviceProvider.reference) {
        const orgRef = encounter.serviceProvider.reference;
        if (orgRef.startsWith('Organization/')) {
          const orgId = orgRef.split('/').pop();
          if (orgId) {
            const org = await this.getOrganizationById(orgId);
            if (org) {
              return {
                id: orgId,
                name: org.name || 'Unknown Organization',
                display: org.name || 'Unknown Organization',
                type: 'organization'
              };
            }
          }
        }
      }

      // Method 3: Check for practitioner in encounter extensions
      if (encounter.extension) {
        for (const ext of encounter.extension) {
          if (ext.valueReference && ext.valueReference.reference) {
            const ref = ext.valueReference.reference;
            if (ref.startsWith('Practitioner/')) {
              const providerId = ref.split('/').pop();
              if (providerId) {
                return await this.getProviderById(providerId);
              }
            }
          }
        }
      }

      return null;
    } catch (error) {
      console.warn('Error resolving provider from encounter:', error);
      return null;
    }
  }

  /**
   * Get provider by ID with caching
   */
  async getProviderById(providerId: string): Promise<ProviderInfo | null> {
    try {
      // Check cache first
      const cacheKey = `provider_${providerId}`;
      const cached = this.providerCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
        return cached.data as ProviderInfo | null;
      }

      // Fetch from FHIR server
      const practitioner = await fhirClient.read('Practitioner', providerId) as R4.IPractitioner;
      
      const providerInfo = this.transformPractitioner(practitioner);
      
      // Cache the result
      this.providerCache.set(cacheKey, {
        data: providerInfo,
        timestamp: Date.now()
      });

      return providerInfo;
    } catch (error) {
      console.warn(`Error fetching provider ${providerId}:`, error);
      return null;
    }
  }

  /**
   * Get organization by ID
   */
  async getOrganizationById(orgId: string): Promise<R4.IOrganization | null> {
    try {
      const cacheKey = `org_${orgId}`;
      const cached = this.providerCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
        return cached.data as R4.IOrganization | null;
      }

      const organization = await fhirClient.read('Organization', orgId) as R4.IOrganization;
      
      // Cache the result
      this.providerCache.set(cacheKey, {
        data: organization,
        timestamp: Date.now()
      });

      return organization;
    } catch (error) {
      console.warn(`Error fetching organization ${orgId}:`, error);
      return null;
    }
  }

  /**
   * Transform FHIR Practitioner resource to simplified format
   */
  transformPractitioner(practitioner: R4.IPractitioner | null): ProviderInfo | null {
    if (!practitioner) return null;

    const name = practitioner.name?.[0] || {};
    const firstName = name.given?.join(' ') || '';
    const lastName = name.family || '';
    const prefix = name.prefix?.join(' ') || '';
    const suffix = name.suffix?.join(' ') || '';
    
    let displayName = '';
    if (prefix) displayName += `${prefix} `;
    displayName += `${firstName} ${lastName}`.trim();
    if (suffix) displayName += `, ${suffix}`;
    
    // Extract specialty from qualification
    let specialty = '';
    if (practitioner.qualification && practitioner.qualification.length > 0) {
      const qual = practitioner.qualification[0];
      specialty = qual.code?.text || qual.code?.coding?.[0]?.display || '';
    }

    // Extract NPI from identifier
    let npi = '';
    if (practitioner.identifier) {
      const npiIdentifier = practitioner.identifier.find(id => 
        id.system === 'http://hl7.org/fhir/sid/us-npi' ||
        id.type?.coding?.[0]?.code === 'NPI'
      );
      npi = npiIdentifier?.value || '';
    }

    return {
      id: practitioner.id || null,
      name: displayName.trim() || 'Unknown Provider',
      display: displayName.trim() || 'Unknown Provider',
      firstName,
      lastName,
      prefix,
      suffix,
      specialty,
      npi,
      active: practitioner.active !== false,
      type: 'practitioner'
    };
  }

  /**
   * Search for providers
   */
  async searchProviders(searchTerm: string, limit: number = 10): Promise<ProviderInfo[]> {
    try {
      const result = await fhirClient.search('Practitioner', {
        name: searchTerm,
        _count: limit.toString(),
        active: 'true'
      });

      if (!result.resources || !Array.isArray(result.resources)) {
        return [];
      }

      return result.resources
        .map(practitioner => this.transformPractitioner(practitioner as R4.IPractitioner))
        .filter((provider): provider is ProviderInfo => provider !== null);
    } catch (error) {
      console.warn('Error searching providers:', error);
      return [];
    }
  }

  /**
   * Get all active providers
   */
  async getAllProviders(limit: number = 50): Promise<ProviderInfo[]> {
    try {
      const result = await fhirClient.search('Practitioner', {
        _count: limit.toString(),
        active: 'true',
        _sort: 'family'
      });

      if (!result.resources || !Array.isArray(result.resources)) {
        return [];
      }

      return result.resources
        .map(practitioner => this.transformPractitioner(practitioner as R4.IPractitioner))
        .filter((provider): provider is ProviderInfo => provider !== null);
    } catch (error) {
      console.warn('Error fetching all providers:', error);
      return [];
    }
  }

  /**
   * Clear provider cache
   */
  clearCache(): void {
    this.providerCache.clear();
  }

  /**
   * Get provider display name with fallback
   */
  getProviderDisplayName(provider: ProviderInfo | string | null | undefined): string {
    if (!provider) return 'Unknown Provider';
    
    if (typeof provider === 'string') return provider;
    
    return provider.display || provider.name || 'Unknown Provider';
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.providerCache.size,
      entries: Array.from(this.providerCache.keys())
    };
  }

  /**
   * Clean expired cache entries
   */
  cleanExpiredCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.providerCache.forEach((value, key) => {
      if ((now - value.timestamp) > this.cacheTimeout) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.providerCache.delete(key));
  }

  /**
   * Preload providers for given encounter IDs
   */
  async preloadProvidersForEncounters(encounters: EncounterWithExtensions[]): Promise<void> {
    const providerPromises = encounters.map(encounter => 
      this.resolveProviderFromEncounter(encounter).catch(() => null)
    );

    await Promise.allSettled(providerPromises);
  }
}

// Export singleton instance
export const providerService = new ProviderService();

// Also export class for custom instances
export default ProviderService;
export { ProviderService };