/**
 * Edit Medication Dialog Component
 * Allows editing existing medication requests in patient chart
 * 
 * Migrated to TypeScript with comprehensive type safety for medication editing.
 */

import React, { useState, useEffect, useCallback } from 'react';
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
  Divider,
  FormControlLabel,
  Checkbox,
  SxProps,
  Theme,
  SelectChangeEvent,
  AlertColor,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, parseISO } from 'date-fns';
import { MedicationRequest } from '@ahryman40k/ts-fhir-types/lib/R4';
import { searchService } from '../../../../services/searchService';

/**
 * Type definitions for EditMedicationDialog component
 */
export type MedicationStatus = 'active' | 'on-hold' | 'cancelled' | 'completed' | 'entered-in-error' | 'stopped' | 'draft' | 'unknown';

export type MedicationPriority = 'routine' | 'urgent' | 'asap' | 'stat';

export type RouteCode = 'oral' | 'topical' | 'injection' | 'inhalation' | 'sublingual' | 'rectal';

export type FrequencyCode = 'once-daily' | 'twice-daily' | 'three-times-daily' | 'four-times-daily' | 'every-other-day' | 'weekly' | 'as-needed';

export interface DosingFrequency {
  value: FrequencyCode;
  display: string;
}

export interface RouteOption {
  value: RouteCode;
  display: string;
}

export interface StatusOption {
  value: MedicationStatus;
  display: string;
}

export interface PriorityOption {
  value: MedicationPriority;
  display: string;
}

export interface MedicationOption {
  code: string;
  display: string;
  system?: string;
  source: string;
  route?: string;
  form?: string;
}

export interface FormData {
  selectedMedication: MedicationOption | null;
  customMedication: string;
  dosage: string;
  route: RouteCode;
  frequency: FrequencyCode;
  duration: string;
  quantity: string;
  refills: number;
  startDate: Date | null;
  endDate: Date | null;
  instructions: string;
  indication: string;
  priority: MedicationPriority;
  status: MedicationStatus;
  genericSubstitution: boolean;
  notes: string;
}

export interface EditMedicationDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (updatedMedicationRequest: MedicationRequest) => Promise<void>;
  onDelete: (medicationId: string) => Promise<void>;
  medicationRequest: MedicationRequest | null;
  patientId: string;
  sx?: SxProps<Theme>;
}

export interface DosageInstruction {
  text?: string;
  timing?: {
    code?: {
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
    };
    repeat?: {
      frequency?: number;
      period?: number;
      periodUnit?: string;
    };
  };
  route?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  doseAndRate?: Array<{
    doseQuantity?: {
      value?: number;
      unit?: string;
      code?: string;
    };
  }>;
  doseQuantity?: {
    value?: number;
    unit?: string;
    code?: string;
  };
  patientInstruction?: string;
}

export interface DispenseRequest {
  numberOfRepeatsAllowed?: number;
  quantity?: {
    value?: number;
    unit?: string;
  };
  expectedSupplyDuration?: {
    value?: number;
    unit?: string;
  };
  validityPeriod?: {
    end?: string;
  };
}

export interface MedicationCodeableConcept {
  text?: string;
  coding?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
}

/**
 * Constants for medication options
 */
const DOSING_FREQUENCIES: DosingFrequency[] = [
  { value: 'once-daily', display: 'Once daily' },
  { value: 'twice-daily', display: 'Twice daily' },
  { value: 'three-times-daily', display: 'Three times daily' },
  { value: 'four-times-daily', display: 'Four times daily' },
  { value: 'every-other-day', display: 'Every other day' },
  { value: 'weekly', display: 'Weekly' },
  { value: 'as-needed', display: 'As needed' }
];

const ROUTES: RouteOption[] = [
  { value: 'oral', display: 'Oral' },
  { value: 'topical', display: 'Topical' },
  { value: 'injection', display: 'Injection' },
  { value: 'inhalation', display: 'Inhalation' },
  { value: 'sublingual', display: 'Sublingual' },
  { value: 'rectal', display: 'Rectal' }
];

