/**
 * Documentation Tab Component
 * Clinical notes, forms, and documentation management
 * 
 * Migrated to TypeScript with comprehensive type safety for clinical documentation.
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
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextareaAutosize,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
  alpha,
  Snackbar,
  SxProps,
  Theme,
  SelectChangeEvent,
  AlertColor,
} from '@mui/material';
import {
  Description as NoteIcon,
  Assignment as FormIcon,
  AttachFile as AttachmentIcon,
  Edit as EditIcon,
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Print as PrintIcon,
  Share as ShareIcon,
  Lock as SignedIcon,
  LockOpen as UnsignedIcon,
  ExpandMore as ExpandMoreIcon,
  CalendarMonth as CalendarIcon,
  Person as AuthorIcon,
  LocalOffer as TagIcon,
  History as HistoryIcon,
  Notes as SOAPIcon,
  Assessment as AssessmentIcon,
  EventNote as ProgressIcon,
  MedicalServices as ConsultIcon,
  Receipt as DischargeIcon,
  FormatBold as BoldIcon,
  FormatItalic as ItalicIcon,
  FormatUnderlined as UnderlineIcon,
  FormatListBulleted as BulletIcon,
  FormatListNumbered as NumberedIcon,
  Visibility as VisibilityIcon
} from '@mui/icons-material';
import { format, parseISO, formatDistanceToNow, isWithinInterval, subDays, subMonths } from 'date-fns';
import { DocumentReference, Composition, ClinicalImpression, DiagnosticReport, Patient } from '@ahryman40k/ts-fhir-types/lib/R4';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import fhirClient from '../../../../services/fhirClient';
import { useNavigate } from 'react-router-dom';
import { printDocument, formatClinicalNoteForPrint } from '../../../../utils/printUtils';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';

/**
 * Type definitions for DocumentationTab component
 */
export type NoteType = 'progress' | 'soap' | 'consult' | 'discharge' | 'assessment' | 'clinical-note' | 'other' | '34117-2' | '51847-2';
export type DocumentStatus = 'draft' | 'preliminary' | 'final' | 'current' | 'superseded' | 'entered-in-error';
export type FilterPeriod = 'all' | '7d' | '30d' | '3m' | '6m' | '1y';
export type FilterStatus = 'all' | 'draft' | 'final';
export type FilterType = 'all' | 'progress' | 'soap' | 'consult' | 'discharge' | 'assessment';

export interface NoteTypeConfig {
  icon: React.ReactElement;
  label: string;
  color: 'primary' | 'secondary' | 'info' | 'warning' | 'success' | 'default';
}

export interface EnhancedDocumentReference extends Omit<DocumentReference, 'type' | 'status' | 'date' | 'author'> {
  type: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  status: DocumentStatus;
  date?: string;
  author?: Array<{
    display?: string;
    reference?: string;
  }>;
  text?: string;
  docStatus?: string;
  relatesTo?: Array<{
    code?: string;
    target?: {
      reference?: string;
    };
  }>;
  section?: Array<{
    title?: string;
    text?: {
      div?: string;
    } | string;
  }>;
}

