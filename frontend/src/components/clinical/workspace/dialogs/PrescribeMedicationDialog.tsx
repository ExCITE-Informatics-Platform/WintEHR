/**
 * Prescribe Medication Dialog Component
 * Allows prescribing new medications to patient
 * 
 * Migrated to TypeScript with comprehensive type safety for medication prescribing.
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
  Divider,
  FormControlLabel,
  Checkbox,
  SxProps,
  Theme,
  SelectChangeEvent,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import { MedicationRequest } from '@ahryman40k/ts-fhir-types/lib/R4';
import { searchService } from '../../../../services/searchService';
import { cdsHooksClient } from '../../../../services/cdsHooksClient';

/**
 * Type definitions for PrescribeMedicationDialog component
 */
export type DosingFrequency = 'once-daily' | 'twice-daily' | 'three-times-daily' | 'four-times-daily' | 'every-other-day' | 'weekly' | 'as-needed';

export type MedicationRoute = 'oral' | 'topical' | 'injection' | 'inhalation' | 'sublingual' | 'rectal';

export type PrescriptionPriority = 'routine' | 'urgent' | 'asap' | 'stat';

export type CDSIndicator = 'info' | 'warning' | 'critical';

export interface DosingFrequencyOption {
  value: DosingFrequency;
  display: string;
}

export interface RouteOption {
  value: MedicationRoute;
  display: string;
}

export interface MedicationOption {
  id: string;
  display: string;
  name: string;
  code: string;
  coding?: Array<{
    system: string;
    code: string;
    display: string;
  }>;
  route?: MedicationRoute;
  form?: string;
  strength?: string;
}

export interface CDSAlert {
  uuid?: string;
  summary: string;
  detail: string;
  indicator: CDSIndicator;
  suggestions?: CDSSuggestion[];
  links?: CDSLink[];
  serviceId: string;
  serviceName: string;
  timestamp: Date;
}

export interface CDSSuggestion {
  uuid?: string;
  label: string;
  actions?: any[];
}

export interface CDSLink {
  label: string;
  url: string;
  type?: string;
}

export interface CDSService {
  id: string;
  hook: string;
  title?: string;
  description?: string;
}

export interface PrescriptionFormData {
  selectedMedication: MedicationOption | null;
  customMedication: string;
  dosage: string;
  route: MedicationRoute;
  frequency: DosingFrequency;
  duration: string;
  quantity: string;
  refills: number;
  startDate: Date;
  endDate: Date | null;
  instructions: string;
  indication: string;
  priority: PrescriptionPriority;
  genericSubstitution: boolean;
  notes: string;
}

export interface PrescribeMedicationDialogProps {
  open: boolean;
  onClose: () => void;
  onPrescribe: (medicationRequest: MedicationRequest) => Promise<void>;
  patientId: string;
  sx?: SxProps<Theme>;
}

/**
 * Constants and configuration
 */
const DOSING_FREQUENCIES: DosingFrequencyOption[] = [
  { value: 'once-daily', display: 'Once daily' },
  { value: 'twice-daily', display: 'Twice daily' },
  { value: 'three-times-daily', display: 'Three times daily' },
  { value: 'four-times-daily', display: 'Four times daily' },
  { value: 'every-other-day', display: 'Every other day' },
  { value: 'weekly', display: 'Weekly' },
  { value: 'as-needed', display: 'As needed' },
];

const ROUTES: RouteOption[] = [
  { value: 'oral', display: 'Oral' },
  { value: 'topical', display: 'Topical' },
  { value: 'injection', display: 'Injection' },
  { value: 'inhalation', display: 'Inhalation' },
  { value: 'sublingual', display: 'Sublingual' },
  { value: 'rectal', display: 'Rectal' },
];

/**
 * Helper functions
 */
const createDefaultFormData = (): PrescriptionFormData => ({
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
  genericSubstitution: true,
  notes: '',
});