const MEDICATION_STATUS: StatusOption[] = [
  { value: 'active', display: 'Active' },
  { value: 'on-hold', display: 'On Hold' },
  { value: 'cancelled', display: 'Cancelled' },
  { value: 'completed', display: 'Completed' },
  { value: 'entered-in-error', display: 'Entered in Error' },
  { value: 'stopped', display: 'Stopped' }
];

const PRIORITIES: PriorityOption[] = [
  { value: 'routine', display: 'Routine' },
  { value: 'urgent', display: 'Urgent' },
  { value: 'asap', display: 'ASAP' },
  { value: 'stat', display: 'STAT' }
];

/**
 * Helper functions
 */
const parseNumericValue = (value: string): number => {
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
};

const safeParseISO = (dateString: string | undefined): Date | null => {
  if (!dateString) return null;
  try {
    return parseISO(dateString);
  } catch {
    return null;
  }
};

const validateRequiredFields = (formData: FormData): string | null => {
  if (!formData.selectedMedication && !formData.customMedication) {
    return 'Please select a medication or enter a custom medication';
  }
  if (!formData.dosage) {
    return 'Please specify the dosage';
  }
  if (!formData.quantity) {
    return 'Please specify the quantity to dispense';
  }
  return null;
};

/**
 * EditMedicationDialog Component
 */
