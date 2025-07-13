/**
 * Enhanced Confirmation Dialog Component
 * Provides detailed confirmation dialogs for delete operations
 * 
 * Migrated to TypeScript with comprehensive type safety for clinical resource deletion.
 */

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  Stack,
  Chip,
  Divider,
  SxProps,
  Theme,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Delete as DeleteIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { R4 } from '@ahryman40k/ts-fhir-types';

/**
 * Type definitions for ConfirmDeleteDialog component
 */
export type ResourceType = 'condition' | 'medication' | 'allergy';

export interface ResourceDetails {
  status?: string;
  date?: string;
  severity?: string;
  criticality?: string;
  dosage?: string;
}

export interface ConfirmDeleteDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  resourceType: ResourceType;
  resourceData: R4.ICondition | R4.IMedicationRequest | R4.IAllergyIntolerance | null;
  loading?: boolean;
  sx?: SxProps<Theme>;
}

/**
 * Helper functions
 */
const getResourceDisplay = (
  resourceType: ResourceType, 
  resourceData: R4.ICondition | R4.IMedicationRequest | R4.IAllergyIntolerance | null
): string => {
  if (!resourceData) return 'Unknown resource';

  switch (resourceType) {
    case 'condition':
      const condition = resourceData as R4.ICondition;
      return condition.code?.text || 
             condition.code?.coding?.[0]?.display || 
             'Unknown condition';
    
    case 'medication':
      const medication = resourceData as R4.IMedicationRequest;
      return medication.medicationCodeableConcept?.text || 
             medication.medicationCodeableConcept?.coding?.[0]?.display || 
             'Unknown medication';
    
    case 'allergy':
      const allergy = resourceData as R4.IAllergyIntolerance;
      return allergy.code?.text || 
             allergy.code?.coding?.[0]?.display || 
             'Unknown allergen';
    
    default:
      return 'Unknown resource';
  }
};

const getResourceDetails = (
  resourceType: ResourceType, 
  resourceData: R4.ICondition | R4.IMedicationRequest | R4.IAllergyIntolerance | null
): ResourceDetails => {
  if (!resourceData) return {};

  switch (resourceType) {
    case 'condition':
      const condition = resourceData as R4.ICondition;
      return {
        status: condition.clinicalStatus?.coding?.[0]?.code || 'unknown',
        date: condition.onsetDateTime || condition.recordedDate,
        severity: condition.severity?.text || condition.severity?.coding?.[0]?.display
      };
    
    case 'medication':
      const medication = resourceData as R4.IMedicationRequest;
      return {
        status: medication.status || 'unknown',
        date: medication.authoredOn,
        dosage: medication.dosageInstruction?.[0]?.text
      };
    
    case 'allergy':
      const allergy = resourceData as R4.IAllergyIntolerance;
      return {
        status: allergy.clinicalStatus?.coding?.[0]?.code || 'unknown',
        criticality: allergy.criticality,
        date: allergy.recordedDate || allergy.onsetDateTime
      };
    
    default:
      return {};
  }
};

const getWarningMessage = (resourceType: ResourceType): string => {
  switch (resourceType) {
    case 'condition':
      return 'This will remove the condition from the patient\'s active problem list. The condition will be marked as inactive but preserved for medical history.';
    
    case 'medication':
      return 'This will cancel the medication prescription. The medication will be marked as cancelled but preserved for medication history.';
    
    case 'allergy':
      return 'This will remove the allergy from the patient\'s active allergy list. The allergy will be marked as inactive but preserved for safety history.';
    
    default:
      return 'This action will modify the resource status but preserve it for historical records.';
  }
};

const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return 'Unknown date';
  
  try {
    return new Date(dateString).toLocaleDateString();
  } catch (error) {
    return 'Invalid date';
  }
};

const capitalizeResourceType = (resourceType: ResourceType): string => {
  return resourceType.charAt(0).toUpperCase() + resourceType.slice(1);
};

/**
 * ConfirmDeleteDialog Component
 */
const ConfirmDeleteDialog: React.FC<ConfirmDeleteDialogProps> = ({ 
  open, 
  onClose, 
  onConfirm, 
  resourceType, 
  resourceData, 
  loading = false,
  sx 
}) => {
  const resourceDisplay = getResourceDisplay(resourceType, resourceData);
  const resourceDetails = getResourceDetails(resourceType, resourceData);
  const warningMessage = getWarningMessage(resourceType);
  const capitalizedResourceType = capitalizeResourceType(resourceType);

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      sx={sx}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="warning" />
          <Typography variant="h6">
            Confirm Delete {capitalizedResourceType}
          </Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Stack spacing={3}>
          <Alert severity="warning" icon={<InfoIcon />}>
            {warningMessage}
          </Alert>

          <Box>
            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 'bold' }}>
              Resource to be deleted:
            </Typography>
            <Box sx={{ 
              p: 2, 
              backgroundColor: 'grey.50', 
              borderRadius: 1, 
              border: '1px solid', 
              borderColor: 'grey.300' 
            }}>
              <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 1 }}>
                {resourceDisplay}
              </Typography>
              
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {resourceDetails.status && (
                  <Chip 
                    label={`Status: ${resourceDetails.status}`} 
                    size="small" 
                    color={resourceDetails.status === 'active' ? 'success' : 'default'}
                  />
                )}
                {resourceDetails.criticality && (
                  <Chip 
                    label={`Criticality: ${resourceDetails.criticality}`} 
                    size="small" 
                    color={resourceDetails.criticality === 'high' ? 'error' : 'default'}
                  />
                )}
                {resourceDetails.severity && (
                  <Chip 
                    label={`Severity: ${resourceDetails.severity}`} 
                    size="small" 
                  />
                )}
              </Stack>

              {resourceDetails.dosage && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Dosage: {resourceDetails.dosage}
                </Typography>
              )}

              {resourceDetails.date && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Date: {formatDate(resourceDetails.date)}
                </Typography>
              )}
            </Box>
          </Box>

          <Divider />

          <Box>
            <Typography variant="body2" color="text.secondary">
              <strong>Note:</strong> This action uses "soft delete" - the resource will be marked as inactive 
              but preserved in the medical record for auditing and historical purposes. This follows 
              clinical best practices for maintaining complete patient history.
            </Typography>
          </Box>

          <Typography variant="h6" color="error" sx={{ textAlign: 'center' }}>
            Are you sure you want to proceed?
          </Typography>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button 
          onClick={onClose} 
          disabled={loading}
          variant="outlined"
        >
          Cancel
        </Button>
        <Button 
          onClick={onConfirm} 
          color="error" 
          variant="contained"
          disabled={loading}
          startIcon={loading ? null : <DeleteIcon />}
        >
          {loading ? 'Deleting...' : `Delete ${capitalizedResourceType}`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ConfirmDeleteDialog;