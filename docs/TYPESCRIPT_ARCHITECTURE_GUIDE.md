# WintEHR TypeScript Architecture Guide

**Version**: 1.0  
**Created**: 2025-01-26  
**Branch**: `feature/typescript-migration` (to be created)

## Overview

This guide details the modernized architecture for WintEHR's TypeScript migration, focusing on scalability, maintainability, and developer experience.

## Core Architecture Principles

### 1. Feature-First Organization

Organize code by feature/domain rather than technical role:

```
src/features/
├── patients/           # Patient management feature
├── clinical/          # Clinical workspace
├── orders/            # Order management
├── pharmacy/          # Pharmacy operations
├── imaging/           # Medical imaging
├── laboratory/        # Lab results
└── billing/           # Financial operations
```

### 2. Layered Architecture

Each feature follows a consistent layered structure:

```
feature/
├── api/              # API calls and data fetching
├── components/       # UI components
├── hooks/           # Custom React hooks
├── store/           # State management (Zustand)
├── types/           # TypeScript definitions
├── utils/           # Feature-specific utilities
├── constants/       # Feature constants
└── index.ts         # Public API exports
```

### 3. Dependency Rules

- Features can depend on `shared` and `core`
- Features should NOT depend on other features directly
- Use events or shared state for cross-feature communication
- Core modules have no dependencies

## Type System Architecture

### Base Types Structure

```typescript
// src/shared/types/base.ts
export interface Entity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
}

export interface ApiResponse<T> {
  data: T;
  meta?: ResponseMeta;
  errors?: ApiError[];
}

export interface ApiError {
  code: string;
  message: string;
  field?: string;
  details?: unknown;
}
```

### FHIR Type Extensions

```typescript
// src/core/fhir/types/extensions.ts
import { Patient as FHIRPatient } from '@types/fhir';

export interface Patient extends FHIRPatient {
  // Custom extensions
  _computedAge?: number;
  _lastVisit?: string;
  _riskScore?: number;
  _preferredPharmacy?: Reference;
}

// Discriminated unions for better type safety
export type ClinicalResource = 
  | { resourceType: 'Condition'; resource: Condition }
  | { resourceType: 'Observation'; resource: Observation }
  | { resourceType: 'MedicationRequest'; resource: MedicationRequest };
```

### Domain Models

```typescript
// src/features/clinical/types/index.ts
export interface ClinicalContext {
  patient: Patient;
  encounter?: Encounter;
  practitioner: Practitioner;
  organization: Organization;
}

export interface ClinicalWorkspace {
  activeTab: ClinicalTab;
  context: ClinicalContext;
  unsavedChanges: Map<string, unknown>;
  notifications: ClinicalNotification[];
}
```

## State Management Architecture

### Zustand Store Pattern

```typescript
// src/features/patients/store/patientStore.ts
interface PatientState {
  // State
  patients: Map<string, Patient>;
  activePatientId: string | null;
  searchResults: Patient[];
  filters: PatientFilters;
  
  // Computed
  activePatient: Patient | null;
  
  // Actions
  actions: {
    fetchPatient: (id: string) => Promise<void>;
    updatePatient: (id: string, data: Partial<Patient>) => Promise<void>;
    searchPatients: (query: PatientSearchQuery) => Promise<void>;
    setActivePatient: (id: string | null) => void;
  };
}

export const usePatientStore = create<PatientState>((set, get) => ({
  patients: new Map(),
  activePatientId: null,
  searchResults: [],
  filters: defaultFilters,
  
  get activePatient() {
    const id = get().activePatientId;
    return id ? get().patients.get(id) || null : null;
  },
  
  actions: {
    fetchPatient: async (id) => {
      const patient = await patientApi.getPatient(id);
      set((state) => ({
        patients: new Map(state.patients).set(id, patient)
      }));
    },
    // ... other actions
  }
}));
```

### Store Composition

```typescript
// src/shared/store/rootStore.ts
interface RootStore {
  patient: PatientState;
  clinical: ClinicalState;
  auth: AuthState;
  ui: UIState;
}

// Slice pattern for modular stores
export const useStore = create<RootStore>()(
  devtools(
    persist(
      (set) => ({
        patient: createPatientSlice(set),
        clinical: createClinicalSlice(set),
        auth: createAuthSlice(set),
        ui: createUISlice(set),
      }),
      {
        name: 'wintemr-store',
        partialize: (state) => ({ auth: state.auth })
      }
    )
  )
);
```

