/**
 * Add Problem Dialog Component
 * Allows adding new problems/conditions to patient chart
 * 
 * Migrated to TypeScript with comprehensive type safety for FHIR Condition resources.
 */

import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Typography,
  Chip,
  Stack,
  Autocomplete,
  Box,
  Alert,
  CircularProgress,
  SelectChangeEvent,
  SxProps,
  Theme,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import { searchService } from '../../../../services/searchService';
import { Condition } from '@ahryman40k/ts-fhir-types/lib/R4';

/**
 * Type definitions for AddProblemDialog component
 */
export type ClinicalStatus = 'active' | 'recurrence' | 'relapse' | 'inactive' | 'remission' | 'resolved';

export type VerificationStatus = 'confirmed' | 'provisional' | 'differential' | 'unconfirmed';

export type SeverityLevel = 'mild' | 'moderate' | 'severe' | '';

export type ConditionCategory = 'problem-list-item' | 'encounter-diagnosis';

export interface ConditionOption {
  code: string;
  display: string;
  system?: string;
  source?: string;
}

export interface ProblemFormData {
  problemText: string;
  selectedProblem: ConditionOption | null;
  clinicalStatus: ClinicalStatus;
  verificationStatus: VerificationStatus;
  severity: SeverityLevel;
  onsetDate: Date | null;
  category: ConditionCategory;
  notes: string;
}

export interface AddProblemDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (condition: Condition) => Promise<void>;
  patientId: string;
  sx?: SxProps<Theme>;
}

export interface SearchServiceType {
  searchConditions: (query: string, limit?: number) => Promise<ConditionOption[]>;
  formatCondition: (condition: any) => ConditionOption;
}

/**
 * Helper functions
 */
const getInitialFormData = (): ProblemFormData => ({
  problemText: '',
  selectedProblem: null,
  clinicalStatus: 'active',
  verificationStatus: 'confirmed',
  severity: '',
  onsetDate: null,
  category: 'problem-list-item',
  notes: ''
});

const getSeverityCode = (severity: SeverityLevel): string | null => {
  switch (severity) {
    case 'mild': return '255604002';
    case 'moderate': return '6736007';
    case 'severe': return '24484000';
    default: return null;
  }
};

const createConditionResource = (formData: ProblemFormData, patientId: string): Condition => {
  const condition: Condition = {
    resourceType: 'Condition',
    id: `condition-${Date.now()}`,
    clinicalStatus: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/condition-clinical',
        code: formData.clinicalStatus,
        display: formData.clinicalStatus
      }]
    },
    verificationStatus: {
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status',
        code: formData.verificationStatus,
        display: formData.verificationStatus
      }]
    },
    category: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/condition-category',
        code: formData.category,
        display: 'Problem List Item'
      }]
    }],
    code: formData.selectedProblem ? {
      coding: [{
        system: 'http://hl7.org/fhir/sid/icd-10-cm',
        code: formData.selectedProblem.code,
        display: formData.selectedProblem.display
      }],
      text: formData.selectedProblem.display
    } : {
      text: formData.problemText
    },
    subject: {
      reference: `Patient/${patientId}`
    },
    recordedDate: new Date().toISOString()
  };

  // Add optional fields
  if (formData.onsetDate) {
    condition.onsetDateTime = formData.onsetDate.toISOString();
  }

  if (formData.severity) {
    const severityCode = getSeverityCode(formData.severity);
    if (severityCode) {
      condition.severity = {
        coding: [{
          system: 'http://snomed.info/sct',
          code: severityCode,
          display: formData.severity
        }],
        text: formData.severity
      };
    }
  }

  if (formData.notes) {
    condition.note = [{
      text: formData.notes,
      time: new Date().toISOString()
    }];
  }

  return condition;
};

const formatDisplayDate = (date: Date): string => {
  try {
    return format(date, 'MMM d, yyyy');
  } catch (error) {
    console.error('Error formatting date:', error);
    return date.toString();
  }
};

const getStatusColor = (status: ClinicalStatus): 'warning' | 'default' => {
  return status === 'active' ? 'warning' : 'default';
};

const getSeverityColor = (severity: SeverityLevel): 'error' | 'default' => {
  return severity === 'severe' ? 'error' : 'default';
};

/**
 * AddProblemDialog Component
 */
