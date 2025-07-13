/**
 * Vital Signs Service
 * Centralized service for managing vital signs mapping and categorization using FHIR standards
 * 
 * Migrated to TypeScript with comprehensive type safety using FHIR R4 types.
 */

import { R4 } from '@ahryman40k/ts-fhir-types';

// Standard LOINC codes for vital signs
const VITAL_SIGNS_LOINC = {
  // Core vital signs
  'blood-pressure': {
    systolic: '8480-6',    // Systolic blood pressure
    diastolic: '8462-4',   // Diastolic blood pressure
    panel: '85354-9'       // Blood pressure panel
  },
  'heart-rate': '8867-4',        // Heart rate
  'respiratory-rate': '9279-1',   // Respiratory rate
  'body-temperature': '8310-5',   // Body temperature
  'body-weight': '29463-7',       // Body weight
  'body-height': '8302-2',        // Body height
  'bmi': '39156-5',              // Body mass index
  'oxygen-saturation': '2708-6',  // Oxygen saturation
  
  // Additional common vitals
  'head-circumference': '9843-4', // Head circumference
  'pain-scale': '72514-3',        // Pain severity scale
  'glasgow-coma': '9269-2'        // Glasgow coma scale
} as const;

// Display names for vital signs
const VITAL_SIGNS_DISPLAY: Record<string, string> = {
  '8480-6': 'Systolic Blood Pressure',
  '8462-4': 'Diastolic Blood Pressure',
  '85354-9': 'Blood Pressure',
  '8867-4': 'Heart Rate',
  '9279-1': 'Respiratory Rate',
  '8310-5': 'Body Temperature',
  '29463-7': 'Body Weight',
  '8302-2': 'Body Height',
  '39156-5': 'Body Mass Index',
  '2708-6': 'Oxygen Saturation',
  '9843-4': 'Head Circumference',
  '72514-3': 'Pain Scale',
  '9269-2': 'Glasgow Coma Scale'
};

// Units for vital signs
const VITAL_SIGNS_UNITS: Record<string, string> = {
  '8480-6': 'mmHg',
  '8462-4': 'mmHg',
  '85354-9': 'mmHg',
  '8867-4': 'bpm',
  '9279-1': '/min',
  '8310-5': 'F',
  '29463-7': 'kg',
  '8302-2': 'cm',
  '39156-5': 'kg/m2',
  '2708-6': '%',
  '9843-4': 'cm',
  '72514-3': '{score}',
  '9269-2': '{score}'
};

// Categories for grouping vital signs
const VITAL_SIGNS_CATEGORIES: Record<string, string[]> = {
  'cardiovascular': ['8480-6', '8462-4', '85354-9', '8867-4'],
  'respiratory': ['9279-1', '2708-6'],
  'metabolic': ['8310-5', '29463-7', '8302-2', '39156-5'],
  'neurological': ['72514-3', '9269-2'],
  'pediatric': ['9843-4']
};

/**
 * Type definitions for vital signs
 */
export type VitalSignType = keyof typeof VITAL_SIGNS_LOINC;
export type VitalSignCategory = keyof typeof VITAL_SIGNS_CATEGORIES;

export interface VitalSignRange {
  min: number;
  max: number;
}

export interface VitalSignData {
  loincCode: string;
  displayName: string;
  unit: string;
  value: number | string;
  date: string;
  isAbnormal?: boolean;
}

/**
 * Extended observation interface for legacy support
 */
export interface ObservationWithLegacy extends R4.IObservation {
  loinc_code?: string;
  observation_type?: string;
  observation_date?: string;
  date?: string;
}

class VitalSignsService {
  private readonly loincCodes: typeof VITAL_SIGNS_LOINC;
  private readonly displayNames: Record<string, string>;
  private readonly units: Record<string, string>;
  private readonly categories: Record<string, string[]>;

  constructor() {
    this.loincCodes = VITAL_SIGNS_LOINC;
    this.displayNames = VITAL_SIGNS_DISPLAY;
    this.units = VITAL_SIGNS_UNITS;
    this.categories = VITAL_SIGNS_CATEGORIES;
  }

