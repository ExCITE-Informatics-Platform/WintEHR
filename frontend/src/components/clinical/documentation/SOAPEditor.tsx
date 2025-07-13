/**
 * SOAP Editor Component
 * Editor for clinical documentation using SOAP format
 * 
 * Migrated to TypeScript with comprehensive type safety for clinical documentation.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  TextField,
  Typography,
  Button,
  IconButton,
  Tooltip,
  Alert,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Stack,
  SxProps,
  Theme,
} from '@mui/material';
import {
  Save as SaveIcon,
  CheckCircle as SignIcon,
  Psychology as SmartPhraseIcon,
  History as HistoryIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { useDocumentation } from '../../../contexts/DocumentationContext';
import { useClinical } from '../../../contexts/ClinicalContext';

/**
 * Type definitions for SOAPEditor component
 */
export type SOAPSection = 'subjective' | 'objective' | 'assessment' | 'plan';

export type NoteType = 'progress_note' | 'discharge_summary' | 'consultation' | 'admission_note';

export type NoteStatus = 'draft' | 'pending' | 'signed' | 'cosigned' | 'amended';

export interface ClinicalNote {
  id?: string;
  noteType: NoteType;
  status: NoteStatus;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  createdAt?: string;
  updatedAt?: string;
  signedAt?: string;
  signedBy?: string;
  requiresCosignature?: boolean;
  cosignedAt?: string;
  cosignedBy?: string;
  encounterId?: string;
  patientId?: string;
}

export interface SmartPhrase {
  key: string;
  description: string;
  expansion: string;
}

export interface SOAPEditorProps {
  noteId?: string;
  onSave?: (note: ClinicalNote) => void;
  onSign?: (note: ClinicalNote) => void;
  readOnly?: boolean;
  sx?: SxProps<Theme>;
}

export interface DocumentationContextType {
  currentNote: ClinicalNote | null;
  isDirty: boolean;
  isSaving: boolean;
  updateSOAPSection: (section: SOAPSection, value: string) => void;
  updateNoteField: (field: keyof ClinicalNote, value: any) => void;
  saveNote: () => Promise<void>;
  signNote: () => Promise<void>;
  expandSmartPhrase: (phrase: string) => string;
  loadNote: (noteId: string) => Promise<void>;
  createNewNote: (noteType: NoteType) => void;
}

export interface ClinicalContextType {
  currentPatient: any | null;
  currentEncounter: any | null;
}

/**
 * Smart phrases configuration
 */
const SMART_PHRASES: SmartPhrase[] = [
  {
    key: '.ros',
    description: 'Review of Systems',
    expansion: 'Review of Systems:\n- Constitutional: No fever, chills, night sweats, weight loss\n- Eyes: No vision changes, eye pain, or discharge\n- ENT: No hearing loss, tinnitus, nasal congestion, sore throat\n- Cardiovascular: No chest pain, palpitations, dyspnea on exertion, orthopnea\n- Respiratory: No shortness of breath, cough, wheezing\n- GI: No nausea, vomiting, diarrhea, constipation, abdominal pain\n- GU: No dysuria, frequency, urgency, hematuria\n- Musculoskeletal: No joint pain, swelling, stiffness\n- Neurologic: No headache, dizziness, weakness, numbness\n- Skin: No rash, lesions, or changes\n- Psychiatric: No depression, anxiety, mood changes'
  },
  {
    key: '.pe',
    description: 'Physical Exam',
    expansion: 'Physical Examination:\n- General: Well-appearing, alert and oriented\n- Vital Signs: See flowsheet\n- HEENT: Normocephalic, atraumatic, PERRLA, EOMI, no lymphadenopathy\n- Cardiovascular: RRR, no murmurs, rubs, or gallops\n- Respiratory: Clear to auscultation bilaterally, no wheezes, rales, or rhonchi\n- Abdomen: Soft, non-tender, non-distended, bowel sounds present\n- Extremities: No edema, cyanosis, or clubbing\n- Neurologic: Alert and oriented x3, cranial nerves II-XII intact\n- Skin: Warm, dry, intact, no rashes or lesions'
  },
  {
    key: '.normal',
    description: 'Within normal limits',
    expansion: 'within normal limits'
  },
  {
    key: '.wnl',
    description: 'Within normal limits',
    expansion: 'within normal limits'
  }
];

/**
 * Helper functions
 */
