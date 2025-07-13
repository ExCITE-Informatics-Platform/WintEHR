/**
 * Encounters Tab Component
 * Display and manage patient encounters
 * 
 * Migrated to TypeScript with comprehensive type safety for encounter management.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  Chip,
  Stack,
  Button,
  IconButton,
  Tooltip,
  Divider,
  Card,
  CardContent,
  CardActions,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  FormControl,
  Select,
  InputLabel,
  CircularProgress,
  Alert,
  useTheme,
  alpha,
  Snackbar,
  SxProps,
  Theme,
  SelectChangeEvent,
  AlertColor,
} from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent,
} from '@mui/lab';
import {
  EventNote as EncounterIcon,
  LocalHospital as HospitalIcon,
  MedicalServices as ClinicIcon,
  LocalHospital as EmergencyIcon,
  Home as HomeIcon,
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  MoreVert as MoreIcon,
  Edit as EditIcon,
  Description as NotesIcon,
  Print as PrintIcon,
  CalendarMonth as CalendarIcon,
  AccessTime as TimeIcon,
  Person as ProviderIcon,
  GetApp as ExportIcon,
} from '@mui/icons-material';
import { format, parseISO, isWithinInterval, subMonths } from 'date-fns';
import { Encounter, Patient } from '@ahryman40k/ts-fhir-types/lib/R4';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useNavigate } from 'react-router-dom';
import EncounterSummaryDialog from '../dialogs/EncounterSummaryDialog';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import { printDocument, formatEncountersForPrint } from '../../../../utils/printUtils';
import { exportClinicalData, EXPORT_COLUMNS } from '../../../../utils/exportUtils';

/**
 * Type definitions for EncountersTab component
 */
export type EncounterStatus = 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled' | 'entered-in-error' | 'unknown';

export type EncounterClass = 'AMB' | 'IMP' | 'EMER' | 'HH' | 'ACUTE' | 'NONAC';

export type ViewMode = 'cards' | 'timeline';

export type FilterPeriod = 'all' | '1m' | '3m' | '6m' | '1y';

export type ExportFormat = 'csv' | 'json' | 'pdf';

export interface EncounterCardProps {
  encounter: Encounter;
  onViewDetails: () => void;
  onEdit: () => void;
}

export interface NewEncounterData {
  type: EncounterClass;
  reasonForVisit: string;
  provider: string;
  startDate: string;
  startTime: string;
}

export interface SnackbarState {
  open: boolean;
  message: string;
  severity: AlertColor;
}

export interface PatientInfo {
  name: string;
  mrn: string;
  birthDate?: string;
  gender?: string;
  phone?: string;
}

export interface EncountersTabProps {
  patientId: string;
  onNotificationUpdate?: (message: string, severity: AlertColor) => void;
  sx?: SxProps<Theme>;
}

export interface EncounterParticipant {
  type?: Array<{
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  }>;
  individual?: {
    reference?: string;
    display?: string;
  };
}

export interface EncounterClass {
  system?: string;
  code?: string;
  display?: string;
}

export interface EncounterType {
  coding?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  text?: string;
}

export interface EncounterPeriod {
  start?: string;
  end?: string;
}

export interface ReasonCode {
  coding?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  text?: string;
}

/**
 * Helper functions
 */
const getEncounterIcon = (encounterClass?: EncounterClass): React.ReactElement => {
  const classCode = typeof encounterClass === 'object' ? encounterClass?.code : encounterClass;
  
  switch (classCode) {
    case 'IMP':
    case 'ACUTE':
      return <HospitalIcon color="error" />;
    case 'EMER':
      return <EmergencyIcon color="error" />;
    case 'HH':
      return <HomeIcon color="info" />;
    case 'AMB':
    default:
      return <ClinicIcon color="primary" />;
  }
};

const getEncounterTypeLabel = (encounter: Encounter): string => {
  return encounter.type?.[0]?.text || 
         encounter.type?.[0]?.coding?.[0]?.display || 
         encounter.class?.display ||
         'Encounter';
};

const getStatusColor = (status?: EncounterStatus): 'success' | 'warning' | 'error' | 'default' => {
  switch (status) {
    case 'finished': return 'success';
    case 'in-progress': return 'warning';
    case 'cancelled': return 'error';
    default: return 'default';
  }
};

const createDefaultNewEncounterData = (): NewEncounterData => ({
  type: 'AMB',
  reasonForVisit: '',
  provider: '',
  startDate: new Date().toISOString().split('T')[0],
  startTime: new Date().toTimeString().split(' ')[0].slice(0, 5),
});

