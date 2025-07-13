/**
 * Medication Reconciliation Component
 * Advanced medication reconciliation workflow interface
 * 
 * Migrated to TypeScript with comprehensive type safety for medication reconciliation.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Chip,
  Stack,
  Divider,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Collapse,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  Badge,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  SxProps,
  Theme,
} from '@mui/material';
import {
  Medication as MedicationIcon,
  Compare as CompareIcon,
  CheckCircle as ApprovedIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  SwapHoriz as ReconcileIcon,
  Assignment as ReportIcon,
  Print as PrintIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon,
  Schedule as ScheduleIcon,
  LocalPharmacy as PharmacyIcon,
  PersonAdd as PrescribeIcon,
  Update as UpdateIcon,
  Flag as FlagIcon,
  Visibility as ViewIcon,
  Home as HomeIcon,
  LocalHospital as HospitalIcon,
} from '@mui/icons-material';
import { format, parseISO, isAfter, differenceInDays } from 'date-fns';
import { MedicationRequest, MedicationStatement } from '@ahryman40k/ts-fhir-types/lib/R4';
import { fhirClient } from '../../../services/fhirClient';

/**
 * Type definitions for MedicationReconciliation component
 */
export type MedicationSource = 'home' | 'hospital' | 'discharge' | 'current';

export type MedicationStatus = 'active' | 'on-hold' | 'cancelled' | 'completed' | 'entered-in-error' | 'stopped' | 'draft' | 'unknown';

export type ReconciliationMode = 'admission' | 'discharge' | 'transfer';

export type ReconciliationAction = 'continue' | 'modify' | 'discontinue' | 'add';

export interface MedicationItemProps {
  medication: MedicationRequest | MedicationStatement;
  source: MedicationSource;
  isSelected?: boolean;
  onSelect?: (medicationId: string, isSelected: boolean) => void;
  onEdit?: (medication: MedicationRequest | MedicationStatement) => void;
  onDelete?: (medicationId: string) => void;
  showActions?: boolean;
  comparisonMode?: boolean;
}

export interface ReconciliationStep {
  label: string;
  description: string;
}

export interface ReconciliationStepperProps {
  activeStep: number;
  steps: ReconciliationStep[];
  onStepClick?: (stepIndex: number) => void;
}

export interface MedicationComparison {
  id: string;
  home: MedicationRequest | MedicationStatement | null;
  hospital: MedicationRequest | MedicationStatement | null;
  discharge: MedicationRequest | MedicationStatement | null;
  status: 'pending' | 'reviewed' | 'reconciled';
  action?: ReconciliationAction;
  notes?: string;
}

export interface MedicationComparisonProps {
  homeMeds: (MedicationRequest | MedicationStatement)[];
  hospitalMeds: (MedicationRequest | MedicationStatement)[];
  dischargeMeds: (MedicationRequest | MedicationStatement)[];
  onReconcile?: (selectedComparisons: string[]) => void;
}

export interface CategorizedMedications {
  home: (MedicationRequest | MedicationStatement)[];
  hospital: (MedicationRequest | MedicationStatement)[];
  discharge: (MedicationRequest | MedicationStatement)[];
}

export interface SelectedMedications {
  home?: Record<string, boolean>;
  hospital?: Record<string, boolean>;
  discharge?: Record<string, boolean>;
}

export interface MedicationReconciliationProps {
  patientId: string;
  encounterId?: string;
  mode?: ReconciliationMode;
  sx?: SxProps<Theme>;
}

