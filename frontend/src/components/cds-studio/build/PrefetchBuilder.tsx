/**
 * Prefetch Builder - Visual interface for building prefetch queries
 * 
 * Migrated to TypeScript with comprehensive type safety for CDS Hook prefetch configuration.
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Alert,
  Chip,
  Stack,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SxProps,
  Theme,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Code as CodeIcon,
  Help as HelpIcon,
} from '@mui/icons-material';

/**
 * Type definitions for PrefetchBuilder component
 */
export type HookType = 'patient-view' | 'medication-prescribe' | 'order-sign' | string;

export interface PrefetchQuery {
  key: string;
  query: string;
}

export interface PrefetchConfig {
  [key: string]: string;
}

export interface PrefetchTemplate {
  key: string;
  query: string;
}

export interface PrefetchBuilderProps {
  prefetch?: PrefetchConfig;
  onChange: (prefetch: PrefetchConfig) => void;
  hookType?: HookType;
  sx?: SxProps<Theme>;
}

/**
 * Constants
 */
const PREFETCH_TEMPLATES: Record<string, PrefetchTemplate[]> = {
  'patient-view': [
    { key: 'patient', query: 'Patient/{{context.patientId}}' },
    { key: 'conditions', query: 'Condition?patient={{context.patientId}}' },
    { key: 'medications', query: 'MedicationRequest?patient={{context.patientId}}&status=active' }
  ],
  'medication-prescribe': [
    { key: 'patient', query: 'Patient/{{context.patientId}}' },
    { key: 'activeMedications', query: 'MedicationRequest?patient={{context.patientId}}&status=active' },
    { key: 'allergies', query: 'AllergyIntolerance?patient={{context.patientId}}' }
  ],
  'order-sign': [
    { key: 'patient', query: 'Patient/{{context.patientId}}' },
    { key: 'draftOrders', query: 'ServiceRequest?patient={{context.patientId}}&status=draft' }
  ]
};

/**
 * Helper functions
 */
const isValidPrefetchKey = (key: string): boolean => {
  return key.trim().length > 0 && /^[a-zA-Z][a-zA-Z0-9_]*$/.test(key.trim());
};

const isValidFHIRQuery = (query: string): boolean => {
  return query.trim().length > 0;
};

/**
 * PrefetchBuilder Component
 */
const PrefetchBuilder: React.FC<PrefetchBuilderProps> = ({ 
  prefetch = {}, 
  onChange, 
  hookType,
  sx 
}) => {
  const [newKey, setNewKey] = useState<string>('');
  const [newQuery, setNewQuery] = useState<string>('');
  const [showHelp, setShowHelp] = useState<boolean>(false);
  const [keyError, setKeyError] = useState<string>('');
  const [queryError, setQueryError] = useState<string>('');

  const validateInputs = (): boolean => {
    let valid = true;
    
    if (!isValidPrefetchKey(newKey)) {
      setKeyError('Key must be alphanumeric and start with a letter');
      valid = false;
    } else if (prefetch.hasOwnProperty(newKey.trim())) {
      setKeyError('Key already exists');
      valid = false;
    } else {
      setKeyError('');
    }
    
    if (!isValidFHIRQuery(newQuery)) {
      setQueryError('Query cannot be empty');
      valid = false;
    } else {
      setQueryError('');
    }
    
    return valid;
  };

  const addPrefetch = (): void => {
    if (validateInputs()) {
      const trimmedKey = newKey.trim();
      const trimmedQuery = newQuery.trim();
      
      onChange({
        ...prefetch,
        [trimmedKey]: trimmedQuery
      });
      
      setNewKey('');
      setNewQuery('');
      setKeyError('');
      setQueryError('');
    }
  };

  const removePrefetch = (key: string): void => {
    const updated = { ...prefetch };
    delete updated[key];
    onChange(updated);
  };

  const applyTemplate = (template: PrefetchTemplate): void => {
    onChange({
      ...prefetch,
      [template.key]: template.query
    });
  };

  const handleKeyChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setNewKey(event.target.value);
    setKeyError('');
  };

  const handleQueryChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setNewQuery(event.target.value);
    setQueryError('');
  };

  const prefetchEntries = Object.entries(prefetch);
  const availableTemplates = hookType ? PREFETCH_TEMPLATES[hookType] : undefined;

  return (
    <Box sx={sx}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Prefetch Queries</Typography>
        <Tooltip title="Help">
          <IconButton onClick={() => setShowHelp(!showHelp)} size="small">
            <HelpIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {showHelp && (
        <Alert severity="info" sx={{ mb: 2 }} onClose={() => setShowHelp(false)}>
          <Typography variant="subtitle2" gutterBottom>
            Prefetch allows you to request data before your hook executes.
          </Typography>
          <Typography variant="body2">
            • Use context variables like {`{{context.patientId}}`}<br />
            • Define FHIR queries to fetch needed resources<br />
            • Data will be available in your hook logic
          </Typography>
        </Alert>
      )}

      {/* Templates */}
      {availableTemplates && availableTemplates.length > 0 && (
        <Box mb={3}>
          <Typography variant="subtitle2" gutterBottom>
            Quick Templates:
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {availableTemplates.map((template: PrefetchTemplate, index: number) => (
              <Chip
                key={`${template.key}-${index}`}
                label={template.key}
                onClick={() => applyTemplate(template)}
                clickable
                size="small"
                icon={<AddIcon />}
                disabled={prefetch.hasOwnProperty(template.key)}
              />
            ))}
          </Stack>
        </Box>
      )}

      {/* Existing Prefetch Queries */}
      {prefetchEntries.length > 0 ? (
        <List>
          {prefetchEntries.map(([key, query]: [string, string]) => (
            <ListItem key={key}>
              <ListItemText
                primary={key}
                secondary={
                  <Typography variant="body2" component="span" sx={{ fontFamily: 'monospace' }}>
                    {query}
                  </Typography>
                }
              />
              <ListItemSecondaryAction>
                <IconButton 
                  edge="end" 
                  onClick={() => removePrefetch(key)}
                  aria-label={`Remove prefetch query ${key}`}
                >
                  <DeleteIcon />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      ) : (
        <Alert severity="info" sx={{ mb: 2 }}>
          No prefetch queries defined. Add queries to fetch data before hook execution.
        </Alert>
      )}

      {/* Add New Prefetch */}
      <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Add Prefetch Query
        </Typography>
        <Stack spacing={2}>
          <TextField
            fullWidth
            label="Key"
            value={newKey}
            onChange={handleKeyChange}
            placeholder="e.g., patient, medications"
            size="small"
            error={!!keyError}
            helperText={keyError || 'Alphanumeric key starting with a letter'}
          />
          <TextField
            fullWidth
            label="FHIR Query"
            value={newQuery}
            onChange={handleQueryChange}
            placeholder="e.g., Patient/{{context.patientId}}"
            size="small"
            multiline
            rows={2}
            error={!!queryError}
            helperText={queryError || 'FHIR query string with optional context variables'}
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={addPrefetch}
            disabled={!newKey.trim() || !newQuery.trim()}
          >
            Add Prefetch
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
};

export default PrefetchBuilder;