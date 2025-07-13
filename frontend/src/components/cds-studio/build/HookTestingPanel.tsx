/**
 * Hook Testing Panel - Test CDS hooks with mock patients
 * 
 * Migrated to TypeScript with comprehensive type safety for CDS Hook testing.
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Chip,
  Stack,
  Card,
  CardContent,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Tooltip,
  SelectChangeEvent,
  SxProps,
  Theme,
} from '@mui/material';
import {
  PlayArrow as TestIcon,
  Close as CloseIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  BugReport as DebugIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { R4 } from '@ahryman40k/ts-fhir-types';
import { useCDSStudio } from '../../../pages/CDSHooksStudio';
import { usePatientSearch } from '../../../hooks/usePatientSearch';

/**
 * Type definitions for HookTestingPanel component
 */
export type CardIndicator = 'info' | 'warning' | 'critical' | 'success';

export interface CDSCard {
  uuid?: string;
  summary: string;
  detail?: string;
  indicator: CardIndicator;
  source?: {
    label: string;
    url?: string;
    icon?: string;
  };
  suggestions?: Array<{
    label: string;
    uuid?: string;
    actions?: any[];
  }>;
  selectionBehavior?: 'at-most-one' | 'any' | 'exactly-one';
  links?: Array<{
    label: string;
    url: string;
    type: string;
  }>;
}

export interface TestResult {
  success: boolean;
  error?: string;
  result?: {
    cards: CDSCard[];
    executionTime: number;
    context: Record<string, any>;
    prefetch: Record<string, any>;
    timestamp: string;
  };
}

export interface CDSHook {
  id: string;
  title: string;
  hook: string;
  description?: string;
  prefetch?: Record<string, string>;
  context?: Record<string, any>;
}

export interface Patient {
  id: string;
  name?: R4.IHumanName[];
  gender?: string;
  birthDate?: string;
  identifier?: R4.IIdentifier[];
  telecom?: R4.IContactPoint[];
}

export interface HookTestingPanelProps {
  open: boolean;
  onClose: () => void;
  hook: CDSHook;
  sx?: SxProps<Theme>;
}

export interface PatientSearchHook {
  patients: Patient[];
  loading: boolean;
  searchPatients: (query: string) => void;
  error?: string;
}

export interface CDSStudioActions {
  testHook: (patientId: string) => Promise<TestResult>;
}

export interface CDSStudioContext {
  actions: CDSStudioActions;
}

/**
 * Helper functions
 */
const getPatientDisplayName = (patient: Patient): string => {
  const name = patient.name?.[0];
  if (!name) return 'Unknown Patient';
  
  const family = name.family || '';
  const given = name.given?.join(' ') || '';
  
  return `${family}, ${given}`.trim();
};

const calculateAge = (birthDate: string | undefined): number => {
  if (!birthDate) return 0;
  
  try {
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  } catch (error) {
    return 0;
  }
};

const formatDebugData = (hook: CDSHook, patientId: string, testResults: TestResult | null): string => {
  const debugData = {
    hook: hook,
    patient: patientId,
    results: testResults,
    timestamp: new Date().toISOString()
  };
  
  return JSON.stringify(debugData, null, 2);
};

const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
};

const getIndicatorIcon = (indicator: CardIndicator): JSX.Element => {
  const iconMap: Record<CardIndicator, JSX.Element> = {
    info: <InfoIcon color="info" />,
    warning: <WarningIcon color="warning" />,
    critical: <ErrorIcon color="error" />,
    success: <SuccessIcon color="success" />
  };
  
  return iconMap[indicator] || <InfoIcon color="info" />;
};

/**
 * HookTestingPanel Component
 */