export interface DosageInstruction {
  text?: string;
  doseAndRate?: Array<{
    doseQuantity?: {
      value?: number;
      unit?: string;
      code?: string;
    };
  }>;
  timing?: {
    repeat?: {
      frequency?: number;
      period?: number;
      periodUnit?: string;
    };
  };
  route?: {
    text?: string;
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
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
 * Helper functions
 */
const getMedicationName = (medication: MedicationRequest | MedicationStatement): string => {
  const medCodeable = medication.medicationCodeableConcept as MedicationCodeableConcept;
  return medCodeable?.text || 
         medCodeable?.coding?.[0]?.display ||
         (medication as any).medicationReference?.display ||
         'Unknown Medication';
};

const getDosageInfo = (medication: MedicationRequest | MedicationStatement): string => {
  const dosage = medication.dosageInstruction?.[0] as DosageInstruction;
  if (!dosage) return 'No dosage specified';

  const dose = dosage.doseAndRate?.[0]?.doseQuantity;
  const frequency = dosage.timing?.repeat?.frequency;
  const period = dosage.timing?.repeat?.period;
  const periodUnit = dosage.timing?.repeat?.periodUnit;
  const route = dosage.route?.text || dosage.route?.coding?.[0]?.display;

  let dosageText = '';
  if (dose) {
    dosageText += `${dose.value} ${dose.unit || dose.code}`;
  }
  if (frequency && period) {
    dosageText += ` ${frequency} times per ${period} ${periodUnit}`;
  }
  if (route) {
    dosageText += ` (${route})`;
  }

  return dosageText || dosage.text || 'See instructions';
};

const getStatusColor = (status?: MedicationStatus): 'success' | 'info' | 'error' | 'warning' | 'default' => {
  switch (status) {
    case 'active': return 'success';
    case 'completed': return 'info';
    case 'stopped': return 'error';
    case 'on-hold': return 'warning';
    case 'draft': return 'default';
    default: return 'default';
  }
};

const getSourceIcon = (source: MedicationSource): React.ReactElement => {
  switch (source) {
    case 'home': return <HomeIcon color="primary" />;
    case 'hospital': return <HospitalIcon color="secondary" />;
    case 'discharge': return <UpdateIcon color="info" />;
    case 'current': return <MedicationIcon color="action" />;
    default: return <MedicationIcon />;
  }
};

const getSourceLabel = (source: MedicationSource): string => {
  switch (source) {
    case 'home': return 'Home Medications';
    case 'hospital': return 'Hospital Medications';
    case 'discharge': return 'Discharge Medications';
    case 'current': return 'Current Medications';
    default: return 'Unknown Source';
  }
};

const findSimilarMedications = (
  med: MedicationRequest | MedicationStatement,
  targetList: (MedicationRequest | MedicationStatement)[]
): (MedicationRequest | MedicationStatement)[] => {
  const medName = getMedicationName(med).toLowerCase();
  return targetList.filter(target => {
    const targetName = getMedicationName(target).toLowerCase();
    return targetName.includes(medName.split(' ')[0]) || medName.includes(targetName.split(' ')[0]);
  });
};

/**
 * MedicationItem Component
 */
const MedicationItem: React.FC<MedicationItemProps> = ({ 
  medication, 
  source, 
  isSelected = false,
  onSelect, 
  onEdit, 
  onDelete, 
  showActions = true,
  comparisonMode = false
}) => {
  const [expanded, setExpanded] = useState<boolean>(false);

  const handleSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
    onSelect?.(medication.id!, event.target.checked);
  }, [medication.id, onSelect]);

  const handleEdit = useCallback((): void => {
    onEdit?.(medication);
  }, [medication, onEdit]);

  const handleDelete = useCallback((): void => {
    onDelete?.(medication.id!);
  }, [medication.id, onDelete]);

  const medicationName = getMedicationName(medication);
  const dosageInfo = getDosageInfo(medication);
  const statusColor = getStatusColor(medication.status as MedicationStatus);
  const sourceIcon = getSourceIcon(source);
  const sourceLabel = getSourceLabel(source);

