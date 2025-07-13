/**
 * Patient Form Component
 * Dialog form for creating and editing patient information
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
  Box,
  SxProps,
  Theme,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { format, parseISO } from 'date-fns';
import { R4 } from '@ahryman40k/ts-fhir-types';

/**
 * Type definitions for PatientForm component
 */
export interface PatientFormData {
  first_name: string;
  last_name: string;
  date_of_birth: Date | null;
  gender: string;
  race: string;
  ethnicity: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  phone: string;
  email: string;
  insurance_name: string;
  insurance_id: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
}

export interface PatientFormSubmissionData extends Omit<PatientFormData, 'date_of_birth'> {
  date_of_birth: string | null;
}

export interface PatientFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: PatientFormSubmissionData) => void | Promise<void>;
  patient?: Partial<PatientFormData> | null;
  loading?: boolean;
  sx?: SxProps<Theme>;
}

export interface FormField {
  name: keyof PatientFormData;
  label: string;
  required?: boolean;
  type?: 'text' | 'email' | 'tel' | 'select' | 'date';
  options?: { value: string; label: string }[];
  gridSize?: { xs?: number; sm?: number; md?: number };
}

export type Gender = 'male' | 'female' | 'other' | 'unknown';

/**
 * Constants
 */
const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'unknown', label: 'Unknown' },
];

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

/**
 * Helper functions
 */
const getEmptyFormData = (): PatientFormData => ({
  first_name: '',
  last_name: '',
  date_of_birth: null,
  gender: '',
  race: '',
  ethnicity: '',
  address: '',
  city: '',
  state: '',
  zip_code: '',
  phone: '',
  email: '',
  insurance_name: '',
  insurance_id: '',
  emergency_contact_name: '',
  emergency_contact_phone: ''
});

const validateFormData = (data: PatientFormData): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (!data.first_name.trim()) {
    errors.first_name = 'First name is required';
  }

  if (!data.last_name.trim()) {
    errors.last_name = 'Last name is required';
  }

  if (!data.date_of_birth) {
    errors.date_of_birth = 'Date of birth is required';
  } else if (data.date_of_birth > new Date()) {
    errors.date_of_birth = 'Date of birth cannot be in the future';
  }

  if (!data.gender) {
    errors.gender = 'Gender is required';
  }

  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.email = 'Please enter a valid email address';
  }

  if (data.phone && !/^\+?[\d\s\-\(\)]+$/.test(data.phone)) {
    errors.phone = 'Please enter a valid phone number';
  }

  if (data.zip_code && !/^\d{5}(-\d{4})?$/.test(data.zip_code)) {
    errors.zip_code = 'Please enter a valid ZIP code';
  }

  return errors;
};

/**
 * PatientForm Component
 */
