# WintEHR TypeScript Migration Plan

**Version**: 1.0  
**Created**: 2025-01-26  
**Status**: Active Planning

## Executive Summary

This document outlines a comprehensive plan to migrate the WintEHR frontend from JavaScript to TypeScript while simultaneously modernizing the codebase, improving architecture, and updating dependencies. The migration will be performed incrementally without disrupting ongoing development or production deployments.

## Goals & Objectives

### Primary Goals
1. **Type Safety**: Achieve 100% TypeScript coverage with strict type checking
2. **Zero Downtime**: Maintain continuous operation throughout migration
3. **Improved Developer Experience**: Better IntelliSense, compile-time error catching
4. **Modernization**: Update libraries and adopt current best practices
5. **Performance**: Improve bundle size and runtime performance

### Success Metrics
- 100% TypeScript file conversion
- Strict mode enabled (`strict: true`)
- No increase in bundle size (target: 10% reduction)
- Test coverage maintained at >80%
- Zero production incidents during migration

## Migration Strategy

### Approach: Parallel Track Migration

We'll use a **parallel track approach** where TypeScript versions are created alongside JavaScript files, allowing gradual cutover:

```
components/
├── PatientCard.js          # Original
├── PatientCard.tsx         # New TypeScript version
└── PatientCard.migration   # Migration status tracker
```

### Key Principles

1. **Incremental**: Convert module by module
2. **Non-Breaking**: Maintain backward compatibility
3. **Test-Driven**: Write tests before conversion
4. **Documentation**: Update docs with each conversion
5. **Quality First**: Refactor and improve during migration

## Technical Architecture Improvements

### 1. Enhanced Folder Structure

```
src/
├── app/                    # Application-level components
│   ├── layouts/           # Layout components
│   ├── providers/         # Context providers
│   └── routes/            # Route definitions
├── features/              # Feature-based modules
│   ├── patients/
│   │   ├── api/          # API calls
│   │   ├── components/   # Feature components
│   │   ├── hooks/        # Feature hooks
│   │   ├── store/        # State management
│   │   ├── types/        # TypeScript types
│   │   └── utils/        # Feature utilities
│   ├── clinical/
│   ├── orders/
│   ├── pharmacy/
│   └── imaging/
├── shared/                # Shared resources
│   ├── components/       # Reusable components
│   ├── hooks/           # Shared hooks
│   ├── services/        # API services
│   ├── types/           # Global types
│   └── utils/           # Utilities
├── core/                 # Core functionality
│   ├── fhir/            # FHIR-specific code
│   ├── auth/            # Authentication
│   └── api/             # API configuration
└── assets/              # Static assets
```

### 2. State Management Modernization

Replace Context-heavy approach with **Zustand** for better TypeScript support:

```typescript
// Before: Context API
const PatientContext = React.createContext<PatientContextType | null>(null);

// After: Zustand with TypeScript
interface PatientStore {
  patient: Patient | null;
  loading: boolean;
  error: Error | null;
  actions: {
    fetchPatient: (id: string) => Promise<void>;
    updatePatient: (data: Partial<Patient>) => Promise<void>;
  };
}

const usePatientStore = create<PatientStore>((set, get) => ({
  patient: null,
  loading: false,
  error: null,
  actions: {
    fetchPatient: async (id) => {
      // Implementation
    }
  }
}));
```

### 3. API Layer Enhancement

Implement **React Query (TanStack Query)** for data fetching:

```typescript
// Enhanced FHIR hooks with React Query
export function usePatient(id: string) {
  return useQuery({
    queryKey: ['patient', id],
    queryFn: () => fhirClient.getPatient(id),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });
}
```

### 4. Component Architecture

Adopt **Compound Component Pattern** for complex clinical components:

```typescript
// Clinical component with compound pattern
interface ClinicalCardProps {
  children: React.ReactNode;
  severity?: 'info' | 'warning' | 'critical';
}

const ClinicalCard = ({ children, severity = 'info' }: ClinicalCardProps) => {
  return <CardContext.Provider value={{ severity }}>{children}</CardContext.Provider>;
};

ClinicalCard.Header = CardHeader;
ClinicalCard.Body = CardBody;
ClinicalCard.Actions = CardActions;

// Usage
<ClinicalCard severity="warning">
  <ClinicalCard.Header title="Active Conditions" />
  <ClinicalCard.Body>
    <ConditionsList conditions={conditions} />
  </ClinicalCard.Body>
  <ClinicalCard.Actions>
    <Button>Add Condition</Button>
  </ClinicalCard.Actions>
</ClinicalCard>
```

## Library Updates & Replacements

### Core Dependencies to Update

| Current | Replacement | Reason |
|---------|-------------|---------|
| axios | Native fetch + React Query | Better TypeScript support, smaller bundle |
| react-beautiful-dnd | @dnd-kit (keep) | Already using modern library |
| Context API (heavy use) | Zustand | Better TypeScript, less boilerplate |
| Manual caching | React Query | Automatic caching, background refetch |
| react-scripts | Vite | Faster builds, better DX |
| Chart.js | Recharts (keep) | Already using, good TS support |
| moment.js (if any) | date-fns (keep) | Already using |

### New Dependencies to Add

```json
{
  "@tanstack/react-query": "^5.x",
  "zustand": "^4.x",
  "zod": "^3.x",              // Runtime validation
  "@types/fhir": "^0.0.36",   // FHIR types
  "react-hook-form": "^7.x",  // Form handling
  "vite": "^5.x",             // Build tool
  "vitest": "^1.x"            // Testing
}
```

## Migration Phases

### Phase 0: Foundation (Week 1-2)

**Goal**: Set up infrastructure for migration

1. **TypeScript Configuration Enhancement**
   ```json
   {
     "compilerOptions": {
       "strict": false,  // Start loose, tighten gradually
       "strictNullChecks": true,  // Enable immediately
       "noImplicitAny": false,    // Enable per module
       "target": "ES2020",        // Modern target
       "lib": ["ES2020", "DOM", "DOM.Iterable"],
       "incremental": true,       // Faster builds
       "composite": true          // Project references
     }
   }
   ```

2. **Migration Tooling Setup**
   - Install `ts-migrate` for automated conversion
   - Set up migration scripts
   - Create migration tracking system
   - Configure dual compilation (JS + TS)

3. **Type Definition Infrastructure**
   ```typescript
   // src/shared/types/fhir/index.ts
   export * from './resources';
   export * from './datatypes';
   export * from './operations';
   export * from './search';
   ```

4. **Development Workflow**
   - Set up pre-commit hooks for type checking
   - Configure IDE for TypeScript
   - Create migration checklist templates

### Phase 1: Core Services & Types (Week 3-4)

**Goal**: Convert foundational services and establish type system

1. **FHIR Type System**
   ```typescript
   // Extend @types/fhir with custom types
   import { Patient as FHIRPatient } from '@types/fhir';
   
   export interface Patient extends FHIRPatient {
     // Custom extensions
     _lastAccessed?: string;
     _computedAge?: number;
   }
   ```

2. **API Services**
   - Convert `fhirClient.js` → `fhirClient.ts` ✓ (already done)
   - Create `apiClient.ts` base class
   - Implement request/response interceptors
   - Add comprehensive error types

3. **Authentication Service**
   ```typescript
   interface AuthService {
     login(credentials: LoginCredentials): Promise<AuthResponse>;
     logout(): Promise<void>;
     refreshToken(): Promise<TokenResponse>;
     getCurrentUser(): User | null;
   }
   ```

4. **WebSocket Service**
   ```typescript
   interface WebSocketMessage<T = unknown> {
     type: string;
     payload: T;
     timestamp: string;
   }
   
   class TypedWebSocket<T extends WebSocketMessage> {
     // Implementation
   }
   ```

### Phase 2: Shared Components & Hooks (Week 5-6)

**Goal**: Create typed component library