  /**
   * Check if an observation is a vital sign
   */
  isVitalSign(observation: ObservationWithLegacy | null | undefined): boolean {
    if (!observation) return false;
    
    // Check by LOINC code
    const loincCode = this.extractLoincCode(observation);
    if (loincCode && this.displayNames[loincCode]) {
      return true;
    }
    
    // Check by category
    if (observation.category) {
      for (const cat of observation.category) {
        if (cat.coding) {
          for (const coding of cat.coding) {
            if (coding.code === 'vital-signs' || 
                coding.system === 'http://terminology.hl7.org/CodeSystem/observation-category') {
              return true;
            }
          }
        }
      }
    }
    
    // Check by observation type field (legacy support)
    if (observation.observation_type === 'vital-signs') {
      return true;
    }
    
    return false;
  }

  /**
   * Extract LOINC code from observation
   */
  extractLoincCode(observation: ObservationWithLegacy): string | null {
    if (!observation || !observation.code) return null;
    
    // Check coding array
    if (observation.code.coding) {
      for (const coding of observation.code.coding) {
        if (coding.system === 'http://loinc.org' || !coding.system) {
          return coding.code || null;
        }
      }
    }
    
    // Check legacy loinc_code field
    if (observation.loinc_code) {
      return observation.loinc_code;
    }
    
    return null;
  }

  /**
   * Get display name for a vital sign
   */
  getDisplayName(observation: ObservationWithLegacy): string {
    const loincCode = this.extractLoincCode(observation);
    
    // Use FHIR display name if available
    if (observation.code && observation.code.text) {
      return observation.code.text;
    }
    
    if (observation.code && observation.code.coding) {
      for (const coding of observation.code.coding) {
        if (coding.display) {
          return coding.display;
        }
      }
    }
    
    // Use mapped display name
    if (loincCode && this.displayNames[loincCode]) {
      return this.displayNames[loincCode];
    }
    
    // Fallback to LOINC code
    return loincCode || 'Unknown Vital Sign';
  }

  /**
   * Get unit for a vital sign
   */
  getUnit(observation: ObservationWithLegacy): string {
    // First check FHIR valueQuantity unit
    if (observation.valueQuantity && observation.valueQuantity.unit) {
      return observation.valueQuantity.unit;
    }
    
    // Fall back to mapped unit
    const loincCode = this.extractLoincCode(observation);
    if (loincCode && this.units[loincCode]) {
      return this.units[loincCode];
    }
    
    return '';
  }

  /**
   * Get numeric value from observation
   */
  getValue(observation: ObservationWithLegacy): number | null {
    // Check valueQuantity
    if (observation.valueQuantity && typeof observation.valueQuantity.value === 'number') {
      return observation.valueQuantity.value;
    }
    
    // Check valueString for numeric values
    if (observation.valueString) {
      const numValue = parseFloat(observation.valueString);
      if (!isNaN(numValue)) {
        return numValue;
      }
    }
    
    // Check valueInteger
    if (typeof observation.valueInteger === 'number') {
      return observation.valueInteger;
    }
    
    // Check component values (for blood pressure)
    if (observation.component && observation.component.length > 0) {
      // For multi-component observations, return the first component value
      const firstComponent = observation.component[0];
      if (firstComponent.valueQuantity && typeof firstComponent.valueQuantity.value === 'number') {
        return firstComponent.valueQuantity.value;
      }
    }
    
    return null;
  }

  /**
   * Filter observations to only vital signs
   */
  filterVitalSigns(observations: ObservationWithLegacy[]): ObservationWithLegacy[] {
    return observations.filter(obs => this.isVitalSign(obs));
  }

  /**
   * Group vital signs by category
   */
  groupByCategory(observations: ObservationWithLegacy[]): Record<string, ObservationWithLegacy[]> {
    const vitalSigns = this.filterVitalSigns(observations);
    const grouped: Record<string, ObservationWithLegacy[]> = {};
    
    // Initialize categories
    Object.keys(this.categories).forEach(category => {
      grouped[category] = [];
    });
    grouped['other'] = [];
    
    vitalSigns.forEach(obs => {
      const loincCode = this.extractLoincCode(obs);
      let categorized = false;
      
      for (const [category, codes] of Object.entries(this.categories)) {
        if (loincCode && codes.includes(loincCode)) {
          grouped[category].push(obs);
          categorized = true;
          break;
        }
      }
      
      if (!categorized) {
        grouped['other'].push(obs);
      }
    });
    
    return grouped;
  }

