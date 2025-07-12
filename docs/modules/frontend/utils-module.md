# Utils Module Documentation

**Module**: Frontend Utils  
**Status**: Active - TypeScript Migration In Progress  
**Updated**: 2025-01-12

## Overview

The Utils module provides essential utility functions for the MedGenEMR frontend application. These utilities handle FHIR data formatting, validation, caching, export functionality, and other common operations used throughout the application.

## Directory Structure

```
frontend/src/utils/
├── fhirFormatters.ts       # FHIR data formatting utilities ✅ (Migrated)
├── fhirValidation.ts       # FHIR resource validation ✅ (Migrated)  
├── intelligentCache.js     # Multi-level caching system
├── exportUtils.js          # Data export functionality
├── printUtils.js           # Clinical document printing
├── performanceMonitor.js   # Performance monitoring
├── colorUtils.js           # UI color utilities
├── dateUtils.js            # Date manipulation helpers
├── errorUtils.js           # Error handling utilities
├── migrations.js           # FHIR data migration framework
└── qrCodeUtils.js          # QR code generation
```

## TypeScript Migration Status

| File | Status | Migration Date | Key Changes |
|------|--------|----------------|-------------|
| fhirFormatters.ts | ✅ Migrated | 2025-01-12 | Added 4 new functions, comprehensive type safety |
| fhirValidation.ts | ✅ Migrated | 2025-01-12 | Strongly typed validation classes, 153 FHIR types |
| intelligentCache.js | ⏳ Pending | - | Multi-level cache with TTL |
| exportUtils.js | ⏳ Pending | - | CSV/JSON/PDF export |
| Others | ⏳ Pending | - | Lower priority utilities |

## Core Utilities

### 1. FHIR Formatters (`fhirFormatters.ts`) ✅

**Purpose**: Format FHIR data types for display in the UI

**Key Functions**:
```typescript
// Format various FHIR data types
export const formatCodeableConcept = (concept?: CodeableConcept | null): string
export const formatReference = (reference?: Reference | string | null): string
export const formatPeriod = (period?: Period | null): string
export const formatQuantity = (quantity?: Quantity | null): string
export const formatHumanName = (name?: HumanName | null): string
export const formatAddress = (address?: Address | null): string
export const formatContactPoint = (contact?: ContactPoint | null): string

// Generic formatter with type detection
export const getDisplayText = (field: DisplayableField): string

// Date formatting with multiple formats
export const formatFHIRDate = (date?: string | null, format: DateFormat = 'short'): string

// New utility functions (added in TypeScript migration)
export const formatAge = (birthDate?: string | null): string
export const formatMultipleFields = (fields: DisplayableField[], separator?: string): string
export const formatBoolean = (value?: boolean | null, trueText?: string, falseText?: string): string
export const safeFormat = (field: DisplayableField, fallback?: string): string
```

**TypeScript Benefits**:
- Type-safe formatting with proper null handling
- Type guards for runtime FHIR type detection
- Discriminated unions for format options
- Enhanced IntelliSense support

### 2. FHIR Validation (`fhirValidation.ts`) ✅

**Purpose**: Comprehensive validation for FHIR R4 resources

**Key Features**:
```typescript
// Main validator class
export class FHIRValidator {
  constructor(options?: FHIRValidatorOptions)
  validateResource(resource: any): ValidationResult
  validateReference(reference: any, path: string, result: ValidationResult): void
  // ... 20+ validation methods for different FHIR types
}

// Validation result management
export class ValidationResult {
  errors: FHIRValidationError[]
  warnings: FHIRValidationError[]
  information: FHIRValidationError[]
  
  get isValid(): boolean
  get hasWarnings(): boolean
  toOperationOutcome(): OperationOutcome
}

// Typed validation errors
export class FHIRValidationError extends Error {
  path: string
  severity: ValidationSeverity
  code: ValidationErrorCode | null
}

// All 153 FHIR R4 resource types
export const FHIR_RESOURCE_TYPES: readonly FHIRResourceType[]

// 17 validation patterns for primitives
export const VALIDATION_PATTERNS: {
  id, uri, url, code, dateTime, date, time, decimal,
  integer, positiveInt, unsignedInt, base64Binary,
  instant, oid, uuid, canonical
}
```

**TypeScript Benefits**:
- Strongly typed error codes and severity levels
- Type-safe validator options
- Comprehensive type guards
- Proper error class inheritance

### 3. Intelligent Cache (`intelligentCache.js`) ⏳

**Purpose**: Multi-level caching system with TTL and size limits

**Key Features**:
- Memory cache with configurable TTL
- Size-based eviction policies
- Cache statistics and monitoring
- Batch operations support

**Usage**:
```javascript
import { IntelligentCache } from '../utils/intelligentCache';

const cache = new IntelligentCache({
  maxSize: 1000,
  defaultTTL: 600000, // 10 minutes
  evictionPolicy: 'lru'
});

// Set with custom TTL
cache.set('key', data, { ttl: 300000 });

// Get with fallback
const data = cache.get('key', fetchFromServer);
```

### 4. Export Utils (`exportUtils.js`) ⏳

**Purpose**: Export clinical data in multiple formats

**Supported Formats**:
- CSV with customizable columns
- JSON with FHIR structure
- PDF with clinical formatting
- Excel worksheets

