/**
 * FHIR Data Formatters - TypeScript Migration
 * Utility functions to safely format FHIR data types for display
 * 
 * Migrated to TypeScript with comprehensive type safety for FHIR R4 resource formatting,
 * using @ahryman40k/ts-fhir-types for strict compliance with FHIR specifications.
 */

import {
  CodeableConcept,
  Coding,
  Reference,
  Period,
  Quantity,
  HumanName,
  Address,
  ContactPoint,
} from '../types/fhir';

/**
 * Date format options for FHIR date formatting
 */
export type DateFormat = 'short' | 'long' | 'relative';

/**
 * Generic FHIR field that might contain display information
 */
export type DisplayableField = 
  | string 
  | CodeableConcept 
  | Coding 
  | Reference 
  | Period 
  | Quantity 
  | HumanName 
  | Address 
  | ContactPoint
  | DisplayableField[]
  | null 
  | undefined;

/**
 * Format a FHIR CodeableConcept for display
 * @param codeableConcept - FHIR CodeableConcept object
 * @returns Display text
 */
export const formatCodeableConcept = (codeableConcept?: CodeableConcept | null): string => {
  if (!codeableConcept) return '';
  
  // Check for text first (preferred)
  if (codeableConcept.text) return codeableConcept.text;
  
  // Check for coding display
  if (codeableConcept.coding?.length && codeableConcept.coding.length > 0) {
    const primaryCoding = codeableConcept.coding[0];
    return primaryCoding.display || primaryCoding.code || '';
  }
  
  return '';
};

/**
 * Format a FHIR Coding for display
 * @param coding - FHIR Coding object
 * @returns Display text
 */
export const formatCoding = (coding?: Coding | null): string => {
  if (!coding) return '';
  return coding.display || coding.code || '';
};

/**
 * Format a FHIR Reference for display
 * @param reference - FHIR Reference object
 * @returns Display text
 */
export const formatReference = (reference?: Reference | string | null): string => {
  if (!reference) return '';
  
  if (typeof reference === 'string') return reference;
  
  return reference.display || reference.reference || '';
};

/**
 * Format a FHIR Period for display
 * @param period - FHIR Period object
 * @returns Display text
 */
export const formatPeriod = (period?: Period | null): string => {
  if (!period) return '';
  
  const start = period.start ? new Date(period.start).toLocaleDateString() : '';
  const end = period.end ? new Date(period.end).toLocaleDateString() : 'Present';
  
  if (start && end !== 'Present') return `${start} - ${end}`;
  if (start) return `Since ${start}`;
  if (period.end) return `Until ${end}`;
  
  return '';
};

/**
 * Format a FHIR Quantity for display
 * @param quantity - FHIR Quantity object
 * @returns Display text
 */
export const formatQuantity = (quantity?: Quantity | null): string => {
  if (!quantity) return '';
  
  const value = quantity.value?.toString() || '';
  const unit = quantity.unit || quantity.code || '';
  
  return `${value} ${unit}`.trim();
};

/**
 * Format a FHIR HumanName for display
 * @param name - FHIR HumanName object
 * @returns Display text
 */
export const formatHumanName = (name?: HumanName | null): string => {
  if (!name) return '';
  
  const given = name.given?.join(' ') || '';
  const family = name.family || '';
  
  return `${given} ${family}`.trim();
};

/**
 * Format a FHIR Address for display
 * @param address - FHIR Address object
 * @returns Display text
 */
export const formatAddress = (address?: Address | null): string => {
  if (!address) return '';
  
  const parts: string[] = [];
  
  if (address.line?.length && address.line.length > 0) {
    parts.push(address.line.join(', '));
  }
  
  if (address.city) parts.push(address.city);
  if (address.state) parts.push(address.state);
  if (address.postalCode) parts.push(address.postalCode);
  if (address.country) parts.push(address.country);
  
  return parts.join(', ');
};

/**
 * Format a FHIR ContactPoint for display
 * @param contactPoint - FHIR ContactPoint object
 * @returns Display text
 */
export const formatContactPoint = (contactPoint?: ContactPoint | null): string => {
  if (!contactPoint) return '';
  
  const value = contactPoint.value || '';
  const use = contactPoint.use ? `(${contactPoint.use})` : '';
  
  return `${value} ${use}`.trim();
};

/**
 * Type guard for CodeableConcept
 */
const isCodeableConcept = (field: any): field is CodeableConcept => {
  return field && typeof field === 'object' && ('coding' in field || 'text' in field);
};

/**
 * Type guard for Reference
 */
const isReference = (field: any): field is Reference => {
  return field && typeof field === 'object' && ('reference' in field || 'display' in field);
};

/**
 * Type guard for Coding
 */
const isCoding = (field: any): field is Coding => {
  return field && typeof field === 'object' && 'code' in field && 'system' in field;
};

/**
 * Type guard for Period
 */
const isPeriod = (field: any): field is Period => {
  return field && typeof field === 'object' && ('start' in field || 'end' in field);
};

/**
 * Type guard for Quantity
 */
const isQuantity = (field: any): field is Quantity => {
  return field && typeof field === 'object' && 'value' in field && ('unit' in field || 'code' in field);
};

/**
 * Type guard for HumanName
 */
