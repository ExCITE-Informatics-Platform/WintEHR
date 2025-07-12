/**
 * Search Service
 * Provides unified search functionality across all clinical catalogs
 * 
 * Migrated to TypeScript with comprehensive type safety and caching patterns.
 */

import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';

/**
 * Cache item interface with timestamp for TTL
 */
interface CacheItem<T> {
  data: T;
  timestamp: number;
}

/**
 * Basic catalog item interface
 */
interface CatalogItem {
  id?: string;
  code?: string;
  display?: string;
  name?: string;
  system?: string;
}

/**
 * Condition catalog item
 */
interface ConditionItem extends CatalogItem {
  source?: string;
}

/**
 * Medication catalog item
 */
interface MedicationItem extends CatalogItem {
  form?: string;
  status?: string;
  route?: string;
}

/**
 * Lab test catalog item
 */
interface LabTestItem extends CatalogItem {
  type?: string;
}

/**
 * Imaging procedure catalog item
 */
interface ImagingProcedureItem extends CatalogItem {
  category?: string;
}

/**
 * Procedure catalog item
 */
interface ProcedureItem extends CatalogItem {
  category?: string;
}

/**
 * Document type catalog item
 */
interface DocumentTypeItem extends CatalogItem {
  category?: string;
}

/**
 * Practitioner catalog item
 */
interface PractitionerItem extends CatalogItem {
  specialty?: string;
  organization?: string;
  active?: boolean;
}

/**
 * Organization catalog item
 */
interface OrganizationItem extends CatalogItem {
  type?: string;
  active?: boolean;
}

/**
 * Vaccine catalog item
 */
interface VaccineItem extends CatalogItem {
  manufacturer?: string;
  type?: string;
}

/**
 * Allergen catalog item
 */
interface AllergenItem extends CatalogItem {
  category: 'medication' | 'food' | 'environment';
  source: string;
}

/**
 * Search all results interface
 */
interface SearchAllResults {
  medications: MedicationItem[];
  labTests: LabTestItem[];
  imagingProcedures: ImagingProcedureItem[];
  conditions: ConditionItem[];
  procedures: ProcedureItem[];
  documentTypes: DocumentTypeItem[];
  practitioners: PractitionerItem[];
  vaccines: VaccineItem[];
}

/**
 * Formatted catalog items for consistent display
 */
interface FormattedMedication {
  id?: string;
  display: string;
  code?: string;
  system: string;
  form?: string;
  status: string;
  route: string;
}

interface FormattedCondition {
  code?: string;
  display: string;
  system: string;
  source: string;
}

interface FormattedLabTest {
  code?: string;
  display: string;
  system: string;
  type: string;
}

interface FormattedProcedure {
  code?: string;
  display: string;
  system: string;
  category: string;
}

interface FormattedDocumentType {
  code?: string;
  display: string;
  system: string;
  category: string;
}

interface FormattedPractitioner {
  id?: string;
  display: string;
  specialty?: string;
  organization?: string;
  active: boolean;
}

interface FormattedVaccine {
  code?: string;
  display: string;
  system: string;
  manufacturer?: string;
  type: string;
}

/**
 * Search Service Error
 */
class SearchServiceError extends Error {
  public status?: number;
  public code?: string;
  public details?: any;

