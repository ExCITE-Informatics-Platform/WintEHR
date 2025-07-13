/**
 * Results Tab Component
 * Display lab results and diagnostic test results
 * 
 * Migrated to TypeScript with comprehensive type safety for lab result management.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Chip,
  Stack,
  Button,
  IconButton,
  Tooltip,
  Divider,
  Card,
  CardContent,
  CardActions,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  FormControl,
  Select,
  InputLabel,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Tabs,
  Tab,
  Badge,
  LinearProgress,
  ToggleButton,
  ToggleButtonGroup,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  alpha,
  Checkbox,
  FormControlLabel,
  Snackbar,
  SxProps,
  Theme,
  SelectChangeEvent,
  AlertColor,
} from '@mui/material';
import {
  Science as LabIcon,
  Assessment as DiagnosticIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Warning as AbnormalIcon,
  CheckCircle as NormalIcon,
  Schedule as PendingIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  GetApp as DownloadIcon,
  Visibility as ViewIcon,
  Print as PrintIcon,
  CalendarMonth as DateIcon,
  AccessTime as TimeIcon,
  ArrowUpward as HighIcon,
  ArrowDownward as LowIcon,
  Remove as NormalRangeIcon,
  Assessment as AssessmentIcon,
  Close as CloseIcon,
  CheckCircle
} from '@mui/icons-material';
import { format, parseISO, isWithinInterval, subDays, subMonths, formatDistanceToNow } from 'date-fns';
import { Observation, DiagnosticReport, Patient } from '@ahryman40k/ts-fhir-types/lib/R4';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useNavigate } from 'react-router-dom';
import VitalsOverview from '../../charts/VitalsOverview';
import LabTrendsChart from '../../charts/LabTrendsChart';
import { printDocument, formatLabResultsForPrint } from '../../../../utils/printUtils';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';

/**
 * Type definitions for ResultsTab component
 */
export type ViewMode = 'table' | 'cards' | 'trends';
export type FilterPeriod = 'all' | '7d' | '30d' | '3m' | '6m' | '1y';
export type FilterStatus = 'all' | 'normal' | 'abnormal';
export type ObservationStatus = 'registered' | 'preliminary' | 'final' | 'amended' | 'cancelled' | 'entered-in-error' | 'unknown';
export type InterpretationCode = 'H' | 'HH' | 'L' | 'LL' | 'A' | 'AA' | 'N' | 'B' | 'R' | 'S' | 'I';

export interface ReferenceRange {
  low?: {
    value?: number;
    unit?: string;
  };
  high?: {
    value?: number;
    unit?: string;
  };
  unit?: string;
  text?: string;
}

export interface ResultStatus {
  icon: React.ReactElement;
  color: 'primary' | 'success' | 'error' | 'warning' | 'default';
  label: string;
}

export interface ObservationComponent {
  code?: {
    text?: string;
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  };
  valueQuantity?: {
    value?: number;
    unit?: string;
  };
  valueString?: string;
  referenceRange?: Array<{
    low?: { value?: number; unit?: string; };
    high?: { value?: number; unit?: string; };
    text?: string;
  }>;
}

export interface EnhancedObservation extends Observation {
  referenceRange?: Array<{
    low?: { value?: number; unit?: string; };
    high?: { value?: number; unit?: string; };
    text?: string;
  }>;
  component?: ObservationComponent[];
}

export interface ResultRowProps {
  observation: EnhancedObservation;
  onClick: () => void;
  selected: boolean;
  onSelectResult: (resultId: string) => void;
  isSelected: boolean;
}

export interface ResultCardProps {
  observation: EnhancedObservation;
  onClick: () => void;
}

export interface ResultsTabProps {
  patientId: string;
  onNotificationUpdate?: (notification: NotificationMessage) => void;
  sx?: SxProps<Theme>;
}