  /**
   * Get latest vital signs (one per type)
   */
  getLatestVitalSigns(observations: ObservationWithLegacy[]): ObservationWithLegacy[] {
    const vitalSigns = this.filterVitalSigns(observations);
    const latest: Record<string, ObservationWithLegacy> = {};
    
    vitalSigns.forEach(obs => {
      const loincCode = this.extractLoincCode(obs);
      const key = loincCode || this.getDisplayName(obs);
      const date = obs.effectiveDateTime || obs.observation_date || obs.date;
      
      if (!latest[key] || (date && new Date(date) > new Date(latest[key].effectiveDateTime || latest[key].observation_date || latest[key].date || '1970-01-01'))) {
        latest[key] = obs;
      }
    });
    
    return Object.values(latest);
  }

  /**
   * Check if vital sign is abnormal
   */
  isAbnormal(observation: ObservationWithLegacy, patientAge?: number | null, patientGender?: string | null): boolean {
    const loincCode = this.extractLoincCode(observation);
    const value = this.getValue(observation);
    
    if (!value || isNaN(value)) return false;
    
    // Basic abnormal ranges (would need more sophisticated logic for age/gender)
    const abnormalRanges: Record<string, VitalSignRange> = {
      '8480-6': { min: 90, max: 140 },  // Systolic BP
      '8462-4': { min: 60, max: 90 },   // Diastolic BP
      '8867-4': { min: 60, max: 100 },  // Heart rate
      '9279-1': { min: 12, max: 20 },   // Respiratory rate
      '8310-5': { min: 97, max: 99.5 }, // Temperature (F)
      '2708-6': { min: 95, max: 100 }   // Oxygen saturation
    };
    
    const range = loincCode ? abnormalRanges[loincCode] : undefined;
    if (range) {
      return value < range.min || value > range.max;
    }
    
    return false;
  }

  /**
   * Get LOINC code for a vital sign type
   */
  getLoincCode(vitalType: VitalSignType): string | typeof VITAL_SIGNS_LOINC[VitalSignType] | null {
    return this.loincCodes[vitalType] || null;
  }

  /**
   * Get all supported vital sign types
   */
  getSupportedVitalTypes(): VitalSignType[] {
    return Object.keys(this.loincCodes) as VitalSignType[];
  }

  /**
   * Get vital sign categories
   */
  getCategories(): Record<string, string[]> {
    return { ...this.categories };
  }

  /**
   * Convert observation to VitalSignData
   */
  toVitalSignData(observation: ObservationWithLegacy): VitalSignData {
    const loincCode = this.extractLoincCode(observation) || '';
    const displayName = this.getDisplayName(observation);
    const unit = this.getUnit(observation);
    const value = this.getValue(observation) || 0;
    const date = observation.effectiveDateTime || observation.observation_date || observation.date || new Date().toISOString();
    const isAbnormal = this.isAbnormal(observation);

    return {
      loincCode,
      displayName,
      unit,
      value,
      date,
      isAbnormal
    };
  }

  /**
   * Get abnormal ranges for all vital signs
   */
  getAbnormalRanges(): Record<string, VitalSignRange> {
    return {
      '8480-6': { min: 90, max: 140 },  // Systolic BP
      '8462-4': { min: 60, max: 90 },   // Diastolic BP
      '8867-4': { min: 60, max: 100 },  // Heart rate
      '9279-1': { min: 12, max: 20 },   // Respiratory rate
      '8310-5': { min: 97, max: 99.5 }, // Temperature (F)
      '2708-6': { min: 95, max: 100 }   // Oxygen saturation
    };
  }
}

// Export singleton instance
export const vitalSignsService = new VitalSignsService();

// Also export class for custom instances
export default VitalSignsService;
export { VitalSignsService };