/**
 * EncounterDetail Component
 * Detailed view of encounter information with medications, observations, and conditions
 * 
 * Migrated to TypeScript with comprehensive type safety for encounter management.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Button,
  Divider,
  List,
  ListItem,
  ListItemText,
  Tab,
  Tabs,
  Alert,
  SxProps,
  Theme,
} from '@mui/material';
import {
  Close as CloseIcon,
  Edit as EditIcon,
  LocalHospital as HospitalIcon,
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  Assignment as AssignmentIcon,
  Medication as MedicationIcon,
  Science as ScienceIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { fhirClient } from '../services/fhirClient';
import api from '../services/api';
import {
  Patient as FHIRPatient,
  Encounter as FHIREncounter,
  MedicationRequest as FHIRMedicationRequest,
  Observation as FHIRObservation,
  Condition as FHIRCondition,
  Practitioner,
} from '@ahryman40k/ts-fhir-types/lib/R4';

/**
 * Type definitions for EncounterDetail component
 */
export type EncounterStatus = 
  | 'planned' 
  | 'arrived' 
  | 'triaged' 
  | 'in-progress' 
  | 'onleave' 
  | 'finished' 
  | 'cancelled' 
  | 'entered-in-error' 
  | 'unknown';

export type MedicationStatus = 
  | 'active' 
  | 'on-hold' 
  | 'cancelled' 
  | 'completed' 
  | 'entered-in-error' 
  | 'stopped' 
  | 'draft' 
  | 'unknown';

export type ObservationStatus = 
  | 'registered' 
  | 'preliminary' 
  | 'final' 
  | 'amended' 
  | 'corrected' 
  | 'cancelled' 
  | 'entered-in-error' 
  | 'unknown';

export type ConditionStatus = 
  | 'active' 
  | 'recurrence' 
  | 'relapse' 
  | 'inactive' 
  | 'remission' 
  | 'resolved';

export type EditableResourceType = 'encounter' | 'medication' | 'observation' | 'condition';

export interface PatientInfo {
  id: string;
  first_name?: string;
  last_name?: string;
  mrn?: string;
  date_of_birth?: string;
  gender?: string;
}

export interface EncounterInfo {
  id: string;
  patient_id: string;
  encounter_type: string;
  encounter_date: string;
  status: EncounterStatus;
  chief_complaint?: string;
  notes?: string;
  provider_id?: string;
  provider_name?: string;
}

export interface MedicationInfo {
  id: string;
  medication_name: string;
  dosage?: string;
  frequency?: string;
  status: MedicationStatus;
  start_date: string;
  end_date?: string;
}

export interface ObservationInfo {
  id: string;
  display: string;
  value: string | number;
  unit?: string;
  value_unit?: string;
  observation_date: string;
  status: ObservationStatus;
}

export interface ConditionInfo {
  id: string;
  description: string;
  icd10_code?: string;
  clinical_status: ConditionStatus;
  onset_date?: string;
}

export interface ProviderInfo {
  id: string;
  first_name: string;
  last_name: string;
  specialty?: string;
  npi?: string;
}

export interface EncounterData {
  medications: MedicationInfo[];
  observations: ObservationInfo[];
  conditions: ConditionInfo[];
  procedures: any[];
  provider: ProviderInfo | null;
}

export interface TabPanelProps {
  children?: React.ReactNode;
  value: number;
  index: number;
}

export interface EncounterDetailProps {
  open: boolean;
  onClose: () => void;
  encounter: EncounterInfo | null;
  patient?: PatientInfo | null;
  onEdit?: (resourceType: EditableResourceType, resource: any) => void;
  onUpdate?: () => void;
  sx?: SxProps<Theme>;
}

export interface FHIRSearchResult<T> {
  resources: T[];
  total?: number;
  bundle?: any;
}

/**
 * Helper functions
 */
const getStatusColor = (status?: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
  if (!status) return 'default';
  
  switch (status.toLowerCase()) {
    case 'active': 
    case 'finished': 
      return 'success';
    case 'completed': 
      return 'default';
    case 'stopped': 
    case 'cancelled': 
      return 'error';
    case 'in-progress': 
      return 'info';
    case 'on-hold': 
      return 'warning';
    default: 
      return 'default';
  }
};

