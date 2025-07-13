/**
 * Audit Trail Component
 * Displays FHIR AuditEvent resources with filtering and pagination
 * 
 * Migrated to TypeScript with comprehensive type safety for audit logging and compliance.
 */

import React, { useState, useEffect, ChangeEvent, MouseEvent } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Collapse,
  Button,
  Stack,
  SelectChangeEvent,
  SxProps,
  Theme,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format, parseISO } from 'date-fns';
import {
  Info as InfoIcon,
  FilterList as FilterListIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Security as SecurityIcon,
  Check as CheckIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { R4 } from '@ahryman40k/ts-fhir-types';
import api from '../services/api';
import { fhirClient } from '../services/fhirClient';

/**
 * Type definitions for AuditTrail component
 */
export interface AuditTrailProps {
  patientId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  title?: string;
  showFilters?: boolean;
  maxHeight?: number;
  sx?: SxProps<Theme>;
}

export interface AuditFilters {
  dateFrom: Date | null;
  dateTo: Date | null;
  action: string;
  outcome: string;
  user: string;
  entity: string;
}

export interface AuditActionType {
  value: string;
  label: string;
}

export interface AuditOutcomeType {
  value: string;
  label: string;
}

export type AuditEventAction = 'C' | 'R' | 'U' | 'D' | 'E' | '';
export type AuditEventOutcome = '0' | '4' | '8' | '12' | '';

/**
 * Constants
 */
const ACTION_TYPES: AuditActionType[] = [
  { value: '', label: 'All Actions' },
  { value: 'C', label: 'Create' },
  { value: 'R', label: 'Read' },
  { value: 'U', label: 'Update' },
  { value: 'D', label: 'Delete' },
  { value: 'E', label: 'Execute' }
];

const OUTCOME_TYPES: AuditOutcomeType[] = [
  { value: '', label: 'All Outcomes' },
  { value: '0', label: 'Success' },
  { value: '4', label: 'Minor Failure' },
  { value: '8', label: 'Major Failure' },
  { value: '12', label: 'Serious Failure' }
];

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

/**
 * Helper functions
 */
const getActionColor = (action: string): 'success' | 'info' | 'warning' | 'error' | 'default' => {
  switch (action) {
    case 'C': return 'success';
    case 'R': return 'info';
    case 'U': return 'warning';
    case 'D': return 'error';
    case 'E': return 'default';
    default: return 'default';
  }
};

const getOutcomeColor = (outcome: string): 'success' | 'warning' | 'error' | 'default' => {
  switch (outcome) {
    case '0': return 'success';
    case '4': return 'warning';
    case '8': 
    case '12': return 'error';
    default: return 'default';
  }
};

const getOutcomeIcon = (outcome: string): JSX.Element => {
  switch (outcome) {
    case '0': return <CheckIcon fontSize="small" />;
    case '4': return <WarningIcon fontSize="small" />;
    case '8':
    case '12': return <ErrorIcon fontSize="small" />;
    default: return <InfoIcon fontSize="small" />;
  }
};

const formatAuditDate = (dateString?: string): string => {
  if (!dateString) return 'Unknown';
  try {
    return format(parseISO(dateString), 'MMM dd, yyyy HH:mm:ss');
  } catch (error) {
    return 'Invalid Date';
  }
};

const extractUserName = (agent?: R4.IAuditEvent_Agent[]): string => {
  if (!agent || agent.length === 0) return 'Unknown';
  const primaryAgent = agent[0];
  return primaryAgent.name || primaryAgent.who?.display || 'System';
};

const extractEntityName = (entity?: R4.IAuditEvent_Entity[]): string => {
  if (!entity || entity.length === 0) return 'Unknown';
  const primaryEntity = entity[0];
  return primaryEntity.name || primaryEntity.what?.display || primaryEntity.what?.reference || 'Unknown';
};

/**
 * AuditTrail Component
 */
const AuditTrail: React.FC<AuditTrailProps> = ({
  patientId = null,
  resourceType = null,
  resourceId = null,
  title = 'Audit Trail',
  showFilters: defaultShowFilters = false,
  maxHeight = 600,
  sx
}) => {
  const [auditEvents, setAuditEvents] = useState<R4.IAuditEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(25);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [showFilters, setShowFilters] = useState<boolean>(defaultShowFilters);
  
  // Filters
  const [filters, setFilters] = useState<AuditFilters>({
    dateFrom: null,
    dateTo: null,
    action: '',
    outcome: '',
    user: '',
    entity: resourceType && resourceId ? `${resourceType}/${resourceId}` : ''
  });

  const fetchAuditEvents = async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      // Build search parameters
      const params = new URLSearchParams({
        _count: rowsPerPage.toString(),
        _offset: (page * rowsPerPage).toString(),
        _sort: '-date' // Sort by date descending
      });

      // Add filters
      if (filters.dateFrom) {
        params.append('date', `ge${format(filters.dateFrom, 'yyyy-MM-dd')}`);
      }
      if (filters.dateTo) {
        params.append('date', `le${format(filters.dateTo, 'yyyy-MM-dd')}`);
      }
      if (filters.action) {
        params.append('action', filters.action);
      }
      if (filters.outcome) {
        params.append('outcome', filters.outcome);
      }
      if (filters.user) {
        params.append('agent', filters.user);
      }
      if (filters.entity) {
        params.append('entity', filters.entity);
      }
      if (patientId) {
        params.append('patient', `Patient/${patientId}`);
      }

      const response = await fhirClient.search('AuditEvent', params);

      if (response.entry) {
        const events = response.entry.map(e => e.resource as R4.IAuditEvent);
        setAuditEvents(events);
        setTotalCount(response.total || events.length);
      } else {
        setAuditEvents([]);
        setTotalCount(0);
      }
    } catch (err) {
      console.error('Failed to load audit trail:', err);
      setError('Failed to load audit trail');
      setAuditEvents([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditEvents();
  }, [page, rowsPerPage, filters, patientId, resourceType, resourceId]);

  const handleFilterChange = (field: keyof AuditFilters, value: string | Date | null): void => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
    setPage(0); // Reset to first page on filter change
  };

  const handleChangePage = (event: unknown, newPage: number): void => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: ChangeEvent<HTMLInputElement>): void => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleRefresh = (): void => {
    fetchAuditEvents();
  };

  const toggleFilters = (): void => {
    setShowFilters(!showFilters);
  };

  const clearFilters = (): void => {
    setFilters({
      dateFrom: null,
      dateTo: null,
      action: '',
      outcome: '',
      user: '',
      entity: resourceType && resourceId ? `${resourceType}/${resourceId}` : ''
    });
    setPage(0);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Paper sx={{ p: 3, ...sx }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SecurityIcon color="primary" />
            <Typography variant="h6" fontWeight={600}>
              {title}
            </Typography>
            {totalCount > 0 && (
              <Chip
                label={`${totalCount} events`}
                size="small"
                color="primary"
                variant="outlined"
              />
            )}
          </Box>

          <Stack direction="row" spacing={1}>
            <Tooltip title="Toggle Filters">
              <IconButton onClick={toggleFilters}>
                <FilterListIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Refresh">
              <IconButton onClick={handleRefresh} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>

        {/* Filters */}
        <Collapse in={showFilters}>
          <Paper sx={{ p: 2, mb: 2, bgcolor: 'grey.50' }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6} md={3}>
                <DatePicker
                  label="Date From"
                  value={filters.dateFrom}
                  onChange={(date) => handleFilterChange('dateFrom', date)}
                  slotProps={{
                    textField: {
                      size: 'small',
                      fullWidth: true
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <DatePicker
                  label="Date To"
                  value={filters.dateTo}
                  onChange={(date) => handleFilterChange('dateTo', date)}
                  slotProps={{
                    textField: {
                      size: 'small',
                      fullWidth: true
                    }
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Action</InputLabel>
                  <Select
                    value={filters.action}
                    onChange={(e: SelectChangeEvent) => handleFilterChange('action', e.target.value)}
                    label="Action"
                  >
                    {ACTION_TYPES.map((type) => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2}>
                <FormControl fullWidth size="small">
                  <InputLabel>Outcome</InputLabel>
                  <Select
                    value={filters.outcome}
                    onChange={(e: SelectChangeEvent) => handleFilterChange('outcome', e.target.value)}
                    label="Outcome"
                  >
                    {OUTCOME_TYPES.map((type) => (
                      <MenuItem key={type.value} value={type.value}>
                        {type.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <Button
                  variant="outlined"
                  onClick={clearFilters}
                  size="small"
                  fullWidth
                >
                  Clear Filters
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </Collapse>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Table */}
        <TableContainer sx={{ maxHeight }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Date/Time</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>Outcome</TableCell>
                <TableCell>User</TableCell>
                <TableCell>Entity</TableCell>
                <TableCell>Type</TableCell>
                <TableCell align="center">Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <CircularProgress size={40} />
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Loading audit events...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : auditEvents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">
                      No audit events found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                auditEvents.map((event, index) => {
                  const action = event.action || '';
                  const outcome = event.outcome || '0';
                  const userName = extractUserName(event.agent);
                  const entityName = extractEntityName(event.entity);
                  const eventType = event.type?.display || event.type?.code || 'Unknown';

                  return (
                    <TableRow key={event.id || index} hover>
                      <TableCell>
                        <Typography variant="body2">
                          {formatAuditDate(event.recorded)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={ACTION_TYPES.find(t => t.value === action)?.label || action}
                          color={getActionColor(action)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={getOutcomeIcon(outcome)}
                          label={OUTCOME_TYPES.find(t => t.value === outcome)?.label || outcome}
                          color={getOutcomeColor(outcome)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {userName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {entityName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {eventType}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title="View Details">
                          <IconButton size="small">
                            <InfoIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={handleChangePage}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          rowsPerPageOptions={ROWS_PER_PAGE_OPTIONS}
          sx={{ mt: 1 }}
        />
      </Paper>
    </LocalizationProvider>
  );
};

export default AuditTrail;