const AddProblemDialog: React.FC<AddProblemDialogProps> = ({ 
  open, 
  onClose, 
  onAdd, 
  patientId,
  sx 
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  const [conditionOptions, setConditionOptions] = useState<ConditionOption[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [formData, setFormData] = useState<ProblemFormData>(getInitialFormData());

  // Search for conditions as user types
  const handleSearchConditions = useCallback(async (query: string): Promise<void> => {
    if (!query || query.length < 2) {
      setConditionOptions([]);
      return;
    }

    setSearchLoading(true);
    try {
      const results = await searchService.searchConditions(query, 20);
      setConditionOptions(results.map(searchService.formatCondition));
    } catch (err) {
      console.error('Error searching conditions:', err);
      setConditionOptions([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleReset = useCallback((): void => {
    setFormData(getInitialFormData());
    setError('');
    setConditionOptions([]);
    setSearchQuery('');
  }, []);

  const handleClose = useCallback((): void => {
    handleReset();
    onClose();
  }, [handleReset, onClose]);

  const handleSubmit = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError('');

      // Validate required fields
      if (!formData.problemText && !formData.selectedProblem) {
        setError('Please specify a problem description or select from the list');
        return;
      }

      // Create FHIR Condition resource
      const condition = createConditionResource(formData, patientId);

      // Call the onAdd callback with the new condition
      await onAdd(condition);
      handleClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add problem';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [formData, patientId, onAdd, handleClose]);

  const handleFormDataChange = useCallback(<K extends keyof ProblemFormData>(
    field: K, 
    value: ProblemFormData[K]
  ): void => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleClinicalStatusChange = useCallback((event: SelectChangeEvent<ClinicalStatus>): void => {
    handleFormDataChange('clinicalStatus', event.target.value as ClinicalStatus);
  }, [handleFormDataChange]);

  const handleVerificationStatusChange = useCallback((event: SelectChangeEvent<VerificationStatus>): void => {
    handleFormDataChange('verificationStatus', event.target.value as VerificationStatus);
  }, [handleFormDataChange]);

  const handleSeverityChange = useCallback((event: SelectChangeEvent<SeverityLevel>): void => {
    handleFormDataChange('severity', event.target.value as SeverityLevel);
  }, [handleFormDataChange]);

  const handleConditionSelect = useCallback((event: React.SyntheticEvent, newValue: ConditionOption | null): void => {
    setFormData(prev => ({
      ...prev,
      selectedProblem: newValue,
      problemText: newValue ? newValue.display : prev.problemText
    }));
  }, []);

  const handleCustomProblemChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
    setFormData(prev => ({
      ...prev,
      problemText: event.target.value,
      selectedProblem: null
    }));
  }, []);

  const isFormValid = formData.problemText || formData.selectedProblem;
  const previewProblem = formData.selectedProblem ? formData.selectedProblem.display : formData.problemText;

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog 
        open={open} 
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { minHeight: '600px', ...sx }
        }}
      >
        <DialogTitle>
          <Typography variant="h6">Add New Problem</Typography>
        </DialogTitle>
        
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            {error && (
              <Alert severity="error" onClose={() => setError('')}>
                {error}
              </Alert>
            )}

            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Problem Description
                </Typography>
                <Autocomplete
                  options={conditionOptions}
                  getOptionLabel={(option: ConditionOption) => option.display}
                  value={formData.selectedProblem}
                  loading={searchLoading}
                  onInputChange={(event, value) => {
                    setSearchQuery(value);
                    handleSearchConditions(value);
                  }}
                  onChange={handleConditionSelect}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Search for conditions/problems"
                      placeholder="Type to search conditions..."
                      variant="outlined"
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {searchLoading ? <CircularProgress color="inherit" size={20} /> : null}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  renderOption={(props, option: ConditionOption) => (
                    <Box component="li" {...props}>
                      <Stack>
                        <Typography variant="body2">{option.display}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {option.code} • {option.system?.split('/').pop()?.toUpperCase()} • Source: {option.source}
                        </Typography>
                      </Stack>
                    </Box>
                  )}
                  noOptionsText={
                    searchQuery.length < 2 ? 
                    "Type at least 2 characters to search" : 
                    searchLoading ? "Searching..." : "No conditions found"
                  }
                />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Or enter a custom problem description:
                </Typography>
                <TextField
                  fullWidth
                  label="Custom Problem Description"
                  value={formData.problemText}
                  onChange={handleCustomProblemChange}
                  variant="outlined"
                  multiline
                  rows={2}
                />
              </Grid>

              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Clinical Status</InputLabel>
                  <Select
                    value={formData.clinicalStatus}
                    label="Clinical Status"
                    onChange={handleClinicalStatusChange}
                  >
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="recurrence">Recurrence</MenuItem>
                    <MenuItem value="relapse">Relapse</MenuItem>
                    <MenuItem value="inactive">Inactive</MenuItem>
                    <MenuItem value="remission">Remission</MenuItem>
                    <MenuItem value="resolved">Resolved</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Verification Status</InputLabel>
                  <Select
                    value={formData.verificationStatus}
                    label="Verification Status"
                    onChange={handleVerificationStatusChange}
                  >
                    <MenuItem value="confirmed">Confirmed</MenuItem>
                    <MenuItem value="provisional">Provisional</MenuItem>
                    <MenuItem value="differential">Differential</MenuItem>
                    <MenuItem value="unconfirmed">Unconfirmed</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Severity</InputLabel>
                  <Select
                    value={formData.severity}
                    label="Severity"
                    onChange={handleSeverityChange}
                  >
                    <MenuItem value="">Not specified</MenuItem>
                    <MenuItem value="mild">Mild</MenuItem>
                    <MenuItem value="moderate">Moderate</MenuItem>
                    <MenuItem value="severe">Severe</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={6}>
                <DatePicker
                  label="Onset Date"
                  value={formData.onsetDate}
                  onChange={(newValue: Date | null) => handleFormDataChange('onsetDate', newValue)}
                  renderInput={(params) => (
                    <TextField {...params} fullWidth />
                  )}
                  maxDate={new Date()}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Clinical Notes"
                  value={formData.notes}
                  onChange={(e) => handleFormDataChange('notes', e.target.value)}
                  variant="outlined"
                  multiline
                  rows={3}
                  placeholder="Additional notes about this problem..."
                />
              </Grid>
            </Grid>

            {/* Preview */}
            {previewProblem && (
              <Box sx={{ p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Preview:
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2">
                    {previewProblem}
                  </Typography>
                  <Chip 
                    label={formData.clinicalStatus} 
                    size="small" 
                    color={getStatusColor(formData.clinicalStatus)}
                  />
                  {formData.severity && (
                    <Chip 
                      label={formData.severity} 
                      size="small" 
                      color={getSeverityColor(formData.severity)}
                    />
                  )}
                </Stack>
                {formData.onsetDate && (
                  <Typography variant="caption" color="text.secondary">
                    Onset: {formatDisplayDate(formData.onsetDate)}
                  </Typography>
                )}
              </Box>
            )}
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained" 
            disabled={loading || !isFormValid}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading ? 'Adding...' : 'Add Problem'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export default AddProblemDialog;