  constructor(message: string, status?: number, code?: string, details?: any) {
    super(message);
    this.name = 'SearchServiceError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Main Search Service class
 */
class SearchService {
  private readonly baseUrl: string;
  private readonly cache: Map<string, CacheItem<any>>;
  private readonly cacheTimeout: number;
  private readonly httpClient: AxiosInstance;

  constructor() {
    this.baseUrl = '/api/emr/clinical/catalog';
    this.cache = new Map<string, CacheItem<any>>();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    
    // Create a dedicated HTTP client for catalog searches
    this.httpClient = axios.create({
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
  }

  /**
   * Search for conditions/problems
   */
  async searchConditions(query: string, limit: number = 20): Promise<ConditionItem[]> {
    if (!query || query.length < 2) {
      return [];
    }

    const cacheKey = `conditions:${query}:${limit}`;
    const cached = this.getFromCache<ConditionItem[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response: AxiosResponse<{ conditions: ConditionItem[] }> = await this.httpClient.get(
        `${this.baseUrl}/conditions/search`,
        { params: { query, limit } }
      );
      
      const conditions = response.data?.conditions || [];
      this.setCache(cacheKey, conditions);
      return conditions;
    } catch (error) {
      this.handleSearchError('Failed to search conditions', error);
      return [];
    }
  }

  /**
   * Search for medications
   */
  async searchMedications(query: string, limit: number = 20): Promise<MedicationItem[]> {
    if (!query || query.length < 2) {
      return [];
    }

    const cacheKey = `medications:${query}:${limit}`;
    const cached = this.getFromCache<MedicationItem[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response: AxiosResponse<{ medications: MedicationItem[] }> = await this.httpClient.get(
        `${this.baseUrl}/medications/search`,
        { params: { query, limit } }
      );
      
      const medications = response.data?.medications || [];
      this.setCache(cacheKey, medications);
      return medications;
    } catch (error) {
      this.handleSearchError('Failed to search medications', error);
      return [];
    }
  }

  /**
   * Search for lab tests
   */
  async searchLabTests(query: string, limit: number = 20): Promise<LabTestItem[]> {
    if (!query || query.length < 2) {
      return [];
    }

    const cacheKey = `labTests:${query}:${limit}`;
    const cached = this.getFromCache<LabTestItem[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response: AxiosResponse<{ labTests: LabTestItem[] }> = await this.httpClient.get(
        `${this.baseUrl}/lab-tests/search`,
        { params: { query, limit } }
      );
      
      const labTests = response.data?.labTests || [];
      this.setCache(cacheKey, labTests);
      return labTests;
    } catch (error) {
      this.handleSearchError('Failed to search lab tests', error);
      return [];
    }
  }

  /**
   * Search for imaging procedures
   */
  async searchImagingProcedures(query: string, limit: number = 20): Promise<ImagingProcedureItem[]> {
    if (!query || query.length < 2) {
      return [];
    }

    const cacheKey = `imaging:${query}:${limit}`;
    const cached = this.getFromCache<ImagingProcedureItem[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response: AxiosResponse<{ imagingProcedures: ImagingProcedureItem[] }> = await this.httpClient.get(
        `${this.baseUrl}/imaging-procedures/search`,
        { params: { query, limit } }
      );
      
      const procedures = response.data?.imagingProcedures || [];
      this.setCache(cacheKey, procedures);
      return procedures;
    } catch (error) {
      this.handleSearchError('Failed to search imaging procedures', error);
      return [];
    }
  }

  /**
   * Universal search across all catalogs
   */
  async searchAll(query: string, limit: number = 10): Promise<SearchAllResults> {
    if (!query || query.length < 2) {
      return this.getEmptySearchResults();
    }

    const cacheKey = `all:${query}:${limit}`;
    const cached = this.getFromCache<SearchAllResults>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response: AxiosResponse<{ results: SearchAllResults }> = await this.httpClient.get(
        `${this.baseUrl}/all/search`,
        { params: { query, limit } }
      );
      
      const results = response.data?.results || this.getEmptySearchResults();
      this.setCache(cacheKey, results);
      return results;
    } catch (error) {
      this.handleSearchError('Failed to search all catalogs', error);
      return this.getEmptySearchResults();
    }
  }

  /**
   * Search for procedures
   */
  async searchProcedures(query: string, limit: number = 20): Promise<ProcedureItem[]> {
    if (!query || query.length < 2) {
      return [];
    }

    const cacheKey = `procedures:${query}:${limit}`;
    const cached = this.getFromCache<ProcedureItem[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response: AxiosResponse<{ procedures: ProcedureItem[] }> = await this.httpClient.get(
        `${this.baseUrl}/procedures/search`,
        { params: { query, limit } }
      );
      
      const procedures = response.data?.procedures || [];
      this.setCache(cacheKey, procedures);
      return procedures;
    } catch (error) {
      this.handleSearchError('Failed to search procedures', error);
      return [];
    }
  }

  /**
   * Search for document types
   */
  async searchDocumentTypes(query: string, limit: number = 20): Promise<DocumentTypeItem[]> {
    if (!query || query.length < 2) {
      return [];
    }

    const cacheKey = `documentTypes:${query}:${limit}`;
    const cached = this.getFromCache<DocumentTypeItem[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response: AxiosResponse<{ documentTypes: DocumentTypeItem[] }> = await this.httpClient.get(
        `${this.baseUrl}/document-types/search`,
        { params: { query, limit } }
      );
      
      const documentTypes = response.data?.documentTypes || [];
      this.setCache(cacheKey, documentTypes);
      return documentTypes;
    } catch (error) {
      this.handleSearchError('Failed to search document types', error);
      return [];
    }
  }

  /**
   * Search for practitioners/providers
   */
  async searchPractitioners(query: string, limit: number = 20): Promise<PractitionerItem[]> {
    if (!query || query.length < 2) {
      return [];
    }

    const cacheKey = `practitioners:${query}:${limit}`;
    const cached = this.getFromCache<PractitionerItem[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response: AxiosResponse<{ practitioners: PractitionerItem[] }> = await this.httpClient.get(
        `${this.baseUrl}/practitioners/search`,
        { params: { query, limit } }
      );
      
      const practitioners = response.data?.practitioners || [];
      this.setCache(cacheKey, practitioners);
      return practitioners;
    } catch (error) {
      this.handleSearchError('Failed to search practitioners', error);
      return [];
    }
  }

  /**
   * Search for organizations/facilities
   */
  async searchOrganizations(query: string, limit: number = 20): Promise<OrganizationItem[]> {
    if (!query || query.length < 2) {
      return [];
    }

    const cacheKey = `organizations:${query}:${limit}`;
    const cached = this.getFromCache<OrganizationItem[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response: AxiosResponse<{ organizations: OrganizationItem[] }> = await this.httpClient.get(
        `${this.baseUrl}/organizations/search`,
        { params: { query, limit } }
      );
      
      const organizations = response.data?.organizations || [];
      this.setCache(cacheKey, organizations);
      return organizations;
    } catch (error) {
      this.handleSearchError('Failed to search organizations', error);
      return [];
    }
  }

  /**
   * Search for vaccine codes
   */
  async searchVaccines(query: string, limit: number = 20): Promise<VaccineItem[]> {
    if (!query || query.length < 2) {
      return [];
    }

    const cacheKey = `vaccines:${query}:${limit}`;
    const cached = this.getFromCache<VaccineItem[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response: AxiosResponse<{ vaccines: VaccineItem[] }> = await this.httpClient.get(
        `${this.baseUrl}/vaccines/search`,
        { params: { query, limit } }
      );
      
      const vaccines = response.data?.vaccines || [];
      this.setCache(cacheKey, vaccines);
      return vaccines;
    } catch (error) {
      this.handleSearchError('Failed to search vaccines', error);
      return [];
    }
  }

  /**
   * Search for allergens (combines medications with environmental allergens)
   */
  async searchAllergens(query: string, category: 'medication' | 'food' | 'environment' | null = null): Promise<AllergenItem[]> {
    if (!query || query.length < 2) {
      return [];
    }

    const results: AllergenItem[] = [];

    // Search medications if no category filter or medication category
    if (!category || category === 'medication') {
      try {
        const medications = await this.searchMedications(query, 10);
        results.push(...medications.map(med => ({
          code: med.code || 'RXNORM:' + med.id,
          display: med.name || med.display || 'Unknown medication',
          system: med.system || 'http://www.nlm.nih.gov/research/umls/rxnorm',
          category: 'medication' as const,
          source: 'medication_catalog'
        })));
      } catch (error) {
        this.handleSearchError('Failed to search medication allergens', error);
      }
    }

    // Add common environmental and food allergens
    if (!category || category === 'food' || category === 'environment') {
      const commonAllergens: Omit<AllergenItem, 'system' | 'source'>[] = [
        // Foods
        { code: 'SNOMED:735029007', display: 'Shellfish', category: 'food' },
        { code: 'SNOMED:735030002', display: 'Peanuts', category: 'food' },
        { code: 'SNOMED:735048007', display: 'Tree nuts', category: 'food' },
        { code: 'SNOMED:735049004', display: 'Milk', category: 'food' },
        { code: 'SNOMED:735050004', display: 'Eggs', category: 'food' },
        { code: 'SNOMED:735051000', display: 'Wheat', category: 'food' },
        { code: 'SNOMED:735052007', display: 'Soy', category: 'food' },
        
        // Environmental
        { code: 'SNOMED:256259004', display: 'Pollen', category: 'environment' },
        { code: 'SNOMED:232347008', display: 'Dust mites', category: 'environment' },
        { code: 'SNOMED:232350006', display: 'Animal dander', category: 'environment' },
        { code: 'SNOMED:232353008', display: 'Mold', category: 'environment' },
        { code: 'SNOMED:420174000', display: 'Latex', category: 'environment' }
      ];

      const filtered = commonAllergens.filter(allergen => {
        const matchesQuery = allergen.display?.toLowerCase().includes(query.toLowerCase()) ||
                           allergen.code?.toLowerCase().includes(query.toLowerCase());
        const matchesCategory = !category || allergen.category === category;
        return matchesQuery && matchesCategory;
      });

      results.push(...filtered.map(allergen => ({
        ...allergen,
        system: 'http://snomed.info/sct',
        source: 'common_allergens'
      })));
    }

    return results;
  }

  /**
   * Get item from cache if not expired
   */
  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data as T;
    }
    return null;
  }

  /**
   * Set item in cache with timestamp
   */
  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Handle search errors consistently
   */
  private handleSearchError(message: string, error: any): void {
    if (error instanceof AxiosError) {
      throw new SearchServiceError(
        message,
        error.response?.status,
        'SEARCH_FAILED',
        error
      );
    } else {
      // For now, just log errors - don't throw to maintain graceful degradation
      console.warn(`SearchService: ${message}`, error);
    }
  }

  /**
   * Get empty search results structure
   */
  private getEmptySearchResults(): SearchAllResults {
    return {
      medications: [],
      labTests: [],
      imagingProcedures: [],
      conditions: [],
      procedures: [],
      documentTypes: [],
      practitioners: [],
      vaccines: []
    };
  }

  /**
   * Format medication for display
   */
  formatMedication(medication: MedicationItem): FormattedMedication {
    return {
      id: medication.id,
      display: medication.name || medication.display || 'Unknown medication',
      code: medication.code,
      system: medication.system || 'http://www.nlm.nih.gov/research/umls/rxnorm',
      form: medication.form,
      status: medication.status || 'active',
      route: medication.route || 'oral'
    };
  }

  /**
   * Format condition for display
   */
  formatCondition(condition: ConditionItem): FormattedCondition {
    return {
      code: condition.code,
      display: condition.display || 'Unknown condition',
      system: condition.system || 'http://snomed.info/sct',
      source: condition.source || 'catalog'
    };
  }

  /**
   * Format lab test for display
   */
  formatLabTest(labTest: LabTestItem): FormattedLabTest {
    return {
      code: labTest.code,
      display: labTest.display || 'Unknown test',
      system: labTest.system || 'http://loinc.org',
      type: 'laboratory'
    };
  }

  /**
   * Format procedure for display
   */
  formatProcedure(procedure: ProcedureItem): FormattedProcedure {
    return {
      code: procedure.code,
      display: procedure.display || 'Unknown procedure',
      system: procedure.system || 'http://snomed.info/sct',
      category: procedure.category || 'procedure'
    };
  }

  /**
   * Format document type for display
   */
  formatDocumentType(documentType: DocumentTypeItem): FormattedDocumentType {
    return {
      code: documentType.code,
      display: documentType.display || 'Unknown document type',
      system: documentType.system || 'http://loinc.org',
      category: 'clinical-document'
    };
  }

  /**
   * Format practitioner for display
   */
  formatPractitioner(practitioner: PractitionerItem): FormattedPractitioner {
    return {
      id: practitioner.id,
      display: practitioner.name || practitioner.display || 'Unknown practitioner',
      specialty: practitioner.specialty,
      organization: practitioner.organization,
      active: practitioner.active !== false
    };
  }

  /**
   * Format vaccine for display
   */
  formatVaccine(vaccine: VaccineItem): FormattedVaccine {
    return {
      code: vaccine.code,
      display: vaccine.display || 'Unknown vaccine',
      system: vaccine.system || 'http://hl7.org/fhir/sid/cvx',
      manufacturer: vaccine.manufacturer,
      type: 'vaccine'
    };
  }
}

// Export singleton instance
export const searchService = new SearchService();

// Export class and types
export default SearchService;
export type {
  CatalogItem,
  ConditionItem,
  MedicationItem,
  LabTestItem,
  ImagingProcedureItem,
  ProcedureItem,
  DocumentTypeItem,
  PractitionerItem,
  OrganizationItem,
  VaccineItem,
  AllergenItem,
  SearchAllResults,
  FormattedMedication,
  FormattedCondition,
  FormattedLabTest,
  FormattedProcedure,
  FormattedDocumentType,
  FormattedPractitioner,
  FormattedVaccine
};
export { SearchServiceError };