/**
 * Real-time results indicator component
 * Shows when new results are available for the current patient
 * 
 * Migrated to TypeScript with comprehensive type safety for real-time result notifications.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Alert,
  Collapse,
  IconButton,
  Typography,
  Button,
  Chip,
  SxProps,
  Theme,
} from '@mui/material';
import {
  Close as CloseIcon,
  Refresh as RefreshIcon,
  NewReleases as NewIcon,
} from '@mui/icons-material';
import { R4 } from '@ahryman40k/ts-fhir-types';
import { useWebSocket } from '../../../hooks/useWebSocket';
import { useClinical } from '../../../contexts/ClinicalContext';

/**
 * Type definitions for RealTimeResultsIndicator component
 */
export interface RealTimeResultsIndicatorProps {
  onRefresh?: () => void;
  maxResults?: number;
  autoHideDelay?: number;
  sx?: SxProps<Theme>;
}

export interface NewResult {
  id: string;
  type: 'Lab Result' | 'Diagnostic Report';
  name: string;
  value?: string | number;
  unit?: string;
  status?: string;
  timestamp: Date;
}

export interface WebSocketUpdate {
  resourceType: 'Observation' | 'DiagnosticReport';
  resource: R4.IObservation | R4.IDiagnosticReport;
  action: 'create' | 'update' | 'delete';
  patientId: string;
  timestamp: string;
}

export interface ClinicalContextType {
  currentPatient?: {
    id: string;
    name?: R4.IHumanName[];
    birthDate?: string;
    gender?: string;
  } | null;
}

/**
 * Helper functions
 */
const formatResultValue = (observation: R4.IObservation): string => {
  if (observation.valueQuantity?.value !== undefined) {
    const value = observation.valueQuantity.value;
    const unit = observation.valueQuantity.unit || '';
    return `${value}${unit ? ` ${unit}` : ''}`;
  }
  
  if (observation.valueString) {
    return observation.valueString;
  }
  
  if (observation.valueCodeableConcept?.text) {
    return observation.valueCodeableConcept.text;
  }
  
  if (observation.valueBoolean !== undefined) {
    return observation.valueBoolean ? 'Positive' : 'Negative';
  }
  
  return 'N/A';
};

const getResultName = (resource: R4.IObservation | R4.IDiagnosticReport): string => {
  return resource.code?.text || 
         resource.code?.coding?.[0]?.display || 
         'Unknown test';
};

const isLabResult = (observation: R4.IObservation): boolean => {
  return observation.category?.[0]?.coding?.[0]?.code === 'laboratory';
};

/**
 * RealTimeResultsIndicator Component
 */
const RealTimeResultsIndicator: React.FC<RealTimeResultsIndicatorProps> = ({
  onRefresh,
  maxResults = 3,
  autoHideDelay,
  sx
}) => {
  const { currentPatient } = useClinical() as ClinicalContextType;
  const [showAlert, setShowAlert] = useState<boolean>(false);
  const [newResults, setNewResults] = useState<NewResult[]>([]);

  // Subscribe to Observation and DiagnosticReport updates for current patient
  const { connected, lastUpdate } = useWebSocket({
    resourceTypes: ['Observation', 'DiagnosticReport'],
    patientIds: currentPatient ? [currentPatient.id] : [],
    enabled: !!currentPatient
  });

  useEffect(() => {
    if (lastUpdate && (lastUpdate as WebSocketUpdate).action !== 'delete') {
      const update = lastUpdate as WebSocketUpdate;
      const { resourceType, resource } = update;
      
      let newResult: NewResult | null = null;
      
      // Check if this is a lab result
      if (resourceType === 'Observation' && isLabResult(resource as R4.IObservation)) {
        const observation = resource as R4.IObservation;
        newResult = {
          id: observation.id || '',
          type: 'Lab Result',
          name: getResultName(observation),
          value: formatResultValue(observation),
          status: observation.status,
          timestamp: new Date()
        };
      } else if (resourceType === 'DiagnosticReport') {
        const report = resource as R4.IDiagnosticReport;
        newResult = {
          id: report.id || '',
          type: 'Diagnostic Report',
          name: getResultName(report),
          status: report.status,
          timestamp: new Date()
        };
      }
      
      if (newResult) {
        setNewResults(prev => {
          // Avoid duplicates
          const exists = prev.some(result => result.id === newResult!.id);
          if (exists) return prev;
          
          // Add new result and limit total count
          const updated = [newResult!, ...prev];
          return updated.slice(0, 10); // Keep max 10 results
        });
        setShowAlert(true);
      }
    }
  }, [lastUpdate]);

  // Auto-hide functionality
  useEffect(() => {
    if (showAlert && autoHideDelay && autoHideDelay > 0) {
      const timer = setTimeout(() => {
        setShowAlert(false);
      }, autoHideDelay);
      
      return () => clearTimeout(timer);
    }
  }, [showAlert, autoHideDelay]);

  const handleRefresh = (): void => {
    setShowAlert(false);
    setNewResults([]);
    onRefresh?.();
  };

  const handleClose = (): void => {
    setShowAlert(false);
    setNewResults([]);
  };

  const handleResultClick = (result: NewResult): void => {
    // TODO: Navigate to specific result or open detail view
    console.log('Clicked result:', result);
  };

  if (!connected || !currentPatient || newResults.length === 0) {
    return null;
  }

  const displayResults = newResults.slice(0, maxResults);
  const additionalCount = newResults.length - maxResults;

  return (
    <Collapse in={showAlert}>
      <Alert
        severity="info"
        icon={<NewIcon />}
        action={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              color="inherit"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={handleRefresh}
            >
              Refresh
            </Button>
            <IconButton
              aria-label="close"
              color="inherit"
              size="small"
              onClick={handleClose}
            >
              <CloseIcon fontSize="inherit" />
            </IconButton>
          </Box>
        }
        sx={{ mb: 2, ...sx }}
      >
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            {newResults.length === 1 ? 'New result available' : `${newResults.length} new results available`}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
            {displayResults.map((result) => (
              <Chip
                key={result.id}
                label={`${result.type}: ${result.name}${result.value ? ` (${result.value})` : ''}`}
                size="small"
                color="primary"
                variant="outlined"
                onClick={() => handleResultClick(result)}
                sx={{ 
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: 'primary.light',
                    color: 'primary.contrastText'
                  }
                }}
              />
            ))}
            {additionalCount > 0 && (
              <Chip
                label={`+${additionalCount} more`}
                size="small"
                variant="outlined"
                color="secondary"
              />
            )}
          </Box>
          
          {newResults.length > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Latest: {newResults[0].timestamp.toLocaleTimeString()}
            </Typography>
          )}
        </Box>
      </Alert>
    </Collapse>
  );
};

export default RealTimeResultsIndicator;