const isVitalSign = (display: string): boolean => {
  const lowerDisplay = display.toLowerCase();
  return lowerDisplay.includes('blood pressure') || 
         lowerDisplay.includes('heart rate') || 
         lowerDisplay.includes('temperature') || 
         lowerDisplay.includes('weight') || 
         lowerDisplay.includes('height') || 
         lowerDisplay.includes('oxygen') || 
         lowerDisplay.includes('respiratory') || 
         lowerDisplay.includes('bmi') || 
         lowerDisplay.includes('pulse') || 
         lowerDisplay.includes('bp');
};

const isLabResult = (display: string): boolean => {
  return !isVitalSign(display);
};

const formatEncounterDate = (dateString: string): string => {
  try {
    return format(new Date(dateString), 'MMM dd, yyyy h:mm a');
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString;
  }
};

const formatShortDate = (dateString: string): string => {
  try {
    return format(new Date(dateString), 'MM/dd/yyyy');
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString;
  }
};

/**
 * TabPanel Component
 */
const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`encounter-tabpanel-${index}`}
      aria-labelledby={`encounter-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
};

/**
 * EncounterDetail Component
 */
const EncounterDetail: React.FC<EncounterDetailProps> = ({ 
  open, 
  onClose, 
  encounter, 
  patient,
  onEdit,
  onUpdate,
  sx 
}) => {
  const [tabValue, setTabValue] = useState<number>(0);
  const [encounterData, setEncounterData] = useState<EncounterData>({
    medications: [],
    observations: [],
    conditions: [],
    procedures: [],
    provider: null
  });
  const [loading, setLoading] = useState<boolean>(false);

  const fetchEncounterData = useCallback(async (): Promise<void> => {
    if (!encounter) return;
    
    try {
      setLoading(true);
      
      // Fetch all data for the patient and filter by encounter
      const patientId = patient?.id || encounter.patient_id;
      
      const [
        medicationsResult,
        observationsResult,
        conditionsResult
      ] = await Promise.all([
        fhirClient.getMedications(patientId) as Promise<FHIRSearchResult<FHIRMedicationRequest>>,
        fhirClient.getObservations(patientId) as Promise<FHIRSearchResult<FHIRObservation>>,
        fhirClient.getConditions(patientId) as Promise<FHIRSearchResult<FHIRCondition>>
      ]);
      
      // Filter resources by encounter reference
      const encounterRef = `Encounter/${encounter.id}`;
      
      const medications: MedicationInfo[] = medicationsResult.resources
        .filter((med: FHIRMedicationRequest) => med.encounter?.reference === encounterRef)
        .map((med: FHIRMedicationRequest) => ({
          id: med.id || '',
          medication_name: med.medicationCodeableConcept?.text || 
                          med.medicationCodeableConcept?.coding?.[0]?.display || 'Unknown',
          dosage: med.dosageInstruction?.[0]?.text || '',
          frequency: med.dosageInstruction?.[0]?.timing?.repeat?.frequency?.toString() || '',
          status: (med.status as MedicationStatus) || 'unknown',
          start_date: med.authoredOn || new Date().toISOString()
        }));
      
      const observations: ObservationInfo[] = observationsResult.resources
        .filter((obs: FHIRObservation) => obs.encounter?.reference === encounterRef)
        .map((obs: FHIRObservation) => ({
          id: obs.id || '',
          display: obs.code?.text || obs.code?.coding?.[0]?.display || 'Unknown',
          value: obs.valueQuantity?.value || obs.valueString || '',
          unit: obs.valueQuantity?.unit || '',
          value_unit: obs.valueQuantity?.unit || '',
          observation_date: obs.effectiveDateTime || obs.issued || new Date().toISOString(),
          status: (obs.status as ObservationStatus) || 'unknown'
        }));
      
      const conditions: ConditionInfo[] = conditionsResult.resources
        .filter((cond: FHIRCondition) => cond.encounter?.reference === encounterRef)
        .map((cond: FHIRCondition) => ({
          id: cond.id || '',
          description: cond.code?.text || cond.code?.coding?.[0]?.display || 'Unknown',
          icd10_code: cond.code?.coding?.find(c => c.system?.includes('icd'))?.code || '',
          clinical_status: (cond.clinicalStatus?.coding?.[0]?.code as ConditionStatus) || 'active',
          onset_date: cond.onsetDateTime || cond.onsetPeriod?.start
        }));
      
      // Provider info would come from encounter participant
      const provider: ProviderInfo | null = null; // TODO: Implement provider lookup

      setEncounterData({
        medications,
        observations,
        conditions,
        procedures: [], // TODO: Add procedures API
        provider
      });
    } catch (error) {
      console.error('Error fetching encounter data:', error);
    } finally {
      setLoading(false);
    }
  }, [encounter, patient]);

  useEffect(() => {
    if (open && encounter) {
      fetchEncounterData();
    }
  }, [open, encounter, fetchEncounterData]);

  const handleTabChange = useCallback((event: React.SyntheticEvent, newValue: number): void => {
    setTabValue(newValue);
  }, []);

  const handleEdit = useCallback((resourceType: EditableResourceType, resource: any): void => {
    if (onEdit) {
      onEdit(resourceType, resource);
    }
  }, [onEdit]);

  const vitalsObservations = encounterData.observations.filter(obs => isVitalSign(obs.display));
  const labObservations = encounterData.observations.filter(obs => isLabResult(obs.display));

  if (!encounter) return null;

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
      PaperProps={{
        sx: { height: '90vh', ...sx }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <HospitalIcon color="primary" />
            <Box>
              <Typography variant="h6">
                {encounter.encounter_type} - {formatShortDate(encounter.encounter_date)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {patient?.first_name} {patient?.last_name} - MRN: {patient?.mrn}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {onEdit && (
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={() => handleEdit('encounter', encounter)}
                size="small"
              >
                Edit Encounter
              </Button>
            )}
            <IconButton onClick={onClose} aria-label="Close encounter detail">
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Encounter Summary Card */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <ScheduleIcon color="primary" />
                  <Typography variant="h6">Encounter Details</Typography>
                </Box>
                <Typography variant="body2">
                  <strong>Date:</strong> {formatEncounterDate(encounter.encounter_date)}
                </Typography>
                <Typography variant="body2">
                  <strong>Type:</strong> {encounter.encounter_type}
                </Typography>
                <Typography variant="body2">
                  <strong>Status:</strong> 
                  <Chip 
                    label={encounter.status} 
                    color={getStatusColor(encounter.status)} 
                    size="small" 
                    sx={{ ml: 1 }}
                  />
                </Typography>
                {encounterData.provider && (
                  <Typography variant="body2">
                    <strong>Provider:</strong> Dr. {encounterData.provider.first_name} {encounterData.provider.last_name}
                  </Typography>
                )}
              </Grid>
              <Grid item xs={12} md={8}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <AssignmentIcon color="primary" />
                  <Typography variant="h6">Chief Complaint & Notes</Typography>
                </Box>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Chief Complaint:</strong> {encounter.chief_complaint || 'Not specified'}
                </Typography>
                {encounter.notes && (
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                    <Typography variant="body2" style={{ whiteSpace: 'pre-wrap' }}>
                      {encounter.notes}
                    </Typography>
                  </Paper>
                )}
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Related Data Tabs */}
        <Paper sx={{ width: '100%' }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={handleTabChange} aria-label="encounter data tabs">
              <Tab label={`Medications (${encounterData.medications.length})`} />
              <Tab label={`Lab Results (${labObservations.length})`} />
              <Tab label={`Vital Signs (${vitalsObservations.length})`} />
              <Tab label={`Diagnoses (${encounterData.conditions.length})`} />
            </Tabs>
          </Box>

          {/* Medications Tab */}
          <TabPanel value={tabValue} index={0}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Medications Prescribed</Typography>
              {onEdit && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => handleEdit('medication', null)}
                  size="small"
                >
                  Add Medication
                </Button>
              )}
            </Box>
            {encounterData.medications.length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Medication</TableCell>
                      <TableCell>Dosage</TableCell>
                      <TableCell>Frequency</TableCell>
                      <TableCell>Start Date</TableCell>
                      <TableCell>Status</TableCell>
                      {onEdit && <TableCell>Actions</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {encounterData.medications.map((medication) => (
                      <TableRow key={medication.id}>
                        <TableCell>
                          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                            {medication.medication_name}
                          </Typography>
                        </TableCell>
                        <TableCell>{medication.dosage || 'Not specified'}</TableCell>
                        <TableCell>{medication.frequency || 'As directed'}</TableCell>
                        <TableCell>
                          {formatShortDate(medication.start_date)}
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={medication.status} 
                            color={getStatusColor(medication.status)} 
                            size="small" 
                          />
                        </TableCell>
                        {onEdit && (
                          <TableCell>
                            <Tooltip title="Edit medication">
                              <IconButton 
                                size="small" 
                                onClick={() => handleEdit('medication', medication)}
                                aria-label="Edit medication"
                              >
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="info">No medications prescribed during this encounter</Alert>
            )}
          </TabPanel>

          {/* Lab Results Tab */}
          <TabPanel value={tabValue} index={1}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Laboratory Results</Typography>
              {onEdit && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => handleEdit('observation', null)}
                  size="small"
                >
                  Add Lab Result
                </Button>
              )}
            </Box>
            {labObservations.length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Test</TableCell>
                      <TableCell>Result</TableCell>
                      <TableCell>Unit</TableCell>
                      {onEdit && <TableCell>Actions</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {labObservations.map((observation) => (
                      <TableRow key={observation.id}>
                        <TableCell>
                          {formatShortDate(observation.observation_date)}
                        </TableCell>
                        <TableCell>{observation.display}</TableCell>
                        <TableCell>
                          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                            {observation.value}
                          </Typography>
                        </TableCell>
                        <TableCell>{observation.value_unit || observation.unit}</TableCell>
                        {onEdit && (
                          <TableCell>
                            <Tooltip title="Edit lab result">
                              <IconButton 
                                size="small" 
                                onClick={() => handleEdit('observation', observation)}
                                aria-label="Edit lab result"
                              >
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="info">No lab results recorded for this encounter</Alert>
            )}
          </TabPanel>

          {/* Vital Signs Tab */}
          <TabPanel value={tabValue} index={2}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Vital Signs</Typography>
              {onEdit && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => handleEdit('observation', null)}
                  size="small"
                >
                  Add Vital Signs
                </Button>
              )}
            </Box>
            {vitalsObservations.length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Vital Sign</TableCell>
                      <TableCell>Value</TableCell>
                      <TableCell>Unit</TableCell>
                      {onEdit && <TableCell>Actions</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {vitalsObservations.map((observation) => (
                      <TableRow key={observation.id}>
                        <TableCell>
                          {formatShortDate(observation.observation_date)}
                        </TableCell>
                        <TableCell>{observation.display}</TableCell>
                        <TableCell>
                          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                            {observation.value}
                          </Typography>
                        </TableCell>
                        <TableCell>{observation.value_unit || observation.unit}</TableCell>
                        {onEdit && (
                          <TableCell>
                            <Tooltip title="Edit vital signs">
                              <IconButton 
                                size="small" 
                                onClick={() => handleEdit('observation', observation)}
                                aria-label="Edit vital signs"
                              >
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="info">No vital signs recorded for this encounter</Alert>
            )}
          </TabPanel>

          {/* Diagnoses Tab */}
          <TabPanel value={tabValue} index={3}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Diagnoses & Conditions</Typography>
              {onEdit && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => handleEdit('condition', null)}
                  size="small"
                >
                  Add Diagnosis
                </Button>
              )}
            </Box>
            {encounterData.conditions.length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>ICD-10 Code</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Onset Date</TableCell>
                      {onEdit && <TableCell>Actions</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {encounterData.conditions.map((condition) => (
                      <TableRow key={condition.id}>
                        <TableCell>
                          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                            {condition.icd10_code || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>{condition.description}</TableCell>
                        <TableCell>
                          <Chip 
                            label={condition.clinical_status} 
                            color={getStatusColor(condition.clinical_status)} 
                            size="small" 
                          />
                        </TableCell>
                        <TableCell>
                          {condition.onset_date ? formatShortDate(condition.onset_date) : 'Not specified'}
                        </TableCell>
                        {onEdit && (
                          <TableCell>
                            <Tooltip title="Edit condition">
                              <IconButton 
                                size="small" 
                                onClick={() => handleEdit('condition', condition)}
                                aria-label="Edit condition"
                              >
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="info">No diagnoses recorded for this encounter</Alert>
            )}
          </TabPanel>
        </Paper>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default EncounterDetail;