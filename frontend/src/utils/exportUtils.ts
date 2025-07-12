/**
 * Export utilities for clinical data - TypeScript Migration
 * Supports CSV, JSON, and PDF export formats with comprehensive type safety
 * 
 * Migrated to TypeScript with type-safe export operations, file handling,
 * and FHIR resource formatting capabilities.
 */

import { format, parseISO } from 'date-fns';
import { printDocument } from './printUtils';
import { Patient } from '../types/fhir';

/**
 * Export format types
 */
export type ExportFormat = 'csv' | 'json' | 'pdf';

/**
 * File MIME types
 */
export type ExportMimeType = 
  | 'text/csv;charset=utf-8;'
  | 'application/json;charset=utf-8;'
  | 'application/pdf';

/**
 * Column configuration for export
 */
export interface ExportColumn<T = any> {
  key: string;
  label: string;
  formatter?: (value: any, item: T) => string;
}

/**
 * Export options interface
 */
export interface ExportOptions<T = any> {
  patient?: Patient;
  data: T[];
  columns?: ExportColumn<T>[];
  format: ExportFormat;
  title: string;
  formatForPrint?: (data: T[]) => string;
  includeTimestamp?: boolean;
  customFilename?: string;
}

/**
 * Patient information for exports
 */
export interface ExportPatientInfo {
  name: string;
  mrn?: string;
  birthDate?: string;
  gender?: string;
  phone?: string;
}

/**
 * JSON export data structure
 */
export interface JSONExportData<T = any> {
  exportDate: string;
  title: string;
  patient: ExportPatientInfo;
  data: T[] | T | Record<string, any>;
  metadata?: {
    recordCount: number;
    exportFormat: ExportFormat;
    generatedBy: string;
  };
}

/**
 * Convert data to CSV format
 */