export interface SOAPSections {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface NoteData {
  type: NoteType;
  title: string;
  content: string;
  sections: SOAPSections;
}

export interface NoteCardProps {
  note: EnhancedDocumentReference;
  onEdit: (note: EnhancedDocumentReference) => void;
  onView: (note: EnhancedDocumentReference) => void;
  onSign: (note: EnhancedDocumentReference) => void;
}

export interface NoteEditorProps {
  open: boolean;
  onClose: () => void;
  note?: EnhancedDocumentReference | null;
  patientId: string;
  onNotificationUpdate?: (notification: NotificationMessage) => void;
}

export interface AddendumDialogProps {
  open: boolean;
  onClose: () => void;
  note?: EnhancedDocumentReference | null;
  onSave: (addendumText: string) => void;
}

export interface DocumentationTabProps {
  patientId: string;
  onNotificationUpdate?: (notification: NotificationMessage) => void;
  newNoteDialogOpen?: boolean;
  onNewNoteDialogClose?: () => void;
  sx?: SxProps<Theme>;
}

export interface NotificationMessage {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
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

/**
 * Note type configuration
 */
const NOTE_TYPES: Record<NoteType, NoteTypeConfig> = {
  // LOINC codes from actual data
  '34117-2': { icon: <AssessmentIcon />, label: 'History & Physical', color: 'primary' },
  '51847-2': { icon: <ProgressIcon />, label: 'Evaluation & Plan', color: 'info' },
  // Common note types
  'progress': { icon: <ProgressIcon />, label: 'Progress Note', color: 'primary' },
  'soap': { icon: <SOAPIcon />, label: 'SOAP Note', color: 'info' },
  'consult': { icon: <ConsultIcon />, label: 'Consultation', color: 'secondary' },
  'discharge': { icon: <DischargeIcon />, label: 'Discharge Summary', color: 'warning' },
  'assessment': { icon: <AssessmentIcon />, label: 'Assessment', color: 'success' },
  'clinical-note': { icon: <NoteIcon />, label: 'Clinical Note', color: 'primary' },
  'other': { icon: <NoteIcon />, label: 'Other', color: 'default' }
};

/**
 * Helper functions
 */
const safeParseISO = (dateString: string | undefined): Date | null => {
  if (!dateString) return null;
  try {
    return parseISO(dateString);
  } catch {
    return null;
  }
};

const decodeBase64Content = (content?: { data?: string }): string | null => {
  try {
    if (content?.data) {
      return atob(content.data);
    }
    return null;
  } catch (error) {
    return null;
  }
};

const extractPatientInfo = (patient: Patient | null): PatientInfo => {
  if (!patient) {
    return {
      name: 'Unknown Patient',
      mrn: 'Unknown',
    };
  }

  const name = patient.name?.[0] ? 
    `${patient.name[0].given?.join(' ') || ''} ${patient.name[0].family || ''}`.trim() : 
    'Unknown Patient';
  
  const mrn = patient.identifier?.find(id => id.type?.coding?.[0]?.code === 'MR')?.value || patient.id || 'Unknown';
  
  return {
    name,
    mrn,
    birthDate: patient.birthDate,
    gender: patient.gender,
    phone: patient.telecom?.find(t => t.system === 'phone')?.value
  };
};

const validateNoteData = (noteData: NoteData): string | null => {
  if (noteData.type === 'soap') {
    if (!noteData.sections.subjective && !noteData.sections.objective && 
        !noteData.sections.assessment && !noteData.sections.plan) {
      return 'Please fill in at least one SOAP section';
    }
  } else {
    if (!noteData.content.trim()) {
      return 'Please enter note content';
    }
  }
  return null;
};

/**
 * Note Card Component
 */
const NoteCard: React.FC<NoteCardProps> = ({ note, onEdit, onView, onSign }) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState<boolean>(false);
  
  const noteType = (note.type?.coding?.[0]?.code || 'other') as NoteType;
  const typeConfig = NOTE_TYPES[noteType] || NOTE_TYPES.other;
  const author = note.author?.[0]?.display || 'Unknown';
  const date = note.date || note.meta?.lastUpdated;
  const isSigned = note.status === 'final' || note.docStatus === 'final';
  
  const handleEdit = useCallback((): void => {
    onEdit(note);
  }, [onEdit, note]);

  const handleView = useCallback((): void => {
    onView(note);
  }, [onView, note]);

  const handleSign = useCallback((): void => {
    onSign(note);
  }, [onSign, note]);

  const handleAddendum = useCallback((): void => {
    onEdit({ ...note, isAddendum: true } as EnhancedDocumentReference);
  }, [onEdit, note]);

  const toggleExpanded = useCallback((): void => {
    setExpanded(!expanded);
  }, [expanded]);

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={2} alignItems="center" mb={1}>
              <Box sx={{ 
                color: typeConfig.color === 'default' 
                  ? theme.palette.text.secondary 
                  : theme.palette[typeConfig.color]?.main || theme.palette.text.primary 
              }}>
                {typeConfig.icon}
              </Box>
              <Typography variant="h6">
                {typeConfig.label}
              </Typography>
              {isSigned ? (
                <Chip 
                  icon={<SignedIcon />} 
                  label="Signed" 
                  size="small" 
                  color="success"
                />
              ) : (
                <Chip 
                  icon={<UnsignedIcon />} 
                  label="Draft" 
                  size="small" 
                  color="warning"
                />
              )}
            </Stack>

            <Stack direction="row" spacing={3} alignItems="center" mb={2}>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <AuthorIcon fontSize="small" color="action" />
                <Typography variant="caption">{author}</Typography>
              </Stack>
              <Stack direction="row" spacing={0.5} alignItems="center">
                <CalendarIcon fontSize="small" color="action" />
                <Typography variant="caption">
                  {date ? format(parseISO(date), 'MMM d, yyyy h:mm a') : 'No date'}
                </Typography>
              </Stack>
              {date && (
                <Typography variant="caption" color="text.secondary">
                  ({formatDistanceToNow(parseISO(date), { addSuffix: true })})
                </Typography>
              )}
            </Stack>

