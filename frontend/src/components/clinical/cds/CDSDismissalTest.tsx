/**
 * Test component to verify CDS dismissal functionality
 * This is a temporary component for testing purposes
 * 
 * Migrated to TypeScript with comprehensive type safety for CDS testing utilities.
 */

import React from 'react';
import { Box, Button, Typography, Paper, SxProps, Theme } from '@mui/material';

/**
 * Type definitions for CDSDismissalTest component
 */
export interface CDSDismissalTestProps {
  patientId?: string;
  sx?: SxProps<Theme>;
}

export interface DismissedAlert {
  alertId: string;
  dismissedAt: string;
  patientId: string;
}

/**
 * Constants
 */
const DEFAULT_TEST_PATIENT_ID = 'test-patient-123';

/**
 * Helper functions
 */
const getSessionStorageKey = (patientId: string): string => {
  return `cds-dismissed-alerts-${patientId}`;
};

const getDismissedAlerts = (patientId: string): string[] => {
  const sessionKey = getSessionStorageKey(patientId);
  const stored = sessionStorage.getItem(sessionKey);
  
  if (!stored) {
    return [];
  }
  
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Error parsing dismissed alerts from session storage:', error);
    return [];
  }
};

const clearDismissedAlerts = (patientId: string): void => {
  const sessionKey = getSessionStorageKey(patientId);
  sessionStorage.removeItem(sessionKey);
};

/**
 * CDSDismissalTest Component
 */
const CDSDismissalTest: React.FC<CDSDismissalTestProps> = ({ 
  patientId = DEFAULT_TEST_PATIENT_ID,
  sx 
}) => {
  const checkSessionStorage = (): void => {
    const dismissedAlerts = getDismissedAlerts(patientId);
    
    if (dismissedAlerts.length > 0) {
      const alertList = dismissedAlerts.join('\n');
      alert(`Dismissed alerts for patient ${patientId}:\n${alertList}`);
    } else {
      alert('No dismissed alerts found in session storage');
    }
  };
  
  const clearSessionStorage = (): void => {
    clearDismissedAlerts(patientId);
    alert('Session storage cleared for CDS dismissed alerts');
  };

  const addTestAlert = (): void => {
    const testAlertId = `test-alert-${Date.now()}`;
    const sessionKey = getSessionStorageKey(patientId);
    const existing = getDismissedAlerts(patientId);
    const updated = [...existing, testAlertId];
    
    try {
      sessionStorage.setItem(sessionKey, JSON.stringify(updated));
      alert(`Added test alert: ${testAlertId}`);
    } catch (error) {
      console.error('Error adding test alert:', error);
      alert('Failed to add test alert');
    }
  };

  const exportSessionData = (): void => {
    const dismissedAlerts = getDismissedAlerts(patientId);
    const data = {
      patientId,
      dismissedAlerts,
      exportedAt: new Date().toISOString(),
      sessionKey: getSessionStorageKey(patientId)
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `cds-dismissed-alerts-${patientId}-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  };

  const inspectAllSessionStorage = (): void => {
    const allKeys = Object.keys(sessionStorage);
    const cdsKeys = allKeys.filter(key => key.startsWith('cds-dismissed-alerts-'));
    
    if (cdsKeys.length === 0) {
      alert('No CDS dismissal data found in session storage');
      return;
    }
    
    const report = cdsKeys.map(key => {
      const data = sessionStorage.getItem(key);
      const patientIdMatch = key.match(/cds-dismissed-alerts-(.+)/);
      const extractedPatientId = patientIdMatch ? patientIdMatch[1] : 'unknown';
      
      try {
        const parsed = JSON.parse(data || '[]');
        return `Patient ${extractedPatientId}: ${parsed.length} dismissed alerts`;
      } catch (error) {
        return `Patient ${extractedPatientId}: Invalid data format`;
      }
    }).join('\n');
    
    alert(`CDS Session Storage Report:\n\n${report}`);
  };
  
  return (
    <Paper sx={{ p: 3, m: 2, ...sx }}>
      <Typography variant="h6" gutterBottom>
        CDS Dismissal Test
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Use this to verify that CDS alerts are being properly stored in sessionStorage when dismissed.
      </Typography>
      
      <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
        Current Patient ID: <code>{patientId}</code>
      </Typography>
      
      <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Button variant="contained" onClick={checkSessionStorage}>
          Check Session Storage
        </Button>
        <Button variant="outlined" onClick={clearSessionStorage}>
          Clear Session Storage
        </Button>
        <Button variant="outlined" onClick={addTestAlert} color="secondary">
          Add Test Alert
        </Button>
      </Box>

      <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Button variant="text" onClick={exportSessionData} size="small">
          Export Data
        </Button>
        <Button variant="text" onClick={inspectAllSessionStorage} size="small">
          Inspect All Patients
        </Button>
      </Box>
      
      <Typography variant="caption" display="block" sx={{ mt: 2 }}>
        <strong>Instructions:</strong> Dismiss some CDS alerts in the Clinical Workspace, then click "Check Session Storage" to verify they're being saved.
      </Typography>
      
      <Typography variant="caption" display="block" sx={{ mt: 1, fontStyle: 'italic' }}>
        <strong>Note:</strong> This is a development/testing component and should not be included in production builds.
      </Typography>
    </Paper>
  );
};

export default CDSDismissalTest;