const getSectionLabel = (section: SOAPSection): string => {
  const labels: Record<SOAPSection, string> = {
    subjective: 'Subjective - Patient History & Symptoms',
    objective: 'Objective - Physical Exam & Test Results',
    assessment: 'Assessment - Clinical Impression & Diagnosis',
    plan: 'Plan - Treatment & Follow-up'
  };
  return labels[section] || section;
};

const getPlaceholder = (section: SOAPSection): string => {
  const placeholders: Record<SOAPSection, string> = {
    subjective: 'Document patient\'s chief complaint, history of present illness, review of systems...\n\nTry smart phrases: .ros (review of systems)',
    objective: 'Document vital signs, physical examination findings, laboratory results...\n\nTry smart phrases: .pe (physical exam), .wnl (within normal limits)',
    assessment: 'Document clinical assessment, differential diagnosis, problem list updates...',
    plan: 'Document treatment plan, medications, follow-up instructions, patient education...'
  };
  return placeholders[section] || '';
};

const getNoteTypeDisplay = (noteType: NoteType): string => {
  const displays: Record<NoteType, string> = {
    progress_note: 'Progress Note',
    discharge_summary: 'Discharge Summary',
    consultation: 'Consultation Note',
    admission_note: 'Admission Note'
  };
  return displays[noteType] || 'Clinical Note';
};

const formatDate = (dateString: string): string => {
  try {
    return format(new Date(dateString), 'MM/dd/yyyy h:mm a');
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString;
  }
};

/**
 * SOAPEditor Component
 */