export interface NotificationMessage {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

export interface SnackbarState {
  open: boolean;
  message: string;
  severity: AlertColor;
}

export interface CategorizedObservations {
  labResults: EnhancedObservation[];
  vitalSigns: EnhancedObservation[];
  otherResults: EnhancedObservation[];
}

export interface PatientInfo {
  name: string;
  mrn: string;
  birthDate?: string;
  gender?: string;
  phone?: string;
}

export interface CriticalAlert {
  type: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  data: any;
  actions: Array<{
    label: string;
    action: string;
    target: string;
  }>;
}

/**
 * Reference ranges for common lab tests (based on LOINC codes)
 */
const REFERENCE_RANGES: Record<string, ReferenceRange> = {
  '2339-0': { low: 70, high: 100, unit: 'mg/dL' },     // Glucose
  '38483-4': { low: 0.6, high: 1.2, unit: 'mg/dL' },  // Creatinine
  '2947-0': { low: 136, high: 145, unit: 'mmol/L' },   // Sodium
  '6298-4': { low: 3.5, high: 5.0, unit: 'mmol/L' },  // Potassium
  '2069-3': { low: 98, high: 107, unit: 'mmol/L' },    // Chloride
  '20565-8': { low: 22, high: 29, unit: 'mmol/L' },    // CO2
  '4548-4': { low: 4.0, high: 5.6, unit: '%' },        // Hemoglobin A1c
  '49765-1': { low: 8.5, high: 10.5, unit: 'mg/dL' },  // Calcium
  '6299-2': { low: 7, high: 20, unit: 'mg/dL' }        // Urea Nitrogen
};

/**
 * Helper functions
 */
const enhanceObservationWithReferenceRange = (observation: Observation): EnhancedObservation => {
  if (observation.referenceRange && observation.referenceRange.length > 0) {
    return observation as EnhancedObservation; // Already has reference range
  }
  
  const loincCode = observation.code?.coding?.[0]?.code;
  const refRange = loincCode ? REFERENCE_RANGES[loincCode] : undefined;
  
  if (refRange) {
    return {
      ...observation,
      referenceRange: [{
        low: { value: refRange.low, unit: refRange.unit },
        high: { value: refRange.high, unit: refRange.unit },
        text: `${refRange.low}-${refRange.high} ${refRange.unit}`
      }]
    } as EnhancedObservation;
  }
  
  return observation as EnhancedObservation;
};

const getResultStatus = (observation: EnhancedObservation): ResultStatus => {
  if (!observation.status) return { icon: <PendingIcon />, color: 'default', label: 'Pending' };
  
  switch (observation.status) {
    case 'final':
      // First check for explicit interpretation
      const interpretation = observation.interpretation?.[0]?.coding?.[0]?.code as InterpretationCode | undefined;
      if (interpretation === 'H' || interpretation === 'HH') {
        return { icon: <HighIcon />, color: 'error', label: 'High' };
      } else if (interpretation === 'L' || interpretation === 'LL') {
        return { icon: <LowIcon />, color: 'error', label: 'Low' };
      } else if (interpretation === 'A' || interpretation === 'AA') {
        return { icon: <AbnormalIcon />, color: 'warning', label: 'Abnormal' };
      } else if (interpretation === 'N') {
        return { icon: <NormalIcon />, color: 'success', label: 'Normal' };
      }
      
      // If no interpretation, calculate based on reference range
      if (observation.valueQuantity?.value && observation.referenceRange?.[0]) {
        const value = observation.valueQuantity.value;
        const range = observation.referenceRange[0];
        
        if (range.low?.value && value < range.low.value) {
          return { icon: <LowIcon />, color: 'error', label: 'Low' };
        } else if (range.high?.value && value > range.high.value) {
          return { icon: <HighIcon />, color: 'error', label: 'High' };
        } else if (range.low?.value && range.high?.value) {
          return { icon: <NormalIcon />, color: 'success', label: 'Normal' };
        }
      }
      
      // Only show "Normal" if we can't determine the status
      return { icon: <NormalRangeIcon />, color: 'default', label: '' };
    case 'preliminary':
      return { icon: <PendingIcon />, color: 'warning', label: 'Preliminary' };
    case 'entered-in-error':
      return { icon: <AbnormalIcon />, color: 'error', label: 'Error' };
    default:
      return { icon: <PendingIcon />, color: 'default', label: observation.status };
  }
};

const safeParseISO = (dateString: string | undefined): Date | null => {
  if (!dateString) return null;
  try {
    return parseISO(dateString);
  } catch {
    return null;
  }
};

const formatQuantityValue = (valueQuantity?: { value?: number; unit?: string }): string => {
  if (!valueQuantity?.value) return '';
  return `${valueQuantity.value} ${valueQuantity.unit || ''}`;
};

const extractPatientInfo = (patient: Patient | null): PatientInfo => {
  if (!patient) {
    return {
      name: 'Unknown Patient',
      mrn: 'Unknown',
    };
  }

  const name = patient.name?.[0] ? 
    `${patient.name[0].given?.join(' ') || ''} ${patient.name[0].family || ''}`.trim() : 
    'Unknown Patient';
  
  const mrn = patient.identifier?.find(id => id.type?.coding?.[0]?.code === 'MR')?.value || patient.id || 'Unknown';
  
  return {
    name,
    mrn,
    birthDate: patient.birthDate,
    gender: patient.gender,
    phone: patient.telecom?.find(t => t.system === 'phone')?.value
  };
};

/**
 * Result Row Component for Table View
 */
const ResultRow: React.FC<ResultRowProps> = ({ 
  observation, 
  onClick, 
  selected, 
  onSelectResult, 
  isSelected 
}) => {
  const theme = useTheme();
  const status = getResultStatus(observation);
  const date = observation.effectiveDateTime || observation.issued;
  
  const getValue = useCallback((): string => {
    // Handle blood pressure with components
    if (observation.component && observation.component.length > 0) {
      const systolic = observation.component.find(c => 
        c.code?.coding?.some(coding => 
          coding.code === '8480-6' || coding.display?.toLowerCase().includes('systolic')
        )
      );
      const diastolic = observation.component.find(c => 
        c.code?.coding?.some(coding => 
          coding.code === '8462-4' || coding.display?.toLowerCase().includes('diastolic')
        )
      );
      
      if (systolic?.valueQuantity?.value && diastolic?.valueQuantity?.value) {
        return `${systolic.valueQuantity.value}/${diastolic.valueQuantity.value} ${systolic.valueQuantity.unit || 'mmHg'}`;
      }
    }
    
    // Handle regular values
    if (observation.valueQuantity) {
      return formatQuantityValue(observation.valueQuantity);
    } else if (observation.valueString) {
      return observation.valueString;
    } else if (observation.valueCodeableConcept) {
      return observation.valueCodeableConcept.text || 
             observation.valueCodeableConcept.coding?.[0]?.display || '';
    }
    return 'Result pending';
  }, [observation]);

  const getReference = useCallback((): string => {
    if (observation.referenceRange?.[0]) {
      const range = observation.referenceRange[0];
      if (range.low && range.high) {
        return `${range.low.value}-${range.high.value} ${range.low.unit || ''}`;
      } else if (range.text) {
        return range.text;
      }
    }
    return '';
  }, [observation.referenceRange]);

  const handleCheckboxClick = useCallback((event: React.MouseEvent): void => {
    event.stopPropagation();
    onSelectResult(observation.id || '');
  }, [onSelectResult, observation.id]);

  return (
    <TableRow 
      hover 
      onClick={onClick}
      selected={selected}
      sx={{ cursor: 'pointer' }}
    >
      <TableCell padding="checkbox">
        <Checkbox
          checked={isSelected || false}
          onClick={handleCheckboxClick}
          inputProps={{ 'aria-label': `Select ${observation.code?.text || 'result'}` }}
        />
      </TableCell>
      <TableCell>
        <Stack direction="row" spacing={1} alignItems="center">
          {status.icon}
          <Typography variant="body2">
            {observation.code?.text || observation.code?.coding?.[0]?.display || 'Unknown test'}
          </Typography>
        </Stack>
      </TableCell>
      <TableCell>
        <Typography variant="body2" fontWeight={status.label !== 'Normal' ? 'bold' : 'normal'}>
          {getValue()}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="caption" color="text.secondary">
          {getReference()}
        </Typography>
      </TableCell>
      <TableCell>
        {status.label && (
          <Chip 
            label={status.label} 
            size="small" 
            color={status.color}
            sx={{ fontWeight: 'bold' }}
          />
        )}
      </TableCell>
      <TableCell>
        <Typography variant="caption">
          {date ? format(parseISO(date), 'MMM d, yyyy h:mm a') : 'No date'}
        </Typography>
      </TableCell>
    </TableRow>
  );
};

/**
 * Result Card Component
 */
const ResultCard: React.FC<ResultCardProps> = ({ observation, onClick }) => {
  const theme = useTheme();
  const status = getResultStatus(observation);
  const date = observation.effectiveDateTime || observation.issued;
  
  const getValue = useCallback((): string => {
    if (observation.valueQuantity) {
      return formatQuantityValue(observation.valueQuantity);
    } else if (observation.valueString) {
      return observation.valueString;
    }
    return 'Pending';
  }, [observation]);

  const getReference = useCallback((): string => {
    if (observation.referenceRange?.[0]) {
      const range = observation.referenceRange[0];
      if (range.low?.value && range.high?.value) {
        return `${range.low.value}-${range.high.value} ${range.low.unit || ''}`;
      }
    }
    return '';
  }, [observation.referenceRange]);
  
  return (
    <Card 
      sx={{ 
        mb: 2,
        cursor: 'pointer',
        '&:hover': { boxShadow: 3 }
      }}
      onClick={onClick}
    >
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" mb={1}>
              {status.icon}
              <Typography variant="h6">
                {observation.code?.text || observation.code?.coding?.[0]?.display || 'Unknown test'}
              </Typography>
              {status.label && (
                <Chip 
                  label={status.label} 
                  size="small" 
                  color={status.color}
                />
              )}
            </Stack>
            
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary">Result</Typography>
                <Typography variant="body1" fontWeight="bold">
                  {getValue()}
                </Typography>
              </Grid>
              
              {observation.referenceRange?.[0] && (
                <Grid item xs={12} sm={4}>
                  <Typography variant="caption" color="text.secondary">Reference Range</Typography>
                  <Typography variant="body2">
                    {getReference()}
                  </Typography>
                </Grid>
              )}
              
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary">Date</Typography>
                <Typography variant="body2">
                  {date ? format(parseISO(date), 'MMM d, yyyy') : 'No date'}
                </Typography>
              </Grid>
            </Grid>
            
            {observation.note?.[0] && (
              <Box mt={2}>
                <Typography variant="caption" color="text.secondary">Note</Typography>
                <Typography variant="body2">{observation.note[0].text}</Typography>
              </Box>
            )}
          </Box>
        </Stack>
      </CardContent>
      
      <CardActions>
        <Button 
          size="small" 
          startIcon={<ViewIcon />} 
          onClick={(e) => { 
            e.stopPropagation(); 
            onClick(); 
          }}
        >
          View Details
        </Button>
      </CardActions>
    </Card>
  );
};

/**
 * Main ResultsTab Component
 */
const ResultsTab: React.FC<ResultsTabProps> = ({ patientId, onNotificationUpdate, sx }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { getPatientResources, isLoading, currentPatient } = useFHIRResource();
  const { publish, createCriticalAlert } = useClinicalWorkflow();
  
  const [tabValue, setTabValue] = useState<number>(0);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedResult, setSelectedResult] = useState<EnhancedObservation | DiagnosticReport | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState<boolean>(false);
  const [alertedResults, setAlertedResults] = useState<Set<string>>(new Set());
  const [selectedResultIds, setSelectedResultIds] = useState<Set<string>>(new Set());
  const [acknowledgingResults, setAcknowledgingResults] = useState<boolean>(false);
  const [snackbar, setSnackbar] = useState<SnackbarState>({ open: false, message: '', severity: 'success' });

