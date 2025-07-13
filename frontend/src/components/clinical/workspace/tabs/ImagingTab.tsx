/**
 * Imaging Tab Component
 * Display and manage medical imaging studies with DICOM viewer integration
 * 
 * Migrated to TypeScript with comprehensive type safety for medical imaging.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Grid,
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
  Tabs,
  Tab,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  useTheme,
  alpha,
  SxProps,
  Theme,
  SelectChangeEvent,
  AlertColor,
} from '@mui/material';
import {
  Image as ImagingIcon,
  Scanner as CTIcon,
  MedicalServices as MRIcon,
  CameraAlt as XRayIcon,
  MonitorHeart as UltrasoundIcon,
  Visibility as ViewIcon,
  Download as DownloadIcon,
  Print as PrintIcon,
  Share as ShareIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  CalendarMonth as CalendarIcon,
  LocalHospital as ModalityIcon,
  Description as ReportIcon,
  PlayArrow as PlayIcon,
  Fullscreen as FullscreenIcon,
  ZoomIn as ZoomIcon,
  RotateRight as RotateIcon,
  Brightness6 as WindowIcon,
  GridView as SeriesIcon,
  PhotoLibrary as InstanceIcon,
  Warning as WarningIcon,
  CheckCircle as CompleteIcon,
} from '@mui/icons-material';
import { format, parseISO, formatDistanceToNow, isWithinInterval, subDays, subMonths } from 'date-fns';
import { ImagingStudy, Patient } from '@ahryman40k/ts-fhir-types/lib/R4';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import axios from 'axios';
import DICOMViewer from '../../imaging/DICOMViewer';
import ImagingReportDialog from '../../imaging/ImagingReportDialog';
import DownloadDialog from '../../imaging/DownloadDialog';
import ShareDialog from '../../imaging/ShareDialog';
import { printDocument } from '../../../../utils/printUtils';

/**
 * Type definitions for ImagingTab component
 */
export type ImagingModality = 'CT' | 'MR' | 'MRI' | 'CR' | 'DX' | 'XR' | 'US' | 'NM' | 'RF' | 'MG';

export type StudyStatus = 'available' | 'pending' | 'cancelled' | 'registered' | 'unknown';

export type FilterPeriod = 'all' | '7d' | '30d' | '3m' | '6m' | '1y';

export type StudyAction = 'view' | 'report' | 'download' | 'share' | 'print';

export interface ImagingStudyCard extends ImagingStudy {
  studyDirectory?: string;
  extension?: Array<{
    url: string;
    valueString?: string;
  }>;
}

export interface ImagingStudyCardProps {
  study: ImagingStudyCard;
  onView: (study: ImagingStudyCard) => void;
  onAction: (study: ImagingStudyCard, action: StudyAction) => void;
}

export interface DICOMViewerDialogProps {
  open: boolean;
  onClose: () => void;
  study: ImagingStudyCard | null;
  onDownload: (study: ImagingStudyCard) => void;
}

export interface SnackbarState {
  open: boolean;
  message: string;
  severity: AlertColor;
}

export interface DialogState<T = ImagingStudyCard> {
  open: boolean;
  study: T | null;
}

export interface PatientInfo {
  name: string;
  mrn: string;
  birthDate?: string;
  gender?: string;
  phone?: string;
}

export interface ImagingTabProps {
  patientId: string;
  onNotificationUpdate?: (message: string, severity: AlertColor) => void;
  sx?: SxProps<Theme>;
}

export interface ModalityData {
  code?: string;
  display?: string;
  system?: string;
}

export interface StudySeries {
  uid?: string;
  number?: number;
  modality?: ModalityData;
  description?: string;
  numberOfInstances?: number;
  bodySite?: {
    display?: string;
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  };
  instance?: Array<{
    uid?: string;
    number?: number;
    sopClass?: ModalityData;
    title?: string;
  }>;
}

export interface StudyIdentifier {
  use?: string;
  type?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  };
  system?: string;
  value?: string;
}

/**
 * Helper functions
 */