export const generateCSV = <T = any>(data: T[], columns: ExportColumn<T>[]): string => {
  if (!data || data.length === 0) return '';
  
  // Create header row
  const headers = columns.map(col => `"${col.label}"`).join(',');
  
  // Create data rows
  const rows = data.map(item => {
    return columns.map(col => {
      let value: any;
      
      if (col.formatter) {
        value = col.formatter(getNestedValue(item, col.key), item);
      } else {
        value = getNestedValue(item, col.key);
      }
      
      // Escape quotes and wrap in quotes
      const escaped = String(value || '').replace(/"/g, '""');
      return `"${escaped}"`;
    }).join(',');
  });
  
  return [headers, ...rows].join('\n');
};

/**
 * Get nested object value by dot notation path with type safety
 */
const getNestedValue = (obj: any, path: string): any => {
  return path.split('.').reduce((current, key) => {
    return current?.[key];
  }, obj);
};

/**
 * Create typed blob for download
 */
const createTypedBlob = (content: string, format: ExportFormat): Blob => {
  const mimeTypes: Record<ExportFormat, ExportMimeType> = {
    csv: 'text/csv;charset=utf-8;',
    json: 'application/json;charset=utf-8;',
    pdf: 'application/pdf'
  };
  
  return new Blob([content], { type: mimeTypes[format] });
};

/**
 * Download blob as file with proper cleanup
 */
const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  try {
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
  } finally {
    // Cleanup
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};

/**
 * Download data as CSV file
 */
export const downloadCSV = <T = any>(
  data: T[], 
  columns: ExportColumn<T>[], 
  filename: string
): void => {
  const csv = generateCSV(data, columns);
  const blob = createTypedBlob(csv, 'csv');
  downloadBlob(blob, `${filename}.csv`);
};

/**
 * Download data as JSON file
 */
export const downloadJSON = <T = any>(data: T, filename: string): void => {
  const json = JSON.stringify(data, null, 2);
  const blob = createTypedBlob(json, 'json');
  downloadBlob(blob, `${filename}.json`);
};

/**
 * Generate safe filename from title and patient info
 */
const generateFilename = (title: string, patient?: Patient, includeTimestamp: boolean = true): string => {
  const timestamp = includeTimestamp ? format(new Date(), 'yyyy-MM-dd_HHmm') : '';
  const patientName = patient?.name?.[0]?.family || 'Patient';
  const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_');
  
  return [safeTitle, patientName, timestamp].filter(Boolean).join('_');
};

/**
 * Extract patient information for export
 */
const extractPatientInfo = (patient?: Patient): ExportPatientInfo => {
  if (!patient) {
    return { name: 'Unknown Patient' };
  }
  
  const name = patient.name?.[0] ? 
    `${patient.name[0].given?.join(' ') || ''} ${patient.name[0].family || ''}`.trim() : 
    'Unknown Patient';
    
  const mrn = patient.identifier?.find(id => 
    id.type?.coding?.[0]?.code === 'MR'
  )?.value || patient.id;
  
  const phone = patient.telecom?.find(t => t.system === 'phone')?.value;
  
  return {
    name,
    mrn,
    birthDate: patient.birthDate,
    gender: patient.gender,
    phone
  };
};

/**
 * Export clinical data with patient header and comprehensive type safety
 */
export const exportClinicalData = <T = any>(options: ExportOptions<T>): void => {
  const {
    patient,
    data,
    columns = [],
    format,
    title,
    formatForPrint,
    includeTimestamp = true,
    customFilename
  } = options;
  
  const filename = customFilename || generateFilename(title, patient, includeTimestamp);
  
  try {
    switch (format) {
      case 'csv':
        if (columns.length === 0) {
          throw new Error('Columns are required for CSV export');
        }
        downloadCSV(data, columns, filename);
        break;
        
      case 'json': {
        const patientInfo = extractPatientInfo(patient);
        const exportData: JSONExportData<T> = {
          exportDate: new Date().toISOString(),
          title,
          patient: patientInfo,
          data,
          metadata: {
            recordCount: data.length,
            exportFormat: format,
            generatedBy: 'MedGenEMR Export Utility'
          }
        };
        downloadJSON(exportData, filename);
        break;
      }
        
      case 'pdf': {
        const patientInfo = extractPatientInfo(patient);
        const content = formatForPrint ? 
          formatForPrint(data) : 
          generateTableHTML(data, columns);
        
        printDocument({
          title,
          patient: patientInfo,
          content
        });
        break;
      }
        
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  } catch (error) {
    console.error('Export failed:', error);
    throw new Error(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Generate HTML table from data with proper escaping
 */
const generateTableHTML = <T = any>(data: T[], columns: ExportColumn<T>[]): string => {
  if (!data || data.length === 0) {
    return '<p>No data available</p>';
  }
  
  const escapeHtml = (text: string): string => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };
  
  const headers = columns.map(col => `<th>${escapeHtml(col.label)}</th>`).join('');
  const rows = data.map(item => {
    const cells = columns.map(col => {
      let value: any;
      
      if (col.formatter) {
        value = col.formatter(getNestedValue(item, col.key), item);
      } else {
        value = getNestedValue(item, col.key);
      }
      
      return `<td>${escapeHtml(String(value || ''))}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');
  
  return `
    <table>
      <thead>
        <tr>${headers}</tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
};

/**
 * Column configurations for common clinical data types with proper typing
 */
export const EXPORT_COLUMNS = {
  conditions: [
    { key: 'code.text', label: 'Condition' },
    { key: 'clinicalStatus.coding.0.code', label: 'Status' },
    { key: 'severity.text', label: 'Severity' },
    { key: 'onsetDateTime', label: 'Onset Date', formatter: (value: string) => value ? format(parseISO(value), 'yyyy-MM-dd') : '' },
    { key: 'recordedDate', label: 'Recorded Date', formatter: (value: string) => value ? format(parseISO(value), 'yyyy-MM-dd') : '' }
  ] as ExportColumn[],
  
  medications: [
    { key: 'medicationCodeableConcept.text', label: 'Medication' },
    { key: 'status', label: 'Status' },
    { key: 'dosageInstruction.0.text', label: 'Dosage' },
    { key: 'authoredOn', label: 'Prescribed Date', formatter: (value: string) => value ? format(parseISO(value), 'yyyy-MM-dd') : '' },
    { key: 'requester.display', label: 'Prescriber' }
  ] as ExportColumn[],
  
  allergies: [
    { key: 'code.text', label: 'Allergen' },
    { key: 'criticality', label: 'Criticality' },
    { key: 'type', label: 'Type' },
    { key: 'reaction.0.manifestation.0.text', label: 'Reaction' },
    { key: 'recordedDate', label: 'Recorded Date', formatter: (value: string) => value ? format(parseISO(value), 'yyyy-MM-dd') : '' }
  ] as ExportColumn[],
  
  encounters: [
    { key: 'type.0.text', label: 'Type' },
    { key: 'status', label: 'Status' },
    { key: 'period.start', label: 'Start Date', formatter: (value: string) => value ? format(parseISO(value), 'yyyy-MM-dd HH:mm') : '' },
    { key: 'period.end', label: 'End Date', formatter: (value: string) => value ? format(parseISO(value), 'yyyy-MM-dd HH:mm') : '' },
    { key: 'participant.0.individual.display', label: 'Provider' },
    { key: 'location.0.location.display', label: 'Location' }
  ] as ExportColumn[],
  
  orders: [
    { key: 'code.text', label: 'Order' },
    { key: 'resourceType', label: 'Type' },
    { key: 'status', label: 'Status' },
    { key: 'priority', label: 'Priority' },
    { key: 'authoredOn', label: 'Ordered Date', formatter: (value: string) => value ? format(parseISO(value), 'yyyy-MM-dd') : '' },
    { key: 'requester.display', label: 'Ordered By' }
  ] as ExportColumn[],
  
  observations: [
    { key: 'code.text', label: 'Test/Observation' },
    { key: 'valueQuantity.value', label: 'Value' },
    { key: 'valueQuantity.unit', label: 'Unit' },
    { key: 'referenceRange.0.text', label: 'Reference Range' },
    { key: 'status', label: 'Status' },
    { key: 'effectiveDateTime', label: 'Date', formatter: (value: string) => value ? format(parseISO(value), 'yyyy-MM-dd HH:mm') : '' }
  ] as ExportColumn[]
} as const;

/**
 * Type-safe export column selector
 */
export type ExportColumnType = keyof typeof EXPORT_COLUMNS;

/**
 * Get typed export columns for a specific resource type
 */
export const getExportColumns = (type: ExportColumnType): ExportColumn[] => {
  return EXPORT_COLUMNS[type];
};

/**
 * Batch export multiple data types
 */
export interface BatchExportOptions {
  patient: Patient;
  exports: Array<{
    data: any[];
    type: ExportColumnType;
    title: string;
  }>;
  format: ExportFormat;
  combinedFilename?: string;
}

/**
 * Export multiple data types in a single operation
 */
export const batchExportClinicalData = (options: BatchExportOptions): void => {
  const { patient, exports, format, combinedFilename } = options;
  
  if (format === 'json') {
    // Combine all exports into a single JSON file
    const combinedData = exports.reduce((acc, exp) => {
      acc[exp.type] = exp.data;
      return acc;
    }, {} as Record<string, any>);
    
    const filename = combinedFilename || generateFilename('Combined_Clinical_Data', patient);
    const exportData: JSONExportData<Record<string, any>> = {
      exportDate: new Date().toISOString(),
      title: 'Combined Clinical Data Export',
      patient: extractPatientInfo(patient),
      data: combinedData,
      metadata: {
        recordCount: exports.reduce((sum, exp) => sum + exp.data.length, 0),
        exportFormat: format,
        generatedBy: 'MedGenEMR Batch Export'
      }
    };
    
    downloadJSON(exportData, filename);
  } else {
    // Export each type separately
    exports.forEach(exp => {
      exportClinicalData({
        patient,
        data: exp.data,
        columns: getExportColumns(exp.type),
        format,
        title: exp.title
      });
    });
  }
};

/**
 * Export utilities for common operations
 */
export const exportUtils = {
  generateFilename,
  extractPatientInfo,
  getExportColumns,
  createTypedBlob,
  escapeForCSV: (value: string): string => value.replace(/"/g, '""'),
  validateExportData: <T>(data: T[]): boolean => Array.isArray(data) && data.length > 0
};

/**
 * Default export for backward compatibility
 */
const exportUtilsDefault = {
  exportClinicalData,
  batchExportClinicalData,
  downloadCSV,
  downloadJSON,
  generateCSV,
  EXPORT_COLUMNS,
  getExportColumns,
  exportUtils
};

export default exportUtilsDefault;
