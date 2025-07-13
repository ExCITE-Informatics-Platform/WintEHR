/**
 * Editable Modal Component
 * Generic modal for creating and editing various clinical data types
 * 
 * Migrated to TypeScript with comprehensive type safety and FHIR R4 compliance.
 */

import React, { useState, useEffect, ChangeEvent } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Grid,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Box,
  Alert,
  CircularProgress,
  SelectChangeEvent,
  SxProps,
  Theme,
} from '@mui/material';
import { R4 } from '@ahryman40k/ts-fhir-types';
import api from '../services/api';

/**
 * Type definitions for EditableModal component
 */
export type EditableModalType = 'medication' | 'condition' | 'observation' | 'encounter';

export interface Provider {
  id: string;
  first_name: string;
  last_name: string;
  specialty: string;
}

export interface MedicationFormData {
  patient_id: string;
  encounter_id?: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  route: string;
  start_date: string;
  end_date?: string;
  status: string;
  prescriber_id: string;
}

export interface ConditionFormData {
  patient_id: string;
  icd10_code: string;
  description: string;
  clinical_status: string;
  verification_status: string;
  onset_date: string;
}

export interface ObservationFormData {
  patient_id: string;
  encounter_id?: string;
  observation_type?: string;
  code: string;
  display: string;
  value: string;
  unit: string;
  observation_date: string;
}

export interface EncounterFormData {
  patient_id: string;
  provider_id: string;
  location_id?: string;
  encounter_type: string;
  chief_complaint: string;
  notes: string;
  status: string;
  encounter_date: string;
}

export type FormData = MedicationFormData | ConditionFormData | ObservationFormData | EncounterFormData;

export interface EditableModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: any) => void | Promise<void>;
  type: EditableModalType;
  data?: Partial<FormData> | null;
  patientId: string;
  encounterId?: string | null;
  sx?: SxProps<Theme>;
}

/**
 * Constants
 */
const MEDICATION_FREQUENCIES = [
  'Once daily',
  'Twice daily', 
  'Three times daily',
  'Four times daily',
  'As needed',
  'Weekly'
] as const;

const MEDICATION_ROUTES = [
  'oral',
  'intravenous',
  'intramuscular', 
  'subcutaneous',
  'topical'
] as const;

const MEDICATION_STATUSES = [
  'active',
  'stopped',
  'completed'
] as const;

const CONDITION_CLINICAL_STATUSES = [
  'active',
  'resolved', 
  'inactive'
] as const;

const OBSERVATION_TYPES = [
  'laboratory',
  'vital-signs'
] as const;

const ENCOUNTER_TYPES = [
  'outpatient',
  'inpatient',
  'emergency',
  'virtual'
] as const;

const TYPE_NAMES: Record<EditableModalType, string> = {
  medication: 'Medication',
  condition: 'Condition',
  observation: 'Lab Result',
  encounter: 'Encounter'
};

/**
 * Helper functions
 */
const getEmptyFormData = (type: EditableModalType, patientId: string, encounterId?: string | null): FormData => {
  const baseDate = new Date().toISOString();
  
  switch (type) {
    case 'medication':
      return {
        patient_id: patientId,
        encounter_id: encounterId || undefined,
        medication_name: '',
        dosage: '',
        frequency: 'Once daily',
        route: 'oral',
        start_date: baseDate.split('T')[0],
        status: 'active',
        prescriber_id: ''
      } as MedicationFormData;
      
    case 'condition':
      return {
        patient_id: patientId,
        icd10_code: '',
        description: '',
        clinical_status: 'active',
        verification_status: 'confirmed',
        onset_date: baseDate.split('T')[0]
      } as ConditionFormData;
      
    case 'observation':
      return {
        patient_id: patientId,
        encounter_id: encounterId || undefined,
        code: '',
        display: '',
        value: '',
        unit: '',
        observation_date: baseDate
      } as ObservationFormData;
      
    case 'encounter':
      return {
        patient_id: patientId,
        provider_id: '',
        location_id: '',
        encounter_type: 'outpatient',
        chief_complaint: '',
        notes: '',
        status: 'finished',
        encounter_date: baseDate
      } as EncounterFormData;
      
    default:
      return {} as FormData;
  }
};