const getModalityIcon = (modality?: string): React.ReactElement => {
  switch (modality?.toUpperCase()) {
    case 'CT':
      return <CTIcon color="primary" />;
    case 'MR':
    case 'MRI':
      return <MRIcon color="secondary" />;
    case 'CR':
    case 'DX':
    case 'XR':
      return <XRayIcon color="info" />;
    case 'US':
      return <UltrasoundIcon color="success" />;
    default:
      return <ImagingIcon color="action" />;
  }
};

const getModalityColor = (modality?: string): 'primary' | 'secondary' | 'info' | 'success' | 'default' => {
  switch (modality?.toUpperCase()) {
    case 'CT':
      return 'primary';
    case 'MR':
    case 'MRI':
      return 'secondary';
    case 'CR':
    case 'DX':
    case 'XR':
      return 'info';
    case 'US':
      return 'success';
    default:
      return 'default';
  }
};

const getStatusColor = (status?: StudyStatus): 'success' | 'warning' | 'error' | 'default' => {
  switch (status?.toLowerCase() as StudyStatus) {
    case 'available':
      return 'success';
    case 'pending':
      return 'warning';
    case 'cancelled':
      return 'error';
    default:
      return 'default';
  }
};

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

const extractStudyDirectory = (studyObj: ImagingStudyCard): string | null => {
  // Check for direct study directory property
  if (studyObj.studyDirectory) {
    return studyObj.studyDirectory;
  }
  
  // Check for DICOM directory in extensions
  if (studyObj.extension) {
    const dicomDirExt = studyObj.extension.find(
      ext => ext.url === 'http://example.org/fhir/StructureDefinition/dicom-directory'
    );
    if (dicomDirExt && dicomDirExt.valueString) {
      return dicomDirExt.valueString;
    }
  }
  
  // Try to derive from study ID
  if (studyObj.id) {
    // Determine study type from modality or description
    let studyType = 'CT_CHEST'; // Default
    
    if (studyObj.modality && studyObj.modality.length > 0) {
      const modalityCode = studyObj.modality[0].code;
      if (modalityCode === 'CT') {
        studyType = studyObj.description?.toLowerCase().includes('head') ? 'CT_HEAD' : 'CT_CHEST';
      } else if (modalityCode === 'MR') {
        studyType = 'MR_BRAIN';
      } else if (modalityCode === 'US') {
        studyType = 'US_ABDOMEN';
      } else if (modalityCode === 'CR' || modalityCode === 'DX') {
        studyType = 'XR_CHEST';
      }
    }
    
    // Generate directory name based on our convention
    return `${studyType}_${studyObj.id.replace(/-/g, '')}`;
  }
  
  return null;
};

/**
 * ImagingStudyCard Component
 */
