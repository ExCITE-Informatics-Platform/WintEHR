/**
 * Medication Reconciliation Dialog Component
 * Allows clinicians to reconcile patient medications across different sources
 * 
 * Migrated to TypeScript with comprehensive type safety for medication reconciliation.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Chip,
  Stack,
  Divider,
  Alert,
  Checkbox,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip,
  Paper,
  SxProps,
  Theme,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Medication as MedicationIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  Edit as EditIcon,
  Visibility as ReviewIcon,
} from '@mui/icons-material';
import { useMedicationResolver } from '../../../../hooks/useMedicationResolver';
import { MedicationRequest } from '@ahryman40k/ts-fhir-types/lib/R4';

/**
 * Type definitions for MedicationReconciliationDialog component
 */
export type ReconciliationChangeType = 'add' | 'discontinue' | 'modify' | 'review';

export type MedicationStatus = 'active' | 'inactive' | 'entered-in-error' | 'stopped' | 'on-hold' | 'cancelled' | 'completed' | 'unknown' | 'discontinued';

export interface ExternalMedication {
  id: string;
  name: string;
  dosage: string;
  status: MedicationStatus;
  source: string;
  strength?: string;
  route?: string;
  frequency?: string;
}

export interface MedicationSource {
  source: string;
  date: string;
  medications: ExternalMedication[];
  reliability?: 'high' | 'medium' | 'low';
  lastUpdated?: string;
}

export interface ReconciliationChange {
  id: string;
  type: ReconciliationChangeType;
  medication: ExternalMedication | MedicationRequest;
  newDosage?: string;
  reason: string;
  source: string;
  priority?: 'high' | 'medium' | 'low';
  confidence?: number;
}

export interface MedicationReconciliationDialogProps {
  open: boolean;
  onClose: () => void;
  patientId: string;
  currentMedications?: MedicationRequest[];
  onReconcile: (changes: ReconciliationChange[]) => Promise<void>;
  sx?: SxProps<Theme>;
}

export interface MedicationResolverHook {
  getMedicationDisplay: (medication: MedicationRequest) => string;
  resolveMedicationName: (medication: MedicationRequest) => string;
  getMedicationCode: (medication: MedicationRequest) => string | undefined;
}

/**
 * Helper functions
 */
const getDefaultExternalSources = (): MedicationSource[] => [
  {
    source: 'Hospital Discharge Summary',
    date: '2024-01-15',
    medications: [
      {
        id: 'ext-1',
        name: 'Lisinopril 10mg',
        dosage: 'Take 1 tablet by mouth daily',
        status: 'active',
        source: 'discharge'
      },
      {
        id: 'ext-2', 
        name: 'Metformin 500mg',
        dosage: 'Take 1 tablet by mouth twice daily with meals',
        status: 'active',
        source: 'discharge'
      }
    ]
  },
  {
    source: 'Pharmacy Records',
    date: '2024-01-20',
    medications: [
      {
        id: 'ext-3',
        name: 'Atorvastatin 20mg',
        dosage: 'Take 1 tablet by mouth at bedtime',
        status: 'active',
        source: 'pharmacy'
      },
      {
        id: 'ext-4',
        name: 'Lisinopril 10mg',
        dosage: 'Take 1 tablet by mouth daily',
        status: 'discontinued',
        source: 'pharmacy'
      }
    ]
  }
];

const normalizeBaseName = (medicationName: string): string => {
  return medicationName.toLowerCase().split(' ')[0];
};

