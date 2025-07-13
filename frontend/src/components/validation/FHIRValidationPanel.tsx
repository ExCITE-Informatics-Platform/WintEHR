/**
 * FHIRValidationPanel Component
 * Interactive UI for FHIR resource validation with real-time feedback
 * 
 * Migrated to TypeScript with comprehensive type safety for FHIR validation.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Button,
  IconButton,
  Tooltip,
  Stack,
  TextField,
  Switch,
  FormControlLabel,
  Divider,
  CircularProgress,
  Badge,
  LinearProgress,
  SxProps,
  Theme,
  AlertColor,
} from '@mui/material';
import {
  Error as ErrorIcon,
  Warning as WarningIcon,
  CheckCircle as SuccessIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
  Clear as ClearIcon,
  Settings as SettingsIcon,
  Code as CodeIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material';
import { useResourceValidation, useFHIRValidation } from '../../hooks/useFHIRValidation';

/**
 * Type definitions for FHIRValidationPanel component
 */
export type ValidationSeverity = 'error' | 'warning' | 'information';

export interface ValidationIssue {
  message: string;
  path?: string;
  severity: ValidationSeverity;
  code?: string;
  location?: {
    line?: number;
    column?: number;
  };
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  information?: ValidationIssue[];
  resourceType?: string;
  validatedAt?: string;
}

export interface ValidationOptions {
  strictMode?: boolean;
  validateReferences?: boolean;
  validateCoding?: boolean;
  validateProfiles?: boolean;
  allowUnknownExtensions?: boolean;
  ignoreSlicing?: boolean;
}

export interface ValidationStats {
  cacheSize: number;
  totalErrors: number;
  totalWarnings: number;
  totalValidations: number;
  lastValidation?: string;
}

export interface FHIRResource {
  resourceType: string;
  id?: string;
  meta?: {
    versionId?: string;
    lastUpdated?: string;
    profile?: string[];
  };
  [key: string]: any;
}

export interface ValidationSummaryProps {
  validationResult: ValidationResult | null;
  isValidating: boolean;
}

export interface ValidationIssuesListProps {
  issues: ValidationIssue[];
  severity: ValidationSeverity;
  expanded?: boolean;
}

export interface ValidationSettingsProps {
  options: ValidationOptions;
  onOptionsChange: (options: ValidationOptions) => void;
}

export interface ResourceEditorProps {
  resource: FHIRResource | null;
  onChange: (resource: FHIRResource) => void;
  onValidate: () => void;
}

export interface FHIRValidationPanelProps {
  initialResource?: FHIRResource | null;
  onResourceChange?: (resource: FHIRResource | null) => void;
  sx?: SxProps<Theme>;
}

/**
 * Helper functions
 */
const getSeverityIcon = (severity: ValidationSeverity): React.ReactElement => {
  switch (severity) {
    case 'error': return <ErrorIcon color="error" />;
    case 'warning': return <WarningIcon color="warning" />;
    case 'information': return <InfoIcon color="info" />;
    default: return <InfoIcon />;
  }
};

const getSeverityColor = (severity: ValidationSeverity): AlertColor => {
  switch (severity) {
    case 'error': return 'error';
    case 'warning': return 'warning';
    case 'information': return 'info';
    default: return 'info';
  }
};

const formatSeverityLabel = (severity: ValidationSeverity): string => {
  return severity.charAt(0).toUpperCase() + severity.slice(1);
};

const parseResourceSafely = (resourceText: string): { resource: FHIRResource | null; error: string | null } => {
  try {
    const parsed = JSON.parse(resourceText);
    return { resource: parsed, error: null };
  } catch (error) {
    return { 
      resource: null, 
      error: error instanceof Error ? error.message : 'Invalid JSON format' 
    };
  }
};

/**
 * ValidationSummary Component
 */