const createEncounterResource = (data: NewEncounterData, patientId: string): Encounter => ({
  resourceType: 'Encounter',
  status: 'in-progress',
  class: {
    system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
    code: data.type,
    display: data.type === 'AMB' ? 'ambulatory' : 
            data.type === 'IMP' ? 'inpatient' : 
            data.type === 'EMER' ? 'emergency' : 'ambulatory',
  },
  type: [{
    text: 'Office Visit',
  }],
  subject: {
    reference: `Patient/${patientId}`,
  },
  period: {
    start: `${data.startDate}T${data.startTime}:00`,
  },
  reasonCode: data.reasonForVisit ? [{
    text: data.reasonForVisit,
  }] : [],
  participant: data.provider ? [{
    type: [{
      coding: [{
        system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
        code: 'ATND',
        display: 'attender',
      }],
    }],
    individual: {
      display: data.provider,
    },
  }] : [],
});

const extractPatientInfo = (patient: Patient | null): PatientInfo => {
  if (!patient) {
    return {
      name: 'Unknown Patient',
      mrn: '',
    };
  }

  const name = patient.name?.[0] ? 
    `${patient.name[0].given?.join(' ') || ''} ${patient.name[0].family || ''}`.trim() : 
    'Unknown Patient';

  const mrn = patient.identifier?.find(id => id.type?.coding?.[0]?.code === 'MR')?.value || patient.id || '';

  return {
    name,
    mrn,
    birthDate: patient.birthDate,
    gender: patient.gender,
    phone: patient.telecom?.find(t => t.system === 'phone')?.value,
  };
};

/**
 * EncounterCard Component
 */
const EncounterCard: React.FC<EncounterCardProps> = ({ encounter, onViewDetails, onEdit }) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleMenuClose = useCallback((): void => {
    setAnchorEl(null);
  }, []);

  const period = encounter.period || {};
  const startDate = period.start ? parseISO(period.start) : null;
  const endDate = period.end ? parseISO(period.end) : null;

  const attendingProvider = encounter.participant?.find(p => 
    p.type?.[0]?.coding?.[0]?.code === 'ATND'
  )?.individual?.display;

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={2} alignItems="center" mb={1}>
              {getEncounterIcon(encounter.class)}
              <Typography variant="h6">
                {getEncounterTypeLabel(encounter)}
              </Typography>
              <Chip 
                label={encounter.status || 'unknown'} 
                size="small" 
                color={getStatusColor(encounter.status as EncounterStatus)}
              />
            </Stack>

            <Stack spacing={1}>
              {startDate && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <CalendarIcon fontSize="small" color="action" />
                  <Typography variant="body2">
                    {format(startDate, 'MMM d, yyyy')}
                  </Typography>
                  <TimeIcon fontSize="small" color="action" />
                  <Typography variant="body2">
                    {format(startDate, 'h:mm a')}
                    {endDate && ` - ${format(endDate, 'h:mm a')}`}
                  </Typography>
                </Stack>
              )}

              {encounter.participant && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <ProviderIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    {attendingProvider || 'No provider recorded'}
                  </Typography>
                </Stack>
              )}

              {encounter.reasonCode && encounter.reasonCode.length > 0 && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Reason for visit:
                  </Typography>
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
                    {encounter.reasonCode.map((reason, idx) => (
                      <Chip 
                        key={idx}
                        label={reason.text || reason.coding?.[0]?.display || 'Unknown reason'} 
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Stack>
                </Box>
              )}
            </Stack>
          </Box>

          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
            <MoreIcon />
          </IconButton>
        </Stack>
      </CardContent>

      <CardActions>
        <Button 
          size="small" 
          startIcon={<NotesIcon />}
          onClick={onViewDetails}
        >
          View Summary
        </Button>
        <Button 
          size="small" 
          startIcon={<EditIcon />}
          onClick={onEdit}
        >
          Edit
        </Button>
      </CardActions>
    </Card>
  );
};

/**
 * EncountersTab Component
 */