const createMedicationRequest = (
  formData: PrescriptionFormData,
  patientId: string
): MedicationRequest => {
  const frequencyOption = DOSING_FREQUENCIES.find(f => f.value === formData.frequency);
  const routeOption = ROUTES.find(r => r.value === formData.route);

  return {
    resourceType: 'MedicationRequest',
    id: `medication-request-${Date.now()}`,
    status: 'active',
    intent: 'order',
    priority: formData.priority,
    medicationCodeableConcept: formData.selectedMedication ? {
      coding: [{
        system: 'http://www.nlm.nih.gov/research/umls/rxnorm',
        code: formData.selectedMedication.code.replace('RxNorm:', ''),
        display: formData.selectedMedication.display,
      }],
      text: formData.selectedMedication.display,
    } : {
      text: formData.customMedication,
    },
    subject: {
      reference: `Patient/${patientId}`,
    },
    authoredOn: new Date().toISOString(),
    dosageInstruction: [{
      text: formData.instructions || `${formData.dosage} ${formData.frequency}`,
      timing: {
        code: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/v3-GTSAbbreviation',
            code: formData.frequency,
            display: frequencyOption?.display,
          }],
        },
      },
      route: {
        coding: [{
          system: 'http://snomed.info/sct',
          code: formData.route,
          display: routeOption?.display,
        }],
      },
      doseAndRate: [{
        doseQuantity: {
          value: parseFloat(formData.dosage) || 1,
          unit: 'dose',
        },
      }],
    }],
    dispenseRequest: {
      numberOfRepeatsAllowed: formData.refills,
      quantity: {
        value: parseFloat(formData.quantity) || 30,
        unit: 'dose',
      },
      ...(formData.duration && {
        expectedSupplyDuration: {
          value: parseFloat(formData.duration),
          unit: 'days',
        },
      }),
    },
    substitution: {
      allowedBoolean: formData.genericSubstitution,
    },
    ...(formData.indication && {
      reasonCode: [{
        text: formData.indication,
      }],
    }),
    ...(formData.notes && {
      note: [{
        text: formData.notes,
        time: new Date().toISOString(),
      }],
    }),
  };
};

const getAlertSeverity = (indicator: CDSIndicator): 'error' | 'warning' | 'info' => {
  switch (indicator) {
    case 'critical': return 'error';
    case 'warning': return 'warning';
    case 'info': return 'info';
    default: return 'info';
  }
};

const getPriorityColor = (priority: PrescriptionPriority): 'default' | 'warning' | 'error' => {
  switch (priority) {
    case 'stat': return 'error';
    case 'urgent': case 'asap': return 'warning';
    default: return 'default';
  }
};

/**
 * PrescribeMedicationDialog Component
 */