const analyzeDiscrepancies = (
  currentMedications: MedicationRequest[],
  externalSources: MedicationSource[],
  getMedicationDisplay: (med: MedicationRequest) => string
): ReconciliationChange[] => {
  const changes: ReconciliationChange[] = [];
  const currentMedNames = new Set(
    currentMedications.map(med => getMedicationDisplay(med).toLowerCase())
  );

  // Find medications in external sources not in current list
  externalSources.forEach(source => {
    source.medications.forEach(extMed => {
      const medName = extMed.name.toLowerCase();
      if (!currentMedNames.has(medName) && extMed.status === 'active') {
        changes.push({
          id: `add-${extMed.id}`,
          type: 'add',
          medication: extMed,
          reason: `Found in ${source.source} but not in current medications`,
          source: source.source,
          priority: 'medium'
        });
      }
    });
  });

  // Find medications that should be discontinued
  externalSources.forEach(source => {
    source.medications.forEach(extMed => {
      if (extMed.status === 'discontinued') {
        const currentMed = currentMedications.find(med => 
          getMedicationDisplay(med).toLowerCase().includes(extMed.name.toLowerCase())
        );
        if (currentMed && currentMed.status === 'active') {
          changes.push({
            id: `discontinue-${currentMed.id}`,
            type: 'discontinue',
            medication: currentMed,
            reason: `Marked as discontinued in ${source.source}`,
            source: source.source,
            priority: 'high'
          });
        }
      }
    });
  });

  // Find potential duplicates or dosage changes
  currentMedications.forEach(currentMed => {
    externalSources.forEach(source => {
      source.medications.forEach(extMed => {
        const currentName = getMedicationDisplay(currentMed).toLowerCase();
        const extName = extMed.name.toLowerCase();
        
        const currentBaseName = normalizeBaseName(currentName);
        const extBaseName = normalizeBaseName(extName);
        
        if (currentBaseName === extBaseName || currentName.includes(extBaseName) || extName.includes(currentBaseName)) {
          const currentDosage = currentMed.dosageInstruction?.[0]?.text || '';
          if (currentDosage !== extMed.dosage && extMed.status === 'active') {
            changes.push({
              id: `modify-${currentMed.id}`,
              type: 'modify',
              medication: currentMed,
              newDosage: extMed.dosage,
              reason: `Dosage discrepancy with ${source.source}`,
              source: source.source,
              priority: 'medium'
            });
          }
        }
      });
    });
  });

  return changes;
};

const getChangeIcon = (type: ReconciliationChangeType): React.ReactElement => {
  switch (type) {
    case 'add': return <AddIcon color="success" />;
    case 'discontinue': return <RemoveIcon color="error" />;
    case 'modify': return <EditIcon color="warning" />;
    default: return <ReviewIcon />;
  }
};

const getChangeColor = (type: ReconciliationChangeType): 'success' | 'error' | 'warning' | 'info' => {
  switch (type) {
    case 'add': return 'success';
    case 'discontinue': return 'error';
    case 'modify': return 'warning';
    default: return 'info';
  }
};

const getMedicationStatusColor = (status: MedicationStatus): 'success' | 'default' => {
  return status === 'active' ? 'success' : 'default';
};

const formatChangeDescription = (change: ReconciliationChange, getMedicationDisplay: (med: MedicationRequest) => string): string => {
  switch (change.type) {
    case 'add':
      return `Add: ${(change.medication as ExternalMedication).name}`;
    case 'discontinue':
      return `Discontinue: ${getMedicationDisplay(change.medication as MedicationRequest)}`;
    case 'modify':
      return `Modify: ${getMedicationDisplay(change.medication as MedicationRequest)}`;
    default:
      return 'Review medication';
  }
};

/**
 * MedicationReconciliationDialog Component
 */
