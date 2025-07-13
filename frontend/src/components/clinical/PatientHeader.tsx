/**
 * Patient Header Component
 * Displays patient information and context across the clinical workspace
 * 
 * Migrated to TypeScript with comprehensive type safety for patient data management.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Chip,
  IconButton,
  Button,
  Tooltip,
  Alert,
  Stack,
  Select,
  MenuItem,
  FormControl,
  Divider,
  SelectChangeEvent,
  SxProps,
  Theme,
} from '@mui/material';
import {
  Warning as WarningIcon,
  LocalHospital as HospitalIcon,
  EventNote as EventNoteIcon,
  Assignment as AssignmentIcon,
  Close as CloseIcon,
  Info as InfoIcon,
  ArrowDropDown as ArrowDropDownIcon,
} from '@mui/icons-material';
import { format, differenceInYears } from 'date-fns';
import { useClinical } from '../../contexts/ClinicalContext';
import { useNavigate } from 'react-router-dom';
import { fhirClient } from '../../services/fhirClient';
import { providerService } from '../../services/providerService';
import { 
  Patient as FHIRPatient,
  Encounter as FHIREncounter,
  AllergyIntolerance,
  Condition,
  MedicationRequest 
} from '@ahryman40k/ts-fhir-types/lib/R4';

/**
 * Type definitions for PatientHeader component
 */
export type EncounterStatus = 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled' | 'entered-in-error' | 'unknown';
export type AllergyStatus = 'active' | 'inactive' | 'resolved';
export type ProblemStatus = 'active' | 'recurrence' | 'relapse' | 'inactive' | 'remission' | 'resolved';
export type MedicationStatus = 'active' | 'on-hold' | 'cancelled' | 'completed' | 'entered-in-error' | 'stopped' | 'draft' | 'unknown';
export type AllergySeverity = 'mild' | 'moderate' | 'severe';
export type CodeStatus = 'full-code' | 'dnr' | 'dni' | 'comfort-care' | 'limited-interventions';

export interface PatientDemographics {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: string;
  mrn?: string;
  phone?: string;
  email?: string;
  address?: {
    line?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
}

export interface AllergyInfo {
  id: string;
  allergen: string;
  reaction?: string;
  severity?: AllergySeverity;
  status: AllergyStatus;
  onset?: string;
  lastOccurrence?: string;
  notes?: string;
}

export interface ProblemInfo {
  id: string;
  condition: string;
  code?: string;
  clinicalStatus: ProblemStatus;
  verificationStatus?: string;
  severity?: string;
  onset?: string;
  recordedDate?: string;
  notes?: string;
}

export interface MedicationInfo {
  id: string;
  medication: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  status: MedicationStatus;
  prescribedDate?: string;
  lastFilled?: string;
  prescriber?: string;
}

export interface EncounterInfo {
  id: string;
  patient_id: string;
  encounter_type: string;
  encounter_date: string;
  start_date: string;
  end_date?: string;
  status: EncounterStatus;
  encounter_class?: string;
  provider?: string;
  provider_id?: string;
  location?: string;
  reason?: string;
  diagnosis?: string[];
}

export interface PatientInfo extends PatientDemographics {
  allergies?: AllergyInfo[];
  problems?: ProblemInfo[];
  medications?: MedicationInfo[];
  codeStatus?: CodeStatus;
  primaryProvider?: string;
  primaryProviderPhone?: string;
  emergencyContact?: {
    name: string;
    relationship: string;
    phone: string;
  };
  insurance?: {
    primary?: string;
    secondary?: string;
    memberId?: string;
  };
}

export interface ClinicalContextType {
  currentPatient: PatientInfo | null;
  currentEncounter: EncounterInfo | null;
  setCurrentEncounter: (encounter: EncounterInfo | null) => void;
  clearClinicalContext: () => void;
}

export interface ProviderInfo {
  id: string;
  name: string;
  npi?: string;
  specialty?: string;
  phone?: string;
  email?: string;
}

export interface PatientHeaderProps {
  onClose?: () => void;
  showEncounterInfo?: boolean;
  sx?: SxProps<Theme>;
}

export interface FHIRSearchResult {
  resources: FHIREncounter[];
  total?: number;
}

/**
 * Helper functions
 */
const calculateAge = (dob?: string): string | number => {
  if (!dob) return 'Unknown';
  try {
    const date = new Date(dob);
    if (isNaN(date.getTime())) return 'Unknown';
    return differenceInYears(new Date(), date);
  } catch (error) {
    console.error('Error calculating age:', error);
    return 'Unknown';
  }
};

const formatDate = (dateString?: string, formatStr: string = 'MM/dd/yyyy'): string => {
  if (!dateString) return 'Unknown';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Unknown';
    return format(date, formatStr);
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Unknown';
  }
};

const formatMRN = (mrn?: string): string => {
  if (!mrn) return 'No MRN';
  try {
    // Format MRN for display (e.g., XXX-XX-XXXX)
    const cleanMRN = mrn.replace(/\D/g, '');
    if (cleanMRN.length === 9) {
      return cleanMRN.replace(/(\d{3})(\d{2})(\d{4})/, '$1-$2-$3');
    }
    return mrn; // Return as-is if not 9 digits
  } catch (error) {
    console.error('Error formatting MRN:', error);
    return mrn;
  }
};