            <Typography 
              variant="body2" 
              sx={{ 
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: expanded ? 'unset' : 3,
                WebkitBoxOrient: 'vertical',
                whiteSpace: 'pre-wrap'
              }}
            >
              {note.text || 'No content available'}
            </Typography>

            {note.section && (
              <Box mt={2}>
                {note.section.map((section, index) => (
                  <Accordion key={index} expanded={expanded}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle2">
                        {section.title || 'Section'}
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Typography variant="body2">
                        {typeof section.text === 'string' ? section.text : section.text?.div || ''}
                      </Typography>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Box>
            )}
          </Box>

          <Stack direction="column" spacing={1}>
            <Tooltip title="View details">
              <IconButton size="small" onClick={handleView} aria-label="View note details">
                <VisibilityIcon />
              </IconButton>
            </Tooltip>
            {!isSigned && (
              <Tooltip title="Edit note">
                <IconButton size="small" onClick={handleEdit} aria-label="Edit note">
                  <EditIcon />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        </Stack>
      </CardContent>

      <CardActions>
        <Button 
          size="small" 
          onClick={toggleExpanded}
        >
          {expanded ? 'Show Less' : 'Read More'}
        </Button>
        {!isSigned && (
          <Button size="small" color="primary" onClick={handleSign}>
            Sign Note
          </Button>
        )}
        {isSigned && (
          <Button 
            size="small" 
            startIcon={<AddIcon />}
            onClick={handleAddendum}
          >
            Addendum
          </Button>
        )}
        <Button size="small" startIcon={<ShareIcon />}>
          Share
        </Button>
      </CardActions>
    </Card>
  );
};

/**
 * Note Editor Component
 */
const NoteEditor: React.FC<NoteEditorProps> = ({ open, onClose, note, patientId, onNotificationUpdate }) => {
  const { publish } = useClinicalWorkflow();
  const [noteData, setNoteData] = useState<NoteData>({
    type: 'progress',
    title: '',
    content: '',
    sections: {
      subjective: '',
      objective: '',
      assessment: '',
      plan: ''
    }
  });
  const [formatting, setFormatting] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Extract content from FHIR DocumentReference when editing existing note
  useEffect(() => {
    if (note && open) {
      let extractedContent = '';
      let extractedSections: SOAPSections = {
        subjective: '',
        objective: '',
        assessment: '',
        plan: ''
      };

      // Try to decode base64 content
      if (note.content?.[0]?.attachment?.data) {
        try {
          const decodedContent = atob(note.content[0].attachment.data);
          extractedContent = decodedContent;
          
          // Try to parse as JSON for SOAP sections
          try {
            const parsed = JSON.parse(decodedContent);
            if (parsed.subjective || parsed.objective || parsed.assessment || parsed.plan) {
              extractedSections = {
                subjective: parsed.subjective || '',
                objective: parsed.objective || '',
                assessment: parsed.assessment || '',
                plan: parsed.plan || ''
              };
              extractedContent = ''; // Use sections instead of plain content
            }
          } catch (e) {
            // Not JSON, use as plain content
          }
        } catch (e) {
          // Failed to decode - will return original base64 string
        }
      }

      setNoteData({
        type: (note.type?.coding?.[0]?.code || 'progress') as NoteType,
        title: note.description || '',
        content: extractedContent,
        sections: extractedSections
      });
    } else if (!note && open) {
      // Reset for new note
      setNoteData({
        type: 'progress',
        title: '',
        content: '',
        sections: {
          subjective: '',
          objective: '',
          assessment: '',
          plan: ''
        }
      });
    }
  }, [note, open]);

  const handleSave = useCallback(async (signNote = false): Promise<void> => {
    try {
      setLoading(true);

      // Validate form data
      const validationError = validateNoteData(noteData);
      if (validationError) {
        onNotificationUpdate?.({
          type: 'error',
          message: validationError
        });
        return;
      }

      // Prepare content based on note type
      let content = '';
      if (noteData.type === 'soap') {
        // Format SOAP sections
        content = JSON.stringify({
          subjective: noteData.sections.subjective,
          objective: noteData.sections.objective,
          assessment: noteData.sections.assessment,
          plan: noteData.sections.plan
        });
      } else {
        content = noteData.content;
      }

      // Create FHIR DocumentReference
      const documentReference: Partial<DocumentReference> = {
        resourceType: 'DocumentReference',
        status: signNote ? 'current' : 'preliminary',
        docStatus: signNote ? 'final' : 'preliminary',
        type: {
          coding: [{
            system: 'http://loinc.org',
            code: noteData.type === '34117-2' || noteData.type === '51847-2' ? noteData.type : '11488-4',
            display: NOTE_TYPES[noteData.type]?.label || 'Clinical Note'
          }]
        },
        subject: {
          reference: `Patient/${patientId}`
        },
        date: new Date().toISOString(),
        author: [{
          display: 'Current User' // This would come from auth context
        }],
        description: noteData.title || NOTE_TYPES[noteData.type]?.label || 'Clinical Note',
        content: [{
          attachment: {
            contentType: 'text/plain',
            data: btoa(content), // Base64 encode the content
            title: noteData.title || 'Clinical Note'
          }
        }]
      };

      let response: Response;
      if (note && note.id) {
        // Update existing note
        response = await fetch(`/fhir/R4/DocumentReference/${note.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...note,
            ...documentReference,
            id: note.id
          })
        });
      } else {
        // Create new note
        response = await fetch('/fhir/R4/DocumentReference', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(documentReference)
        });
      }

      if (response.ok) {
        const savedNote = await response.json();
        
        // Publish DOCUMENTATION_CREATED event
        await publish(CLINICAL_EVENTS.DOCUMENTATION_CREATED, {
          ...savedNote,
          noteType: NOTE_TYPES[noteData.type]?.label || 'Clinical Note',
          isUpdate: !!(note && note.id),
          isSigned: signNote,
          patientId,
          timestamp: new Date().toISOString()
        });
        
        // Publish workflow notification
        await publish(CLINICAL_EVENTS.WORKFLOW_NOTIFICATION, {
          workflowType: 'clinical-documentation',
          step: note && note.id ? 'updated' : 'created',
          data: {
            noteType: NOTE_TYPES[noteData.type]?.label || 'Clinical Note',
            title: noteData.title || 'Clinical Note',
            isSigned: signNote,
            patientId,
            timestamp: new Date().toISOString()
          }
        });
        
        // Refresh patient resources to show new/updated note
        window.dispatchEvent(new CustomEvent('fhir-resources-updated', { 
          detail: { patientId } 
        }));
        
        onNotificationUpdate?.({
          type: 'success',
          message: `Note ${note ? 'updated' : 'created'} successfully`
        });
        
        onClose();
      } else {
        throw new Error(`Failed to save note: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error saving note:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save note. Please try again.';
      onNotificationUpdate?.({
        type: 'error',
        message: errorMessage
      });
    } finally {
      setLoading(false);
    }
  }, [noteData, note, patientId, onNotificationUpdate, onClose, publish]);

  const handleTypeChange = useCallback((event: SelectChangeEvent<string>): void => {
    setNoteData(prev => ({ ...prev, type: event.target.value as NoteType }));
  }, []);

  const handleTitleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
    setNoteData(prev => ({ ...prev, title: event.target.value }));
  }, []);

  const handleContentChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
    setNoteData(prev => ({ ...prev, content: event.target.value }));
  }, []);

  const handleSectionChange = useCallback((section: keyof SOAPSections) => 
    (event: React.ChangeEvent<HTMLInputElement>): void => {
      setNoteData(prev => ({
        ...prev,
        sections: { ...prev.sections, [section]: event.target.value }
      }));
    }, []);

  const handleFormattingChange = useCallback((event: React.MouseEvent<HTMLElement>, newFormats: string[]): void => {
    setFormatting(newFormats);
  }, []);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {note ? 'Edit Clinical Note' : 'New Clinical Note'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 2 }}>
          <FormControl fullWidth>
            <InputLabel>Note Type</InputLabel>
            <Select
              value={noteData.type}
              onChange={handleTypeChange}
              label="Note Type"
            >
              {Object.entries(NOTE_TYPES).map(([key, config]) => (
                <MenuItem key={key} value={key}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {config.icon}
                    <span>{config.label}</span>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            fullWidth
            label="Note Title"
            value={noteData.title}
            onChange={handleTitleChange}
            placeholder="Enter a descriptive title for this note"
          />

          {noteData.type === 'soap' ? (
            <>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Subjective"
                value={noteData.sections.subjective}
                onChange={handleSectionChange('subjective')}
                placeholder="Patient's subjective complaints and symptoms..."
              />
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Objective"
                value={noteData.sections.objective}
                onChange={handleSectionChange('objective')}
                placeholder="Objective findings, vital signs, physical exam..."
              />
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Assessment"
                value={noteData.sections.assessment}
                onChange={handleSectionChange('assessment')}
                placeholder="Clinical assessment and diagnosis..."
              />
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Plan"
                value={noteData.sections.plan}
                onChange={handleSectionChange('plan')}
                placeholder="Treatment plan and follow-up..."
              />
            </>
          ) : (
            <>
              <Box>
                <ToggleButtonGroup
                  value={formatting}
                  onChange={handleFormattingChange}
                  aria-label="text formatting"
                  size="small"
                  sx={{ mb: 1 }}
                >
                  <ToggleButton value="bold" aria-label="bold">
                    <BoldIcon />
                  </ToggleButton>
                  <ToggleButton value="italic" aria-label="italic">
                    <ItalicIcon />
                  </ToggleButton>
                  <ToggleButton value="underlined" aria-label="underlined">
                    <UnderlineIcon />
                  </ToggleButton>
                  <ToggleButton value="bullet" aria-label="bullet list">
                    <BulletIcon />
                  </ToggleButton>
                  <ToggleButton value="numbered" aria-label="numbered list">
                    <NumberedIcon />
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>
              <TextField
                fullWidth
                multiline
                rows={10}
                label="Note Content"
                value={noteData.content}
                onChange={handleContentChange}
                placeholder="Enter clinical note content..."
              />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button 
          onClick={() => handleSave(false)}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : undefined}
        >
          {loading ? 'Saving...' : 'Save as Draft'}
        </Button>
        <Button 
          variant="contained" 
          onClick={() => handleSave(true)}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : undefined}
        >
          {loading ? 'Saving...' : 'Save & Sign'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/**
 * Addendum Dialog Component
 */
const AddendumDialog: React.FC<AddendumDialogProps> = ({ open, onClose, note, onSave }) => {
  const [addendumText, setAddendumText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  
  const handleSave = useCallback(async (): Promise<void> => {
    if (addendumText.trim()) {
      setLoading(true);
      try {
        await onSave(addendumText);
        setAddendumText('');
      } finally {
        setLoading(false);
      }
    }
  }, [addendumText, onSave]);

  const handleTextChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
    setAddendumText(event.target.value);
  }, []);
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Add Addendum to Note
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Alert severity="info">
            You are adding an addendum to a signed note. The original note cannot be modified.
          </Alert>
          
          {note && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Original Note:
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {note.text || 'No content'}
              </Typography>
              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                Signed by {note.author?.[0]?.display} on {note.date ? format(parseISO(note.date), 'MMM d, yyyy h:mm a') : 'Unknown'}
              </Typography>
            </Paper>
          )}
          
          <TextField
            fullWidth
            multiline
            rows={6}
            label="Addendum Text"
            value={addendumText}
            onChange={handleTextChange}
            placeholder="Enter your addendum..."
            helperText="This addendum will be permanently attached to the original note."
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button 
          variant="contained" 
          onClick={handleSave}
          disabled={!addendumText.trim() || loading}
          startIcon={loading ? <CircularProgress size={20} /> : undefined}
        >
          {loading ? 'Saving...' : 'Save Addendum'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/**
 * Main DocumentationTab Component
 */
const DocumentationTab: React.FC<DocumentationTabProps> = ({ 
  patientId, 
  onNotificationUpdate, 
  newNoteDialogOpen, 
  onNewNoteDialogClose,
  sx 
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { getPatientResources, isLoading, currentPatient } = useFHIRResource();
  const { publish } = useClinicalWorkflow();
  
  const [tabValue, setTabValue] = useState<number>(0);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [snackbar, setSnackbar] = useState<SnackbarState>({ open: false, message: '', severity: 'success' });
  const [editorOpen, setEditorOpen] = useState<boolean>(false);
  const [selectedNote, setSelectedNote] = useState<EnhancedDocumentReference | null>(null);
  const [addendumDialogOpen, setAddendumDialogOpen] = useState<boolean>(false);
  const [selectedNoteForAddendum, setSelectedNoteForAddendum] = useState<EnhancedDocumentReference | null>(null);

  useEffect(() => {
    setLoading(false);
  }, []);

  // Get documentation resources with proper typing
  const documentReferences = useMemo(() => 
    (getPatientResources(patientId, 'DocumentReference') as DocumentReference[] || []),
  [getPatientResources, patientId]);
  
  const compositions = useMemo(() => 
    (getPatientResources(patientId, 'Composition') as Composition[] || []),
  [getPatientResources, patientId]);
  
  const clinicalImpressions = useMemo(() => 
    (getPatientResources(patientId, 'ClinicalImpression') as ClinicalImpression[] || []),
  [getPatientResources, patientId]);
  
  const diagnosticReports = useMemo(() => 
    (getPatientResources(patientId, 'DiagnosticReport') as DiagnosticReport[] || []),
  [getPatientResources, patientId]);
  
  // Process DocumentReference resources to extract notes
  const processedDocumentReferences = useMemo((): EnhancedDocumentReference[] => {
    return documentReferences.map(doc => {
      const decodedContent = doc.content?.[0]?.attachment ? 
        decodeBase64Content(doc.content[0].attachment) : null;
      
      return {
        ...doc,
        type: doc.type || { coding: [{ code: 'other' }] },
        status: (doc.status as DocumentStatus) || 'final',
        date: doc.date || doc.content?.[0]?.attachment?.creation,
        author: doc.author || [{ display: 'Unknown' }],
        text: decodedContent || doc.description || 'No content available'
      } as EnhancedDocumentReference;
    });
  }, [documentReferences]);
  
  // Process DiagnosticReport resources to extract notes
  const processedDiagnosticReports = useMemo((): EnhancedDocumentReference[] => {
    return diagnosticReports.map(report => {
      const decodedContent = report.presentedForm?.[0] ? 
        decodeBase64Content(report.presentedForm[0] as any) : null;
      
      return {
        ...report,
        resourceType: 'DocumentReference', // Treat as document for display
        type: { coding: [{ code: 'assessment' }] },
        status: (report.status as DocumentStatus) || 'final',
        date: report.issued || report.effectiveDateTime,
        author: report.performer || [{ display: 'System' }],
        text: decodedContent || report.conclusion || 'No content available'
      } as EnhancedDocumentReference;
    });
  }, [diagnosticReports]);

  // Combine all documentation
  const allDocuments = useMemo((): EnhancedDocumentReference[] => {
    return [
      ...processedDocumentReferences, 
      ...compositions.map(comp => ({
        ...comp,
        resourceType: 'DocumentReference',
        type: comp.type || { coding: [{ code: 'other' }] },
        status: (comp.status as DocumentStatus) || 'final',
        text: comp.title || 'No content available'
      } as EnhancedDocumentReference)), 
      ...clinicalImpressions.map(imp => ({
        ...imp,
        resourceType: 'DocumentReference',
        type: { coding: [{ code: 'assessment' }] },
        status: (imp.status as DocumentStatus) || 'final',
        text: imp.summary || imp.description || 'No content available'
      } as EnhancedDocumentReference)), 
      ...processedDiagnosticReports
    ];
  }, [processedDocumentReferences, compositions, clinicalImpressions, processedDiagnosticReports]);

  // Filter documents
  const filterDocuments = useCallback((docs: EnhancedDocumentReference[]): EnhancedDocumentReference[] => {
    return docs.filter(doc => {
      // Type filter
      if (filterType !== 'all') {
        const docType = doc.type?.coding?.[0]?.code;
        if (docType !== filterType) return false;
      }

      // Status filter
      if (filterStatus !== 'all' && doc.status !== filterStatus) {
        return false;
      }

      // Period filter
      if (filterPeriod !== 'all') {
        const docDate = doc.date || doc.meta?.lastUpdated;
        if (docDate) {
          const date = safeParseISO(docDate);
          if (date) {
            const periodMap = {
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
      }

      // Search filter
      if (searchTerm) {
        const searchableText = [
          doc.type?.text,
          doc.type?.coding?.[0]?.display,
          doc.text,
          doc.description,
          doc.author?.[0]?.display
        ].filter(Boolean).join(' ').toLowerCase();
        
        if (!searchableText.includes(searchTerm.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }, [filterType, filterStatus, filterPeriod, searchTerm]);

  const filteredDocuments = useMemo(() => filterDocuments(allDocuments), [filterDocuments, allDocuments]);
  
  const sortedDocuments = useMemo(() => {
    return [...filteredDocuments].sort((a, b) => {
      const dateA = new Date(a.date || a.meta?.lastUpdated || 0);
      const dateB = new Date(b.date || b.meta?.lastUpdated || 0);
      return dateB.getTime() - dateA.getTime();
    });
  }, [filteredDocuments]);

  // Count documents by status
  const draftCount = useMemo(() => 
    allDocuments.filter(d => d.status === 'draft' || d.status === 'preliminary').length,
  [allDocuments]);
  
  const signedCount = useMemo(() => 
    allDocuments.filter(d => d.status === 'final' || d.status === 'current').length,
  [allDocuments]);

  const handleNewNote = useCallback((): void => {
    setSelectedNote(null);
    setEditorOpen(true);
  }, []);

  const handleEditNote = useCallback((note: EnhancedDocumentReference): void => {
    if ((note as any).isAddendum) {
      // This is from the addendum button in NoteCard
      setSelectedNoteForAddendum(note);
      setAddendumDialogOpen(true);
    } else {
      // Regular edit
      setSelectedNote(note);
      setEditorOpen(true);
    }
  }, []);

  const handleViewNote = useCallback((note: EnhancedDocumentReference): void => {
    // Show note details in a modal or expanded view
    setSelectedNote(note);
    // You could also open a dialog here if needed
  }, []);

  const handleSignNote = useCallback(async (note: EnhancedDocumentReference): Promise<void> => {
    try {
      // Update the note status to final
      const updatedNote = {
        ...note,
        status: 'current',
        docStatus: 'final'
      };
      
      const response = await fetch(`/fhir/R4/DocumentReference/${note.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedNote)
      });
      
      if (response.ok) {
        // Publish DOCUMENTATION_CREATED event (for signed note)
        await publish(CLINICAL_EVENTS.DOCUMENTATION_CREATED, {
          ...updatedNote,
          noteType: note.type?.coding?.[0]?.display || 'Clinical Note',
          isUpdate: true,
          isSigned: true,
          patientId,
          timestamp: new Date().toISOString()
        });
        
        // Publish workflow notification
        await publish(CLINICAL_EVENTS.WORKFLOW_NOTIFICATION, {
          workflowType: 'clinical-documentation',
          step: 'signed',
          data: {
            noteType: note.type?.coding?.[0]?.display || 'Clinical Note',
            title: note.description || 'Clinical Note',
            isSigned: true,
            patientId,
            timestamp: new Date().toISOString()
          }
        });
        
        // Refresh patient resources to show updated status
        window.dispatchEvent(new CustomEvent('fhir-resources-updated', { 
          detail: { patientId } 
        }));
        
        setSnackbar({
          open: true,
          message: 'Note signed successfully',
          severity: 'success'
        });
      } else {
        throw new Error(`Failed to sign note: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error signing note:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to sign note';
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error'
      });
    }
  }, [patientId, publish]);
  
  const handleSaveAddendum = useCallback(async (addendumText: string): Promise<void> => {
    if (!selectedNoteForAddendum || !addendumText.trim()) {
      throw new Error('Invalid addendum data');
    }

    try {
      // Create the addendum DocumentReference
      const addendumResource: Partial<DocumentReference> = {
        resourceType: 'DocumentReference',
        status: 'current',
        docStatus: 'final',
        type: {
          coding: [{
            system: 'http://loinc.org',
            code: '11506-3',
            display: 'Progress note'
          }],
          text: 'Addendum'
        },
        category: [{
          coding: [{
            system: 'http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category',
            code: 'clinical-note',
            display: 'Clinical Note'
          }]
        }],
        subject: {
          reference: `Patient/${patientId}`
        },
        date: new Date().toISOString(),
        author: [{
          display: 'Current User' // This would come from auth context
        }],
        relatesTo: [{
          code: 'appends',
          target: {
            reference: `DocumentReference/${selectedNoteForAddendum.id}`
          }
        }],
        description: `Addendum to ${selectedNoteForAddendum.type?.text || 'note'} from ${selectedNoteForAddendum.date ? format(parseISO(selectedNoteForAddendum.date), 'MMM d, yyyy') : 'unknown date'}`,
        content: [{
          attachment: {
            contentType: 'text/plain',
            data: btoa(addendumText), // Base64 encode the text
            creation: new Date().toISOString()
          }
        }]
      };

      // Save the addendum
      const createdAddendum = await fhirClient.createDocumentReference(addendumResource);
      
      // Publish DOCUMENTATION_CREATED event
      await publish(CLINICAL_EVENTS.DOCUMENTATION_CREATED, {
        ...createdAddendum,
        noteType: 'Addendum',
        isUpdate: false,
        isSigned: true,
        isAddendum: true,
        originalNoteId: selectedNoteForAddendum.id,
        patientId,
        timestamp: new Date().toISOString()
      });
      
      // Publish workflow notification
      await publish(CLINICAL_EVENTS.WORKFLOW_NOTIFICATION, {
        workflowType: 'clinical-documentation',
        step: 'addendum-created',
        data: {
          noteType: 'Addendum',
          originalNoteTitle: selectedNoteForAddendum.description || 'Clinical Note',
          patientId,
          timestamp: new Date().toISOString()
        }
      });
      
      // Refresh the documents list
      await fhirClient.refreshPatientResources(patientId);
      
      // Close dialog and clear state
      setAddendumDialogOpen(false);
      setSelectedNoteForAddendum(null);
      
      // Show success message
      setSnackbar({
        open: true,
        message: 'Addendum saved successfully',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error saving addendum:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save addendum';
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error'
      });
    }
  }, [selectedNoteForAddendum, patientId, publish]);
  
  const handlePrintDocumentation = useCallback((): void => {
    const patientInfo = extractPatientInfo(currentPatient as Patient);
    
    let content = '';
    sortedDocuments.forEach((doc, index) => {
      if (index > 0) content += '<div class="page-break"></div>';
      content += formatClinicalNoteForPrint(doc);
    });
    
    printDocument({
      title: 'Clinical Documentation',
      patient: patientInfo,
      content
    });
  }, [currentPatient, sortedDocuments]);

  const handleFilterTypeChange = useCallback((event: SelectChangeEvent<string>): void => {
    setFilterType(event.target.value as FilterType);
  }, []);

  const handleFilterStatusChange = useCallback((event: SelectChangeEvent<string>): void => {
    setFilterStatus(event.target.value as FilterStatus);
  }, []);

  const handleFilterPeriodChange = useCallback((event: SelectChangeEvent<string>): void => {
    setFilterPeriod(event.target.value as FilterPeriod);
  }, []);

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
    setSearchTerm(event.target.value);
  }, []);

  const handleSnackbarClose = useCallback((): void => {
    setSnackbar(prev => ({ ...prev, open: false }));
  }, []);

  const handleNotificationUpdate = useCallback((notification: NotificationMessage): void => {
    setSnackbar({
      open: true,
      message: notification.message,
      severity: notification.type === 'error' ? 'error' : 'success'
    });
  }, []);
  
  useEffect(() => {
    if (newNoteDialogOpen) {
      handleNewNote();
    }
  }, [newNoteDialogOpen, handleNewNote]);
  
  useEffect(() => {
    if (!editorOpen && onNewNoteDialogClose) {
      onNewNoteDialogClose();
    }
  }, [editorOpen, onNewNoteDialogClose]);

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
          Clinical Documentation
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleNewNote}
        >
          New Note
        </Button>
      </Stack>

      {/* Summary Stats */}
      <Stack direction="row" spacing={2} mb={3}>
        <Chip 
          label={`${draftCount} Draft Notes`} 
          color="warning" 
          icon={<UnsignedIcon />}
        />
        <Chip 
          label={`${signedCount} Signed Notes`} 
          color="success" 
          icon={<SignedIcon />}
        />
        <Chip 
          label={`${allDocuments.length} Total Documents`} 
          color="primary" 
        />
      </Stack>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            placeholder="Search documentation..."
            value={searchTerm}
            onChange={handleSearchChange}
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
            <InputLabel>Type</InputLabel>
            <Select
              value={filterType}
              onChange={handleFilterTypeChange}
              label="Type"
            >
              <MenuItem value="all">All Types</MenuItem>
              <MenuItem value="progress">Progress Notes</MenuItem>
              <MenuItem value="soap">SOAP Notes</MenuItem>
              <MenuItem value="consult">Consultations</MenuItem>
              <MenuItem value="discharge">Discharge Summaries</MenuItem>
              <MenuItem value="assessment">Assessments</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={filterStatus}
              onChange={handleFilterStatusChange}
              label="Status"
            >
              <MenuItem value="all">All Status</MenuItem>
              <MenuItem value="draft">Draft</MenuItem>
              <MenuItem value="final">Signed</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Period</InputLabel>
            <Select
              value={filterPeriod}
              onChange={handleFilterPeriodChange}
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

          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={handlePrintDocumentation}
          >
            Print
          </Button>
        </Stack>
      </Paper>

      {/* Documents List */}
      {sortedDocuments.length === 0 ? (
        <Alert severity="info">
          No documentation found matching your criteria
        </Alert>
      ) : (
        <Box>
          {sortedDocuments.map((document) => (
            <NoteCard
              key={document.id}
              note={document}
              onEdit={handleEditNote}
              onView={handleViewNote}
              onSign={handleSignNote}
            />
          ))}
        </Box>
      )}

      {/* Note Editor Dialog */}
      <NoteEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        note={selectedNote}
        patientId={patientId}
        onNotificationUpdate={handleNotificationUpdate}
      />
      
      {/* Addendum Dialog */}
      <AddendumDialog
        open={addendumDialogOpen}
        onClose={() => {
          setAddendumDialogOpen(false);
          setSelectedNoteForAddendum(null);
        }}
        note={selectedNoteForAddendum}
        onSave={handleSaveAddendum}
      />

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Alert 
          onClose={handleSnackbarClose} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default DocumentationTab;