const MedicationReconciliationDialog: React.FC<MedicationReconciliationDialogProps> = ({ 
  open, 
  onClose, 
  patientId, 
  currentMedications = [],
  onReconcile,
  sx 
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [reconciliationChanges, setReconciliationChanges] = useState<ReconciliationChange[]>([]);
  const [selectedChanges, setSelectedChanges] = useState<Set<string>>(new Set());
  const [externalSources] = useState<MedicationSource[]>(getDefaultExternalSources());

  const { getMedicationDisplay } = useMedicationResolver(currentMedications);

  const performAnalysis = useCallback((): void => {
    const changes = analyzeDiscrepancies(currentMedications, externalSources, getMedicationDisplay);
    setReconciliationChanges(changes);
  }, [currentMedications, externalSources, getMedicationDisplay]);

  useEffect(() => {
    if (open) {
      performAnalysis();
    }
  }, [open, performAnalysis]);

  const handleToggleChange = useCallback((changeId: string): void => {
    setSelectedChanges(prev => {
      const newSet = new Set(prev);
      if (newSet.has(changeId)) {
        newSet.delete(changeId);
      } else {
        newSet.add(changeId);
      }
      return newSet;
    });
  }, []);

  const handleSelectAll = useCallback((): void => {
    if (selectedChanges.size === reconciliationChanges.length) {
      setSelectedChanges(new Set());
    } else {
      setSelectedChanges(new Set(reconciliationChanges.map(c => c.id)));
    }
  }, [selectedChanges.size, reconciliationChanges]);

  const handleReconcile = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const changesToApply = reconciliationChanges.filter(change => 
        selectedChanges.has(change.id)
      );
      
      await onReconcile(changesToApply);
      onClose();
    } catch (error) {
      console.error('Error during medication reconciliation:', error);
    } finally {
      setLoading(false);
    }
  }, [reconciliationChanges, selectedChanges, onReconcile, onClose]);

  const handleClose = useCallback((): void => {
    setSelectedChanges(new Set());
    onClose();
  }, [onClose]);

  const isExternalMedication = (medication: ExternalMedication | MedicationRequest): medication is ExternalMedication => {
    return 'name' in medication && typeof medication.name === 'string';
  };

  const isMedicationRequest = (medication: ExternalMedication | MedicationRequest): medication is MedicationRequest => {
    return 'resourceType' in medication && medication.resourceType === 'MedicationRequest';
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { minHeight: '70vh', ...sx }
      }}
    >
      <DialogTitle>
        <Typography variant="h6">Medication Reconciliation</Typography>
        <Typography variant="body2" color="text.secondary">
          Review and reconcile medications from multiple sources
        </Typography>
      </DialogTitle>
      
      <DialogContent>
        <Stack spacing={3}>
          <Alert severity="info">
            Medication reconciliation helps ensure accuracy by comparing current medications 
            with external sources like discharge summaries and pharmacy records.
          </Alert>

          {/* Current Medications Summary */}
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">
                Current Medications ({currentMedications.length})
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List dense>
                {currentMedications.map((med) => (
                  <ListItem key={med.id}>
                    <ListItemIcon>
                      <MedicationIcon color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary={getMedicationDisplay(med)}
                      secondary={med.dosageInstruction?.[0]?.text || 'No dosage information'}
                    />
                    <Chip 
                      label={med.status || 'unknown'} 
                      size="small" 
                      color={getMedicationStatusColor(med.status as MedicationStatus || 'unknown')}
                    />
                  </ListItem>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>

          {/* External Sources */}
          {externalSources.map((source, index) => (
            <Accordion key={index}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">
                  {source.source} ({source.medications.length} medications)
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                  {source.date}
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <List dense>
                  {source.medications.map((med) => (
                    <ListItem key={med.id}>
                      <ListItemIcon>
                        <MedicationIcon color={med.status === 'active' ? 'primary' : 'disabled'} />
                      </ListItemIcon>
                      <ListItemText
                        primary={med.name}
                        secondary={med.dosage}
                      />
                      <Chip 
                        label={med.status} 
                        size="small" 
                        color={getMedicationStatusColor(med.status)}
                      />
                    </ListItem>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>
          ))}

          <Divider />

          {/* Reconciliation Changes */}
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">
                Recommended Changes ({reconciliationChanges.length})
              </Typography>
              <Button 
                onClick={handleSelectAll}
                size="small"
                variant="outlined"
                disabled={reconciliationChanges.length === 0}
              >
                {selectedChanges.size === reconciliationChanges.length ? 'Deselect All' : 'Select All'}
              </Button>
            </Stack>

            {reconciliationChanges.length === 0 ? (
              <Alert severity="success" icon={<CheckIcon />}>
                No discrepancies found. Current medications are reconciled with external sources.
              </Alert>
            ) : (
              <Paper variant="outlined" sx={{ maxHeight: 400, overflow: 'auto' }}>
                <List>
                  {reconciliationChanges.map((change, index) => (
                    <ListItem key={change.id} divider={index < reconciliationChanges.length - 1}>
                      <ListItemIcon>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={selectedChanges.has(change.id)}
                              onChange={() => handleToggleChange(change.id)}
                            />
                          }
                          label=""
                        />
                      </ListItemIcon>
                      <ListItemIcon>
                        {getChangeIcon(change.type)}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="body1">
                              {formatChangeDescription(change, getMedicationDisplay)}
                            </Typography>
                            <Chip 
                              label={change.type.toUpperCase()} 
                              size="small" 
                              color={getChangeColor(change.type)}
                            />
                          </Stack>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {change.reason}
                            </Typography>
                            {change.type === 'modify' && change.newDosage && (
                              <Typography variant="body2" color="warning.main">
                                New dosage: {change.newDosage}
                              </Typography>
                            )}
                            {change.type === 'add' && isExternalMedication(change.medication) && (
                              <Typography variant="body2" color="success.main">
                                Dosage: {change.medication.dosage}
                              </Typography>
                            )}
                            <Typography variant="caption" color="text.secondary">
                              Source: {change.source}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            )}
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button 
          onClick={handleReconcile} 
          variant="contained" 
          disabled={loading || selectedChanges.size === 0}
        >
          {loading ? 'Applying Changes...' : `Apply ${selectedChanges.size} Changes`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MedicationReconciliationDialog;