## API Architecture

### API Client Pattern

```typescript
// src/core/api/client.ts
export class ApiClient {
  private baseURL: string;
  private interceptors: Interceptor[];

  constructor(config: ApiConfig) {
    this.baseURL = config.baseURL;
    this.setupInterceptors();
  }

  async request<T>(config: RequestConfig): Promise<T> {
    // Apply request interceptors
    // Make request
    // Apply response interceptors
    // Handle errors
  }
}

// Typed API methods
export class TypedApiClient extends ApiClient {
  patients = {
    get: (id: string) => 
      this.request<Patient>({ method: 'GET', url: `/patients/${id}` }),
    list: (params?: PatientSearchParams) => 
      this.request<Patient[]>({ method: 'GET', url: '/patients', params }),
    create: (data: CreatePatientDto) => 
      this.request<Patient>({ method: 'POST', url: '/patients', data }),
    update: (id: string, data: UpdatePatientDto) => 
      this.request<Patient>({ method: 'PUT', url: `/patients/${id}`, data }),
  };
}
```

### React Query Integration

```typescript
// src/features/patients/api/queries.ts
export const patientKeys = {
  all: ['patients'] as const,
  lists: () => [...patientKeys.all, 'list'] as const,
  list: (filters: PatientFilters) => [...patientKeys.lists(), filters] as const,
  details: () => [...patientKeys.all, 'detail'] as const,
  detail: (id: string) => [...patientKeys.details(), id] as const,
};

export function usePatient(id: string) {
  return useQuery({
    queryKey: patientKeys.detail(id),
    queryFn: () => patientApi.get(id),
    staleTime: 5 * 60 * 1000,
  });
}

export function usePatientMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePatientDto }) => 
      patientApi.update(id, data),
    onSuccess: (data, { id }) => {
      queryClient.setQueryData(patientKeys.detail(id), data);
      queryClient.invalidateQueries({ queryKey: patientKeys.lists() });
    },
  });
}
```

## Component Architecture

### Base Component Pattern

```typescript
// src/shared/components/base/Card/Card.tsx
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'outlined' | 'elevated';
  padding?: 'none' | 'small' | 'medium' | 'large';
  interactive?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', padding = 'medium', interactive = false, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'card',
          `card--${variant}`,
          `card--padding-${padding}`,
          interactive && 'card--interactive',
          className
        )}
        {...props}
      />
    );
  }
);

Card.displayName = 'Card';
```

### Compound Component Pattern

```typescript
// src/features/clinical/components/ClinicalCard/index.tsx
interface ClinicalCardContextValue {
  severity: ClinicalSeverity;
  isExpanded: boolean;
  onToggle: () => void;
}

const ClinicalCardContext = createContext<ClinicalCardContextValue | null>(null);

export interface ClinicalCardProps {
  children: React.ReactNode;
  severity?: ClinicalSeverity;
  defaultExpanded?: boolean;
}

export function ClinicalCard({ children, severity = 'info', defaultExpanded = false }: ClinicalCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  
  const value = useMemo(
    () => ({
      severity,
      isExpanded,
      onToggle: () => setIsExpanded(prev => !prev),
    }),
    [severity, isExpanded]
  );

  return (
    <ClinicalCardContext.Provider value={value}>
      <Card className={`clinical-card clinical-card--${severity}`}>
        {children}
      </Card>
    </ClinicalCardContext.Provider>
  );
}

// Compound components
ClinicalCard.Header = ClinicalCardHeader;
ClinicalCard.Body = ClinicalCardBody;
ClinicalCard.Actions = ClinicalCardActions;
```

### Hook Composition

```typescript
// src/features/clinical/hooks/useClinicalWorkspace.ts
export function useClinicalWorkspace(patientId: string) {
  const patient = usePatient(patientId);
  const conditions = usePatientConditions(patientId);
  const medications = usePatientMedications(patientId);
  const vitals = usePatientVitals(patientId);
  
  const isLoading = patient.isLoading || conditions.isLoading || medications.isLoading || vitals.isLoading;
  const error = patient.error || conditions.error || medications.error || vitals.error;
  
  return {
    patient: patient.data,
    conditions: conditions.data,
    medications: medications.data,
    vitals: vitals.data,
    isLoading,
    error,
    refetchAll: () => {
      patient.refetch();
      conditions.refetch();
      medications.refetch();
      vitals.refetch();
    },
  };
}
```