**Usage**:
```javascript
import { exportClinicalData, EXPORT_COLUMNS } from '../utils/exportUtils';

exportClinicalData({
  patient: currentPatient,
  data: observations,
  columns: EXPORT_COLUMNS.observations,
  format: 'csv',
  title: 'Lab Results',
  formatForPrint: formatObservationsForPrint
});
```

### 5. Print Utils (`printUtils.js`)

**Purpose**: Format and print clinical documents

**Features**:
- Clinical document templates
- Print preview functionality
- Header/footer customization
- Page break management

### 6. Performance Monitor (`performanceMonitor.js`)

**Purpose**: Track application performance metrics

**Metrics Tracked**:
- API response times
- Component render performance
- Memory usage patterns
- User interaction latency

## Integration Patterns

### With FHIR Services
```typescript
import { formatCodeableConcept, formatFHIRDate } from '../utils/fhirFormatters';
import { validateResource } from '../utils/fhirValidation';

// Format for display
const conditionDisplay = formatCodeableConcept(condition.code);
const onsetDate = formatFHIRDate(condition.onsetDateTime, 'relative');

// Validate before save
const validation = validateResource(condition);
if (!validation.isValid) {
  showErrors(validation.errors);
}
```

### With Components
```typescript
// In clinical components
import { getDisplayText, formatAge } from '../utils/fhirFormatters';

const PatientHeader: React.FC<{ patient: Patient }> = ({ patient }) => {
  const name = getDisplayText(patient.name);
  const age = formatAge(patient.birthDate);
  
  return (
    <div>
      <h2>{name}</h2>
      <span>{age}</span>
    </div>
  );
};
```

### With Export Features
```javascript
// Export lab results
import { exportClinicalData } from '../utils/exportUtils';

const exportLabs = () => {
  exportClinicalData({
    patient,
    data: labResults,
    format: userPreference.exportFormat,
    columns: EXPORT_COLUMNS.labs
  });
};
```

## Best Practices

### 1. Type Safety (TypeScript Files)
- Always use proper FHIR types from `@ahryman40k/ts-fhir-types`
- Implement type guards for runtime validation
- Use discriminated unions for format options
- Avoid `any` types except for validator input

### 2. Null Handling
- All formatters should handle null/undefined gracefully
- Return empty strings rather than 'undefined' text
- Use optional chaining for nested properties

### 3. Performance
- Cache formatted values when displaying lists
- Use memoization for expensive computations
- Batch validation operations when possible

### 4. Error Handling
- Validators should collect all errors, not fail fast
- Format functions should never throw
- Export operations should show progress

## Testing Guidelines

### Unit Tests
```typescript
// Test formatters
test('formatCodeableConcept handles all cases', () => {
  expect(formatCodeableConcept(null)).toBe('');
  expect(formatCodeableConcept({ text: 'Diabetes' })).toBe('Diabetes');
  expect(formatCodeableConcept({ 
    coding: [{ display: 'DM Type 2' }] 
  })).toBe('DM Type 2');
});

// Test validators
test('validateResource catches missing required fields', () => {
  const result = validateResource({ resourceType: 'Condition' });
  expect(result.isValid).toBe(false);
  expect(result.errors).toContainEqual(
    expect.objectContaining({ 
      path: 'subject',
      code: 'required' 
    })
  );
});
```

### Integration Tests
- Test with real FHIR resources from the database
- Verify export formats open correctly
- Test print output in different browsers
- Validate cache behavior under load

## Migration Considerations

### When Migrating to TypeScript
1. Start with type definitions for all parameters
2. Add proper return types to all functions
3. Implement type guards for runtime checks
4. Update all imports in consuming files
5. Add comprehensive JSDoc comments
6. Ensure backward compatibility

### Breaking Changes to Avoid
- Changing function signatures
- Modifying return value structures
- Altering export names
- Changing default parameters

## Future Enhancements

### Planned Additions
1. **Localization Support**: Format dates/numbers per locale
2. **Custom Validators**: Plugin system for resource-specific rules
3. **Streaming Exports**: Handle large datasets efficiently
4. **Template Engine**: Customizable document templates
5. **Performance Profiler**: Detailed performance analytics

### TypeScript Migration Goals
- Complete migration of all utility files
- Add comprehensive type definitions
- Implement stricter validation
- Improve error messages with types
- Enhanced IDE support throughout

## Dependencies

### NPM Packages
- `@ahryman40k/ts-fhir-types`: FHIR R4 TypeScript types
- `papaparse`: CSV parsing and generation
- `jspdf`: PDF document generation
- `xlsx`: Excel file handling
- `qrcode`: QR code generation

### Internal Dependencies
- `types/fhir`: Custom FHIR type extensions
- `services/fhirClient`: For validation testing
- `contexts/FHIRResourceContext`: Cache integration

## Recent Updates

### 2025-01-12
- ✅ Migrated `fhirFormatters.js` to TypeScript
  - Added 4 new utility functions
  - Implemented comprehensive type guards
  - Enhanced date formatting options
- ✅ Migrated `fhirValidation.js` to TypeScript
  - Strongly typed validation classes
  - All 153 FHIR R4 resource types
  - Enhanced error handling with stack traces
- 📋 Created comprehensive utils module documentation
- 🎯 Next: Migrate `intelligentCache.js` and `exportUtils.js`