const SOAPEditor: React.FC<SOAPEditorProps> = ({ 
  noteId, 
  onSave, 
  onSign, 
  readOnly = false,
  sx 
}) => {
  const { currentPatient, currentEncounter } = useClinical();
  const {
    currentNote,
    isDirty,
    isSaving,
    updateSOAPSection,
    updateNoteField,
    saveNote,
    signNote,
    expandSmartPhrase,
    loadNote,
    createNewNote
  } = useDocumentation();

  const [activeSection, setActiveSection] = useState<SOAPSection>('subjective');
  const [showSmartPhrases, setShowSmartPhrases] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load note if ID provided
  useEffect(() => {
    const initializeNote = async (): Promise<void> => {
      try {
        if (noteId) {
          await loadNote(noteId);
        } else if (!currentNote) {
          // Create new note if none exists
          createNewNote('progress_note');
        }
      } catch (err) {
        setError('Failed to load note');
        console.error('Error loading note:', err);
      }
    };

    initializeNote();
  }, [noteId, currentNote, loadNote, createNewNote]);

  // Handle smart phrase expansion
  const handleTextChange = useCallback((section: SOAPSection, value: string): void => {
    // Check for smart phrases (starting with .)
    const smartPhraseMatch = value.match(/\.\w+$/);
    if (smartPhraseMatch) {
      const phrase = smartPhraseMatch[0];
      const expandedText = expandSmartPhrase(phrase);
      if (expandedText !== phrase) {
        // Replace the smart phrase with expanded text
        const newValue = value.replace(phrase, expandedText);
        updateSOAPSection(section, newValue);
        return;
      }
    }
    
    updateSOAPSection(section, value);
  }, [updateSOAPSection, expandSmartPhrase]);

  const handleSave = async (): Promise<void> => {
    try {
      setError(null);
      await saveNote();
      if (onSave && currentNote) {
        onSave(currentNote);
      }
    } catch (err) {
      setError('Failed to save note');
      console.error('Error saving note:', err);
    }
  };

  const handleSign = async (): Promise<void> => {
    try {
      setError(null);
      // Save first if dirty
      if (isDirty) {
        await saveNote();
      }
      await signNote();
      if (onSign && currentNote) {
        onSign(currentNote);
      }
    } catch (err) {
      setError('Failed to sign note');
      console.error('Error signing note:', err);
    }
  };

  const handleSmartPhrasesToggle = (): void => {
    setShowSmartPhrases(!showSmartPhrases);
  };

  const handleErrorClose = (): void => {
    setError(null);
  };

  const canSign = currentNote?.id && !isDirty && currentNote.status !== 'signed';
  const isSigned = currentNote?.status === 'signed';
  const isReadOnly = readOnly || isSigned;

  if (!currentNote) {
    return (
      <Box sx={{ p: 3, ...sx }}>
        <Alert severity="info">Loading note editor...</Alert>
      </Box>
    );
  }

  return (
    <Box sx={sx}>
      {/* Note Header */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h6">
              {getNoteTypeDisplay(currentNote.noteType)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {currentPatient?.firstName} {currentPatient?.lastName} - 
              {currentEncounter ? ` ${currentEncounter.encounterType} Visit` : ' No active encounter'}
            </Typography>
            {currentNote.createdAt && (
              <Typography variant="caption" color="text.secondary">
                Created: {formatDate(currentNote.createdAt)}
              </Typography>
            )}
          </Box>
          
          <Box display="flex" gap={1} alignItems="center">
            {isSigned && (
              <Chip 
                label="Signed" 
                color="success" 
                icon={<SignIcon />}
                size="small"
              />
            )}
            {isDirty && (
              <Chip 
                label="Unsaved changes" 
                color="warning" 
                size="small"
              />
            )}
            
            <Tooltip title="Smart phrases available">
              <IconButton 
                size="small" 
                onClick={handleSmartPhrasesToggle}
                color={showSmartPhrases ? 'primary' : 'default'}
                aria-label="Toggle smart phrases help"
              >
                <SmartPhraseIcon />
              </IconButton>
            </Tooltip>
            
            <Button
              variant="outlined"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={!isDirty || isSaving || isReadOnly}
            >
              Save
            </Button>
            
            <Button
              variant="contained"
              startIcon={<SignIcon />}
              onClick={handleSign}
              disabled={!canSign}
            >
              Sign Note
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={handleErrorClose}>
          {error}
        </Alert>
      )}

      {/* Smart Phrases Help */}
      {showSmartPhrases && (
        <Alert severity="info" sx={{ mb: 2 }} icon={<InfoIcon />}>
          <Typography variant="subtitle2" gutterBottom>Available Smart Phrases:</Typography>
          <Box display="flex" gap={2} flexWrap="wrap">
            {SMART_PHRASES.map((phrase) => (
              <Chip 
                key={phrase.key}
                label={`${phrase.key} - ${phrase.description}`} 
                size="small" 
              />
            ))}
          </Box>
        </Alert>
      )}

      {/* SOAP Sections */}
      <Paper sx={{ p: 2 }}>
        <Stack spacing={3}>
          {/* Subjective */}
          <Box>
            <Typography 
              variant="subtitle1" 
              fontWeight="bold" 
              color="primary"
              gutterBottom
            >
              S - {getSectionLabel('subjective')}
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={6}
              value={currentNote.subjective || ''}
              onChange={(e) => handleTextChange('subjective', e.target.value)}
              placeholder={getPlaceholder('subjective')}
              disabled={isReadOnly}
              variant="outlined"
              aria-label="Subjective section"
            />
          </Box>

          <Divider />

          {/* Objective */}
          <Box>
            <Typography 
              variant="subtitle1" 
              fontWeight="bold" 
              color="primary"
              gutterBottom
            >
              O - {getSectionLabel('objective')}
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={6}
              value={currentNote.objective || ''}
              onChange={(e) => handleTextChange('objective', e.target.value)}
              placeholder={getPlaceholder('objective')}
              disabled={isReadOnly}
              variant="outlined"
              aria-label="Objective section"
            />
          </Box>

          <Divider />

          {/* Assessment */}
          <Box>
            <Typography 
              variant="subtitle1" 
              fontWeight="bold" 
              color="primary"
              gutterBottom
            >
              A - {getSectionLabel('assessment')}
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={6}
              value={currentNote.assessment || ''}
              onChange={(e) => handleTextChange('assessment', e.target.value)}
              placeholder={getPlaceholder('assessment')}
              disabled={isReadOnly}
              variant="outlined"
              aria-label="Assessment section"
            />
          </Box>

          <Divider />

          {/* Plan */}
          <Box>
            <Typography 
              variant="subtitle1" 
              fontWeight="bold" 
              color="primary"
              gutterBottom
            >
              P - {getSectionLabel('plan')}
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={6}
              value={currentNote.plan || ''}
              onChange={(e) => handleTextChange('plan', e.target.value)}
              placeholder={getPlaceholder('plan')}
              disabled={isReadOnly}
              variant="outlined"
              aria-label="Plan section"
            />
          </Box>
        </Stack>
      </Paper>

      {/* Cosignature Section */}
      {currentNote.requiresCosignature && !isSigned && (
        <Alert severity="warning" sx={{ mt: 2 }} icon={<WarningIcon />}>
          This note requires cosignature from an attending physician
        </Alert>
      )}
    </Box>
  );
};

export default SOAPEditor;