const ValidationSummary: React.FC<ValidationSummaryProps> = ({ validationResult, isValidating }) => {
  if (isValidating) {
    return (
      <Card variant="outlined">
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <CircularProgress size={24} />
          <Typography variant="body2">Validating resource...</Typography>
        </CardContent>
      </Card>
    );
  }

  if (!validationResult) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            No validation results available
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const { isValid, errors, warnings, information } = validationResult;
  const totalIssues = errors.length + warnings.length + (information?.length || 0);

  return (
    <Card variant="outlined">
      <CardHeader
        avatar={
          isValid ? (
            <SuccessIcon color="success" />
          ) : (
            <ErrorIcon color="error" />
          )
        }
        title={
          <Typography variant="h6">
            Validation {isValid ? 'Passed' : 'Failed'}
          </Typography>
        }
        subheader={`${totalIssues} issue${totalIssues !== 1 ? 's' : ''} found`}
      />
      <CardContent sx={{ pt: 0 }}>
        <Stack direction="row" spacing={2}>
          {errors.length > 0 && (
            <Chip
              icon={<ErrorIcon />}
              label={`${errors.length} Error${errors.length !== 1 ? 's' : ''}`}
              color="error"
              size="small"
            />
          )}
          {warnings.length > 0 && (
            <Chip
              icon={<WarningIcon />}
              label={`${warnings.length} Warning${warnings.length !== 1 ? 's' : ''}`}
              color="warning"
              size="small"
            />
          )}
          {information && information.length > 0 && (
            <Chip
              icon={<InfoIcon />}
              label={`${information.length} Info`}
              color="info"
              size="small"
            />
          )}
          {totalIssues === 0 && (
            <Chip
              icon={<SuccessIcon />}
              label="No Issues"
              color="success"
              size="small"
            />
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

/**
 * ValidationIssuesList Component
 */
const ValidationIssuesList: React.FC<ValidationIssuesListProps> = ({ 
  issues, 
  severity, 
  expanded = false 
}) => {
  if (!issues || issues.length === 0) return null;

  const icon = getSeverityIcon(severity);
  const color = getSeverityColor(severity);
  const label = formatSeverityLabel(severity);

  return (
    <Accordion defaultExpanded={expanded}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {icon}
          <Typography variant="subtitle2">
            {label}s ({issues.length})
          </Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails>
        <List dense>
          {issues.map((issue, index) => (
            <ListItem key={index}>
              <ListItemIcon>
                <Badge badgeContent={index + 1} color={color} max={999}>
                  {icon}
                </Badge>
              </ListItemIcon>
              <ListItemText
                primary={issue.message}
                secondary={issue.path ? `Path: ${issue.path}` : undefined}
                primaryTypographyProps={{ variant: 'body2' }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
            </ListItem>
          ))}
        </List>
      </AccordionDetails>
    </Accordion>
  );
};

/**
 * ValidationSettings Component
 */
const ValidationSettings: React.FC<ValidationSettingsProps> = ({ options, onOptionsChange }) => {
  const handleOptionChange = useCallback((field: keyof ValidationOptions, value: boolean): void => {
    onOptionsChange({ ...options, [field]: value });
  }, [options, onOptionsChange]);

  return (
    <Card variant="outlined">
      <CardHeader
        avatar={<SettingsIcon />}
        title="Validation Settings"
        titleTypographyProps={{ variant: 'subtitle1' }}
      />
      <CardContent>
        <Stack spacing={2}>
          <FormControlLabel
            control={
              <Switch
                checked={options.strictMode || false}
                onChange={(e) => handleOptionChange('strictMode', e.target.checked)}
              />
            }
            label="Strict Mode"
          />
          <FormControlLabel
            control={
              <Switch
                checked={options.validateReferences !== false}
                onChange={(e) => handleOptionChange('validateReferences', e.target.checked)}
              />
            }
            label="Validate References"
          />
          <FormControlLabel
            control={
              <Switch
                checked={options.validateCoding !== false}
                onChange={(e) => handleOptionChange('validateCoding', e.target.checked)}
              />
            }
            label="Validate Coding"
          />
          <FormControlLabel
            control={
              <Switch
                checked={options.validateProfiles || false}
                onChange={(e) => handleOptionChange('validateProfiles', e.target.checked)}
              />
            }
            label="Validate Profiles"
          />
        </Stack>
      </CardContent>
    </Card>
  );
};

/**
 * ResourceEditor Component
 */
const ResourceEditor: React.FC<ResourceEditorProps> = ({ resource, onChange, onValidate }) => {
  const [resourceText, setResourceText] = useState<string>(
    resource ? JSON.stringify(resource, null, 2) : ''
  );
  const [parseError, setParseError] = useState<string | null>(null);

  const handleResourceChange = useCallback((value: string): void => {
    setResourceText(value);
    setParseError(null);
    
    const { resource: parsed, error } = parseResourceSafely(value);
    
    if (error) {
      setParseError(error);
    } else if (parsed) {
      onChange(parsed);
    }
  }, [onChange]);

  const handleTextFieldChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
    handleResourceChange(event.target.value);
  }, [handleResourceChange]);

  return (
    <Card variant="outlined">
      <CardHeader
        avatar={<CodeIcon />}
        title="FHIR Resource"
        titleTypographyProps={{ variant: 'subtitle1' }}
        action={
          <Button
            variant="outlined"
            size="small"
            startIcon={<AssignmentIcon />}
            onClick={onValidate}
            aria-label="Validate FHIR resource"
          >
            Validate
          </Button>
        }
      />
      <CardContent>
        <TextField
          multiline
          fullWidth
          rows={15}
          value={resourceText}
          onChange={handleTextFieldChange}
          placeholder="Paste your FHIR resource JSON here..."
          error={!!parseError}
          helperText={parseError}
          variant="outlined"
          sx={{
            '& .MuiInputBase-root': {
              fontFamily: 'monospace',
              fontSize: '0.875rem'
            }
          }}
          aria-label="FHIR resource JSON editor"
        />
      </CardContent>
    </Card>
  );
};

/**
 * FHIRValidationPanel Component
 */
const FHIRValidationPanel: React.FC<FHIRValidationPanelProps> = ({ 
  initialResource = null, 
  onResourceChange,
  sx 
}) => {
  const [resource, setResource] = useState<FHIRResource | null>(initialResource);
  const [options, setOptions] = useState<ValidationOptions>({
    strictMode: false,
    validateReferences: true,
    validateCoding: true,
    validateProfiles: false
  });

  const { clearCache, getValidationStats, updateOptions } = useFHIRValidation(options);
  const { validationResult, isValidating, revalidate } = useResourceValidation(resource, options);

  const stats = useMemo(() => getValidationStats(), [getValidationStats, validationResult]);

  const handleResourceChange = useCallback((newResource: FHIRResource | null): void => {
    setResource(newResource);
    onResourceChange?.(newResource);
  }, [onResourceChange]);

  const handleOptionsChange = useCallback((newOptions: ValidationOptions): void => {
    setOptions(newOptions);
    updateOptions(newOptions);
  }, [updateOptions]);

  const handleClearCache = useCallback((): void => {
    clearCache();
    revalidate();
  }, [clearCache, revalidate]);

  return (
    <Box sx={{ p: 2, ...sx }}>
      <Paper elevation={0} sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5" component="h1">
            FHIR Resource Validation
          </Typography>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Refresh Validation">
              <IconButton 
                onClick={revalidate} 
                disabled={isValidating}
                aria-label="Refresh validation"
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Clear Cache">
              <IconButton onClick={handleClearCache} aria-label="Clear validation cache">
                <ClearIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>

        {/* Stats */}
        {stats.cacheSize > 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Validation cache: {stats.cacheSize} resources, {stats.totalErrors} errors, {stats.totalWarnings} warnings
          </Alert>
        )}

        {/* Loading indicator */}
        {isValidating && <LinearProgress sx={{ mb: 2 }} />}

        <Stack spacing={3}>
          {/* Resource Editor */}
          <ResourceEditor
            resource={resource}
            onChange={handleResourceChange}
            onValidate={revalidate}
          />

          {/* Validation Summary */}
          <ValidationSummary
            validationResult={validationResult}
            isValidating={isValidating}
          />

          {/* Validation Issues */}
          {validationResult && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Validation Details
              </Typography>
              
              <Stack spacing={1}>
                <ValidationIssuesList
                  issues={validationResult.errors}
                  severity="error"
                  expanded={validationResult.errors.length > 0}
                />
                
                <ValidationIssuesList
                  issues={validationResult.warnings}
                  severity="warning"
                  expanded={false}
                />
                
                {validationResult.information && (
                  <ValidationIssuesList
                    issues={validationResult.information}
                    severity="information"
                    expanded={false}
                  />
                )}
              </Stack>
            </Box>
          )}

          <Divider />

          {/* Settings */}
          <ValidationSettings
            options={options}
            onOptionsChange={handleOptionsChange}
          />
        </Stack>
      </Paper>
    </Box>
  );
};

export default FHIRValidationPanel;