const ImagingStudyCardComponent: React.FC<ImagingStudyCardProps> = ({ study, onView, onAction }) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  
  const handleMenuClose = useCallback((): void => {
    setAnchorEl(null);
  }, []);

  const getStudyDescription = useCallback((): string => {
    return study.description || study.procedureCode?.[0]?.coding?.[0]?.display || 'Imaging Study';
  }, [study.description, study.procedureCode]);

  const getBodySite = useCallback((): string => {
    const bodySite = study.bodySite?.[0];
    return bodySite?.display || bodySite?.coding?.[0]?.display || '';
  }, [study.bodySite]);

  const getModality = useCallback((): string => {
    const modality = study.modality?.[0];
    return modality?.display || modality?.code || 'Unknown';
  }, [study.modality]);

  const handleMenuAction = useCallback((action: StudyAction) => (): void => {
    handleMenuClose();
    onAction(study, action);
  }, [study, onAction, handleMenuClose]);

  const handleView = useCallback((): void => {
    onView(study);
  }, [study, onView]);

  const studyDate = study.started || study.performedDateTime;

  return (
    <Card sx={{ mb: 2, '&:hover': { elevation: 3 } }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={2} alignItems="center" mb={1}>
              {getModalityIcon(getModality())}
              <Typography variant="h6">
                {getStudyDescription()}
              </Typography>
              <Chip 
                label={getModality()} 
                size="small" 
                color={getModalityColor(getModality())}
              />
              <Chip 
                label={study.status || 'available'} 
                size="small" 
                color={getStatusColor(study.status as StudyStatus)}
              />
            </Stack>

            {getBodySite() && (
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Body Part: {getBodySite()}
              </Typography>
            )}

            <Stack direction="row" spacing={3} alignItems="center" mt={1}>
              {studyDate && (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <CalendarIcon fontSize="small" color="action" />
                  <Typography variant="caption">
                    {format(parseISO(studyDate), 'MMM d, yyyy HH:mm')}
                  </Typography>
                </Stack>
              )}
              
              <Stack direction="row" spacing={0.5} alignItems="center">
                <SeriesIcon fontSize="small" color="action" />
                <Typography variant="caption">
                  {study.numberOfSeries || 0} series
                </Typography>
              </Stack>

              <Stack direction="row" spacing={0.5} alignItems="center">
                <InstanceIcon fontSize="small" color="action" />
                <Typography variant="caption">
                  {study.numberOfInstances || 0} images
                </Typography>
              </Stack>

              {study.identifier?.[0]?.value && (
                <Typography variant="caption" color="text.secondary">
                  Accession: {study.identifier[0].value}
                </Typography>
              )}
            </Stack>
          </Box>

          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
            <ModalityIcon />
          </IconButton>
        </Stack>
      </CardContent>

      <CardActions>
        <Button 
          size="small" 
          startIcon={<ViewIcon />}
          onClick={handleView}
        >
          View Images
        </Button>
        <Button 
          size="small" 
          startIcon={<ReportIcon />}
          onClick={() => onAction(study, 'report')}
        >
          Report
        </Button>
        <Button 
          size="small" 
          startIcon={<DownloadIcon />}
          onClick={() => onAction(study, 'download')}
        >
          Download
        </Button>
      </CardActions>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleMenuAction('view')}>
          <ViewIcon sx={{ mr: 1 }} />
          View Study
        </MenuItem>
        <MenuItem onClick={handleMenuAction('report')}>
          <ReportIcon sx={{ mr: 1 }} />
          View Report
        </MenuItem>
        <MenuItem onClick={handleMenuAction('share')}>
          <ShareIcon sx={{ mr: 1 }} />
          Share Study
        </MenuItem>
        <MenuItem onClick={handleMenuAction('print')}>
          <PrintIcon sx={{ mr: 1 }} />
          Print Images
        </MenuItem>
      </Menu>
    </Card>
  );
};

/**
 * DICOMViewerDialog Component
 */
const DICOMViewerDialog: React.FC<DICOMViewerDialogProps> = ({ open, onClose, study, onDownload }) => {
  // Prevent body scroll when dialog is open
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  if (!open || !study) return null;
  
  // Render directly without Dialog wrapper for better full-screen experience
  return (
    <DICOMViewer study={study} onClose={onClose} />
  );
};

/**
 * ImagingTab Component
 */