/**
 * EditableModal Component
 */
const EditableModal: React.FC<EditableModalProps> = ({
  open,
  onClose,
  onSave,
  type,
  data = null,
  patientId,
  encounterId = null,
  sx
}) => {
  const [formData, setFormData] = useState<FormData>({} as FormData);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);

  const isEditing = Boolean(data);

  useEffect(() => {
    if (open) {
      if (type === 'medication' || type === 'encounter') {
        fetchProviders();
      }
      resetForm();
    }
  }, [open, data, type, patientId, encounterId]);

  const fetchProviders = async (): Promise<void> => {
    try {
      const response = await api.get('/api/providers');
      setProviders(response.data || []);
    } catch (err) {
      console.error('Failed to fetch providers:', err);
      setProviders([]);
    }
  };

  const resetForm = (): void => {
    if (isEditing && data) {
      setFormData({ ...data } as FormData);
    } else {
      const emptyData = getEmptyFormData(type, patientId, encounterId);
      // Set default prescriber if available for medications
      if (type === 'medication' && providers.length > 0) {
        (emptyData as MedicationFormData).prescriber_id = providers[0].id;
      }
      // Set default provider if available for encounters
      if (type === 'encounter' && providers.length > 0) {
        (emptyData as EncounterFormData).provider_id = providers[0].id;
      }
      setFormData(emptyData);
    }
    setError(null);
  };

  const handleInputChange = (field: string, value: string): void => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleTextFieldChange = (field: string) => (event: ChangeEvent<HTMLInputElement>) => {
    handleInputChange(field, event.target.value);
  };

  const handleSelectChange = (field: string) => (event: SelectChangeEvent) => {
    handleInputChange(field, event.target.value);
  };

  const handleSave = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      let response;
      if (isEditing && data && 'id' in data) {
        // Update existing record
        response = await api.put(`/api/${type}s/${data.id}`, formData);
      } else {
        // Create new record
        response = await api.post(`/api/${type}s`, formData);
      }

      await onSave(response.data);
      onClose();
    } catch (err: any) {
      console.error(`Failed to ${isEditing ? 'update' : 'create'} ${type}:`, err);
      setError(err.response?.data?.detail || `Failed to ${isEditing ? 'update' : 'create'} ${type}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = (): void => {
    setError(null);
    onClose();
  };

  const renderMedicationForm = (): JSX.Element => {
    const medicationData = formData as MedicationFormData;
    
    return (
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Medication Name"
            value={medicationData.medication_name || ''}
            onChange={handleTextFieldChange('medication_name')}
            required
            disabled={loading}
          />
        </Grid>
        <Grid item xs={6}>
          <TextField
            fullWidth
            label="Dosage"
            value={medicationData.dosage || ''}
            onChange={handleTextFieldChange('dosage')}
            placeholder="e.g., 10mg"
            required
            disabled={loading}
          />
        </Grid>
        <Grid item xs={6}>
          <FormControl fullWidth disabled={loading}>
            <InputLabel>Frequency</InputLabel>
            <Select
              value={medicationData.frequency || 'Once daily'}
              onChange={handleSelectChange('frequency')}
              label="Frequency"
            >
              {MEDICATION_FREQUENCIES.map((freq) => (
                <MenuItem key={freq} value={freq}>
                  {freq}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={6}>
          <FormControl fullWidth disabled={loading}>
            <InputLabel>Route</InputLabel>
            <Select
              value={medicationData.route || 'oral'}
              onChange={handleSelectChange('route')}
              label="Route"
            >
              {MEDICATION_ROUTES.map((route) => (
                <MenuItem key={route} value={route}>
                  {route.charAt(0).toUpperCase() + route.slice(1)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={6}>
          <FormControl fullWidth disabled={loading}>
            <InputLabel>Status</InputLabel>
            <Select
              value={medicationData.status || 'active'}
              onChange={handleSelectChange('status')}
              label="Status"
            >
              {MEDICATION_STATUSES.map((status) => (
                <MenuItem key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={6}>
          <TextField
            fullWidth
            type="date"
            label="Start Date"
            InputLabelProps={{ shrink: true }}
            value={medicationData.start_date || ''}
            onChange={handleTextFieldChange('start_date')}
            required
            disabled={loading}
          />
        </Grid>
        <Grid item xs={6}>
          <TextField
            fullWidth
            type="date"
            label="End Date (Optional)"
            InputLabelProps={{ shrink: true }}
            value={medicationData.end_date || ''}
            onChange={handleTextFieldChange('end_date')}
            disabled={loading}
          />
        </Grid>
        {providers.length > 0 && (
          <Grid item xs={12}>
            <FormControl fullWidth disabled={loading}>
              <InputLabel>Prescriber</InputLabel>
              <Select
                value={medicationData.prescriber_id || ''}
                onChange={handleSelectChange('prescriber_id')}
                label="Prescriber"
              >
                {providers.map((provider) => (
                  <MenuItem key={provider.id} value={provider.id}>
                    Dr. {provider.first_name} {provider.last_name} - {provider.specialty}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        )}
      </Grid>
    );
  };

  const renderConditionForm = (): JSX.Element => {
    const conditionData = formData as ConditionFormData;
    
    return (
      <Grid container spacing={2}>
        <Grid item xs={4}>
          <TextField
            fullWidth
            label="ICD-10 Code"
            value={conditionData.icd10_code || ''}
            onChange={handleTextFieldChange('icd10_code')}
            placeholder="e.g., I10"
            required
            disabled={loading}
          />
        </Grid>
        <Grid item xs={8}>
          <TextField
            fullWidth
            label="Description"
            value={conditionData.description || ''}
            onChange={handleTextFieldChange('description')}
            placeholder="e.g., Essential hypertension"
            required
            disabled={loading}
          />
        </Grid>
        <Grid item xs={6}>
          <FormControl fullWidth disabled={loading}>
            <InputLabel>Clinical Status</InputLabel>
            <Select
              value={conditionData.clinical_status || 'active'}
              onChange={handleSelectChange('clinical_status')}
              label="Clinical Status"
            >
              {CONDITION_CLINICAL_STATUSES.map((status) => (
                <MenuItem key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={6}>
          <TextField
            fullWidth
            type="date"
            label="Onset Date"
            InputLabelProps={{ shrink: true }}
            value={conditionData.onset_date || ''}
            onChange={handleTextFieldChange('onset_date')}
            required
            disabled={loading}
          />
        </Grid>
      </Grid>
    );
  };

  const renderObservationForm = (): JSX.Element => {
    const observationData = formData as ObservationFormData;
    
    return (
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <FormControl fullWidth disabled={loading}>
            <InputLabel>Type</InputLabel>
            <Select
              value={observationData.observation_type || ''}
              onChange={handleSelectChange('observation_type')}
              label="Type"
            >
              {OBSERVATION_TYPES.map((obsType) => (
                <MenuItem key={obsType} value={obsType}>
                  {obsType.charAt(0).toUpperCase() + obsType.slice(1).replace('-', ' ')}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={6}>
          <TextField
            fullWidth
            label="Test Code"
            value={observationData.code || ''}
            onChange={handleTextFieldChange('code')}
            placeholder="e.g., 33747-0"
            required
            disabled={loading}
          />
        </Grid>
        <Grid item xs={8}>
          <TextField
            fullWidth
            label="Test Name"
            value={observationData.display || ''}
            onChange={handleTextFieldChange('display')}
            placeholder="e.g., Hemoglobin A1c"
            required
            disabled={loading}
          />
        </Grid>
        <Grid item xs={4}>
          <TextField
            fullWidth
            label="Value"
            value={observationData.value || ''}
            onChange={handleTextFieldChange('value')}
            placeholder="e.g., 7.2"
            required
            disabled={loading}
          />
        </Grid>
        <Grid item xs={6}>
          <TextField
            fullWidth
            label="Unit"
            value={observationData.unit || ''}
            onChange={handleTextFieldChange('unit')}
            placeholder="e.g., %"
            disabled={loading}
          />
        </Grid>
        <Grid item xs={6}>
          <TextField
            fullWidth
            type="datetime-local"
            label="Test Date"
            InputLabelProps={{ shrink: true }}
            value={observationData.observation_date?.slice(0, 16) || ''}
            onChange={(e) => handleInputChange('observation_date', e.target.value + ':00')}
            required
            disabled={loading}
          />
        </Grid>
      </Grid>
    );
  };

  const renderEncounterForm = (): JSX.Element => {
    const encounterData = formData as EncounterFormData;
    
    return (
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <FormControl fullWidth disabled={loading}>
            <InputLabel>Type</InputLabel>
            <Select
              value={encounterData.encounter_type || 'outpatient'}
              onChange={handleSelectChange('encounter_type')}
              label="Type"
            >
              {ENCOUNTER_TYPES.map((encType) => (
                <MenuItem key={encType} value={encType}>
                  {encType.charAt(0).toUpperCase() + encType.slice(1)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={6}>
          <TextField
            fullWidth
            type="datetime-local"
            label="Encounter Date"
            InputLabelProps={{ shrink: true }}
            value={encounterData.encounter_date?.slice(0, 16) || ''}
            onChange={(e) => handleInputChange('encounter_date', e.target.value + ':00')}
            required
            disabled={loading}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Chief Complaint"
            value={encounterData.chief_complaint || ''}
            onChange={handleTextFieldChange('chief_complaint')}
            placeholder="e.g., Follow-up for diabetes"
            required
            disabled={loading}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Clinical Notes"
            value={encounterData.notes || ''}
            onChange={handleTextFieldChange('notes')}
            placeholder="Enter clinical documentation..."
            disabled={loading}
          />
        </Grid>
        {providers.length > 0 && (
          <Grid item xs={12}>
            <FormControl fullWidth disabled={loading}>
              <InputLabel>Provider</InputLabel>
              <Select
                value={encounterData.provider_id || ''}
                onChange={handleSelectChange('provider_id')}
                label="Provider"
                required
              >
                {providers.map((provider) => (
                  <MenuItem key={provider.id} value={provider.id}>
                    Dr. {provider.first_name} {provider.last_name} - {provider.specialty}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        )}
      </Grid>
    );
  };

  const renderForm = (): JSX.Element => {
    switch (type) {
      case 'medication':
        return renderMedicationForm();
      case 'condition':
        return renderConditionForm();
      case 'observation':
        return renderObservationForm();
      case 'encounter':
        return renderEncounterForm();
      default:
        return <Alert severity="error">Unknown form type: {type}</Alert>;
    }
  };

  const getTitle = (): string => {
    const action = isEditing ? 'Edit' : 'Add';
    return `${action} ${TYPE_NAMES[type] || type}`;
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleCancel} 
      maxWidth="md" 
      fullWidth
      sx={sx}
      PaperProps={{
        sx: { minHeight: '400px' }
      }}
    >
      <DialogTitle>{getTitle()}</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {renderForm()}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel} disabled={loading}>
          Cancel
        </Button>
        <Button 
          onClick={handleSave} 
          variant="contained" 
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          {loading ? 'Saving...' : (isEditing ? 'Update' : 'Add')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default EditableModal;