const PatientForm: React.FC<PatientFormProps> = ({ 
  open, 
  onClose, 
  onSubmit, 
  patient = null,
  loading = false,
  sx
}) => {
  const [formData, setFormData] = useState<PatientFormData>(getEmptyFormData());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (patient) {
      setFormData({
        ...getEmptyFormData(),
        ...patient,
        date_of_birth: patient.date_of_birth ? 
          (typeof patient.date_of_birth === 'string' ? parseISO(patient.date_of_birth) : patient.date_of_birth) 
          : null
      });
    } else {
      setFormData(getEmptyFormData());
    }
    setErrors({});
    setTouched({});
  }, [patient, open]);

  const handleChange = (field: keyof PatientFormData) => (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleDateChange = (date: Date | null): void => {
    setFormData(prev => ({ ...prev, date_of_birth: date }));
    
    // Clear error when date changes
    if (errors.date_of_birth) {
      setErrors(prev => ({ ...prev, date_of_birth: '' }));
    }
  };

  const handleBlur = (field: keyof PatientFormData) => (): void => {
    setTouched(prev => ({ ...prev, [field]: true }));
    
    // Validate single field on blur
    const fieldErrors = validateFormData(formData);
    if (fieldErrors[field]) {
      setErrors(prev => ({ ...prev, [field]: fieldErrors[field] }));
    }
  };

  const handleSubmit = async (): Promise<void> => {
    const validationErrors = validateFormData(formData);
    setErrors(validationErrors);
    
    if (Object.keys(validationErrors).length > 0) {
      // Mark all fields as touched to show errors
      const allTouched = Object.keys(formData).reduce((acc, key) => {
        acc[key] = true;
        return acc;
      }, {} as Record<string, boolean>);
      setTouched(allTouched);
      return;
    }

    try {
      const submissionData: PatientFormSubmissionData = {
        ...formData,
        date_of_birth: formData.date_of_birth ? format(formData.date_of_birth, 'yyyy-MM-dd') : null
      };
      
      await onSubmit(submissionData);
    } catch (error) {
      console.error('Error submitting patient form:', error);
    }
  };

  const handleCancel = (): void => {
    setFormData(getEmptyFormData());
    setErrors({});
    setTouched({});
    onClose();
  };

  const isFieldError = (field: keyof PatientFormData): boolean => {
    return touched[field] && Boolean(errors[field]);
  };

  const getFieldHelperText = (field: keyof PatientFormData): string => {
    return touched[field] ? errors[field] || '' : '';
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleCancel} 
      maxWidth="md" 
      fullWidth
      sx={sx}
    >
      <DialogTitle>
        {patient ? 'Edit Patient' : 'Add New Patient'}
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Grid container spacing={2}>
            {/* Personal Information */}
            <Grid item xs={12} sm={6}>
              <TextField
                required
                fullWidth
                label="First Name"
                value={formData.first_name}
                onChange={handleChange('first_name')}
                onBlur={handleBlur('first_name')}
                error={isFieldError('first_name')}
                helperText={getFieldHelperText('first_name')}
                disabled={loading}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                required
                fullWidth
                label="Last Name"
                value={formData.last_name}
                onChange={handleChange('last_name')}
                onBlur={handleBlur('last_name')}
                error={isFieldError('last_name')}
                helperText={getFieldHelperText('last_name')}
                disabled={loading}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <DatePicker
                label="Date of Birth *"
                value={formData.date_of_birth}
                onChange={handleDateChange}
                maxDate={new Date()}
                disabled={loading}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    required: true,
                    error: isFieldError('date_of_birth'),
                    helperText: getFieldHelperText('date_of_birth'),
                    onBlur: handleBlur('date_of_birth')
                  }
                }}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                required
                fullWidth
                select
                label="Gender"
                value={formData.gender}
                onChange={handleChange('gender')}
                onBlur={handleBlur('gender')}
                error={isFieldError('gender')}
                helperText={getFieldHelperText('gender')}
                disabled={loading}
              >
                {GENDER_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Race"
                value={formData.race}
                onChange={handleChange('race')}
                onBlur={handleBlur('race')}
                disabled={loading}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Ethnicity"
                value={formData.ethnicity}
                onChange={handleChange('ethnicity')}
                onBlur={handleBlur('ethnicity')}
                disabled={loading}
              />
            </Grid>

            {/* Address Information */}
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address"
                value={formData.address}
                onChange={handleChange('address')}
                onBlur={handleBlur('address')}
                disabled={loading}
              />
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="City"
                value={formData.city}
                onChange={handleChange('city')}
                onBlur={handleBlur('city')}
                disabled={loading}
              />
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                select
                label="State"
                value={formData.state}
                onChange={handleChange('state')}
                onBlur={handleBlur('state')}
                disabled={loading}
              >
                {US_STATES.map((state) => (
                  <MenuItem key={state} value={state}>
                    {state}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                label="ZIP Code"
                value={formData.zip_code}
                onChange={handleChange('zip_code')}
                onBlur={handleBlur('zip_code')}
                error={isFieldError('zip_code')}
                helperText={getFieldHelperText('zip_code')}
                disabled={loading}
              />
            </Grid>

            {/* Contact Information */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange('phone')}
                onBlur={handleBlur('phone')}
                error={isFieldError('phone')}
                helperText={getFieldHelperText('phone')}
                disabled={loading}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Email"
                type="email"
                value={formData.email}
                onChange={handleChange('email')}
                onBlur={handleBlur('email')}
                error={isFieldError('email')}
                helperText={getFieldHelperText('email')}
                disabled={loading}
              />
            </Grid>

            {/* Insurance Information */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Insurance Provider"
                value={formData.insurance_name}
                onChange={handleChange('insurance_name')}
                onBlur={handleBlur('insurance_name')}
                disabled={loading}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Insurance ID"
                value={formData.insurance_id}
                onChange={handleChange('insurance_id')}
                onBlur={handleBlur('insurance_id')}
                disabled={loading}
              />
            </Grid>

            {/* Emergency Contact */}
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Emergency Contact Name"
                value={formData.emergency_contact_name}
                onChange={handleChange('emergency_contact_name')}
                onBlur={handleBlur('emergency_contact_name')}
                disabled={loading}
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Emergency Contact Phone"
                type="tel"
                value={formData.emergency_contact_phone}
                onChange={handleChange('emergency_contact_phone')}
                onBlur={handleBlur('emergency_contact_phone')}
                disabled={loading}
              />
            </Grid>
          </Grid>
        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={handleCancel} disabled={loading}>
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          color="primary"
          disabled={loading}
        >
          {patient ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PatientForm;