const EditMedicationDialog: React.FC<EditMedicationDialogProps> = ({ 
  open, 
  onClose, 
  onSave, 
  onDelete, 
  medicationRequest, 
  patientId,
  sx 
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  const [medicationOptions, setMedicationOptions] = useState<MedicationOption[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [formData, setFormData] = useState<FormData>({
    selectedMedication: null,
    customMedication: '',
    dosage: '',
    route: 'oral',
    frequency: 'once-daily',
    duration: '',
    quantity: '',
    refills: 0,
    startDate: new Date(),
    endDate: null,
    instructions: '',
    indication: '',
    priority: 'routine',
    status: 'active',
    genericSubstitution: true,
    notes: ''
  });

  // Initialize form with existing medication request data
  useEffect(() => {
    if (medicationRequest && open) {
      initializeFormData(medicationRequest);
    }
  }, [medicationRequest, open]);

  const initializeFormData = useCallback((medRequest: MedicationRequest): void => {
    const status = (medRequest.status as MedicationStatus) || 'active';
    const priority = (medRequest.priority as MedicationPriority) || 'routine';
    const startDate = medRequest.authoredOn ? safeParseISO(medRequest.authoredOn) || new Date() : new Date();
    const endDate = medRequest.dispenseRequest?.validityPeriod?.end ? 
      safeParseISO(medRequest.dispenseRequest.validityPeriod.end) : null;
    
    // Extract medication information
    let selectedMedication: MedicationOption | null = null;
    let customMedication = '';
    
    if (medRequest.medicationCodeableConcept) {
      const med = medRequest.medicationCodeableConcept as MedicationCodeableConcept;
      if (med.coding && med.coding.length > 0) {
        const coding = med.coding[0];
        selectedMedication = {
          code: coding.code || '',
          display: coding.display || med.text || '',
          system: coding.system || 'http://www.nlm.nih.gov/research/umls/rxnorm',
          source: 'existing'
        };
      } else if (med.text) {
        customMedication = med.text;
      }
    } else if (medRequest.medicationReference) {
      customMedication = 'Referenced Medication';
    }

    // Extract dosage information
    const dosageInstruction = medRequest.dosageInstruction?.[0] as DosageInstruction;
    
    // Extract dosage - handle both doseAndRate and doseQuantity formats
    let dosage = '';
    if (dosageInstruction?.doseAndRate?.[0]?.doseQuantity) {
      const doseQty = dosageInstruction.doseAndRate[0].doseQuantity;
      dosage = `${doseQty.value || ''} ${doseQty.unit || ''}`.trim();
    } else if (dosageInstruction?.doseQuantity) {
      const doseQty = dosageInstruction.doseQuantity;
      dosage = `${doseQty.value || ''} ${doseQty.unit || ''}`.trim();
    }
    
    // Extract route - check both coding and text
    const routeValue = dosageInstruction?.route?.coding?.[0]?.code || 
                     dosageInstruction?.route?.text?.toLowerCase() || 
                     'oral';
    const route = ROUTES.find(r => r.value === routeValue)?.value || 'oral';
    
    // Extract frequency - check multiple possible locations
    let frequency: FrequencyCode = 'once-daily';
    if (dosageInstruction?.timing?.code?.coding?.[0]?.code) {
      const freqCode = dosageInstruction.timing.code.coding[0].code as FrequencyCode;
      if (DOSING_FREQUENCIES.find(f => f.value === freqCode)) {
        frequency = freqCode;
      }
    } else if (dosageInstruction?.timing?.repeat) {
      const repeat = dosageInstruction.timing.repeat;
      if (repeat.frequency === 1 && repeat.period === 1) {
        if (repeat.periodUnit === 'd') frequency = 'once-daily';
        else if (repeat.periodUnit === 'wk') frequency = 'weekly';
      } else if (repeat.frequency === 2 && repeat.period === 1 && repeat.periodUnit === 'd') {
        frequency = 'twice-daily';
      } else if (repeat.frequency === 3 && repeat.period === 1 && repeat.periodUnit === 'd') {
        frequency = 'three-times-daily';
      } else if (repeat.frequency === 4 && repeat.period === 1 && repeat.periodUnit === 'd') {
        frequency = 'four-times-daily';
      }
    }
    
    const instructions = dosageInstruction?.text || dosageInstruction?.patientInstruction || '';

    // Extract dispense information
    const dispenseRequest = medRequest.dispenseRequest as DispenseRequest;
    
    // Extract quantity with unit
    let quantity = '';
    if (dispenseRequest?.quantity) {
      quantity = `${dispenseRequest.quantity.value || ''} ${dispenseRequest.quantity.unit || ''}`.trim();
    }
    
    const refills = dispenseRequest?.numberOfRepeatsAllowed || 0;
    
    // Extract duration with unit
    let duration = '';
    if (dispenseRequest?.expectedSupplyDuration) {
      duration = `${dispenseRequest.expectedSupplyDuration.value || ''} ${dispenseRequest.expectedSupplyDuration.unit || 'days'}`.trim();
    }

    // Extract other fields
    const indication = medRequest.reasonCode?.[0]?.text || '';
    const genericSubstitution = medRequest.substitution?.allowedBoolean !== false;
    const notes = medRequest.note?.[0]?.text || '';

    setFormData({
      selectedMedication,
      customMedication,
      dosage,
      route,
      frequency,
      duration,
      quantity,
      refills,
      startDate,
      endDate,
      instructions,
      indication,
      priority,
      status,
      genericSubstitution,
      notes
    });
  }, []);

  // Search for medications as user types
  const handleSearchMedications = useCallback(async (query: string): Promise<void> => {
    if (!query || query.length < 2) {
      setMedicationOptions([]);
      return;
    }

    setSearchLoading(true);
    try {
      const results = await searchService.searchMedications(query, 20);
      setMedicationOptions(results.map(searchService.formatMedication));
    } catch (error) {
      console.error('Error searching medications:', error);
      setMedicationOptions([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleReset = useCallback((): void => {
    setFormData({
      selectedMedication: null,
      customMedication: '',
      dosage: '',
      route: 'oral',
      frequency: 'once-daily',
      duration: '',
      quantity: '',
      refills: 0,
      startDate: new Date(),
      endDate: null,
      instructions: '',
      indication: '',
      priority: 'routine',
      status: 'active',
      genericSubstitution: true,
      notes: ''
    });
    setError('');
    setMedicationOptions([]);
    setSearchQuery('');
  }, []);

  const handleClose = useCallback((): void => {
    handleReset();
    onClose();
  }, [handleReset, onClose]);

  const handleSave = useCallback(async (): Promise<void> => {
    if (!medicationRequest) return;

    try {
      setLoading(true);
      setError('');

      // Validate required fields
      const validationError = validateRequiredFields(formData);
      if (validationError) {
        setError(validationError);
        return;
      }

      // Ensure we have the resource ID
      if (!medicationRequest.id) {
        setError('Cannot update medication: missing resource ID');
        return;
      }

      // Create updated FHIR MedicationRequest resource
      const updatedMedicationRequest: MedicationRequest = {
        ...medicationRequest,
        resourceType: 'MedicationRequest',
        id: medicationRequest.id,
        status: formData.status,
        intent: 'order',
        priority: formData.priority,
        medicationCodeableConcept: formData.selectedMedication ? {
          coding: [{
            system: formData.selectedMedication.system || 'http://www.nlm.nih.gov/research/umls/rxnorm',
            code: formData.selectedMedication.code,
            display: formData.selectedMedication.display
          }],
          text: formData.selectedMedication.display
        } : {
          text: formData.customMedication
        },
        subject: {
          reference: `Patient/${patientId}`
        },
        authoredOn: formData.startDate?.toISOString(),
        dosageInstruction: [{
          text: formData.instructions || `${formData.dosage} ${DOSING_FREQUENCIES.find(f => f.value === formData.frequency)?.display}`,
          timing: {
            code: {
              coding: [{
                system: 'http://terminology.hl7.org/CodeSystem/v3-GTSAbbreviation',
                code: formData.frequency,
                display: DOSING_FREQUENCIES.find(f => f.value === formData.frequency)?.display
              }]
            }
          },
          route: {
            coding: [{
              system: 'http://snomed.info/sct',
              code: formData.route,
              display: ROUTES.find(r => r.value === formData.route)?.display
            }]
          },
          doseAndRate: [{
            doseQuantity: {
              value: parseNumericValue(formData.dosage) || 1,
              unit: 'dose'
            }
          }]
        }],
        dispenseRequest: {
          numberOfRepeatsAllowed: formData.refills,
          quantity: {
            value: parseNumericValue(formData.quantity) || 30,
            unit: 'dose'
          },
          ...(formData.duration && {
            expectedSupplyDuration: {
              value: parseNumericValue(formData.duration),
              unit: 'days'
            }
          }),
          ...(formData.endDate && {
            validityPeriod: {
              end: formData.endDate.toISOString()
            }
          })
        },
        substitution: {
          allowedBoolean: formData.genericSubstitution
        },
        ...(formData.indication && {
          reasonCode: [{
            text: formData.indication
          }]
        }),
        ...(formData.notes && {
          note: [{
            text: formData.notes,
            time: new Date().toISOString()
          }]
        })
      };

      await onSave(updatedMedicationRequest);
      handleClose();
    } catch (err) {
      console.error('Error saving medication:', err);
      const errorMessage = err instanceof Error ? err.message : 
                          (err as any)?.response?.data?.message || 
                          (err as any)?.response?.data?.detail || 
                          'Failed to update medication';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [medicationRequest, formData, patientId, onSave, handleClose]);

  const handleDelete = useCallback(async (): Promise<void> => {
    if (!medicationRequest?.id) return;

    if (window.confirm('Are you sure you want to delete this medication? This action cannot be undone.')) {
      try {
        setLoading(true);
        await onDelete(medicationRequest.id);
        handleClose();
      } catch (err) {
        console.error('Error deleting medication:', err);
        const errorMessage = err instanceof Error ? err.message : 
                            (err as any)?.response?.data?.message || 
                            (err as any)?.response?.data?.detail || 
                            'Failed to delete medication';
        setError(errorMessage);
        setLoading(false);
      }
    }
  }, [medicationRequest?.id, onDelete, handleClose]);

  const getMedicationDisplay = useCallback((): string => {
    if (formData.selectedMedication) {
      return formData.selectedMedication.display;
    }
    return formData.customMedication || 'No medication selected';
  }, [formData.selectedMedication, formData.customMedication]);

  const handleFormFieldChange = useCallback(<T extends keyof FormData>(
    field: T
  ) => (value: FormData[T]): void => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const handleSelectChange = useCallback((event: SelectChangeEvent<string>, field: keyof FormData): void => {
    handleFormFieldChange(field)(event.target.value as any);
  }, [handleFormFieldChange]);

  if (!medicationRequest) {
    return null;
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog 
        open={open} 
        onClose={handleClose}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { minHeight: '700px', ...sx }
        }}
      >
        <DialogTitle>
          Edit Medication
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Medication Request ID: {medicationRequest.id}
          </Typography>
        </DialogTitle>
        
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            {error && (
              <Alert severity="error" onClose={() => setError('')}>
                {error}
              </Alert>
            )}

            <Grid container spacing={3}>
              {/* Medication Selection */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Medication
                </Typography>
                <Autocomplete
                  options={medicationOptions}
                  getOptionLabel={(option) => option.display}
                  value={formData.selectedMedication}
                  loading={searchLoading}
                  isOptionEqualToValue={(option, value) => option.code === value.code}
                  onInputChange={(event, value) => {
                    setSearchQuery(value);
                    handleSearchMedications(value);
                  }}
                  onChange={(event, newValue) => {
                    setFormData(prev => ({
                      ...prev,
                      selectedMedication: newValue,
                      customMedication: '',
                      route: (newValue?.route as RouteCode) || 'oral'
                    }));
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Search for medication"
                      placeholder="Type to search medications..."
                      variant="outlined"
                      fullWidth
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
                  renderOption={(props, option) => (
                    <Box component="li" {...props}>
                      <Stack>
                        <Typography variant="body2">{option.display}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {option.code} • Route: {option.route} • Form: {option.form || 'N/A'}
                        </Typography>
                      </Stack>
                    </Box>
                  )}
                  noOptionsText={
                    searchQuery.length < 2 ? 
                    "Type at least 2 characters to search" : 
                    searchLoading ? "Searching..." : "No medications found"
                  }
                />
              </Grid>

              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Or enter a custom medication:
                </Typography>
                <TextField
                  fullWidth
                  label="Custom Medication"
                  value={formData.customMedication}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    customMedication: e.target.value,
                    selectedMedication: null
                  }))}
                  variant="outlined"
                />
              </Grid>

              <Grid item xs={12}>
                <Divider />
              </Grid>

              {/* Status and Priority */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Status & Priority
                </Typography>
              </Grid>

              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={formData.status}
                    label="Status"
                    onChange={(e) => handleSelectChange(e, 'status')}
                  >
                    {MEDICATION_STATUS.map(status => (
                      <MenuItem key={status.value} value={status.value}>
                        {status.display}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={formData.priority}
                    label="Priority"
                    onChange={(e) => handleSelectChange(e, 'priority')}
                  >
                    {PRIORITIES.map(priority => (
                      <MenuItem key={priority.value} value={priority.value}>
                        {priority.display}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <Divider />
              </Grid>

              {/* Dosing Information */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Dosing & Administration
                </Typography>
              </Grid>

              <Grid item xs={4}>
                <TextField
                  fullWidth
                  label="Dosage"
                  value={formData.dosage}
                  onChange={(e) => handleFormFieldChange('dosage')(e.target.value)}
                  placeholder="e.g., 10 mg, 1 tablet"
                  variant="outlined"
                  required
                />
              </Grid>

              <Grid item xs={4}>
                <FormControl fullWidth>
                  <InputLabel>Route</InputLabel>
                  <Select
                    value={formData.route}
                    label="Route"
                    onChange={(e) => handleSelectChange(e, 'route')}
                  >
                    {ROUTES.map(route => (
                      <MenuItem key={route.value} value={route.value}>
                        {route.display}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={4}>
                <FormControl fullWidth>
                  <InputLabel>Frequency</InputLabel>
                  <Select
                    value={formData.frequency}
                    label="Frequency"
                    onChange={(e) => handleSelectChange(e, 'frequency')}
                  >
                    {DOSING_FREQUENCIES.map(freq => (
                      <MenuItem key={freq.value} value={freq.value}>
                        {freq.display}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Special Instructions"
                  value={formData.instructions}
                  onChange={(e) => handleFormFieldChange('instructions')(e.target.value)}
                  placeholder="e.g., Take with food, Take in the morning"
                  variant="outlined"
                  multiline
                  rows={2}
                />
              </Grid>

              <Grid item xs={12}>
                <Divider />
              </Grid>

              {/* Prescription Details */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Prescription Details
                </Typography>
              </Grid>

              <Grid item xs={4}>
                <TextField
                  fullWidth
                  label="Quantity"
                  value={formData.quantity}
                  onChange={(e) => handleFormFieldChange('quantity')(e.target.value)}
                  placeholder="e.g., 30, 90"
                  variant="outlined"
                  required
                />
              </Grid>

              <Grid item xs={4}>
                <TextField
                  fullWidth
                  label="Refills"
                  type="number"
                  value={formData.refills}
                  onChange={(e) => handleFormFieldChange('refills')(parseInt(e.target.value) || 0)}
                  variant="outlined"
                  inputProps={{ min: 0, max: 12 }}
                />
              </Grid>

              <Grid item xs={4}>
                <TextField
                  fullWidth
                  label="Duration (days)"
                  value={formData.duration}
                  onChange={(e) => handleFormFieldChange('duration')(e.target.value)}
                  placeholder="e.g., 30, 90"
                  variant="outlined"
                />
              </Grid>

              <Grid item xs={6}>
                <DatePicker
                  label="Start Date"
                  value={formData.startDate}
                  onChange={(newValue) => handleFormFieldChange('startDate')(newValue)}
                  slotProps={{
                    textField: { fullWidth: true }
                  }}
                />
              </Grid>

              <Grid item xs={6}>
                <DatePicker
                  label="End Date (Optional)"
                  value={formData.endDate}
                  onChange={(newValue) => handleFormFieldChange('endDate')(newValue)}
                  slotProps={{
                    textField: { fullWidth: true }
                  }}
                  minDate={formData.startDate}
                />
              </Grid>

              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Indication"
                  value={formData.indication}
                  onChange={(e) => handleFormFieldChange('indication')(e.target.value)}
                  placeholder="Reason for prescription"
                  variant="outlined"
                />
              </Grid>

              <Grid item xs={6}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.genericSubstitution}
                      onChange={(e) => handleFormFieldChange('genericSubstitution')(e.target.checked)}
                    />
                  }
                  label="Allow generic substitution"
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Provider Notes"
                  value={formData.notes}
                  onChange={(e) => handleFormFieldChange('notes')(e.target.value)}
                  variant="outlined"
                  multiline
                  rows={3}
                  placeholder="Additional notes for pharmacy or patient..."
                />
              </Grid>
            </Grid>

            {/* Preview */}
            {(formData.selectedMedication || formData.customMedication) && formData.dosage && (
              <Box sx={{ p: 2, backgroundColor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Updated Prescription Preview:
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                  {getMedicationDisplay()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {formData.dosage} {formData.route} {DOSING_FREQUENCIES.find(f => f.value === formData.frequency)?.display}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <Chip 
                    label={formData.status} 
                    size="small" 
                    color={formData.status === 'active' ? 'success' : formData.status === 'cancelled' ? 'error' : 'default'}
                  />
                  <Chip label={`Qty: ${formData.quantity || 'Not specified'}`} size="small" />
                  <Chip label={`Refills: ${formData.refills}`} size="small" />
                  {formData.duration && <Chip label={`${formData.duration} days`} size="small" />}
                  <Chip 
                    label={formData.priority} 
                    size="small" 
                    color={formData.priority === 'stat' ? 'error' : formData.priority === 'urgent' ? 'warning' : 'default'}
                  />
                </Stack>
                {formData.instructions && (
                  <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                    Instructions: {formData.instructions}
                  </Typography>
                )}
              </Box>
            )}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
          <Button 
            onClick={handleDelete} 
            color="error" 
            disabled={loading}
            variant="outlined"
          >
            Delete Medication
          </Button>
          
          <Stack direction="row" spacing={1}>
            <Button onClick={handleClose} disabled={loading}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              variant="contained" 
              disabled={loading || ((!formData.selectedMedication && !formData.customMedication) || !formData.dosage || !formData.quantity)}
              startIcon={loading ? <CircularProgress size={20} /> : null}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export default EditMedicationDialog;