const isHumanName = (field: any): field is HumanName => {
  return field && typeof field === 'object' && ('given' in field || 'family' in field);
};

/**
 * Type guard for Address
 */
const isAddress = (field: any): field is Address => {
  return field && typeof field === 'object' && ('line' in field || 'city' in field || 'state' in field);
};

/**
 * Type guard for ContactPoint
 */
const isContactPoint = (field: any): field is ContactPoint => {
  return field && typeof field === 'object' && 'value' in field && ('system' in field || 'use' in field);
};

/**
 * Safely get display text from any FHIR field
 * @param field - Any FHIR field that might contain display text
 * @returns Display text
 */
export const getDisplayText = (field: DisplayableField): string => {
  if (!field) return '';
  
  // Handle string
  if (typeof field === 'string') return field;
  
  // Handle array (take first item)
  if (Array.isArray(field) && field.length > 0) {
    return getDisplayText(field[0]);
  }
  
  // Handle objects with common FHIR patterns using type guards
  if (typeof field === 'object') {
    // CodeableConcept
    if (isCodeableConcept(field)) {
      return formatCodeableConcept(field);
    }
    
    // Reference
    if (isReference(field)) {
      return formatReference(field);
    }
    
    // Coding
    if (isCoding(field)) {
      return formatCoding(field);
    }
    
    // Period
    if (isPeriod(field)) {
      return formatPeriod(field);
    }
    
    // Quantity
    if (isQuantity(field)) {
      return formatQuantity(field);
    }
    
    // HumanName
    if (isHumanName(field)) {
      return formatHumanName(field);
    }
    
    // Address
    if (isAddress(field)) {
      return formatAddress(field);
    }
    
    // ContactPoint
    if (isContactPoint(field)) {
      return formatContactPoint(field);
    }
  }
  
  return '';
};

/**
 * Format FHIR date/dateTime for display
 * @param date - FHIR date or dateTime string
 * @param format - Display format ('short', 'long', 'relative')
 * @returns Formatted date
 */
export const formatFHIRDate = (date?: string | null, format: DateFormat = 'short'): string => {
  if (!date) return '';
  
  try {
    const dateObj = new Date(date);
    
    // Check for invalid date
    if (isNaN(dateObj.getTime())) {
      return date;
    }
    
    switch (format) {
      case 'short':
        return dateObj.toLocaleDateString();
      case 'long':
        return dateObj.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
      case 'relative': {
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - dateObj.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return dateObj < now ? 'Yesterday' : 'Tomorrow';
        if (diffDays < 7) return dateObj < now ? `${diffDays} days ago` : `In ${diffDays} days`;
        if (diffDays < 30) {
          const weeks = Math.floor(diffDays / 7);
          return dateObj < now ? `${weeks} weeks ago` : `In ${weeks} weeks`;
        }
        if (diffDays < 365) {
          const months = Math.floor(diffDays / 30);
          return dateObj < now ? `${months} months ago` : `In ${months} months`;
        }
        const years = Math.floor(diffDays / 365);
        return dateObj < now ? `${years} years ago` : `In ${years} years`;
      }
      default:
        return dateObj.toLocaleDateString();
    }
  } catch (error) {
    return date;
  }
};

/**
 * Format FHIR date for age calculation (birth date to current age)
 * @param birthDate - FHIR birth date string
 * @returns Age string (e.g., "45 years old")
 */
export const formatAge = (birthDate?: string | null): string => {
  if (!birthDate) return '';
  
  try {
    const birth = new Date(birthDate);
    const now = new Date();
    
    if (isNaN(birth.getTime())) {
      return '';
    }
    
    let age = now.getFullYear() - birth.getFullYear();
    const monthDiff = now.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
      age--;
    }
    
    if (age < 0) return '';
    if (age === 0) {
      // Calculate months for infants
      const months = monthDiff >= 0 ? monthDiff : 12 + monthDiff;
      return months === 1 ? '1 month old' : `${months} months old`;
    }
    
    return age === 1 ? '1 year old' : `${age} years old`;
  } catch (error) {
    return '';
  }
};

/**
 * Format multiple FHIR fields into a single display string
 * @param fields - Array of FHIR fields to format
 * @param separator - Separator between fields (default: ', ')
 * @returns Combined display text
 */
export const formatMultipleFields = (
  fields: DisplayableField[], 
  separator: string = ', '
): string => {
  return fields
    .map(field => getDisplayText(field))
    .filter(text => text.length > 0)
    .join(separator);
};

/**
 * Format FHIR boolean value for display
 * @param value - Boolean value
 * @param trueText - Text to display for true (default: 'Yes')
 * @param falseText - Text to display for false (default: 'No')
 * @returns Display text
 */
export const formatBoolean = (
  value?: boolean | null, 
  trueText: string = 'Yes', 
  falseText: string = 'No'
): string => {
  if (value === null || value === undefined) return '';
  return value ? trueText : falseText;
};

/**
 * Safe formatter that handles any FHIR field type
 * @param field - Any FHIR field
 * @param fallback - Fallback text if field cannot be formatted
 * @returns Display text
 */
export const safeFormat = (field: DisplayableField, fallback: string = 'Unknown'): string => {
  const result = getDisplayText(field);
  return result.length > 0 ? result : fallback;
};