1. **Base Component Library**
   ```typescript
   // src/shared/components/base/Button/Button.tsx
   export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
     variant?: 'primary' | 'secondary' | 'danger';
     size?: 'small' | 'medium' | 'large';
     loading?: boolean;
   }
   ```

2. **Clinical Component System**
   ```typescript
   // src/shared/components/clinical/ClinicalCard/types.ts
   export interface ClinicalCardProps {
     severity?: ClinicalSeverity;
     patient?: Patient;
     onAction?: (action: ClinicalAction) => void;
   }
   ```

3. **Custom Hooks Migration**
   ```typescript
   // src/shared/hooks/useFHIRResource.ts
   export function useFHIRResource<T extends Resource>(
     resourceType: ResourceType,
     id: string,
     options?: FHIRResourceOptions
   ): FHIRResourceResult<T> {
     // Implementation
   }
   ```

### Phase 3: Feature Modules - Clinical Core (Week 7-9)

**Goal**: Migrate critical clinical features

1. **Patient Management**
   ```
   features/patients/
   ├── api/
   │   ├── patientApi.ts
   │   └── patientApi.test.ts
   ├── components/
   │   ├── PatientCard/
   │   ├── PatientSearch/
   │   └── PatientDetails/
   ├── hooks/
   │   ├── usePatient.ts
   │   └── usePatientSearch.ts
   ├── store/
   │   └── patientStore.ts
   └── types/
       └── index.ts
   ```

2. **Clinical Workspace**
   - Migrate tabs incrementally
   - Maintain backward compatibility
   - Add comprehensive prop types
   - Implement error boundaries

3. **Orders Module**
   ```typescript
   interface Order {
     id: string;
     type: OrderType;
     status: OrderStatus;
     patient: Reference;
     prescriber: Reference;
     items: OrderItem[];
   }
   ```

### Phase 4: Feature Modules - Extended (Week 10-11)

**Goal**: Complete remaining feature migrations

1. **Pharmacy Module**
2. **Imaging Module**
3. **Results Module**
4. **Documentation Module**
5. **Care Plans Module**

### Phase 5: Advanced Features (Week 12-13)

**Goal**: Migrate complex features

1. **FHIR Explorer**
   - Query builder with types
   - Resource visualization
   - Schema exploration

2. **CDS Studio**
   - Hook definitions
   - Rule builder
   - Testing interface

3. **UI Composer**
   - Component generation
   - FHIR data binding

### Phase 6: Testing & Quality (Week 14-15)

**Goal**: Comprehensive testing and quality assurance

1. **Test Migration**
   ```typescript
   // src/features/patients/components/PatientCard/PatientCard.test.tsx
   import { render, screen } from '@testing-library/react';
   import { PatientCard } from './PatientCard';
   import { mockPatient } from '@/test/mocks';
   
   describe('PatientCard', () => {
     it('renders patient information correctly', () => {
       render(<PatientCard patient={mockPatient} />);
       expect(screen.getByText(mockPatient.name[0].given[0])).toBeInTheDocument();
     });
   });
   ```

2. **Type Coverage Analysis**
   - Run type coverage reports
   - Fix any implicit any types
   - Enable strict mode gradually

3. **Performance Testing**
   - Bundle size analysis
   - Runtime performance profiling
   - Memory usage monitoring

### Phase 7: Finalization (Week 16)

**Goal**: Complete migration and cleanup

1. **Enable Strict Mode**
   ```json
   {
     "compilerOptions": {
       "strict": true,
       "noImplicitAny": true,
       "strictNullChecks": true,
       "strictFunctionTypes": true
     }
   }
   ```

2. **Remove JavaScript Files**
   - Delete migrated .js files
   - Update imports
   - Clean up migration artifacts

3. **Documentation Update**
   - Update all documentation
   - Create TypeScript style guide
   - Update onboarding materials

## Implementation Details

### Migration Script

