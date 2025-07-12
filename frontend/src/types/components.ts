/**
 * React component and UI-specific type definitions
 */

import React from 'react';
import { 
  Patient, 
  Resource, 
  FHIRResourceType,
  LoadingState,
  ClinicalTabType,
  CDSAlert,
  Notification 
} from './';

/**
 * Common component props
 */
export interface BaseComponentProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/**
 * Patient-related component props
 */
export interface PatientProps {
  patient: Patient;
  loading?: boolean;
  error?: Error | null;
}

export interface PatientSelectorProps extends BaseComponentProps {
  selectedPatient?: Patient | null;
  onPatientSelect: (patient: Patient) => void;
  onPatientClear?: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export interface PatientHeaderProps extends PatientProps {
  showDetails?: boolean;
  actions?: React.ReactNode;
}

/**
 * Resource list and table props
 */
export interface ResourceListProps<T extends Resource = Resource> extends BaseComponentProps {
  resources: T[];
  loading?: boolean;
  error?: Error | null;
  onResourceSelect?: (resource: T) => void;
  onResourceEdit?: (resource: T) => void;
  onResourceDelete?: (resource: T) => void;
  selectedResourceId?: string;
  emptyMessage?: string;
  loadingMessage?: string;
}

export interface ResourceTableProps<T extends Resource = Resource> extends ResourceListProps<T> {
  columns: TableColumn<T>[];
  sortable?: boolean;
  filterable?: boolean;
  paginated?: boolean;
  pageSize?: number;
  onSort?: (field: keyof T, direction: 'asc' | 'desc') => void;
  onFilter?: (filters: Record<string, any>) => void;
}

export interface TableColumn<T = any> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  width?: number | string;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: T, index: number) => React.ReactNode;
  format?: (value: any) => string;
}

/**
 * Form and dialog props
 */
export interface FormProps<T = any> extends BaseComponentProps {
  data?: T;
  onSubmit: (data: T) => void | Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
  error?: Error | null;
  disabled?: boolean;
  mode?: 'create' | 'edit' | 'view';
}

export interface DialogProps extends BaseComponentProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  maxWidth?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  fullWidth?: boolean;
  fullScreen?: boolean;
  disableEscapeKeyDown?: boolean;
  disableBackdropClick?: boolean;
}

export interface ConfirmDialogProps extends DialogProps {
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  severity?: 'info' | 'warning' | 'error';
}

/**
 * Clinical workspace component props
 */
export interface ClinicalWorkspaceProps extends BaseComponentProps {
  patient: Patient;
  activeTab?: ClinicalTabType;
  onTabChange?: (tab: ClinicalTabType) => void;
  tabs?: ClinicalTabType[];
}

export interface ClinicalTabProps extends BaseComponentProps {
  patient: Patient;
  active?: boolean;
  onActivate?: () => void;
}

/**
 * Chart Review specific props
 */
export interface ChartReviewTabProps extends ClinicalTabProps {
  showSummary?: boolean;
  expandedSections?: string[];
  onSectionToggle?: (section: string) => void;
}

export interface ProblemListProps extends BaseComponentProps {
  patient: Patient;
  editable?: boolean;
  onProblemAdd?: () => void;
  onProblemEdit?: (conditionId: string) => void;
  onProblemDelete?: (conditionId: string) => void;
}

export interface MedicationListProps extends BaseComponentProps {
  patient: Patient;
  showDiscontinued?: boolean;
  editable?: boolean;
  onMedicationAdd?: () => void;
  onMedicationEdit?: (medicationId: string) => void;
  onMedicationDiscontinue?: (medicationId: string) => void;
}

/**
 * Results and lab component props
 */