const PrescribeMedicationDialog: React.FC<PrescribeMedicationDialogProps> = ({ 
  open, 
  onClose, 
  onPrescribe, 
  patientId,
  sx 
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  const [medicationOptions, setMedicationOptions] = useState<MedicationOption[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cdsAlerts, setCdsAlerts] = useState<CDSAlert[]>([]);
  const [cdsLoading, setCdsLoading] = useState<boolean>(false);
  const [formData, setFormData] = useState<PrescriptionFormData>(createDefaultFormData());

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
    } catch (searchError) {
      console.error('Error searching medications:', searchError);
      setMedicationOptions([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  // Check for CDS alerts when medication selection changes
  const checkCDSHooks = useCallback(async (medication: MedicationOption): Promise<void> => {
    if (!medication || !patientId) {
      setCdsAlerts([]);
      return;
    }

    setCdsLoading(true);
    try {
      // Get available medication-prescribe services
      const services: CDSService[] = await cdsHooksClient.discoverServices();
      const medicationServices = services.filter(s => s.hook === 'medication-prescribe');
      
      const allAlerts: CDSAlert[] = [];
      
      for (const service of medicationServices) {
        try {
          const response = await cdsHooksClient.callService(service.id, {
            hook: 'medication-prescribe',
            hookInstance: `prescribe-${Date.now()}`,
            context: {
              patientId: patientId,
              medications: {
                new: [{
                  resourceType: 'MedicationRequest',
                  medicationCodeableConcept: {
                    text: medication.display || medication.name,
                    coding: medication.coding || [],
                  },
                }],
              },
            },
          });
          
          if (response.cards) {
            allAlerts.push(...response.cards.map((card: any) => ({
              ...card,
              serviceId: service.id,
              serviceName: service.title || service.id,
              timestamp: new Date(),
            })));
          }
        } catch (serviceError) {
          console.error(`Error calling CDS service ${service.id}:`, serviceError);
        }
      }
      
      setCdsAlerts(allAlerts);
    } catch (error) {
      console.error('Error checking CDS hooks:', error);
    } finally {
      setCdsLoading(false);
    }
  }, [patientId]);

  const handleReset = useCallback((): void => {
    setFormData(createDefaultFormData());
    setError('');
    setMedicationOptions([]);
    setSearchQuery('');
    setCdsAlerts([]);
  }, []);

  const handleClose = useCallback((): void => {
    handleReset();
    onClose();
  }, [handleReset, onClose]);

  const updateFormData = useCallback((updates: Partial<PrescriptionFormData>): void => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  const handleSubmit = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError('');

      // Validate required fields
      if (!formData.selectedMedication && !formData.customMedication) {
        setError('Please select a medication or enter a custom medication');
        return;
      }

      if (!formData.dosage) {
        setError('Please specify the dosage');
        return;
      }

      if (!formData.quantity) {
        setError('Please specify the quantity to dispense');
        return;
      }

      // Create FHIR MedicationRequest resource
      const medicationRequest = createMedicationRequest(formData, patientId);

      // Call the onPrescribe callback with the new medication request
      await onPrescribe(medicationRequest);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to prescribe medication');
    } finally {
      setLoading(false);
    }
  }, [formData, patientId, onPrescribe, handleClose]);

  const getMedicationDisplay = useCallback((): string => {
    if (formData.selectedMedication) {
      return formData.selectedMedication.display;
    }
    return formData.customMedication || 'No medication selected';
  }, [formData.selectedMedication, formData.customMedication]);

  const handleMedicationChange = useCallback((
    _event: React.SyntheticEvent,
    newValue: MedicationOption | null
  ): void => {
    updateFormData({
      selectedMedication: newValue,
      customMedication: '',
      route: newValue?.route || 'oral',
    });
    
    // Check CDS hooks when medication is selected
    if (newValue) {
      checkCDSHooks(newValue);
    } else {
      setCdsAlerts([]);
    }
  }, [updateFormData, checkCDSHooks]);

  const handleInputChange = useCallback((
    _event: React.SyntheticEvent,
    value: string
  ): void => {
    setSearchQuery(value);
    handleSearchMedications(value);
  }, [handleSearchMedications]);

  const handleSelectChange = useCallback((field: keyof PrescriptionFormData) => (
    event: SelectChangeEvent<string>
  ): void => {
    updateFormData({ [field]: event.target.value });
  }, [updateFormData]);

  const handleTextFieldChange = useCallback((field: keyof PrescriptionFormData) => (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    const value = field === 'refills' ? parseInt(event.target.value) || 0 : event.target.value;
    updateFormData({ [field]: value });
  }, [updateFormData]);

  const handleCheckboxChange = useCallback((field: keyof PrescriptionFormData) => (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    updateFormData({ [field]: event.target.checked });
  }, [updateFormData]);

  const isFormValid = useCallback((): boolean => {
    return Boolean(
      (formData.selectedMedication || formData.customMedication) &&
      formData.dosage &&
      formData.quantity
    );
  }, [formData.selectedMedication, formData.customMedication, formData.dosage, formData.quantity]);

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
          <Typography variant="h6">Prescribe Medication</Typography>
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
                  onInputChange={handleInputChange}
                  onChange={handleMedicationChange}
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
                  onChange={(e) => updateFormData({
                    customMedication: e.target.value,
                    selectedMedication: null,
                  })}
                  variant="outlined"
                />
              </Grid>

              {/* CDS Alerts */}
              {(cdsLoading || cdsAlerts.length > 0) && (
                <Grid item xs={12}>
                  <Typography variant="h6" gutterBottom>
                    Clinical Decision Support
                  </Typography>
                  {cdsLoading && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <CircularProgress size={16} />
                      <Typography variant="body2" color="text.secondary">
                        Checking for drug interactions and alerts...
                      </Typography>
                    </Box>
                  )}
                  {cdsAlerts.map((alert, index) => (
                    <Alert 
                      key={index}
                      severity={getAlertSeverity(alert.indicator)}
                      sx={{ mb: 1 }}
                      action={
                        alert.suggestions && alert.suggestions.length > 0 ? (
                          <Button size="small" variant="outlined">
                            View Actions
                          </Button>
                        ) : undefined
                      }
                    >
                      <Typography variant="subtitle2" gutterBottom>
                        {alert.summary}
                      </Typography>
                      <Typography variant="body2">
                        {alert.detail}
                      </Typography>
                      {alert.suggestions && alert.suggestions.length > 0 && (
                        <Box sx={{ mt: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            Suggested actions available
                          </Typography>
                        </Box>
                      )}
                    </Alert>
                  ))}
                </Grid>
              )}

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
                  onChange={handleTextFieldChange('dosage')}
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
                    onChange={handleSelectChange('route')}
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
                    onChange={handleSelectChange('frequency')}
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
                  onChange={handleTextFieldChange('instructions')}
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
                  onChange={handleTextFieldChange('quantity')}
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
                  onChange={handleTextFieldChange('refills')}
                  variant="outlined"
                  inputProps={{ min: 0, max: 12 }}
                />
              </Grid>

              <Grid item xs={4}>
                <TextField
                  fullWidth
                  label="Duration (days)"
                  value={formData.duration}
                  onChange={handleTextFieldChange('duration')}
                  placeholder="e.g., 30, 90"
                  variant="outlined"
                />
              </Grid>

              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Indication"
                  value={formData.indication}
                  onChange={handleTextFieldChange('indication')}
                  placeholder="Reason for prescription"
                  variant="outlined"
                />
              </Grid>

              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={formData.priority}
                    label="Priority"
                    onChange={handleSelectChange('priority')}
                  >
                    <MenuItem value="routine">Routine</MenuItem>
                    <MenuItem value="urgent">Urgent</MenuItem>
                    <MenuItem value="asap">ASAP</MenuItem>
                    <MenuItem value="stat">STAT</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.genericSubstitution}
                      onChange={handleCheckboxChange('genericSubstitution')}
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
                  onChange={handleTextFieldChange('notes')}
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
                  Prescription Preview:
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                  {getMedicationDisplay()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {formData.dosage} {formData.route} {DOSING_FREQUENCIES.find(f => f.value === formData.frequency)?.display}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <Chip label={`Qty: ${formData.quantity || 'Not specified'}`} size="small" />
                  <Chip label={`Refills: ${formData.refills}`} size="small" />
                  {formData.duration && <Chip label={`${formData.duration} days`} size="small" />}
                  <Chip 
                    label={formData.priority} 
                    size="small" 
                    color={getPriorityColor(formData.priority)}
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

        <DialogActions>
          <Button onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            variant="contained" 
            disabled={loading || !isFormValid()}
            startIcon={loading ? <CircularProgress size={20} /> : null}
          >
            {loading ? 'Prescribing...' : 'Prescribe'}
          </Button>
        </DialogActions>
      </Dialog>
    </LocalizationProvider>
  );
};

export default PrescribeMedicationDialog;