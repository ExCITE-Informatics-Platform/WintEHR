/**
 * Trends Tab Component
 * Displays vitals and lab trends visualization
 * 
 * Migrated to TypeScript with comprehensive type safety for clinical trends visualization.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
  SxProps,
  Theme,
} from '@mui/material';
import {
  Timeline as TrendsIcon,
  Favorite as VitalsIcon,
  Science as LabIcon,
} from '@mui/icons-material';
import { R4 } from '@ahryman40k/ts-fhir-types';
import { useClinical } from '../../../contexts/ClinicalContext';
import VitalSignsTrends from '../../VitalSignsTrends';
import LabTrends from '../charts/LabTrends';
import VitalsOverview from '../charts/VitalsOverview';
import { fhirClient } from '../../../services/fhirClient';

/**
 * Type definitions for TrendsTab component
 */
export interface TrendsTabProps {
  sx?: SxProps<Theme>;
  compact?: boolean;
}

export interface TabPanelProps {
  children?: React.ReactNode;
  value: number;
  index: number;
  [key: string]: any;
}

export interface VitalSignData {
  id: string;
  patient_id: string;
  observation_date: string;
  display: string;
  value: string;
  value_quantity: number | null;
  unit: string;
  status?: string;
}

export interface ClinicalContextType {
  currentPatient?: {
    id: string;
    name?: R4.IHumanName[];
    birthDate?: string;
    gender?: string;
  } | null;
}

export interface FHIRClientVitalSignsResponse {
  resources: R4.IObservation[];
  total?: number;
  message?: string;
}

/**
 * Helper components
 */
const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`trends-tabpanel-${index}`}
      aria-labelledby={`trends-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

/**
 * Helper functions
 */
const transformObservationToVitalSign = (
  obs: R4.IObservation, 
  patientId: string
): VitalSignData => {
  const value = obs.valueQuantity?.value || obs.valueString || '';
  const unit = obs.valueQuantity?.unit || '';
  
  // Handle blood pressure component observations
  if (obs.component && obs.component.length > 0) {
    const systolic = obs.component.find(c => 
      c.code?.coding?.some(coding => 
        coding.code === '8480-6' || coding.display?.toLowerCase().includes('systolic')
      )
    )?.valueQuantity?.value;
    
    const diastolic = obs.component.find(c => 
      c.code?.coding?.some(coding => 
        coding.code === '8462-4' || coding.display?.toLowerCase().includes('diastolic')
      )
    )?.valueQuantity?.value;
    
    if (systolic && diastolic) {
      return {
        id: obs.id || '',
        patient_id: patientId,
        observation_date: obs.effectiveDateTime || obs.issued || '',
        display: obs.code?.text || obs.code?.coding?.[0]?.display || 'Blood Pressure',
        value: `${systolic}/${diastolic}`,
        value_quantity: null,
        unit: 'mmHg',
        status: obs.status
      };
    }
  }
  
  return {
    id: obs.id || '',
    patient_id: patientId,
    observation_date: obs.effectiveDateTime || obs.issued || '',
    display: obs.code?.text || obs.code?.coding?.[0]?.display || 'Unknown',
    value: value.toString(),
    value_quantity: typeof value === 'number' ? value : parseFloat(value.toString()) || null,
    unit: unit,
    status: obs.status
  };
};

/**
 * TrendsTab Component
 */
const TrendsTab: React.FC<TrendsTabProps> = ({ sx, compact = false }) => {
  const { currentPatient } = useClinical() as ClinicalContextType;
  const [activeTab, setActiveTab] = useState<number>(0);
  const [vitalsData, setVitalsData] = useState<VitalSignData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentPatient) {
      fetchVitalsData();
    }
  }, [currentPatient]);

  const fetchVitalsData = async (): Promise<void> => {
    if (!currentPatient) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Fetch ALL vital signs using FHIR (now defaults to 1000 count)
      const result = await fhirClient.getVitalSigns(currentPatient.id) as FHIRClientVitalSignsResponse;
      
      // Transform FHIR observations to expected format
      const transformedVitals = (result.resources || []).map(obs => 
        transformObservationToVitalSign(obs, currentPatient.id)
      );
      
      setVitalsData(transformedVitals);
    } catch (error) {
      console.error('Error fetching vitals data:', error);
      setError('Failed to load vitals data');
      setVitalsData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number): void => {
    setActiveTab(newValue);
  };

  if (!currentPatient) {
    return (
      <Box sx={{ p: 3, ...sx }}>
        <Alert severity="info">
          Please select a patient to view trends data.
        </Alert>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: compact ? '200px' : '400px',
        ...sx 
      }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, ...sx }}>
        <Alert severity="error">
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: compact ? 2 : 3, ...sx }}>
      {!compact && (
        <>
          <Typography variant="h5" gutterBottom>
            Clinical Trends
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Visualize trends in vital signs and laboratory results over time
          </Typography>
        </>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab 
            icon={<VitalsIcon />} 
            label="Vital Signs" 
            iconPosition="start"
          />
          <Tab 
            icon={<LabIcon />} 
            label="Laboratory" 
            iconPosition="start"
          />
        </Tabs>
      </Box>

      <TabPanel value={activeTab} index={0}>
        {/* Vital Signs Overview */}
        <VitalsOverview 
          patientId={currentPatient.id} 
          vitalsData={vitalsData} 
        />
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        {/* Laboratory Trends */}
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <LabTrends 
                patientId={currentPatient.id} 
                height={compact ? 250 : 350} 
              />
            </Paper>
          </Grid>
        </Grid>
      </TabPanel>
    </Box>
  );
};

export default TrendsTab;