export interface ResultsTabProps extends ClinicalTabProps {
  showTrends?: boolean;
  groupByCategory?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface LabResultsTableProps extends BaseComponentProps {
  patient: Patient;
  observations: any[]; // Will be typed as Observation[] after migration
  onResultClick?: (observationId: string) => void;
  showReferenceRanges?: boolean;
  highlightAbnormal?: boolean;
}

export interface TrendChartProps extends BaseComponentProps {
  data: any[]; // Will be properly typed after migration
  xField: string;
  yField: string;
  title?: string;
  height?: number;
  showLegend?: boolean;
}

/**
 * Orders and CPOE props
 */
export interface OrdersTabProps extends ClinicalTabProps {
  showHistory?: boolean;
  filterByStatus?: string[];
}

export interface OrderEntryProps extends BaseComponentProps {
  patient: Patient;
  orderType: 'lab' | 'imaging' | 'medication' | 'referral';
  onOrderSubmit: (order: any) => void | Promise<void>;
  onCancel?: () => void;
}

/**
 * Pharmacy component props
 */
export interface PharmacyTabProps extends ClinicalTabProps {
  showQueue?: boolean;
  showDispensed?: boolean;
}

export interface MedicationDispenseProps extends BaseComponentProps {
  medicationRequest: any; // Will be typed as MedicationRequest after migration
  onDispense: (dispenseData: any) => void | Promise<void>;
  onCancel?: () => void;
}

/**
 * Search and filter component props
 */
export interface SearchBarProps extends BaseComponentProps {
  value?: string;
  onChange: (value: string) => void;
  onSearch?: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  loading?: boolean;
  suggestions?: string[];
  onSuggestionSelect?: (suggestion: string) => void;
}

export interface FilterPanelProps extends BaseComponentProps {
  filters: FilterConfig[];
  values: Record<string, any>;
  onChange: (filters: Record<string, any>) => void;
  onClear?: () => void;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

export interface FilterConfig {
  key: string;
  label: string;
  type: 'text' | 'select' | 'multiselect' | 'date' | 'daterange' | 'boolean';
  options?: { value: any; label: string }[];
  placeholder?: string;
  validation?: (value: any) => string | null;
}

/**
 * Notification and alert component props
 */
export interface NotificationProps extends BaseComponentProps {
  notification: Notification;
  onClose?: () => void;
  onAction?: (actionIndex: number) => void;
}

export interface NotificationListProps extends BaseComponentProps {
  notifications: Notification[];
  onClose?: (notificationId: string) => void;
  onClearAll?: () => void;
  maxHeight?: number;
}

export interface CDSAlertProps extends BaseComponentProps {
  alert: CDSAlert;
  onDismiss?: () => void;
  onAction?: (actionId: string) => void;
  compact?: boolean;
}

export interface CDSAlertListProps extends BaseComponentProps {
  alerts: CDSAlert[];
  onDismiss?: (alertId: string) => void;
  onDismissAll?: () => void;
  maxAlerts?: number;
}

/**
 * Loading and error component props
 */
export interface LoadingProps extends BaseComponentProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
  overlay?: boolean;
}

export interface ErrorBoundaryProps extends BaseComponentProps {
  fallback?: React.ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

export interface ErrorDisplayProps extends BaseComponentProps {
  error: Error;
  onRetry?: () => void;
  showDetails?: boolean;
  title?: string;
}

/**
 * Navigation and layout props
 */
export interface LayoutProps extends BaseComponentProps {
  header?: React.ReactNode;
  sidebar?: React.ReactNode;
  footer?: React.ReactNode;
  loading?: boolean;
}

export interface SidebarProps extends BaseComponentProps {
  items: SidebarItem[];
  activeItem?: string;
  onItemClick?: (itemId: string) => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export interface SidebarItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  path?: string;
  children?: SidebarItem[];
  badge?: string | number;
  disabled?: boolean;
}

export interface BreadcrumbProps extends BaseComponentProps {
  items: BreadcrumbItem[];
  onItemClick?: (itemId: string) => void;
}

export interface BreadcrumbItem {
  id: string;
  label: string;
  path?: string;
  current?: boolean;
}

/**
 * Data visualization props
 */
export interface ChartProps extends BaseComponentProps {
  data: any[];
  width?: number;
  height?: number;
  responsive?: boolean;
  title?: string;
  legend?: boolean;
  tooltip?: boolean;
}

export interface LineChartProps extends ChartProps {
  xField: string;
  yField: string;
  seriesField?: string;
  smooth?: boolean;
  area?: boolean;
}

export interface BarChartProps extends ChartProps {
  xField: string;
  yField: string;
  seriesField?: string;
  stacked?: boolean;
  horizontal?: boolean;
}

export interface PieChartProps extends ChartProps {
  angleField: string;
  colorField: string;
  innerRadius?: number;
  showLabels?: boolean;
}

/**
 * Utility component props
 */
export interface CopyToClipboardProps extends BaseComponentProps {
  text: string;
  onCopy?: () => void;
  tooltip?: string;
}

export interface DatePickerProps extends BaseComponentProps {
  value?: Date | null;
  onChange: (date: Date | null) => void;
  label?: string;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  required?: boolean;
  error?: string;
}

export interface TimePickerProps extends BaseComponentProps {
  value?: Date | null;
  onChange: (time: Date | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  format?: '12h' | '24h';
}

/**
 * Hook return types
 */
export interface UseAsyncReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  execute: (...args: any[]) => Promise<T>;
  reset: () => void;
}

export interface UsePaginationReturn {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  reset: () => void;
}

export interface UseSearchReturn<T> {
  query: string;
  results: T[];
  loading: boolean;
  error: Error | null;
  setQuery: (query: string) => void;
  search: (query: string) => Promise<void>;
  clear: () => void;
}