const ImagingTab: React.FC<ImagingTabProps> = ({ 
  patientId, 
  onNotificationUpdate,
  sx 
}) => {
  const theme = useTheme();
  const { getPatientResources, isLoading, currentPatient } = useFHIRResource();
  
  const [tabValue, setTabValue] = useState<number>(0);
  const [filterModality, setFilterModality] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [viewerDialog, setViewerDialog] = useState<DialogState<ImagingStudyCard>>({ open: false, study: null });
  const [reportDialog, setReportDialog] = useState<DialogState<ImagingStudyCard>>({ open: false, study: null });
  const [downloadDialog, setDownloadDialog] = useState<DialogState<ImagingStudyCard>>({ open: false, study: null });
  const [shareDialog, setShareDialog] = useState<DialogState<ImagingStudyCard>>({ open: false, study: null });
  const [studies, setStudies] = useState<ImagingStudyCard[]>([]);
  const [snackbar, setSnackbar] = useState<SnackbarState>({ 
    open: false, 
    message: '', 
    severity: 'success' 
  });

  // Load imaging studies
  useEffect(() => {
    loadImagingStudies();
  }, [patientId]);

  const updateSnackbar = useCallback((updates: Partial<SnackbarState>): void => {
    setSnackbar(prev => ({ ...prev, ...updates }));
  }, []);

  const loadImagingStudies = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      // Try to get imaging studies from FHIR resources first
      const fhirStudies = getPatientResources(patientId, 'ImagingStudy') as ImagingStudyCard[] || [];
      
      // If no FHIR studies, try the API endpoint
      if (fhirStudies.length === 0) {
        try {
          const response = await axios.get(`/api/imaging/studies/${patientId}`);
          const apiStudies: ImagingStudyCard[] = response.data?.data || [];
          setStudies(apiStudies);
        } catch (error) {
          // Failed to load from API - fall back to FHIR data
          setStudies(fhirStudies);
        }
      } else {
        setStudies(fhirStudies);
      }
    } catch (error) {
      // Handle error - imaging studies failed to load
      updateSnackbar({
        open: true,
        message: 'Failed to load imaging studies',
        severity: 'error'
      });
      setStudies([]);
    } finally {
      setLoading(false);
    }
  }, [patientId, getPatientResources, updateSnackbar]);

  // Filter studies
  const filteredStudies = useMemo(() => {
    return studies.filter(study => {
      // Modality filter
      if (filterModality !== 'all') {
        const modality = study.modality?.[0]?.code || study.modality;
        if (typeof modality === 'string' && modality.toLowerCase() !== filterModality.toLowerCase()) {
          return false;
        }
      }

      // Status filter
      if (filterStatus !== 'all' && study.status !== filterStatus) {
        return false;
      }

      // Period filter
      if (filterPeriod !== 'all') {
        const studyDate = study.started || study.performedDateTime;
        if (studyDate) {
          const date = parseISO(studyDate);
          const periodMap: Record<Exclude<FilterPeriod, 'all'>, Date> = {
            '7d': subDays(new Date(), 7),
            '30d': subDays(new Date(), 30),
            '3m': subMonths(new Date(), 3),
            '6m': subMonths(new Date(), 6),
            '1y': subMonths(new Date(), 12)
          };
          if (!isWithinInterval(date, {
            start: periodMap[filterPeriod],
            end: new Date()
          })) {
            return false;
          }
        }
      }

      // Search filter
      if (searchTerm) {
        const searchableText = [
          study.description,
          study.procedureCode?.[0]?.coding?.[0]?.display,
          study.bodySite?.[0]?.display,
          study.modality?.[0]?.display || study.modality?.[0]?.code
        ].filter(Boolean).join(' ').toLowerCase();
        
        if (!searchableText.includes(searchTerm.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }, [studies, filterModality, filterStatus, filterPeriod, searchTerm]);

  // Group studies by modality
  const studiesByModality = useMemo(() => {
    return filteredStudies.reduce((acc: Record<string, ImagingStudyCard[]>, study) => {
      const modality = study.modality?.[0]?.code || study.modality || 'Unknown';
      const modalityKey = typeof modality === 'string' ? modality : 'Unknown';
      if (!acc[modalityKey]) acc[modalityKey] = [];
      acc[modalityKey].push(study);
      return acc;
    }, {});
  }, [filteredStudies]);

  const modalities = useMemo(() => {
    return [...new Set(studies.map(s => {
      const modality = s.modality?.[0]?.code || s.modality;
      return typeof modality === 'string' ? modality : undefined;
    }).filter(Boolean))];
  }, [studies]);

  const handleViewStudy = useCallback((study: ImagingStudyCard): void => {
    setViewerDialog({ open: true, study });
  }, []);

  const handleStudyDownload = useCallback(async (study: ImagingStudyCard): Promise<void> => {
    try {
      // Extract study directory
      const studyDir = extractStudyDirectory(study);
      if (!studyDir) {
        updateSnackbar({
          open: true,
          message: 'Unable to download study - missing directory information',
          severity: 'error'
        });
        return;
      }

      // Download study as ZIP
      const response = await axios.get(`/api/dicom/studies/${studyDir}/download`, {
        responseType: 'blob'
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${study.description || 'study'}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

    } catch (error) {
      updateSnackbar({
        open: true,
        message: `Failed to download study: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });
    }
  }, [updateSnackbar]);

  const handlePrintStudy = useCallback((study: ImagingStudyCard): void => {
    const patientInfo = extractPatientInfo(currentPatient);
    
    let content = '<h2>Imaging Study Report</h2>';
    
    // Study details
    content += '<div class="section">';
    content += `<h3>${study.description || 'Imaging Study'}</h3>`;
    content += '<table>';
    content += `<tr><td><strong>Study Date:</strong></td><td>${study.started ? format(parseISO(study.started), 'MMMM d, yyyy HH:mm') : 'Unknown'}</td></tr>`;
    content += `<tr><td><strong>Modality:</strong></td><td>${study.modality?.[0]?.code || 'Unknown'}</td></tr>`;
    content += `<tr><td><strong>Body Part:</strong></td><td>${study.bodySite?.[0]?.display || 'Not specified'}</td></tr>`;
    content += `<tr><td><strong>Accession Number:</strong></td><td>${study.identifier?.[0]?.value || 'Not available'}</td></tr>`;
    content += `<tr><td><strong>Number of Series:</strong></td><td>${study.numberOfSeries || 0}</td></tr>`;
    content += `<tr><td><strong>Number of Images:</strong></td><td>${study.numberOfInstances || 0}</td></tr>`;
    content += '</table>';
    content += '</div>';
    
    // Series information
    if (study.series && study.series.length > 0) {
      content += '<h3>Series Information</h3>';
      content += '<table>';
      content += '<thead><tr><th>Series</th><th>Description</th><th>Images</th><th>Body Part</th></tr></thead>';
      content += '<tbody>';
      study.series.forEach((series, index) => {
        content += '<tr>';
        content += `<td>${index + 1}</td>`;
        content += `<td>${series.description || 'No description'}</td>`;
        content += `<td>${series.numberOfInstances || 0}</td>`;
        content += `<td>${series.bodySite?.display || '-'}</td>`;
        content += '</tr>';
      });
      content += '</tbody></table>';
    }
    
    // Notes section
    content += '<div class="section" style="margin-top: 30px;">';
    content += '<h3>Clinical Notes</h3>';
    content += '<div style="border: 1px solid #ddd; padding: 20px; min-height: 200px;">';
    content += '<p style="color: #666;">Space for clinical interpretation and notes</p>';
    content += '</div>';
    content += '</div>';
    
    printDocument({
      title: 'Imaging Study Report',
      patient: patientInfo,
      content
    });
  }, [currentPatient]);

  const handlePrintAll = useCallback((): void => {
    const patientInfo = extractPatientInfo(currentPatient);
    
    let content = '<h2>Imaging Studies Summary</h2>';
    
    // Group by modality
    Object.entries(studiesByModality).forEach(([modality, modalityStudies]) => {
      content += `<h3>${modality} Studies (${modalityStudies.length})</h3>`;
      content += '<table class="avoid-break">';
      content += '<thead><tr><th>Date</th><th>Description</th><th>Body Part</th><th>Series</th><th>Images</th></tr></thead>';
      content += '<tbody>';
      
      modalityStudies.forEach(study => {
        content += '<tr>';
        content += `<td>${study.started ? format(parseISO(study.started), 'MMM d, yyyy') : 'Unknown'}</td>`;
        content += `<td>${study.description || 'No description'}</td>`;
        content += `<td>${study.bodySite?.[0]?.display || '-'}</td>`;
        content += `<td>${study.numberOfSeries || 0}</td>`;
        content += `<td>${study.numberOfInstances || 0}</td>`;
        content += '</tr>';
      });
      
      content += '</tbody></table>';
    });
    
    printDocument({
      title: 'Imaging Studies Summary',
      patient: patientInfo,
      content
    });
  }, [currentPatient, studiesByModality]);

  const handleStudyAction = useCallback((study: ImagingStudyCard, action: StudyAction): void => {
    switch (action) {
      case 'view':
        handleViewStudy(study);
        break;
      case 'report':
        setReportDialog({ open: true, study });
        break;
      case 'download':
        setDownloadDialog({ open: true, study });
        break;
      case 'share':
        setShareDialog({ open: true, study });
        break;
      case 'print':
        handlePrintStudy(study);
        break;
      default:
        break;
    }
  }, [handleViewStudy, handlePrintStudy]);

  const handleSelectChange = useCallback((field: 'modality' | 'status' | 'period') => (
    event: SelectChangeEvent<string>
  ): void => {
    const value = event.target.value;
    
    switch (field) {
      case 'modality':
        setFilterModality(value);
        break;
      case 'status':
        setFilterStatus(value);
        break;
      case 'period':
        setFilterPeriod(value as FilterPeriod);
        break;
    }
  }, []);

  const closeDialog = useCallback(<T,>(setter: React.Dispatch<React.SetStateAction<DialogState<T>>>) => (): void => {
    setter({ open: false, study: null });
  }, []);

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
          Medical Imaging
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={handlePrintAll}
          >
            Print
          </Button>
          <Button
            variant="outlined"
            startIcon={<ImagingIcon />}
            onClick={loadImagingStudies}
          >
            Refresh
          </Button>
        </Stack>
      </Stack>

      {/* Summary Stats */}
      <Stack direction="row" spacing={2} mb={3}>
        <Chip 
          label={`${studies.length} Total Studies`} 
          color="primary" 
          icon={<ImagingIcon />}
        />
        {modalities.map(modality => (
          <Chip 
            key={modality}
            label={`${studiesByModality[modality]?.length || 0} ${modality}`} 
            color={getModalityColor(modality)}
            variant="outlined"
          />
        ))}
      </Stack>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            placeholder="Search studies..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            sx={{ flex: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              )
            }}
          />
          
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Modality</InputLabel>
            <Select
              value={filterModality}
              onChange={handleSelectChange('modality')}
              label="Modality"
            >
              <MenuItem value="all">All Modalities</MenuItem>
              {modalities.map(modality => (
                <MenuItem key={modality} value={modality}>{modality}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={filterStatus}
              onChange={handleSelectChange('status')}
              label="Status"
            >
              <MenuItem value="all">All Status</MenuItem>
              <MenuItem value="available">Available</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Period</InputLabel>
            <Select
              value={filterPeriod}
              onChange={handleSelectChange('period')}
              label="Period"
            >
              <MenuItem value="all">All Time</MenuItem>
              <MenuItem value="7d">Last 7 Days</MenuItem>
              <MenuItem value="30d">Last 30 Days</MenuItem>
              <MenuItem value="3m">Last 3 Months</MenuItem>
              <MenuItem value="6m">Last 6 Months</MenuItem>
              <MenuItem value="1y">Last Year</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {/* Studies List */}
      {filteredStudies.length === 0 ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="h6" gutterBottom>No imaging studies found</Typography>
          {studies.length === 0 ? (
            <>
              <Typography variant="body2">
                This patient has no imaging studies yet. Imaging studies will appear here when:
              </Typography>
              <Box component="ul" sx={{ mt: 1, mb: 0 }}>
                <li>New imaging orders are completed</li>
                <li>DICOM files are uploaded to the system</li>
                <li>External studies are imported</li>
              </Box>
            </>
          ) : (
            <Typography variant="body2">
              No studies match the current filter criteria. Try adjusting your search or filters.
            </Typography>
          )}
        </Alert>
      ) : (
        <Box>
          {filteredStudies
            .sort((a, b) => new Date(b.started || b.performedDateTime || 0).getTime() - new Date(a.started || a.performedDateTime || 0).getTime())
            .map((study) => (
              <ImagingStudyCardComponent
                key={study.id}
                study={study}
                onView={handleViewStudy}
                onAction={handleStudyAction}
              />
            ))}
        </Box>
      )}

      {/* DICOM Viewer Dialog */}
      <DICOMViewerDialog
        open={viewerDialog.open}
        onClose={closeDialog(setViewerDialog)}
        study={viewerDialog.study}
        onDownload={handleStudyDownload}
      />

      {/* Imaging Report Dialog */}
      <ImagingReportDialog
        open={reportDialog.open}
        onClose={closeDialog(setReportDialog)}
        study={reportDialog.study}
        patientId={patientId}
      />

      {/* Download Dialog */}
      <DownloadDialog
        open={downloadDialog.open}
        onClose={closeDialog(setDownloadDialog)}
        study={downloadDialog.study}
      />

      {/* Share Dialog */}
      <ShareDialog
        open={shareDialog.open}
        onClose={closeDialog(setShareDialog)}
        study={shareDialog.study}
      />

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

export default ImagingTab;