## Testing Architecture

### Test Organization

```
feature/
├── __tests__/
│   ├── integration/    # Integration tests
│   ├── unit/          # Unit tests
│   └── e2e/           # End-to-end tests
├── __mocks__/         # Test mocks
└── __fixtures__/      # Test fixtures
```

### Testing Patterns

```typescript
// src/features/patients/components/PatientCard/__tests__/PatientCard.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PatientCard } from '../PatientCard';
import { mockPatient } from '@/test/fixtures/patient';
import { TestWrapper } from '@/test/utils';

describe('PatientCard', () => {
  it('renders patient information correctly', () => {
    render(
      <TestWrapper>
        <PatientCard patient={mockPatient} />
      </TestWrapper>
    );
    
    expect(screen.getByText(mockPatient.name[0].text)).toBeInTheDocument();
    expect(screen.getByText(`DOB: ${mockPatient.birthDate}`)).toBeInTheDocument();
  });
  
  it('handles click events', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    
    render(
      <TestWrapper>
        <PatientCard patient={mockPatient} onClick={handleClick} />
      </TestWrapper>
    );
    
    await user.click(screen.getByRole('article'));
    expect(handleClick).toHaveBeenCalledWith(mockPatient.id);
  });
});
```

### Test Utilities

```typescript
// src/test/utils/TestWrapper.tsx
export function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={testQueryClient}>
      <MemoryRouter>
        <ThemeProvider theme={theme}>
          {children}
        </ThemeProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// Custom render function
export function renderWithProviders(ui: React.ReactElement, options?: RenderOptions) {
  return render(ui, {
    wrapper: TestWrapper,
    ...options,
  });
}
```

## Performance Patterns

### Code Splitting

```typescript
// src/features/clinical/routes.tsx
import { lazy } from 'react';

const ClinicalWorkspace = lazy(() => 
  import(/* webpackChunkName: "clinical" */ './components/ClinicalWorkspace')
);

export const clinicalRoutes = [
  {
    path: '/clinical/:patientId',
    element: (
      <Suspense fallback={<ClinicalWorkspaceLoader />}>
        <ClinicalWorkspace />
      </Suspense>
    ),
  },
];
```

### Memoization Patterns

```typescript
// src/features/patients/components/PatientList/PatientList.tsx
export const PatientList = memo(({ patients, onSelectPatient }: PatientListProps) => {
  const sortedPatients = useMemo(
    () => patients.sort((a, b) => a.name[0].family.localeCompare(b.name[0].family)),
    [patients]
  );
  
  const handleSelect = useCallback(
    (patientId: string) => {
      onSelectPatient(patientId);
    },
    [onSelectPatient]
  );
  
  return (
    <VirtualizedList
      items={sortedPatients}
      renderItem={(patient) => (
        <PatientListItem
          key={patient.id}
          patient={patient}
          onSelect={handleSelect}
        />
      )}
    />
  );
});
```

## Build Configuration

### Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui': ['@mui/material', '@mui/icons-material'],
          'fhir': ['@types/fhir', './src/core/fhir'],
          'clinical': ['./src/features/clinical'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['@mui/material', '@emotion/react', '@emotion/styled'],
  },
});
```

## Migration Utilities

### Type Guards

```typescript
// src/shared/utils/guards.ts
export function isPatient(resource: unknown): resource is Patient {
  return (
    typeof resource === 'object' &&
    resource !== null &&
    'resourceType' in resource &&
    resource.resourceType === 'Patient'
  );
}

export function assertPatient(resource: unknown): asserts resource is Patient {
  if (!isPatient(resource)) {
    throw new Error('Resource is not a Patient');
  }
}
```

### Migration Helpers

```typescript
// src/shared/utils/migration.ts
export function migrateComponent<P extends object>(
  Component: React.ComponentType<P>,
  displayName: string
): React.FC<P> {
  const MigratedComponent: React.FC<P> = (props) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Migration] Rendering ${displayName}`, props);
    }
    return <Component {...props} />;
  };
  
  MigratedComponent.displayName = `Migrated(${displayName})`;
  return MigratedComponent;
}
```

## Conclusion

This architecture provides a solid foundation for the TypeScript migration while improving maintainability, testability, and developer experience. The modular structure allows for incremental migration while maintaining system stability.

---

**Remember**: All TypeScript migration work should be done on the `feature/typescript-migration` branch.