const transformFHIREncounter = async (enc: FHIREncounter, patientId: string): Promise<EncounterInfo> => {
  const type = enc.type?.[0];
  const period = enc.period || {};
  
  // Resolve provider information
  const provider = await providerService.resolveProviderFromEncounter(enc);
  const providerName = providerService.getProviderDisplayName(provider);
  
  return {
    id: enc.id || '',
    patient_id: patientId,
    encounter_type: type?.text || type?.coding?.[0]?.display || 'Unknown',
    encounter_date: period.start || enc.meta?.lastUpdated || new Date().toISOString(),
    start_date: period.start || enc.meta?.lastUpdated || new Date().toISOString(),
    end_date: period.end,
    status: (enc.status as EncounterStatus) || 'unknown',
    encounter_class: enc.class_?.code || enc.class_?.display || 'AMB',
    provider: providerName,
    provider_id: provider?.id || null,
    location: enc.location?.[0]?.location?.display,
    reason: enc.reasonCode?.[0]?.text || enc.reasonCode?.[0]?.coding?.[0]?.display
  };
};

/**
 * PatientHeader Component
 */
const PatientHeader: React.FC<PatientHeaderProps> = ({ 
  onClose, 
  showEncounterInfo = true,
  sx 
}) => {
  const navigate = useNavigate();
  const { currentPatient, currentEncounter, setCurrentEncounter, clearClinicalContext } = useClinical() as ClinicalContextType;
  const [encounters, setEncounters] = useState<EncounterInfo[]>([]);
  const [loadingEncounters, setLoadingEncounters] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadEncounters = useCallback(async (): Promise<void> => {
    if (!currentPatient?.id) return;

    setLoadingEncounters(true);
    setError(null);

    try {
      // Fetch encounters using FHIR
      const result: FHIRSearchResult = await fhirClient.getEncounters(currentPatient.id);
      
      // Transform and sort encounters with proper provider resolution
      const transformedEncounters = await Promise.all(
        result.resources.map(async (enc: FHIREncounter) => 
          transformFHIREncounter(enc, currentPatient.id)
        )
      );
      
      // Sort by date descending and take top 10
      const encounterList = transformedEncounters
        .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
        .slice(0, 10);
      
      setEncounters(encounterList);
      
      // If no encounter is currently selected and we have encounters, select the most recent one
      if (!currentEncounter && encounterList.length > 0) {
        setCurrentEncounter(encounterList[0]);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load encounters';
      setError(errorMessage);
      console.error('Error loading encounters:', error);
      setEncounters([]);
    } finally {
      setLoadingEncounters(false);
    }
  }, [currentPatient?.id, currentEncounter, setCurrentEncounter]);

  useEffect(() => {
    if (currentPatient && showEncounterInfo) {
      loadEncounters();
    }
  }, [currentPatient?.id, showEncounterInfo, loadEncounters]);

  const handleEncounterChange = useCallback(async (event: SelectChangeEvent<string>): Promise<void> => {
    const encounterId = event.target.value;
    
    try {
      if (encounterId === 'new') {
        navigate(`/patients/${currentPatient?.id}/encounters/new`);
        return;
      }
      
      const encounter = encounters.find(e => e.id === encounterId);
      if (encounter) {
        setCurrentEncounter(encounter);
      } else if (!encounterId) {
        setCurrentEncounter(null);
      }
    } catch (error) {
      console.error('Error changing encounter:', error);
      setError('Failed to change encounter');
    }
  }, [encounters, currentPatient?.id, navigate, setCurrentEncounter]);

  const handleClose = useCallback((): void => {
    clearClinicalContext();
    if (onClose) {
      onClose();
    } else {
      navigate('/patients');
    }
  }, [clearClinicalContext, onClose, navigate]);

  const getAllergyCount = useCallback((): number => {
    return currentPatient?.allergies?.filter(a => a.status === 'active').length || 0;
  }, [currentPatient?.allergies]);

  const getProblemCount = useCallback((): number => {
    return currentPatient?.problems?.filter(p => p.clinicalStatus === 'active').length || 0;
  }, [currentPatient?.problems]);

  const getMedicationCount = useCallback((): number => {
    return currentPatient?.medications?.filter(m => m.status === 'active').length || 0;
  }, [currentPatient?.medications]);

  const getSevereAllergies = useCallback((): AllergyInfo[] => {
    return currentPatient?.allergies?.filter(a => a.severity === 'severe') || [];
  }, [currentPatient?.allergies]);

  const handleAllergyClick = useCallback((): void => {
    if (currentPatient?.id) {
      navigate(`/patients/${currentPatient.id}/allergies`);
    }
  }, [currentPatient?.id, navigate]);

  const handleProblemClick = useCallback((): void => {
    if (currentPatient?.id) {
      navigate(`/patients/${currentPatient.id}/problems`);
    }
  }, [currentPatient?.id, navigate]);

  const handleMedicationClick = useCallback((): void => {
    if (currentPatient?.id) {
      navigate(`/patients/${currentPatient.id}/medications`);
    }
  }, [currentPatient?.id, navigate]);

  if (!currentPatient) {
    return null;
  }

  const allergyCount = getAllergyCount();
  const problemCount = getProblemCount();
  const medicationCount = getMedicationCount();
  const severeAllergies = getSevereAllergies();

  return (
    <Paper 
      elevation={2} 
      sx={{ 
        p: 2, 
        mb: 2,
        backgroundColor: 'background.paper',
        borderRadius: 2,
        ...sx
      }}
    >
      {error && (
        <Alert 
          severity="error" 
          sx={{ mb: 2 }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      <Grid container spacing={2} alignItems="center">
        {/* Patient Demographics */}
        <Grid item xs={12} md={4}>
          <Box display="flex" alignItems="center" gap={1}>
            <HospitalIcon color="primary" />
            <Box>
              <Typography variant="h6" fontWeight="bold">
                {currentPatient.lastName}, {currentPatient.firstName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                MRN: {formatMRN(currentPatient.mrn)} | 
                DOB: {formatDate(currentPatient.dateOfBirth)} | 
                Age: {calculateAge(currentPatient.dateOfBirth)} | 
                {currentPatient.gender || 'Unknown'}
              </Typography>
            </Box>
          </Box>
        </Grid>

        {/* Clinical Alerts */}
        <Grid item xs={12} md={4}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            {allergyCount > 0 && (
              <Tooltip title={`${allergyCount} active allergies`}>
                <Chip
                  icon={<WarningIcon />}
                  label={`Allergies: ${allergyCount}`}
                  color="error"
                  size="small"
                  onClick={handleAllergyClick}
                  clickable
                />
              </Tooltip>
            )}
            
            {problemCount > 0 && (
              <Tooltip title={`${problemCount} active problems`}>
                <Chip
                  icon={<EventNoteIcon />}
                  label={`Problems: ${problemCount}`}
                  color="warning"
                  size="small"
                  onClick={handleProblemClick}
                  clickable
                />
              </Tooltip>
            )}
            
            {medicationCount > 0 && (
              <Tooltip title={`${medicationCount} active medications`}>
                <Chip
                  icon={<AssignmentIcon />}
                  label={`Meds: ${medicationCount}`}
                  color="info"
                  size="small"
                  onClick={handleMedicationClick}
                  clickable
                />
              </Tooltip>
            )}
          </Stack>
        </Grid>

        {/* Encounter Info & Actions */}
        <Grid item xs={12} md={4}>
          <Box display="flex" alignItems="center" justifyContent="flex-end" gap={1}>
            {showEncounterInfo && (
              <FormControl size="small" sx={{ minWidth: 200 }}>
                <Select
                  value={currentEncounter?.id || ''}
                  onChange={handleEncounterChange}
                  displayEmpty
                  disabled={loadingEncounters}
                  IconComponent={ArrowDropDownIcon}
                  sx={{
                    '& .MuiSelect-select': {
                      py: 1,
                      display: 'flex',
                      alignItems: 'center'
                    }
                  }}
                  aria-label="Select encounter"
                >
                  <MenuItem value="">
                    <em>No Encounter Selected</em>
                  </MenuItem>
                  {encounters.map((encounter) => (
                    <MenuItem key={encounter.id} value={encounter.id}>
                      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '14px' }}>
                          {encounter.encounter_type || 'Visit'} - {formatDate(encounter.encounter_date, 'MM/dd/yyyy')}
                        </span>
                        <span style={{ fontSize: '12px', color: 'rgba(0, 0, 0, 0.6)' }}>
                          Status: {encounter.status || 'in-progress'} | Class: {encounter.encounter_class || 'AMB'}
                        </span>
                      </Box>
                    </MenuItem>
                  ))}
                  <Divider />
                  <MenuItem value="new">
                    <Typography variant="body2" color="primary">
                      + Start New Encounter
                    </Typography>
                  </MenuItem>
                </Select>
              </FormControl>
            )}
            
            <IconButton 
              size="small" 
              onClick={handleClose}
              sx={{ ml: 1 }}
              aria-label="Close patient header"
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </Grid>
      </Grid>

      {/* Additional Alerts */}
      {severeAllergies.length > 0 && (
        <Alert 
          severity="error" 
          sx={{ mt: 2 }}
          icon={<WarningIcon />}
        >
          <Typography variant="body2">
            <strong>Severe Allergies:</strong> {severeAllergies.map(a => a.allergen).join(', ')}
          </Typography>
        </Alert>
      )}

      {/* Code Status or other critical info */}
      {currentPatient.codeStatus && currentPatient.codeStatus !== 'full-code' && (
        <Alert 
          severity="warning" 
          sx={{ mt: 1 }}
          icon={<InfoIcon />}
        >
          <Typography variant="body2">
            <strong>Code Status:</strong> {currentPatient.codeStatus}
          </Typography>
        </Alert>
      )}
    </Paper>
  );
};

export default PatientHeader;