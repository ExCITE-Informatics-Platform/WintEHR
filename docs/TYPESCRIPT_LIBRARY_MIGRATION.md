# WintEHR Library Migration Guide

**Version**: 1.0  
**Created**: 2025-01-26  
**Branch**: `feature/typescript-migration`

## Overview

This guide details library updates, replacements, and new additions for the TypeScript migration, focusing on modern alternatives that provide better TypeScript support, smaller bundle sizes, and improved developer experience.

## Core Library Strategy

### Principles
1. **TypeScript First**: Choose libraries with excellent TypeScript support
2. **Bundle Size**: Optimize for smaller production builds
3. **Tree Shaking**: Ensure libraries support proper tree shaking
4. **Active Maintenance**: Select actively maintained libraries
5. **Healthcare Ready**: Consider HIPAA compliance and security

## Library Migration Plan

### 1. Build Tool Migration

#### From: Create React App → To: Vite

**Why Migrate:**
- 10-100x faster HMR (Hot Module Replacement)
- Smaller bundle sizes with better tree shaking
- Native TypeScript support
- Better development experience

**Migration Steps:**
```bash
# Install Vite and dependencies
npm install -D vite @vitejs/plugin-react vite-tsconfig-paths

# Remove CRA dependencies
npm uninstall react-scripts @craco/craco

# Update scripts in package.json
"scripts": {
  "dev": "vite",
  "build": "tsc && vite build",
  "preview": "vite preview",
  "test": "vitest",
  "test:ui": "vitest --ui"
}
```

**Vite Config:**
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
    visualizer({ open: true, gzipSize: true })
  ],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:8000',
      '/fhir': 'http://localhost:8000'
    }
  }
});
```

### 2. State Management Migration

#### From: React Context (Heavy) → To: Zustand

**Why Migrate:**
- 2KB vs Context API boilerplate
- Better TypeScript inference
- No provider hell
- Built-in devtools

**Before (Context API):**
```javascript
const PatientContext = createContext();

export function PatientProvider({ children }) {
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const fetchPatient = async (id) => {
    setLoading(true);
    try {
      const data = await api.getPatient(id);
      setPatient(data);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <PatientContext.Provider value={{ patient, loading, fetchPatient }}>
      {children}
    </PatientContext.Provider>
  );
}
```

**After (Zustand):**
```typescript
interface PatientStore {
  patient: Patient | null;
  loading: boolean;
  fetchPatient: (id: string) => Promise<void>;
}

const usePatientStore = create<PatientStore>((set) => ({
  patient: null,
  loading: false,
  fetchPatient: async (id) => {
    set({ loading: true });
    try {
      const patient = await api.getPatient(id);
      set({ patient, loading: false });
    } catch (error) {
      set({ loading: false });
      throw error;
    }
  }
}));
```

### 3. Data Fetching Migration

#### Add: TanStack Query (React Query)

**Why Add:**
- Automatic caching and background refetching
- Optimistic updates
- Parallel queries
- Excellent TypeScript support

**Implementation:**
```typescript
// src/features/patients/hooks/usePatient.ts
export function usePatient(id: string) {
  return useQuery({
    queryKey: ['patient', id],
    queryFn: () => fhirClient.getPatient(id),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    retry: (failureCount, error) => {
      if (error.status === 404) return false;
      return failureCount < 3;
    }
  });
}

// Mutations with optimistic updates
export function useUpdatePatient() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: UpdatePatientArgs) => 
      fhirClient.updatePatient(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries(['patient', id]);
      const previousPatient = queryClient.getQueryData(['patient', id]);
      queryClient.setQueryData(['patient', id], old => ({ ...old, ...data }));
      return { previousPatient };
    },
    onError: (err, variables, context) => {
      if (context?.previousPatient) {
        queryClient.setQueryData(['patient', variables.id], context.previousPatient);
      }
    },
    onSettled: (data, error, { id }) => {
      queryClient.invalidateQueries(['patient', id]);
    }
  });
}
```

### 4. Form Handling Migration

#### Add: React Hook Form + Zod

**Why Add:**
- Best-in-class TypeScript support
- Built-in validation with Zod
- Minimal re-renders
- Small bundle size

**Implementation:**
```typescript
// Schema definition with Zod
const patientSchema = z.object({
  name: z.object({
    given: z.array(z.string()).min(1, 'First name is required'),
    family: z.string().min(1, 'Last name is required')
  }),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  gender: z.enum(['male', 'female', 'other', 'unknown']),
  contact: z.array(z.object({
    system: z.enum(['phone', 'email']),
    value: z.string()
  })).optional()
});

type PatientFormData = z.infer<typeof patientSchema>;

// Form component
export function PatientForm({ onSubmit }: PatientFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch
  } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      gender: 'unknown'
    }
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <TextField
        {...register('name.given.0')}
        error={!!errors.name?.given?.[0]}
        helperText={errors.name?.given?.[0]?.message}
        label="First Name"
      />
      {/* More fields... */}
    </form>
  );
}
```

### 5. HTTP Client Strategy

#### Keep: Axios → Configure for TypeScript

**Why Keep:**
- Already in use, team familiar
- Excellent TypeScript support available
- Interceptor pattern useful for auth

**TypeScript Configuration:**
```typescript
// src/core/api/axios.ts
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';