  // Get observations and diagnostic reports early for monitoring
  const observations = useMemo(() => 
    (getPatientResources(patientId, 'Observation') as Observation[] || []),
  [getPatientResources, patientId]);
  
  const diagnosticReports = useMemo(() => 
    (getPatientResources(patientId, 'DiagnosticReport') as DiagnosticReport[] || []),
  [getPatientResources, patientId]);

  useEffect(() => {
    setLoading(false);
  }, []);

  // Monitor for new abnormal results
  useEffect(() => {
    if (observations && observations.length > 0) {
      // Check for recent abnormal results (within last 24 hours)
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      
      const recentAbnormalResults = observations.filter(obs => {
        // Skip if already alerted
        if (alertedResults.has(obs.id || '')) return false;
        
        // Check if observation is recent
        const obsDate = obs.effectiveDateTime ? new Date(obs.effectiveDateTime) : null;
        if (!obsDate || obsDate < oneDayAgo) return false;
        
        // Check if observation is abnormal
        const enhancedObs = enhanceObservationWithReferenceRange(obs);
        const status = getResultStatus(enhancedObs);
        return status.color === 'error' || status.color === 'warning';
      });
      
      // Publish critical alerts for abnormal results
      if (recentAbnormalResults.length > 0) {
        const newAlertedResults = new Set(alertedResults);
        
        recentAbnormalResults.forEach(async (result) => {
          const enhancedResult = enhanceObservationWithReferenceRange(result);
          const status = getResultStatus(enhancedResult);
          const testName = result.code?.text || result.code?.coding?.[0]?.display || 'Unknown test';
          const value = result.valueQuantity ? 
            formatQuantityValue(result.valueQuantity) : 
            'N/A';
          
          try {
            await createCriticalAlert({
              type: 'abnormal_result',
              severity: status.color === 'error' ? 'high' : 'medium',
              message: `Abnormal ${testName}: ${value} (${status.label})`,
              data: result,
              actions: [
                { label: 'Review Result', action: 'view', target: result.id || '' },
                { label: 'Add to Note', action: 'document', target: 'documentation' }
              ]
            });
            
            // Also publish RESULT_RECEIVED event
            await publish(CLINICAL_EVENTS.RESULT_RECEIVED, {
              ...result,
              isAbnormal: true,
              status: status.label,
              patientId,
              timestamp: new Date().toISOString()
            });
            
            // Mark as alerted
            if (result.id) {
              newAlertedResults.add(result.id);
            }
          } catch (error) {
            console.error('Error creating critical alert:', error);
          }
        });
        
        // Update alerted results state
        setAlertedResults(newAlertedResults);
      }
    }
  }, [observations, patientId, createCriticalAlert, publish, alertedResults]);