const HookTestingPanel: React.FC<HookTestingPanelProps> = ({ open, onClose, hook, sx }) => {
  const { actions } = useCDSStudio() as CDSStudioContext;
  const { patients, loading: patientsLoading, searchPatients } = usePatientSearch() as PatientSearchHook;
  const [selectedPatient, setSelectedPatient] = useState<string>('');
  const [testResults, setTestResults] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState<boolean>(false);
  const [debugMode, setDebugMode] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);

  useEffect(() => {
    if (open && patients.length === 0) {
      searchPatients('');
    }
  }, [open, patients, searchPatients]);

  const runTest = async (): Promise<void> => {
    if (!selectedPatient) return;

    setTesting(true);
    setTestResults(null);

    try {
      const result = await actions.testHook(selectedPatient);
      setTestResults(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setTestResults({
        success: false,
        error: errorMessage
      });
    } finally {
      setTesting(false);
    }
  };

  const copyDebugInfo = async (): Promise<void> => {
    const debugText = formatDebugData(hook, selectedPatient, testResults);
    const success = await copyToClipboard(debugText);
    
    if (success) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 3000);
    }
  };

  const handlePatientChange = (event: SelectChangeEvent<string>): void => {
    setSelectedPatient(event.target.value);
  };

  const handleDebugToggle = (): void => {
    setDebugMode(!debugMode);
  };

  const renderCardResult = (card: CDSCard, index: number): JSX.Element => {
    return (
      <Card variant="outlined" sx={{ mb: 2 }} key={index}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={1} mb={1}>
            {getIndicatorIcon(card.indicator)}
            <Typography variant="subtitle1">{card.summary}</Typography>
          </Box>
          {card.detail && (
            <Typography variant="body2" color="text.secondary">
              {card.detail}
            </Typography>
          )}
          {card.source?.label && (
            <Typography variant="caption" color="text.secondary" display="block" mt={1}>
              Source: {card.source.label}
            </Typography>
          )}
          {card.suggestions && card.suggestions.length > 0 && (
            <Box mt={2}>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Suggestions:
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {card.suggestions.map((suggestion, suggestionIndex) => (
                  <Chip
                    key={suggestionIndex}
                    label={suggestion.label}
                    size="small"
                    variant="outlined"
                  />
                ))}
              </Stack>
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth sx={sx}>
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Test Hook: {hook.title}</Typography>
          <IconButton onClick={onClose} size="small" aria-label="Close dialog">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Patient Selection */}
        <Box mb={3}>
          <FormControl fullWidth>
            <InputLabel>Select Test Patient</InputLabel>
            <Select
              value={selectedPatient}
              onChange={handlePatientChange}
              label="Select Test Patient"
              disabled={patientsLoading}
            >
              {patientsLoading ? (
                <MenuItem disabled>
                  <CircularProgress size={20} />
                </MenuItem>
              ) : (
                patients.map((patient: Patient) => (
                  <MenuItem key={patient.id} value={patient.id}>
                    <Box>
                      <Typography variant="body1">
                        {getPatientDisplayName(patient)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {patient.gender} | {calculateAge(patient.birthDate)} years
                      </Typography>
                    </Box>
                  </MenuItem>
                ))
              )}
            </Select>
          </FormControl>
        </Box>

        {/* Test Options */}
        <Stack direction="row" spacing={2} mb={3}>
          <Button
            variant="contained"
            startIcon={<TestIcon />}
            onClick={runTest}
            disabled={!selectedPatient || testing}
          >
            {testing ? 'Testing...' : 'Run Test'}
          </Button>
          
          <Tooltip title="Show debug information">
            <IconButton 
              onClick={handleDebugToggle}
              color={debugMode ? 'primary' : 'default'}
              aria-label="Toggle debug mode"
            >
              <DebugIcon />
            </IconButton>
          </Tooltip>

          {copySuccess && (
            <Chip
              label="Copied!"
              color="success"
              size="small"
            />
          )}
        </Stack>

        {/* Test Results */}
        {testResults && (
          <Box>
            <Alert 
              severity={testResults.success ? 'success' : 'error'} 
              sx={{ mb: 2 }}
              action={
                debugMode && (
                  <IconButton size="small" onClick={copyDebugInfo} aria-label="Copy debug info">
                    <CopyIcon />
                  </IconButton>
                )
              }
            >
              {testResults.success ? 'Hook executed successfully' : testResults.error}
            </Alert>

            {testResults.success && testResults.result && (
              <>
                <Typography variant="h6" gutterBottom>
                  Results
                </Typography>

                {/* Execution Summary */}
                <Card sx={{ mb: 2 }}>
                  <CardContent>
                    <Stack direction="row" spacing={2}>
                      <Chip 
                        label={`${testResults.result.cards?.length || 0} cards generated`}
                        color="primary"
                      />
                      <Chip 
                        label={`Executed in ${testResults.result.executionTime || 0}ms`}
                      />
                    </Stack>
                  </CardContent>
                </Card>

                {/* Generated Cards */}
                {testResults.result.cards?.length > 0 && (
                  <Box mb={3}>
                    <Typography variant="subtitle1" gutterBottom>
                      Generated Cards
                    </Typography>
                    {testResults.result.cards.map((card: CDSCard, index: number) => 
                      renderCardResult(card, index)
                    )}
                  </Box>
                )}

                {/* Debug Information */}
                {debugMode && (
                  <Box>
                    <Typography variant="subtitle1" gutterBottom>
                      Debug Information
                    </Typography>
                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2" gutterBottom>
                          Context Data
                        </Typography>
                        <pre style={{ 
                          overflow: 'auto', 
                          fontSize: '0.875rem',
                          backgroundColor: '#f5f5f5',
                          padding: '8px',
                          borderRadius: '4px',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word'
                        }}>
                          {JSON.stringify(testResults.result.context, null, 2)}
                        </pre>

                        <Divider sx={{ my: 2 }} />

                        <Typography variant="subtitle2" gutterBottom>
                          Prefetch Data
                        </Typography>
                        <pre style={{ 
                          overflow: 'auto', 
                          fontSize: '0.875rem',
                          backgroundColor: '#f5f5f5',
                          padding: '8px',
                          borderRadius: '4px',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word'
                        }}>
                          {JSON.stringify(testResults.result.prefetch, null, 2)}
                        </pre>
                      </CardContent>
                    </Card>
                  </Box>
                )}
              </>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default HookTestingPanel;