interface ApiError {
  message: string;
  code: string;
  details?: unknown;
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor with TypeScript
apiClient.interceptors.request.use(
  (config) => {
    const token = authStore.getState().token;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError<ApiError>) => {
    return Promise.reject(error);
  }
);

// Typed API methods
export async function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await apiClient.get<T>(url, config);
  return response.data;
}
```

### 6. Testing Library Updates

#### From: Jest + React Testing Library → To: Vitest + React Testing Library

**Why Migrate:**
- Native ESM support
- 10x faster than Jest
- Same API as Jest
- Better TypeScript support

**Configuration:**
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/test/']
    }
  }
});
```

### 7. Styling Strategy

#### Keep: Material-UI + Emotion → Update to Latest

**Updates Needed:**
```json
{
  "@mui/material": "^5.15.x",
  "@mui/x-data-grid": "^6.19.x",
  "@mui/x-date-pickers": "^6.19.x",
  "@emotion/react": "^11.11.x",
  "@emotion/styled": "^11.11.x"
}
```

**TypeScript Theme:**
```typescript
// src/shared/theme/theme.ts
import { createTheme, ThemeOptions } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Theme {
    status: {
      danger: string;
      warning: string;
      success: string;
    };
  }
  interface ThemeOptions {
    status?: {
      danger?: string;
      warning?: string;
      success?: string;
    };
  }
}

export const theme = createTheme({
  status: {
    danger: '#d32f2f',
    warning: '#ed6c02',
    success: '#2e7d32'
  },
  // ... rest of theme
} as ThemeOptions);
```

### 8. Utility Libraries

#### Date Handling: Keep date-fns

Already using date-fns which has excellent TypeScript support.

#### Lodash → Native + Radash

**Why Migrate:**
- Lodash has poor tree shaking
- Radash is modern, fully typed alternative
- Use native methods where possible

**Migration Examples:**
```typescript
// Before (Lodash)
import { debounce, groupBy, pick } from 'lodash';

// After (Radash + Native)
import { debounce, group, pick } from 'radash';

// Or use native alternatives
const grouped = Object.groupBy(items, item => item.category);
const picked = { id: obj.id, name: obj.name };
```

### 9. New Essential Libraries

#### Type Validation: Zod

```typescript
// Runtime validation with type inference
const ConfigSchema = z.object({
  apiUrl: z.string().url(),
  timeout: z.number().positive(),
  features: z.object({
    analytics: z.boolean(),
    telemetry: z.boolean()
  })
});

type Config = z.infer<typeof ConfigSchema>;

// Validate unknown data
const config = ConfigSchema.parse(unknownData);
```

#### Error Boundaries: react-error-boundary

```typescript
import { ErrorBoundary } from 'react-error-boundary';

function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  return (
    <Alert severity="error">
      <AlertTitle>Something went wrong</AlertTitle>
      <pre>{error.message}</pre>
      <Button onClick={resetErrorBoundary}>Try again</Button>
    </Alert>
  );
}

<ErrorBoundary
  FallbackComponent={ErrorFallback}
  onReset={() => window.location.reload()}
>
  <ClinicalWorkspace />
</ErrorBoundary>
```

### 10. Development Tools

#### Type Checking & Linting

```json
{
  "@typescript-eslint/eslint-plugin": "^6.x",
  "@typescript-eslint/parser": "^6.x",
  "eslint-plugin-react-hooks": "^4.x",
  "eslint-plugin-jsx-a11y": "^6.x",
  "prettier": "^3.x",
  "husky": "^8.x",
  "lint-staged": "^15.x"
}
```

**ESLint Config:**
```javascript
// .eslintrc.js
module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier'
  ],
  rules: {
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    'react/react-in-jsx-scope': 'off'
  }
};
```

## Migration Priority

### Phase 1: Core Infrastructure
1. Vite build setup
2. TypeScript configuration
3. ESLint & Prettier setup
4. Test infrastructure (Vitest)

### Phase 2: State & Data
1. Zustand stores
2. React Query setup
3. Zod schemas
4. API client typing

### Phase 3: UI & Forms
1. React Hook Form
2. Material-UI theme typing
3. Component library setup

### Phase 4: Optimization
1. Bundle analysis
2. Code splitting
3. Performance monitoring

## Bundle Size Comparison

| Library | Before | After | Savings |
|---------|--------|-------|---------|
| Build Tool | CRA (~200KB overhead) | Vite (~50KB) | 150KB |
| State | Context + Redux | Zustand | ~30KB |
| Forms | Formik | React Hook Form | ~20KB |
| Validation | Custom | Zod | +8KB |
| Utilities | Lodash | Radash + Native | ~40KB |
| **Total** | ~850KB | ~600KB | **~250KB (29%)** |

## Security Considerations

### HIPAA Compliance
- Ensure all libraries handle PHI appropriately
- Verify no telemetry is sent from libraries
- Review library dependencies for vulnerabilities

### Dependency Audit
```bash
# Regular security audits
npm audit
npm audit fix

# Check for outdated packages
npm outdated

# Use lockfile for reproducible installs
npm ci
```

## Conclusion

This library migration plan modernizes the WintEHR tech stack while maintaining stability. The focus on TypeScript-first libraries, reduced bundle size, and improved developer experience will result in a more maintainable and performant application.

---

**Remember**: All library updates should be tested thoroughly on the `feature/typescript-migration` branch before merging.