  const handleViewDetails = useCallback((result: EnhancedObservation | DiagnosticReport): void => {
    setSelectedResult(result);
    setDetailsDialogOpen(true);
  }, []);

  const handleBatchAcknowledge = useCallback(async (): Promise<void> => {
    setAcknowledgingResults(true);
    try {
      // Create acknowledgment notes for each selected result
      const promises = Array.from(selectedResultIds).map(async (resultId) => {
        const result = observations.find(o => o.id === resultId) || 
                      diagnosticReports.find(d => d.id === resultId);
        
        if (result) {
          // Create a note indicating the result has been reviewed
          const note = {
            resourceType: 'DocumentReference',
            status: 'current',
            type: {
              coding: [{
                system: 'http://loinc.org',
                code: '11506-3',
                display: 'Progress note'
              }],
              text: 'Result Acknowledgment'
            },
            subject: {
              reference: `Patient/${patientId}`
            },
            date: new Date().toISOString(),
            author: [{
              display: 'Current User' // In real app, would use auth context
            }],
            content: [{
              attachment: {
                contentType: 'text/plain',
                data: btoa(`Result acknowledged: ${result.code?.text || result.code?.coding?.[0]?.display || 'Unknown test'} - ${(result as Observation).valueQuantity ? formatQuantityValue((result as Observation).valueQuantity) : 'See report'}`)
              }
            }],
            context: {
              related: [{
                reference: `${result.resourceType}/${result.id}`
              }]
            }
          };
          
          const response = await fetch('/fhir/R4/DocumentReference', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(note)
          });
          
          if (!response.ok) {
            throw new Error(`Failed to acknowledge result ${result.id}`);
          }
          
          // Publish acknowledgment event
          await publish(CLINICAL_EVENTS.RESULT_ACKNOWLEDGED, {
            resultId: result.id,
            testName: result.code?.text || result.code?.coding?.[0]?.display || 'Unknown test',
            acknowledgedBy: 'Current User',
            timestamp: new Date().toISOString(),
            patientId
          });
        }
      });
      
      await Promise.all(promises);
      
      setSnackbar({
        open: true,
        message: `Successfully acknowledged ${selectedResultIds.size} result(s)`,
        severity: 'success'
      });
      
      // Clear selection
      setSelectedResultIds(new Set());
      
    } catch (error) {
      console.error('Error acknowledging results:', error);
      setSnackbar({
        open: true,
        message: 'Failed to acknowledge some results',
        severity: 'error'
      });
    } finally {
      setAcknowledgingResults(false);
    }
  }, [selectedResultIds, observations, diagnosticReports, patientId, publish]);

  const handleSelectResult = useCallback((resultId: string): void => {
    const newSelected = new Set(selectedResultIds);
    if (newSelected.has(resultId)) {
      newSelected.delete(resultId);
    } else {
      newSelected.add(resultId);
    }
    setSelectedResultIds(newSelected);
  }, [selectedResultIds]);

  const handleSelectAll = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
    if (event.target.checked) {
      const newSelected = new Set(sortedResults.map(r => r.id || '').filter(Boolean));
      setSelectedResultIds(newSelected);
    } else {
      setSelectedResultIds(new Set());
    }
  }, []);

  const handlePrintResults = useCallback((): void => {
    let resultsToprint: (EnhancedObservation | DiagnosticReport)[] = [];
    let title = '';
    
    switch (tabValue) {
      case 0: // Lab Results
        resultsToprint = sortedResults;
        title = 'Laboratory Results';
        break;
      case 1: // Vital Signs
        resultsToprint = sortedResults;
        title = 'Vital Signs';
        break;
      case 2: // Diagnostic Reports
        resultsToprint = sortedResults;
        title = 'Diagnostic Reports';
        break;
      default:
        resultsToprint = [];
    }
    
    const patientInfo = extractPatientInfo(currentPatient as Patient);
    const content = formatLabResultsForPrint(resultsToprint);
    
    printDocument({
      title,
      patient: patientInfo,
      content
    });
  }, [tabValue, sortedResults, currentPatient]);

  // Memoized categorization to prevent recalculation on every render
  const categorizedObservations: CategorizedObservations = useMemo(() => {
    const labResults: EnhancedObservation[] = [];
    const vitalSigns: EnhancedObservation[] = [];
    const otherResults: EnhancedObservation[] = [];
    
    observations.forEach(o => {
      const enhancedObs = enhanceObservationWithReferenceRange(o);
      const category = enhancedObs.category?.[0]?.coding?.[0]?.code;
      if (category === 'laboratory') {
        labResults.push(enhancedObs);
      } else if (category === 'vital-signs') {
        vitalSigns.push(enhancedObs);
      } else {
        otherResults.push(enhancedObs);
      }
    });
    
    return { labResults, vitalSigns, otherResults };
  }, [observations]);
  
  const { labResults, vitalSigns, otherResults } = categorizedObservations;

  // Memoized filter function to prevent recalculation
  const filterResults = useCallback((results: EnhancedObservation[]): EnhancedObservation[] => {
    return results.filter(result => {
      // Period filter
      if (filterPeriod !== 'all') {
        const date = result.effectiveDateTime || result.issued;
        if (date) {
          const resultDate = safeParseISO(date);
          if (resultDate) {
            const periodMap = {
              '7d': subDays(new Date(), 7),
              '30d': subDays(new Date(), 30),
              '3m': subMonths(new Date(), 3),
              '6m': subMonths(new Date(), 6),
              '1y': subMonths(new Date(), 12)
            };
            if (!isWithinInterval(resultDate, {
              start: periodMap[filterPeriod],
              end: new Date()
            })) {
              return false;
            }
          }
        }
      }

      // Status filter
      if (filterStatus !== 'all') {
        const status = getResultStatus(result);
        if (filterStatus === 'abnormal' && status.label === 'Normal') return false;
        if (filterStatus === 'normal' && status.label !== 'Normal') return false;
      }

      // Search filter
      if (searchTerm) {
        const testName = result.code?.text || result.code?.coding?.[0]?.display || '';
        if (!testName.toLowerCase().includes(searchTerm.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }, [filterPeriod, filterStatus, searchTerm]);

  // Memoized result filtering and sorting
  const { filteredResults, sortedResults } = useMemo(() => {
    let currentResults: (EnhancedObservation | DiagnosticReport)[];
    switch (tabValue) {
      case 0: 
        currentResults = filterResults(labResults);
        break;
      case 1:
      case 2: 
        currentResults = filterResults(vitalSigns);
        break;
      case 3: 
        currentResults = diagnosticReports;
        break;
      default: 
        currentResults = [];
    }
    
    const sorted = [...currentResults].sort((a, b) => {
      const dateA = new Date(a.effectiveDateTime || a.issued || 0);
      const dateB = new Date(b.effectiveDateTime || b.issued || 0);
      return dateB.getTime() - dateA.getTime();
    });
    
    return { 
      filteredResults: currentResults, 
      sortedResults: sorted 
    };
  }, [tabValue, labResults, vitalSigns, diagnosticReports, filterResults]);

  // Memoized abnormal count calculation
  const abnormalCount = useMemo(() => {
    return labResults.filter(r => {
      const status = getResultStatus(r);
      return status.label && status.label !== 'Normal';
    }).length;
  }, [labResults]);

  const handleTabChange = useCallback((event: React.SyntheticEvent, newValue: number): void => {
    setTabValue(newValue);
  }, []);

  const handleViewModeChange = useCallback((event: React.MouseEvent<HTMLElement>, newMode: ViewMode | null): void => {
    if (newMode) {
      setViewMode(newMode);
    }
  }, []);

  const handleFilterPeriodChange = useCallback((event: SelectChangeEvent<string>): void => {
    setFilterPeriod(event.target.value as FilterPeriod);
  }, []);

  const handleFilterStatusChange = useCallback((event: SelectChangeEvent<string>): void => {
    setFilterStatus(event.target.value as FilterStatus);
  }, []);

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
    setSearchTerm(event.target.value);
  }, []);

  const handlePageChange = useCallback((event: unknown, newPage: number): void => {
    setPage(newPage);
  }, []);

  const handleRowsPerPageChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }, []);

  const handleSnackbarClose = useCallback((): void => {
    setSnackbar(prev => ({ ...prev, open: false }));
  }, []);

  const handleCloseDetailsDialog = useCallback((): void => {
    setDetailsDialogOpen(false);
    setSelectedResult(null);
  }, []);

  const renderDetailedResult = useCallback((result: EnhancedObservation | DiagnosticReport): React.ReactNode => {
    const isObservation = result.resourceType === 'Observation';
    const observation = isObservation ? result as EnhancedObservation : null;
    const status = isObservation ? getResultStatus(observation!) : null;

    return (
      <Stack spacing={3}>
        {/* Test Information */}
        <Box>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>Test Name</Typography>
          <Typography variant="h6">
            {result.code?.text || result.code?.coding?.[0]?.display || 'Unknown test'}
          </Typography>
          {result.code?.coding?.[0]?.code && (
            <Typography variant="caption" color="text.secondary">
              LOINC: {result.code.coding[0].code}
            </Typography>
          )}
        </Box>

        {/* Result Value and Status - Only for Observations */}
        {isObservation && observation && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>Result</Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                {status?.icon}
                <Typography variant="h5" fontWeight="bold">
                  {observation.valueQuantity ? 
                    formatQuantityValue(observation.valueQuantity) :
                    observation.valueString || 
                    observation.valueCodeableConcept?.text ||
                    observation.valueCodeableConcept?.coding?.[0]?.display ||
                    'No value recorded'
                  }
                </Typography>
              </Stack>
              {status?.label && (
                <Chip 
                  label={status.label} 
                  color={status.color} 
                  size="small" 
                  sx={{ mt: 1 }}
                />
              )}
            </Grid>

            {observation.referenceRange?.[0] && (
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>Reference Range</Typography>
                <Typography variant="body1">
                  {observation.referenceRange[0].text || 
                   `${observation.referenceRange[0].low?.value || ''} - ${observation.referenceRange[0].high?.value || ''} ${observation.referenceRange[0].low?.unit || ''}`}
                </Typography>
              </Grid>
            )}

            <Grid item xs={12} md={4}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>Status</Typography>
              <Typography variant="body1">
                {observation.status || 'Unknown'}
              </Typography>
            </Grid>
          </Grid>
        )}

        {/* Date and Performer */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>Date Performed</Typography>
            <Typography variant="body1">
              {result.effectiveDateTime || result.issued ? 
                format(parseISO(result.effectiveDateTime || result.issued!), 'MMMM d, yyyy h:mm a') : 
                'No date recorded'}
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>Performer</Typography>
            <Typography variant="body1">
              {result.performer?.[0]?.display || 'Not specified'}
            </Typography>
          </Grid>
        </Grid>

        {/* Components (for panel results) - Only for Observations */}
        {isObservation && observation?.component && observation.component.length > 0 && (
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>Components</Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Component</TableCell>
                    <TableCell>Value</TableCell>
                    <TableCell>Reference Range</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {observation.component.map((comp, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        {comp.code?.text || comp.code?.coding?.[0]?.display || 'Component'}
                      </TableCell>
                      <TableCell>
                        {comp.valueQuantity ? 
                          formatQuantityValue(comp.valueQuantity) :
                          comp.valueString || 'N/A'
                        }
                      </TableCell>
                      <TableCell>
                        {comp.referenceRange?.[0] ? 
                          `${comp.referenceRange[0].low?.value || ''} - ${comp.referenceRange[0].high?.value || ''} ${comp.referenceRange[0].low?.unit || ''}` :
                          '-'
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Notes */}
        {result.note && result.note.length > 0 && (
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>Notes</Typography>
            {result.note.map((note, index) => (
              <Alert key={index} severity="info" sx={{ mt: 1 }}>
                <Typography variant="body2">{note.text}</Typography>
                {note.time && (
                  <Typography variant="caption" color="text.secondary">
                    {format(parseISO(note.time), 'MMM d, yyyy h:mm a')}
                  </Typography>
                )}
              </Alert>
            ))}
          </Box>
        )}

        {/* Interpretation - Only for Observations */}
        {isObservation && observation?.interpretation && observation.interpretation.length > 0 && (
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>Interpretation</Typography>
            {observation.interpretation.map((interp, index) => (
              <Typography key={index} variant="body2">
                {interp.text || interp.coding?.[0]?.display || 'See result status'}
              </Typography>
            ))}
          </Box>
        )}

        {/* Method - Only for Observations */}
        {isObservation && observation?.method && (
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>Method</Typography>
            <Typography variant="body2">
              {observation.method.text || observation.method.coding?.[0]?.display}
            </Typography>
          </Box>
        )}

        {/* Specimen - Only for Observations */}
        {isObservation && observation?.specimen && (
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>Specimen</Typography>
            <Typography variant="body2">
              {observation.specimen.display || 'Specimen information not available'}
            </Typography>
          </Box>
        )}
      </Stack>
    );
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, ...sx }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight="bold">
          Test Results
        </Typography>
        <Stack direction="row" spacing={2}>
          {selectedResultIds.size > 0 && (
            <Button
              variant="contained"
              onClick={handleBatchAcknowledge}
              disabled={acknowledgingResults}
              startIcon={acknowledgingResults ? <CircularProgress size={20} /> : <CheckCircle />}
            >
              {acknowledgingResults ? 'Acknowledging...' : `Acknowledge (${selectedResultIds.size})`}
            </Button>
          )}
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={handleViewModeChange}
            size="small"
          >
            <ToggleButton value="table">Table</ToggleButton>
            <ToggleButton value="cards">Cards</ToggleButton>
            <ToggleButton value="trends">Trends</ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Stack>

      {/* Alerts */}
      {abnormalCount > 0 && (
        <Alert 
          severity="warning" 
          sx={{ mb: 3 }}
          action={
            <Button 
              size="small" 
              onClick={() => setFilterStatus('abnormal')}
            >
              View All
            </Button>
          }
        >
          <Typography variant="subtitle2">
            {abnormalCount} abnormal lab results require review
          </Typography>
        </Alert>
      )}

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange}
          variant="fullWidth"
        >
          <Tab 
            label="Lab Results" 
            icon={
              <Badge badgeContent={labResults.length} color="primary">
                <LabIcon />
              </Badge>
            }
            iconPosition="start"
          />
          <Tab 
            label="Vital Signs" 
            icon={
              <Badge badgeContent={vitalSigns.length} color="primary">
                <DiagnosticIcon />
              </Badge>
            }
            iconPosition="start"
          />
          <Tab 
            label="Reports" 
            icon={
              <Badge badgeContent={diagnosticReports.length} color="primary">
                <AssessmentIcon />
              </Badge>
            }
            iconPosition="start"
          />
        </Tabs>
      </Paper>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            placeholder="Search tests..."
            value={searchTerm}
            onChange={handleSearchChange}
            size="small"
            sx={{ flex: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              )
            }}
          />
          
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Period</InputLabel>
            <Select
              value={filterPeriod}
              onChange={handleFilterPeriodChange}
              label="Period"
            >
              <MenuItem value="all">All Time</MenuItem>
              <MenuItem value="7d">Last 7 Days</MenuItem>
              <MenuItem value="30d">Last 30 Days</MenuItem>
              <MenuItem value="3m">Last 3 Months</MenuItem>
              <MenuItem value="6m">Last 6 Months</MenuItem>
              <MenuItem value="1y">Last Year</MenuItem>
            </Select>
          </FormControl>

          {tabValue === 0 && (
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={filterStatus}
                onChange={handleFilterStatusChange}
                label="Status"
              >
                <MenuItem value="all">All Results</MenuItem>
                <MenuItem value="normal">Normal Only</MenuItem>
                <MenuItem value="abnormal">Abnormal Only</MenuItem>
              </Select>
            </FormControl>
          )}

          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={handlePrintResults}
          >
            Print Results
          </Button>
        </Stack>
      </Paper>

      {/* Results Display */}
      {sortedResults.length === 0 ? (
        <Alert severity="info">
          No results found matching your criteria
        </Alert>
      ) : viewMode === 'trends' && tabValue === 0 ? (
        // Lab Trends View
        <LabTrendsChart 
          patientId={patientId}
          observations={labResults}
          height={500}
        />
      ) : viewMode === 'table' && tabValue !== 1 ? (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={selectedResultIds.size > 0 && selectedResultIds.size < sortedResults.length}
                    checked={sortedResults.length > 0 && selectedResultIds.size === sortedResults.length}
                    onChange={handleSelectAll}
                    inputProps={{ 'aria-label': 'Select all results' }}
                  />
                </TableCell>
                <TableCell>Test Name</TableCell>
                <TableCell>Result</TableCell>
                <TableCell>Reference Range</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedResults
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((result) => (
                  <ResultRow
                    key={result.id}
                    observation={result as EnhancedObservation}
                    onClick={() => handleViewDetails(result)}
                    selected={selectedResult?.id === result.id}
                    onSelectResult={handleSelectResult}
                    isSelected={selectedResultIds.has(result.id || '')}
                  />
                ))
              }
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={sortedResults.length}
            page={page}
            onPageChange={handlePageChange}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleRowsPerPageChange}
          />
        </TableContainer>
      ) : tabValue === 1 ? (
        // Vital Signs
        <Box>
          {vitalSigns.length === 0 ? (
            <Alert severity="info">
              No vital signs recorded for this patient
            </Alert>
          ) : viewMode === 'trends' ? (
            <VitalsOverview 
              patientId={patientId} 
              vitalsData={vitalSigns}
              compact={false}
            />
          ) : viewMode === 'table' ? (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Vital Sign</TableCell>
                    <TableCell>Value</TableCell>
                    <TableCell>Reference Range</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedResults
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((result) => (
                      <ResultRow
                        key={result.id}
                        observation={result as EnhancedObservation}
                        onClick={() => handleViewDetails(result)}
                        selected={selectedResult?.id === result.id}
                        onSelectResult={handleSelectResult}
                        isSelected={selectedResultIds.has(result.id || '')}
                      />
                    ))
                  }
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={sortedResults.length}
                page={page}
                onPageChange={handlePageChange}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={handleRowsPerPageChange}
              />
            </TableContainer>
          ) : (
            // Card View for vital signs
            <Box>
              {sortedResults.map((result) => (
                <ResultCard
                  key={result.id}
                  observation={result as EnhancedObservation}
                  onClick={() => handleViewDetails(result)}
                />
              ))}
            </Box>
          )}
        </Box>
      ) : tabValue === 2 ? (
        // Diagnostic Reports
        viewMode === 'table' ? (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Report Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Performer</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedResults.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>
                      <Typography variant="subtitle2">
                        {report.code?.text || report.code?.coding?.[0]?.display || 'Diagnostic Report'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={(report as DiagnosticReport).status || 'final'} 
                        size="small"
                        color={(report as DiagnosticReport).status === 'final' ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      {report.performer?.[0]?.display || 'Unknown'}
                    </TableCell>
                    <TableCell>
                      {report.effectiveDateTime || report.issued ? 
                        format(parseISO(report.effectiveDateTime || report.issued!), 'MMM d, yyyy') : 
                        'No date'}
                    </TableCell>
                    <TableCell>
                      <Button size="small" startIcon={<ViewIcon />} onClick={() => handleViewDetails(report)}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Alert severity="info">
            Trends view is not available for diagnostic reports. Please use table or cards view.
          </Alert>
        )
      ) : (
        // Default Card View (should not reach here)
        <Box>
          {sortedResults.map((result) => (
            <ResultCard
              key={result.id}
              observation={result as EnhancedObservation}
              onClick={() => handleViewDetails(result)}
            />
          ))}
        </Box>
      )}

      {/* Result Details Dialog */}
      <Dialog open={detailsDialogOpen} onClose={handleCloseDetailsDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Result Details</Typography>
            <IconButton onClick={handleCloseDetailsDialog} aria-label="Close dialog">
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          {selectedResult && renderDetailedResult(selectedResult)}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              if (selectedResult) {
                const patientInfo = extractPatientInfo(currentPatient as Patient);
                
                printDocument({
                  title: 'Lab Result Details',
                  patient: patientInfo,
                  content: formatLabResultsForPrint([selectedResult])
                });
              }
            }} 
            startIcon={<PrintIcon />}
          >
            Print
          </Button>
          <Button onClick={handleCloseDetailsDialog} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert 
          onClose={handleSnackbarClose} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ResultsTab;