const EncountersTab: React.FC<EncountersTabProps> = ({ 
  patientId, 
  onNotificationUpdate,
  sx 
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { getPatientResources, isLoading, currentPatient } = useFHIRResource();
  
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedEncounter, setSelectedEncounter] = useState<Encounter | null>(null);
  const [snackbar, setSnackbar] = useState<SnackbarState>({ 
    open: false, 
    message: '', 
    severity: 'success' 
  });
  const [summaryDialogOpen, setSummaryDialogOpen] = useState<boolean>(false);
  const [newEncounterDialogOpen, setNewEncounterDialogOpen] = useState<boolean>(false);
  const [exportAnchorEl, setExportAnchorEl] = useState<null | HTMLElement>(null);
  const [newEncounterData, setNewEncounterData] = useState<NewEncounterData>(
    createDefaultNewEncounterData()
  );

  useEffect(() => {
    setLoading(false);
  }, []);

  // Get encounters
  const encounters = useMemo(() => {
    return getPatientResources(patientId, 'Encounter') as Encounter[] || [];
  }, [getPatientResources, patientId]);

  // Filter encounters
  const filteredEncounters = useMemo(() => {
    return encounters.filter(encounter => {
      // Type filter
      const matchesType = filterType === 'all' || 
        encounter.class?.code === filterType;

      // Period filter
      let matchesPeriod = true;
      if (filterPeriod !== 'all' && encounter.period?.start) {
        const startDate = parseISO(encounter.period.start);
        const periodMap = {
          '1m': subMonths(new Date(), 1),
          '3m': subMonths(new Date(), 3),
          '6m': subMonths(new Date(), 6),
          '1y': subMonths(new Date(), 12),
        };
        matchesPeriod = isWithinInterval(startDate, {
          start: periodMap[filterPeriod],
          end: new Date(),
        });
      }

      // Search filter
      const matchesSearch = !searchTerm || 
        getEncounterTypeLabel(encounter).toLowerCase().includes(searchTerm.toLowerCase()) ||
        encounter.reasonCode?.some(r => 
          (r.text || r.coding?.[0]?.display || '').toLowerCase().includes(searchTerm.toLowerCase())
        );

      return matchesType && matchesPeriod && matchesSearch;
    });
  }, [encounters, filterType, filterPeriod, searchTerm]);

  // Sort by date descending
  const sortedEncounters = useMemo(() => {
    return [...filteredEncounters].sort((a, b) => {
      const dateA = new Date(a.period?.start || 0);
      const dateB = new Date(b.period?.start || 0);
      return dateB.getTime() - dateA.getTime();
    });
  }, [filteredEncounters]);

  // Handle encounter selection for summary dialog
  const handleViewEncounterDetails = useCallback((encounter: Encounter): void => {
    setSelectedEncounter(encounter);
    setSummaryDialogOpen(true);
  }, []);

  const handleCloseSummaryDialog = useCallback((): void => {
    setSummaryDialogOpen(false);
    setSelectedEncounter(null);
  }, []);

  const handleNewEncounter = useCallback((): void => {
    setNewEncounterDialogOpen(true);
  }, []);

  const updateSnackbar = useCallback((updates: Partial<SnackbarState>): void => {
    setSnackbar(prev => ({ ...prev, ...updates }));
  }, []);

  const handlePrintEncounters = useCallback((): void => {
    const patientInfo = extractPatientInfo(currentPatient);
    const content = formatEncountersForPrint(sortedEncounters);
    
    printDocument({
      title: 'Patient Encounters',
      patient: patientInfo,
      content,
    });
  }, [currentPatient, sortedEncounters]);

  const handleExportEncounters = useCallback((format: ExportFormat): void => {
    exportClinicalData({
      patient: currentPatient,
      data: filteredEncounters,
      columns: EXPORT_COLUMNS.encounters,
      format,
      title: 'Encounter_History',
      formatForPrint: (data: Encounter[]) => {
        let html = '<h2>Encounter History</h2>';
        data.forEach(encounter => {
          const startDate = encounter.period?.start ? 
            format(parseISO(encounter.period.start), 'MMM d, yyyy h:mm a') : 'Unknown';
          const endDate = encounter.period?.end ? 
            format(parseISO(encounter.period.end), 'MMM d, yyyy h:mm a') : 'Ongoing';
          
          html += `
            <div class="section">
              <h3>${getEncounterTypeLabel(encounter)}</h3>
              <p><strong>Status:</strong> ${encounter.status}</p>
              <p><strong>Start:</strong> ${startDate}</p>
              <p><strong>End:</strong> ${endDate}</p>
              ${encounter.participant?.[0]?.individual?.display ? 
                `<p><strong>Provider:</strong> ${encounter.participant[0].individual.display}</p>` : ''}
              ${encounter.location?.[0]?.location?.display ? 
                `<p><strong>Location:</strong> ${encounter.location[0].location.display}</p>` : ''}
              ${encounter.reasonCode?.[0]?.text ? 
                `<p><strong>Reason:</strong> ${encounter.reasonCode[0].text}</p>` : ''}
            </div>
          `;
        });
        return html;
      },
    });
  }, [currentPatient, filteredEncounters]);
  
  const handleCreateEncounter = useCallback(async (): Promise<void> => {
    try {
      const encounter = createEncounterResource(newEncounterData, patientId);

      const response = await fetch('/fhir/R4/Encounter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(encounter),
      });

      if (response.ok) {
        // Refresh patient resources to show new encounter
        window.dispatchEvent(new CustomEvent('fhir-resources-updated', { 
          detail: { patientId } 
        }));
        
        setNewEncounterDialogOpen(false);
        setNewEncounterData(createDefaultNewEncounterData());

        updateSnackbar({
          open: true,
          message: 'New encounter created successfully',
          severity: 'success',
        });
      } else {
        throw new Error(`Failed to create encounter: ${response.statusText}`);
      }
    } catch (error) {
      updateSnackbar({
        open: true,
        message: `Failed to create encounter: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error',
      });
    }
  }, [newEncounterData, patientId, updateSnackbar]);

  const updateNewEncounterData = useCallback((updates: Partial<NewEncounterData>): void => {
    setNewEncounterData(prev => ({ ...prev, ...updates }));
  }, []);

  const handleSelectChange = useCallback((field: 'type' | 'filterType' | 'filterPeriod') => (
    event: SelectChangeEvent<string>
  ): void => {
    const value = event.target.value;
    
    if (field === 'type') {
      updateNewEncounterData({ type: value as EncounterClass });
    } else if (field === 'filterType') {
      setFilterType(value);
    } else if (field === 'filterPeriod') {
      setFilterPeriod(value as FilterPeriod);
    }
  }, [updateNewEncounterData]);

  const handleTextFieldChange = useCallback((field: keyof NewEncounterData) => (
    event: React.ChangeEvent<HTMLInputElement>
  ): void => {
    updateNewEncounterData({ [field]: event.target.value });
  }, [updateNewEncounterData]);

  const handleExportMenuClick = useCallback((event: React.MouseEvent<HTMLElement>): void => {
    setExportAnchorEl(event.currentTarget);
  }, []);

  const handleExportMenuClose = useCallback((): void => {
    setExportAnchorEl(null);
  }, []);

  const handleExportFormat = useCallback((format: ExportFormat): void => {
    handleExportEncounters(format);
    handleExportMenuClose();
  }, [handleExportEncounters, handleExportMenuClose]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, ...sx }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight="bold">
          Encounters
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleNewEncounter}
        >
          New Encounter
        </Button>
      </Stack>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            placeholder="Search encounters..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            sx={{ flex: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
          
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={filterType}
              onChange={handleSelectChange('filterType')}
              label="Type"
            >
              <MenuItem value="all">All Types</MenuItem>
              <MenuItem value="AMB">Ambulatory</MenuItem>
              <MenuItem value="IMP">Inpatient</MenuItem>
              <MenuItem value="EMER">Emergency</MenuItem>
              <MenuItem value="HH">Home Health</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Period</InputLabel>
            <Select
              value={filterPeriod}
              onChange={handleSelectChange('filterPeriod')}
              label="Period"
            >
              <MenuItem value="all">All Time</MenuItem>
              <MenuItem value="1m">Last Month</MenuItem>
              <MenuItem value="3m">Last 3 Months</MenuItem>
              <MenuItem value="6m">Last 6 Months</MenuItem>
              <MenuItem value="1y">Last Year</MenuItem>
            </Select>
          </FormControl>

          <Button
            variant={viewMode === 'cards' ? 'contained' : 'outlined'}
            onClick={() => setViewMode('cards')}
          >
            Cards
          </Button>
          <Button
            variant={viewMode === 'timeline' ? 'contained' : 'outlined'}
            onClick={() => setViewMode('timeline')}
          >
            Timeline
          </Button>
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={handlePrintEncounters}
          >
            Print
          </Button>
          <Button
            variant="outlined"
            startIcon={<ExportIcon />}
            onClick={handleExportMenuClick}
          >
            Export
          </Button>
        </Stack>
      </Paper>

      {/* Summary Stats */}
      <Stack direction="row" spacing={2} mb={3}>
        <Chip 
          label={`${sortedEncounters.length} Total Encounters`} 
          color="primary" 
        />
        <Chip 
          label={`${encounters.filter(e => e.status === 'finished').length} Completed`} 
          color="success" 
        />
        <Chip 
          label={`${encounters.filter(e => e.status === 'in-progress').length} In Progress`} 
          color="warning" 
        />
      </Stack>

      {/* Encounters List/Timeline */}
      {sortedEncounters.length === 0 ? (
        <Alert severity="info">
          No encounters found matching your criteria
        </Alert>
      ) : viewMode === 'cards' ? (
        <Box>
          {sortedEncounters.map((encounter) => (
            <EncounterCard
              key={encounter.id}
              encounter={encounter}
              onViewDetails={() => handleViewEncounterDetails(encounter)}
              onEdit={() => {}}
            />
          ))}
        </Box>
      ) : (
        <Timeline position="alternate">
          {sortedEncounters.map((encounter, index) => (
            <TimelineItem key={encounter.id}>
              <TimelineOppositeContent color="text.secondary">
                {encounter.period?.start && 
                  format(parseISO(encounter.period.start), 'MMM d, yyyy')
                }
              </TimelineOppositeContent>
              <TimelineSeparator>
                <TimelineDot color={encounter.status === 'finished' ? 'success' : 'warning'}>
                  {getEncounterIcon(encounter.class)}
                </TimelineDot>
                {index < sortedEncounters.length - 1 && <TimelineConnector />}
              </TimelineSeparator>
              <TimelineContent>
                <Card>
                  <CardContent>
                    <Typography variant="h6">
                      {getEncounterTypeLabel(encounter)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {encounter.participant?.find(p => 
                        p.type?.[0]?.coding?.[0]?.code === 'ATND'
                      )?.individual?.display || 'No provider recorded'}
                    </Typography>
                    <Button 
                      size="small" 
                      onClick={() => handleViewEncounterDetails(encounter)}
                      sx={{ mt: 1 }}
                    >
                      View Details
                    </Button>
                  </CardContent>
                </Card>
              </TimelineContent>
            </TimelineItem>
          ))}
        </Timeline>
      )}

      {/* Export Menu */}
      <Menu
        anchorEl={exportAnchorEl}
        open={Boolean(exportAnchorEl)}
        onClose={handleExportMenuClose}
      >
        <MenuItem onClick={() => handleExportFormat('csv')}>
          Export as CSV
        </MenuItem>
        <MenuItem onClick={() => handleExportFormat('json')}>
          Export as JSON
        </MenuItem>
        <MenuItem onClick={() => handleExportFormat('pdf')}>
          Export as PDF
        </MenuItem>
      </Menu>

      <EncounterSummaryDialog
        open={summaryDialogOpen}
        onClose={handleCloseSummaryDialog}
        encounter={selectedEncounter}
        patientId={patientId}
      />

      {/* New Encounter Dialog */}
      <Dialog 
        open={newEncounterDialogOpen} 
        onClose={() => setNewEncounterDialogOpen(false)} 
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle>New Encounter</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Encounter Type</InputLabel>
              <Select
                value={newEncounterData.type}
                onChange={handleSelectChange('type')}
                label="Encounter Type"
              >
                <MenuItem value="AMB">Ambulatory (Office Visit)</MenuItem>
                <MenuItem value="IMP">Inpatient</MenuItem>
                <MenuItem value="EMER">Emergency</MenuItem>
                <MenuItem value="HH">Home Health</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Reason for Visit"
              value={newEncounterData.reasonForVisit}
              onChange={handleTextFieldChange('reasonForVisit')}
              multiline
              rows={2}
            />

            <TextField
              fullWidth
              label="Provider"
              value={newEncounterData.provider}
              onChange={handleTextFieldChange('provider')}
              placeholder="Enter provider name"
            />

            <Stack direction="row" spacing={2}>
              <TextField
                label="Date"
                type="date"
                value={newEncounterData.startDate}
                onChange={handleTextFieldChange('startDate')}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="Time"
                type="time"
                value={newEncounterData.startTime}
                onChange={handleTextFieldChange('startTime')}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewEncounterDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleCreateEncounter}
            disabled={!newEncounterData.reasonForVisit.trim()}
          >
            Create Encounter
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => updateSnackbar({ open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert 
          onClose={() => updateSnackbar({ open: false })} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default EncountersTab;