  return (
    <Card 
      sx={{ 
        mb: 1, 
        border: isSelected ? 2 : 1, 
        borderColor: isSelected ? 'primary.main' : 'divider',
        bgcolor: comparisonMode ? 'grey.50' : 'background.paper'
      }}
    >
      <CardContent sx={{ pb: showActions ? 1 : 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Stack direction="row" spacing={2} alignItems="center" sx={{ flexGrow: 1 }}>
            {showActions && (
              <Checkbox
                checked={isSelected}
                onChange={handleSelect}
                color="primary"
              />
            )}
            <Avatar sx={{ bgcolor: 'primary.light' }}>
              {sourceIcon}
            </Avatar>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="subtitle1" fontWeight="medium">
                {medicationName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {dosageInfo}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                <Chip 
                  label={medication.status || 'unknown'}
                  size="small"
                  color={statusColor}
                />
                <Chip 
                  label={sourceLabel}
                  size="small"
                  variant="outlined"
                />
                {medication.authoredOn && (
                  <Typography variant="caption" color="text.secondary">
                    {format(parseISO(medication.authoredOn), 'MM/dd/yyyy')}
                  </Typography>
                )}
              </Stack>
            </Box>
          </Stack>
          <IconButton size="small" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Stack>

        <Collapse in={expanded}>
          <Box sx={{ mt: 2, pl: showActions ? 7 : 0 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2">Prescription Details</Typography>
                <Typography variant="body2">
                  Prescriber: {(medication as MedicationRequest).requester?.display || 'Unknown'}
                </Typography>
                {medication.reasonCode && (
                  <Typography variant="body2">
                    Indication: {medication.reasonCode[0]?.text || medication.reasonCode[0]?.coding?.[0]?.display}
                  </Typography>
                )}
                {(medication as MedicationRequest).dispenseRequest && (
                  <Typography variant="body2">
                    Quantity: {(medication as MedicationRequest).dispenseRequest!.quantity?.value} {(medication as MedicationRequest).dispenseRequest!.quantity?.unit}
                  </Typography>
                )}
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2">Additional Information</Typography>
                {medication.note && (
                  <Typography variant="body2">
                    Notes: {medication.note[0]?.text}
                  </Typography>
                )}
                {medication.category && (
                  <Typography variant="body2">
                    Category: {medication.category[0]?.coding?.[0]?.display}
                  </Typography>
                )}
              </Grid>
            </Grid>
          </Box>
        </Collapse>
      </CardContent>

      {showActions && (
        <CardActions>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Edit Medication">
              <IconButton size="small" onClick={handleEdit}>
                <EditIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="View Details">
              <IconButton size="small">
                <ViewIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Flag for Review">
              <IconButton size="small">
                <FlagIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Remove">
              <IconButton size="small" color="error" onClick={handleDelete}>
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </CardActions>
      )}
    </Card>
  );
};

/**
 * ReconciliationStepper Component
 */
const ReconciliationStepper: React.FC<ReconciliationStepperProps> = ({ 
  activeStep, 
  steps, 
  onStepClick 
}) => {
  const handleStepClick = useCallback((index: number) => (): void => {
    onStepClick?.(index);
  }, [onStepClick]);

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Medication Reconciliation Workflow
      </Typography>
      <Stepper activeStep={activeStep} orientation="horizontal">
        {steps.map((step, index) => (
          <Step key={step.label} completed={index < activeStep}>
            <StepLabel 
              onClick={handleStepClick(index)}
              sx={{ cursor: 'pointer' }}
            >
              {step.label}
            </StepLabel>
          </Step>
        ))}
      </Stepper>
    </Paper>
  );
};

/**
 * MedicationComparison Component
 */
const MedicationComparison: React.FC<MedicationComparisonProps> = ({ 
  homeMeds, 
  hospitalMeds, 
  dischargeMeds, 
  onReconcile 
}) => {
  const [selectedComparisons, setSelectedComparisons] = useState<string[]>([]);

  const allComparisons = useMemo((): MedicationComparison[] => {
    const comparisons: MedicationComparison[] = [];
    
    homeMeds.forEach(homeMed => {
      const hospitalMatches = findSimilarMedications(homeMed, hospitalMeds);
      const dischargeMatches = findSimilarMedications(homeMed, dischargeMeds);
      
      comparisons.push({
        id: `comp_${homeMed.id}`,
        home: homeMed,
        hospital: hospitalMatches[0] || null,
        discharge: dischargeMatches[0] || null,
        status: 'pending'
      });
    });

    return comparisons;
  }, [homeMeds, hospitalMeds, dischargeMeds]);

  const handleComparisonSelect = useCallback((comparisonId: string, isSelected: boolean): void => {
    setSelectedComparisons(prev => 
      isSelected 
        ? [...prev, comparisonId]
        : prev.filter(id => id !== comparisonId)
    );
  }, []);

  const handleReconcileClick = useCallback((): void => {
    onReconcile?.(selectedComparisons);
  }, [selectedComparisons, onReconcile]);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Medication Comparison</Typography>
        <Button 
          variant="contained" 
          startIcon={<ReconcileIcon />}
          onClick={handleReconcileClick}
          disabled={selectedComparisons.length === 0}
        >
          Reconcile Selected ({selectedComparisons.length})
        </Button>
      </Stack>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox />
              </TableCell>
              <TableCell>Home Medications</TableCell>
              <TableCell>Hospital Medications</TableCell>
              <TableCell>Discharge Medications</TableCell>
              <TableCell>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {allComparisons.map((comparison) => (
              <TableRow key={comparison.id}>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selectedComparisons.includes(comparison.id)}
                    onChange={(e) => handleComparisonSelect(comparison.id, e.target.checked)}
                  />
                </TableCell>
                <TableCell>
                  {comparison.home && (
                    <MedicationItem 
                      medication={comparison.home} 
                      source="home" 
                      showActions={false}
                      comparisonMode={true}
                    />
                  )}
                </TableCell>
                <TableCell>
                  {comparison.hospital ? (
                    <MedicationItem 
                      medication={comparison.hospital} 
                      source="hospital" 
                      showActions={false}
                      comparisonMode={true}
                    />
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                      No matching hospital medication
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  {comparison.discharge ? (
                    <MedicationItem 
                      medication={comparison.discharge} 
                      source="discharge" 
                      showActions={false}
                      comparisonMode={true}
                    />
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                      No discharge medication
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Stack spacing={1}>
                    <Button size="small" variant="outlined" color="success">
                      Continue
                    </Button>
                    <Button size="small" variant="outlined" color="warning">
                      Modify
                    </Button>
                    <Button size="small" variant="outlined" color="error">
                      Discontinue
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

/**
 * MedicationReconciliation Component
 */
const MedicationReconciliation: React.FC<MedicationReconciliationProps> = ({ 
  patientId, 
  encounterId, 
  mode = 'admission',
  sx 
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [homeMedications, setHomeMedications] = useState<(MedicationRequest | MedicationStatement)[]>([]);
  const [hospitalMedications, setHospitalMedications] = useState<(MedicationRequest | MedicationStatement)[]>([]);
  const [dischargeMedications, setDischargeMedications] = useState<(MedicationRequest | MedicationStatement)[]>([]);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [selectedMedications, setSelectedMedications] = useState<SelectedMedications>({});
  const [reconciliationComplete, setReconciliationComplete] = useState<boolean>(false);

  const reconciliationSteps: ReconciliationStep[] = [
    { label: 'Collect Home Medications', description: 'Gather patient\'s home medication list' },
    { label: 'Review Hospital Medications', description: 'Review medications administered during stay' },
    { label: 'Compare & Reconcile', description: 'Compare lists and reconcile differences' },
    { label: 'Create Discharge List', description: 'Generate final medication list' },
    { label: 'Complete & Document', description: 'Finalize reconciliation and document' }
  ];

  useEffect(() => {
    if (!patientId) return;
    fetchMedications();
  }, [patientId, encounterId]);

  const fetchMedications = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      // Fetch all medication requests for the patient
      const medicationRequests = await fhirClient.search('MedicationRequest', {
        patient: patientId,
        _sort: '-_lastUpdated',
        _count: 100
      });

      // Fetch medication statements (patient-reported medications)
      const medicationStatements = await fhirClient.search('MedicationStatement', {
        subject: patientId,
        _sort: '-_lastUpdated',
        _count: 100
      });

      const allMedications: (MedicationRequest | MedicationStatement)[] = [
        ...(medicationRequests.resources || []),
        ...(medicationStatements.resources || [])
      ];

      // Categorize medications based on context and encounter
      const categorized = categorizeMedications(allMedications);
      
      setHomeMedications(categorized.home);
      setHospitalMedications(categorized.hospital);
      setDischargeMedications(categorized.discharge);

    } catch (err) {
      console.error('Error fetching medications:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, [patientId, encounterId]);

  const categorizeMedications = useCallback((
    medications: (MedicationRequest | MedicationStatement)[]
  ): CategorizedMedications => {
    const categorized: CategorizedMedications = {
      home: [],
      hospital: [],
      discharge: []
    };

    medications.forEach(med => {
      // Determine category based on context, category, or encounter
      const category = med.category?.[0]?.coding?.[0]?.code;
      const context = (med as MedicationRequest).encounter?.reference;
      const intent = (med as MedicationRequest).intent;

      if (med.resourceType === 'MedicationStatement') {
        // Patient-reported medications are typically home medications
        categorized.home.push(med);
      } else if (intent === 'order' && context === `Encounter/${encounterId}`) {
        // Orders during current encounter are hospital medications
        categorized.hospital.push(med);
      } else if (intent === 'plan' && category === 'discharge') {
        // Discharge planning medications
        categorized.discharge.push(med);
      } else if (med.status === 'active' && !context) {
        // Active medications without encounter context are likely home medications
        categorized.home.push(med);
      } else {
        // Default to home medications for reconciliation
        categorized.home.push(med);
      }
    });

    return categorized;
  }, [encounterId]);

  const handleMedicationSelect = useCallback((
    medicationId: string, 
    isSelected: boolean, 
    category: keyof SelectedMedications
  ): void => {
    setSelectedMedications(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [medicationId]: isSelected
      }
    }));
  }, []);

  const handleReconcile = useCallback(async (selectedComparisons: string[]): Promise<void> => {
    try {
      setLoading(true);
      
      // Here you would implement the actual reconciliation logic
      // Create new MedicationRequest resources for the reconciled list
      // Update existing medications as needed
      // Create documentation of the reconciliation process
      
      console.log('Reconciling medications:', selectedComparisons);
      
      // For demo purposes, just mark as complete
      setReconciliationComplete(true);
      setActiveStep(4);
      
    } catch (err) {
      setError(`Failed to complete reconciliation: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleStepClick = useCallback((stepIndex: number): void => {
    setActiveStep(stepIndex);
  }, []);

  const handlePreviousStep = useCallback((): void => {
    setActiveStep(prev => Math.max(0, prev - 1));
  }, []);

  const handleNextStep = useCallback((): void => {
    setActiveStep(prev => Math.min(reconciliationSteps.length - 1, prev + 1));
  }, [reconciliationSteps.length]);

  const renderStepContent = useCallback((): React.ReactElement | null => {
    switch (activeStep) {
      case 0:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6">Home Medications</Typography>
                    <Stack direction="row" spacing={1}>
                      <Button startIcon={<AddIcon />} variant="outlined">
                        Add Medication
                      </Button>
                      <Button startIcon={<RefreshIcon />} onClick={fetchMedications}>
                        Refresh
                      </Button>
                    </Stack>
                  </Stack>
                  
                  {homeMedications.length > 0 ? (
                    homeMedications.map(med => (
                      <MedicationItem
                        key={med.id}
                        medication={med}
                        source="home"
                        isSelected={selectedMedications.home?.[med.id!] || false}
                        onSelect={(id, selected) => handleMedicationSelect(id, selected, 'home')}
                      />
                    ))
                  ) : (
                    <Alert severity="info">
                      No home medications found. Please add patient's home medications.
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        );

      case 1:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Hospital Medications
                  </Typography>
                  
                  {hospitalMedications.length > 0 ? (
                    hospitalMedications.map(med => (
                      <MedicationItem
                        key={med.id}
                        medication={med}
                        source="hospital"
                        isSelected={selectedMedications.hospital?.[med.id!] || false}
                        onSelect={(id, selected) => handleMedicationSelect(id, selected, 'hospital')}
                      />
                    ))
                  ) : (
                    <Alert severity="info">
                      No hospital medications found for this encounter.
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        );

      case 2:
        return (
          <MedicationComparison
            homeMeds={homeMedications}
            hospitalMeds={hospitalMedications}
            dischargeMeds={dischargeMedications}
            onReconcile={handleReconcile}
          />
        );

      case 3:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Discharge Medication List
                  </Typography>
                  
                  {dischargeMedications.length > 0 ? (
                    dischargeMedications.map(med => (
                      <MedicationItem
                        key={med.id}
                        medication={med}
                        source="discharge"
                        isSelected={selectedMedications.discharge?.[med.id!] || false}
                        onSelect={(id, selected) => handleMedicationSelect(id, selected, 'discharge')}
                      />
                    ))
                  ) : (
                    <Alert severity="warning">
                      No discharge medications have been created yet. Please complete reconciliation first.
                    </Alert>
                  )}
                </CardContent>
                <CardActions>
                  <Button variant="contained" startIcon={<PrintIcon />}>
                    Print Discharge List
                  </Button>
                  <Button variant="outlined" startIcon={<SaveIcon />}>
                    Save Draft
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          </Grid>
        );

      case 4:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Stack direction="row" spacing={2} alignItems="center" mb={2}>
                    <ApprovedIcon color="success" sx={{ fontSize: 40 }} />
                    <Box>
                      <Typography variant="h6">
                        Medication Reconciliation Complete
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Reconciliation completed on {format(new Date(), 'MM/dd/yyyy HH:mm')}
                      </Typography>
                    </Box>
                  </Stack>

                  <Alert severity="success" sx={{ mb: 2 }}>
                    Medication reconciliation has been successfully completed and documented.
                  </Alert>

                  <Stack direction="row" spacing={2}>
                    <Button variant="contained" startIcon={<ReportIcon />}>
                      View Reconciliation Report
                    </Button>
                    <Button variant="outlined" startIcon={<PrintIcon />}>
                      Print Final List
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        );

      default:
        return null;
    }
  }, [activeStep, homeMedications, hospitalMedications, dischargeMedications, selectedMedications, fetchMedications, handleMedicationSelect, handleReconcile]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        Error loading medication data: {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3, ...sx }}>
      {/* Header */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h5">
              Medication Reconciliation
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {mode === 'admission' ? 'Admission' : 'Discharge'} Medication Reconciliation
            </Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <Chip 
              label={`${homeMedications.length} Home Meds`}
              color="primary"
              variant="outlined"
            />
            <Chip 
              label={`${hospitalMedications.length} Hospital Meds`}
              color="secondary"
              variant="outlined"
            />
            <Chip 
              label={`${dischargeMedications.length} Discharge Meds`}
              color="info"
              variant="outlined"
            />
          </Stack>
        </Stack>
      </Paper>

      {/* Stepper */}
      <ReconciliationStepper
        activeStep={activeStep}
        steps={reconciliationSteps}
        onStepClick={handleStepClick}
      />

      {/* Step Content */}
      {renderStepContent()}

      {/* Navigation */}
      <Paper sx={{ p: 2, mt: 3 }}>
        <Stack direction="row" justifyContent="space-between">
          <Button
            disabled={activeStep === 0}
            onClick={handlePreviousStep}
          >
            Previous
          </Button>
          <Button
            variant="contained"
            disabled={activeStep === reconciliationSteps.length - 1}
            onClick={handleNextStep}
          >
            {activeStep === reconciliationSteps.length - 2 ? 'Complete' : 'Next'}
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
};

export default MedicationReconciliation;