```bash
#!/bin/bash
# migrate-component.sh

COMPONENT=$1
FEATURE=$2

# Create TypeScript version
cp src/features/$FEATURE/components/$COMPONENT.js \
   src/features/$FEATURE/components/$COMPONENT.tsx

# Run ts-migrate
npx ts-migrate migrate src/features/$FEATURE/components/$COMPONENT.tsx

# Run prettier
npx prettier --write src/features/$FEATURE/components/$COMPONENT.tsx

# Create migration tracker
echo "Status: In Progress
Started: $(date)
Developer: $USER" > src/features/$FEATURE/components/$COMPONENT.migration
```

### Gradual Strictness

```typescript
// Per-file strict mode during migration
// @ts-strict-mode

// Or use directive comments
// @ts-expect-error - Migration in progress
// @ts-ignore - Temporary during migration
// TODO: Type this properly
```

### Parallel Development

```typescript
// components/PatientCard.wrapper.tsx
// Wrapper to switch between JS and TS versions
export const PatientCard = process.env.REACT_APP_USE_TS 
  ? require('./PatientCard.tsx').default 
  : require('./PatientCard.js').default;
```

## Risk Mitigation

### Technical Risks

1. **Type Definition Conflicts**
   - Solution: Create custom type definitions
   - Use declaration merging for conflicts

2. **Third-party Library Types**
   - Solution: Create stub types initially
   - Contribute types to DefinitelyTyped

3. **Build Performance**
   - Solution: Use project references
   - Implement incremental builds

### Process Risks

1. **Developer Resistance**
   - Solution: Provide training
   - Pair programming sessions

2. **Migration Fatigue**
   - Solution: Celebrate milestones
   - Rotate developers

3. **Schedule Slippage**
   - Solution: Buffer time built in
   - Prioritize critical paths

## Rollback Strategy

Each phase includes rollback capability:

1. **Feature Flags**: Toggle between JS/TS versions
2. **Git Strategy**: Separate branches for each phase
3. **Build System**: Dual compilation support
4. **Testing**: Comprehensive E2E tests

## Success Criteria

### Phase Completion Criteria

- [ ] All files in phase converted to TypeScript
- [ ] Tests passing with >80% coverage
- [ ] No TypeScript errors in strict mode
- [ ] Performance metrics maintained or improved
- [ ] Documentation updated

### Overall Success Metrics

1. **Type Coverage**: 100% of files converted
2. **Type Safety**: Strict mode enabled
3. **Bundle Size**: ≤90% of original
4. **Build Time**: <2 minutes
5. **Developer Satisfaction**: Survey score >4/5

## Timeline Summary

| Phase | Duration | Start Date | End Date | Status |
|-------|----------|------------|----------|---------|
| Phase 0: Foundation | 2 weeks | Week 1 | Week 2 | Planning |
| Phase 1: Core Services | 2 weeks | Week 3 | Week 4 | Planning |
| Phase 2: Shared Components | 2 weeks | Week 5 | Week 6 | Planning |
| Phase 3: Clinical Core | 3 weeks | Week 7 | Week 9 | Planning |
| Phase 4: Extended Features | 2 weeks | Week 10 | Week 11 | Planning |
| Phase 5: Advanced Features | 2 weeks | Week 12 | Week 13 | Planning |
| Phase 6: Testing & Quality | 2 weeks | Week 14 | Week 15 | Planning |
| Phase 7: Finalization | 1 week | Week 16 | Week 16 | Planning |

**Total Duration**: 16 weeks (4 months)

## Conclusion

This migration plan provides a systematic approach to converting WintEHR to TypeScript while improving the overall architecture and developer experience. The incremental approach ensures continuous operation while delivering value at each phase. Success depends on careful execution, team commitment, and maintaining focus on healthcare data safety throughout the process.

## Appendices

### A. TypeScript Configuration Templates
### B. Migration Checklists
### C. Code Style Guide
### D. Training Resources
### E. Monitoring Dashboard Setup

---

**Document Version History**
- v1.0 - Initial plan (2025-01-26)