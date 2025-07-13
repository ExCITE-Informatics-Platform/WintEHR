/**
 * Documentation Context Provider - TypeScript Migration
 * Manages clinical documentation state using FHIR DocumentReference resources
 * 
 * Migrated to TypeScript with comprehensive type safety for clinical documentation,
 * SOAP note management, templates, and document lifecycle orchestration.
 */
import * as React from 'react';
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { fhirClient } from '../services/fhirClient';
import { useClinical } from './ClinicalContext';
import { useFHIRResource } from './FHIRResourceContext';
import { DocumentReference } from '../types/fhir';

/**
 * Document status types for clinical notes
 */
export type DocumentStatus = 
  | 'draft'
  | 'preliminary' 
  | 'final'
  | 'amended'
  | 'entered-in-error'
  | 'current'
  | 'superseded';

/**
 * Note type classifications with LOINC codes
 */
export type NoteType = 
  | 'progress'
  | 'history_physical'
  | 'consultation'
  | 'discharge'
  | 'operative'
  | 'procedure'
  | 'emergency'
  | 'nursing'
  | 'therapy'
  | 'addendum'
  | 'summary';

/**
 * SOAP note section interface
 */
export interface SOAPSections {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  chiefComplaint?: string;
  historyPresentIllness?: string;
  reviewOfSystems?: string;
  physicalExam?: string;
}

/**
 * Clinical note interface with comprehensive typing
 */
export interface ClinicalNote extends SOAPSections {
  id?: string;
  patientId: string;
  encounterId?: string;
  noteType: NoteType;
  title?: string;
  templateId?: string;
  status: DocumentStatus;
  authorId?: string;
  authorName?: string;
  createdAt?: string;
  signedAt?: string;
  requiresCosignature?: boolean;
  cosignerId?: string;
  isSOAPFormat?: boolean;
  content?: string;
}

/**
 * Note template interface
 */
export interface NoteTemplate {
  id: string;
  name: string;
  noteType: NoteType;
  content: Partial<SOAPSections>;
  specialty?: string;
  isActive?: boolean;
  description?: string;
}

/**
 * Template content structure
 */
export interface TemplateContent extends Partial<SOAPSections> {
  [key: string]: string | undefined;
}

/**
 * Recent note interface with author information
 */
export interface RecentNote extends ClinicalNote {
  authorName: string;
}

/**
 * Note creation data interface
 */
export interface NoteCreationData {
  noteType: NoteType;
  templateId?: string;
  patientId?: string;
  encounterId?: string;
  initialContent?: Partial<SOAPSections>;
}

/**
 * Addendum creation data interface
 */
export interface AddendumData {
  parentNoteId: string;
  content: string;
  reason?: string;
  patientId: string;
  encounterId?: string;
}

/**
 * Smart phrase interface
 */
export interface SmartPhrase {
  shortcut: string;
  expansion: string;
  category?: string;
  description?: string;
}

/**
 * Documentation context interface
 */
export interface DocumentationContextType {
  // Current state
  currentNote: ClinicalNote | null;
  noteTemplates: NoteTemplate[];
  recentNotes: RecentNote[];
  isDirty: boolean;
  isSaving: boolean;

  // Note operations
  createNewNote: (noteType: NoteType, templateId?: string) => void;
  loadNote: (noteId: string) => Promise<void>;
  loadRecentNotes: (patientId: string) => Promise<void>;
  loadNoteTemplates: (specialty?: string) => Promise<void>;
  saveNote: () => Promise<void>;
  signNote: () => Promise<void>;
  deleteNote: (noteId: string) => Promise<void>;
  clearCurrentNote: () => void;

  // Content operations
  updateNoteField: (field: keyof ClinicalNote, value: string) => void;
  updateSOAPSection: (section: keyof SOAPSections, value: string) => void;
  expandSmartPhrase: (phrase: string) => string;

  // Advanced operations
  createAddendum: (parentNoteId: string, content: string) => Promise<any>;

  // State management
  setIsDirty: (dirty: boolean) => void;

  // Utility functions
  transformFHIRDocument: (fhirDoc: DocumentReference) => ClinicalNote;
  transformToFHIRDocument: (note: ClinicalNote) => Omit<DocumentReference, 'id' | 'meta'>;
  getNoteTypeCode: (noteType: NoteType) => string;
  getNoteTypeDisplay: (noteType: NoteType) => string;
}

/**
 * Provider props interface
 */
export interface DocumentationProviderProps {
  children: ReactNode;
}

/**
 * LOINC code mapping for note types
 */
const NOTE_TYPE_CODES: Record<NoteType, string> = {
  'progress': '11506-3',
  'history_physical': '34117-2',
  'consultation': '11488-4',
  'discharge': '18842-5',
  'operative': '11504-8',
  'procedure': '28570-0',
  'emergency': '51845-6',
  'nursing': '34119-8',
  'therapy': '11507-1',
  'addendum': '81334-5',
  'summary': '34133-9'
} as const;

/**
 * Display names for note types
 */
const NOTE_TYPE_DISPLAYS: Record<NoteType, string> = {
  'progress': 'Progress note',
  'history_physical': 'History and physical note',
  'consultation': 'Consultation note',
  'discharge': 'Discharge summary',
  'operative': 'Operative note',
  'procedure': 'Procedure note',
  'emergency': 'Emergency department note',
  'nursing': 'Nursing note',
  'therapy': 'Therapy note',
  'addendum': 'Addendum',
  'summary': 'Summary note'
} as const;

/**
 * LOINC code to note type mapping
 */
const CODE_TO_NOTE_TYPE: Record<string, NoteType> = {
  '11506-3': 'progress',
  '34117-2': 'history_physical',
  '11488-4': 'consultation',
  '18842-5': 'discharge',
  '11504-8': 'operative',
  '28570-0': 'procedure',
  '51845-6': 'emergency',
  '34119-8': 'nursing',
  '11507-1': 'therapy',
  '81334-5': 'addendum',
  '34133-9': 'summary'
} as const;

/**
 * Smart phrases for clinical documentation
 */
const SMART_PHRASES: Record<string, string> = {
  '.ros': 'Review of Systems: Constitutional: Denies fever, chills, or weight loss. HEENT: Denies headache, vision changes. Cardiovascular: Denies chest pain, palpitations. Respiratory: Denies shortness of breath, cough.',
  '.pe': 'Physical Exam: Vital Signs: BP ___/___ HR ___ RR ___ Temp ___°F SpO2 ___%. General: Alert and oriented x3, in no acute distress.',
  '.normal': 'Within normal limits',
  '.wnl': 'Within normal limits',
  '.neuro': 'Neurological: Alert and oriented x3. Speech clear. Motor strength 5/5 in all extremities. Deep tendon reflexes 2+ and symmetric. Sensation intact.',
  '.cardiac': 'Cardiovascular: Regular rate and rhythm. No murmurs, rubs, or gallops. Peripheral pulses palpable.',
  '.pulm': 'Respiratory: Clear to auscultation bilaterally. No wheezes, rales, or rhonchi. Good air movement.',
  '.abdomen': 'Abdomen: Soft, non-tender, non-distended. Bowel sounds present. No organomegaly or masses.'
} as const;

/**
 * Create documentation context
 */
const DocumentationContext = createContext<DocumentationContextType | undefined>(undefined);

/**
 * Custom hook for using documentation context with type safety
 */
export const useDocumentation = (): DocumentationContextType => {
  const context = useContext(DocumentationContext);
  if (!context) {
    throw new Error('useDocumentation must be used within a DocumentationProvider');
  }
  return context;
};

/**
 * Documentation provider component with comprehensive type safety
 */
export const DocumentationProvider: React.FC<DocumentationProviderProps> = ({ children }) => {
  const { currentPatient, currentEncounter, setCurrentNote: setClinicalContextNote } = useClinical();
  const { refreshPatientResources } = useFHIRResource();
  
  // State management
  const [currentNote, setCurrentNote] = useState<ClinicalNote | null>(null);
  const [noteTemplates, setNoteTemplates] = useState<NoteTemplate[]>([]);
  const [recentNotes, setRecentNotes] = useState<RecentNote[]>([]);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  /**
   * Transform FHIR DocumentReference to internal format with comprehensive type safety
   */
  const transformFHIRDocument = (fhirDoc: DocumentReference): ClinicalNote => {
    // Extract content from attachment
    const content = fhirDoc.content?.[0]?.attachment?.data 
      ? atob(fhirDoc.content[0].attachment.data) 
      : '';
    
    // Parse content sections
    const sections: Partial<SOAPSections> = {};
    let isSOAPFormat = false;
    
    if (content) {
      try {
        const parsed = JSON.parse(content);
        // Check if it has SOAP structure
        if (parsed.subjective || parsed.objective || parsed.assessment || parsed.plan ||
            parsed.chiefComplaint || parsed.historyPresentIllness || parsed.reviewOfSystems || parsed.physicalExam) {
          isSOAPFormat = true;
          sections.subjective = parsed.subjective || '';
          sections.objective = parsed.objective || '';
          sections.assessment = parsed.assessment || '';
          sections.plan = parsed.plan || '';
          sections.chiefComplaint = parsed.chiefComplaint || '';
          sections.historyPresentIllness = parsed.historyPresentIllness || '';
          sections.reviewOfSystems = parsed.reviewOfSystems || '';
          sections.physicalExam = parsed.physicalExam || '';
        }
      } catch (e) {
        // If not JSON, treat as plain text
        sections.content = content;
      }
    }

    // Extract note type from type coding and map LOINC code back to type
    const loinc = fhirDoc.type?.coding?.[0]?.code;
    const noteType = (loinc && CODE_TO_NOTE_TYPE[loinc]) || 'progress';

    return {
      id: fhirDoc.id,
      patientId: fhirDoc.subject?.reference?.split('/')[1] || '',
      encounterId: (fhirDoc.context as any)?.encounter?.[0]?.reference?.split('/')[1],
      noteType,
      title: getNoteTypeDisplay(noteType),
      templateId: fhirDoc.extension?.find((e: any) => e.url === 'http://medgenemr.com/template-id')?.valueString,
      status: (fhirDoc.status as DocumentStatus) || 'draft',
      authorId: fhirDoc.author?.[0]?.reference?.split('/')[1],
      createdAt: fhirDoc.date,
      signedAt: fhirDoc.status === 'current' ? fhirDoc.date : undefined,
      requiresCosignature: fhirDoc.extension?.find((e: any) => e.url === 'http://medgenemr.com/requires-cosignature')?.valueBoolean,
      cosignerId: fhirDoc.extension?.find((e: any) => e.url === 'http://medgenemr.com/cosigner')?.valueReference?.reference?.split('/')[1],
      isSOAPFormat,
      ...sections
    };
  };

  /**
   * Transform internal note to FHIR DocumentReference format
   */
  const transformToFHIRDocument = (note: ClinicalNote): Omit<DocumentReference, 'id' | 'meta'> => {
    const content = {
      subjective: note.subjective || '',
      objective: note.objective || '',
      assessment: note.assessment || '',
      plan: note.plan || '',
      chiefComplaint: note.chiefComplaint || '',
      historyPresentIllness: note.historyPresentIllness || '',
      reviewOfSystems: note.reviewOfSystems || '',
      physicalExam: note.physicalExam || ''
    };

    const fhirDoc: any = {
      resourceType: 'DocumentReference',
      status: note.status === 'final' ? 'current' : 'preliminary',
      type: {
        coding: [{
          system: 'http://loinc.org',
          code: getNoteTypeCode(note.noteType),
          display: getNoteTypeDisplay(note.noteType)
        }]
      },
      subject: {
        reference: `Patient/${note.patientId}`
      },
      date: note.createdAt || new Date().toISOString(),
      content: [{
        attachment: {
          contentType: 'application/json',
          data: btoa(JSON.stringify(content))
        }
      }],
      extension: []
    };

    // Add optional fields
    if (note.encounterId) {
      fhirDoc.context = {
        encounter: [{ reference: `Encounter/${note.encounterId}` }]
      };
    }

    if (note.authorId) {
      fhirDoc.author = [{ reference: `Practitioner/${note.authorId}` }];
    }

    if (note.templateId) {
      fhirDoc.extension.push({
        url: 'http://medgenemr.com/template-id',
        valueString: note.templateId
      });
    }

    if (note.requiresCosignature) {
      fhirDoc.extension.push({
        url: 'http://medgenemr.com/requires-cosignature',
        valueBoolean: true
      });
    }

    if (note.cosignerId) {
      fhirDoc.extension.push({
        url: 'http://medgenemr.com/cosigner',
        valueReference: { reference: `Practitioner/${note.cosignerId}` }
      });
    }

    return fhirDoc as Omit<DocumentReference, 'id' | 'meta'>;
  };

  /**
   * Helper function to get LOINC codes for note types
   */
  const getNoteTypeCode = (noteType: NoteType): string => {
    return NOTE_TYPE_CODES[noteType] || '11506-3';
  };

  /**
   * Helper function to get display names for note types
   */
  const getNoteTypeDisplay = (noteType: NoteType): string => {
    return NOTE_TYPE_DISPLAYS[noteType] || 'Clinical note';
  };

  /**
   * Create new note with type safety
   */
  const createNewNote = useCallback((noteType: NoteType, templateId?: string): void => {
    if (!currentPatient) {
      throw new Error('No patient selected');
    }

    const newNote: ClinicalNote = {
      patientId: currentPatient.id,
      encounterId: currentEncounter?.id,
      noteType,
      templateId,
      status: 'draft',
      title: getNoteTypeDisplay(noteType)
    };

    // Apply template if provided
    if (templateId) {
      const template = noteTemplates.find(t => t.id === templateId);
      if (template && template.content) {
        Object.assign(newNote, template.content);
      }
    }

    setCurrentNote(newNote);
    setClinicalContextNote(newNote);
    setIsDirty(false);
  }, [currentPatient, currentEncounter, noteTemplates, setClinicalContextNote]);

  /**
   * Load existing note by ID
   */
  const loadNote = async (noteId: string): Promise<void> => {
    try {
      const fhirDoc = await fhirClient.read('DocumentReference' as any, noteId) as DocumentReference;
      const note = transformFHIRDocument(fhirDoc);
      
      setCurrentNote(note);
      setClinicalContextNote(note);
      setIsDirty(false);
    } catch (error) {
      throw error;
    }
  };

  /**
   * Load recent notes for a patient
   */
  const loadRecentNotes = async (patientId: string): Promise<void> => {
    try {
      const result = await fhirClient.search('DocumentReference' as any, {
        patient: patientId,
        _sort: '-date',
        _count: 10
      });
      
      // Ensure resources is an array and transform to internal format
      const notes = (result.resources || []).map((fhirDoc: any) => {
        const note = transformFHIRDocument(fhirDoc as DocumentReference);
        // Add author name if available
        const recentNote: RecentNote = {
          ...note,
          authorName: fhirDoc.author?.[0]?.display || 'Provider'
        };
        return recentNote;
      });
      
      setRecentNotes(notes);
    } catch (error) {
      throw error;
    }
  };

  /**
   * Load note templates
   */
  const loadNoteTemplates = async (specialty?: string): Promise<void> => {
    try {
      // For now, use hardcoded templates until we implement a proper template service
      const templates: NoteTemplate[] = [
        {
          id: 'soap-basic',
          name: 'Basic SOAP Note',
          noteType: 'progress',
          content: {
            subjective: 'Chief Complaint: \nHistory of Present Illness: \nReview of Systems: ',
            objective: 'Vital Signs: \nPhysical Exam: ',
            assessment: 'Assessment: \n1. ',
            plan: 'Plan: \n1. '
          }
        },
        {
          id: 'hp-standard',
          name: 'History & Physical',
          noteType: 'history_physical',
          content: {
            chiefComplaint: 'Chief Complaint: ',
            historyPresentIllness: 'History of Present Illness: ',
            reviewOfSystems: 'Review of Systems: \nConstitutional: \nHEENT: \nCardiovascular: \nRespiratory: ',
            physicalExam: 'Physical Examination: \nVital Signs: \nGeneral: \nHEENT: \nCardiovascular: \nRespiratory: ',
            assessment: 'Assessment: ',
            plan: 'Plan: '
          }
        },
        {
          id: 'consult-standard',
          name: 'Consultation Note',
          noteType: 'consultation',
          content: {
            chiefComplaint: 'Reason for Consultation: ',
            historyPresentIllness: 'History of Present Illness: ',
            assessment: 'Impression: ',
            plan: 'Recommendations: '
          }
        }
      ];
      
      setNoteTemplates(templates);
    } catch (error) {
      throw error;
    }
  };

  /**
   * Update note field with type safety
   */
  const updateNoteField = useCallback((field: keyof ClinicalNote, value: string): void => {
    if (!currentNote) return;
    
    setCurrentNote(prev => prev ? ({
      ...prev,
      [field]: value
    }) : null);
    setIsDirty(true);
  }, [currentNote]);

  /**
   * Update SOAP section
   */
  const updateSOAPSection = useCallback((section: keyof SOAPSections, value: string): void => {
    updateNoteField(section, value);
  }, [updateNoteField]);

  /**
   * Save note to FHIR server
   */
  const saveNote = async (): Promise<void> => {
    if (!currentNote || !currentPatient) return;

    setIsSaving(true);
    try {
      const fhirDoc = transformToFHIRDocument(currentNote);

      let result: any;
      if (currentNote.id) {
        // Update existing note
        result = await fhirClient.update('DocumentReference' as any, currentNote.id, { ...fhirDoc, resourceType: 'DocumentReference' });
      } else {
        // Create new note
        result = await fhirClient.create('DocumentReference' as any, fhirDoc);
      }

      const savedNote: ClinicalNote = {
        ...currentNote,
        id: result.id || currentNote.id,
        createdAt: new Date().toISOString()
      };

      setCurrentNote(savedNote);
      setClinicalContextNote(savedNote);
      setIsDirty(false);

      // Refresh patient resources to update all contexts
      if (currentPatient?.id) {
        await refreshPatientResources(currentPatient.id);
      }

      // Reload recent notes
      await loadRecentNotes(currentPatient.id);
    } catch (error) {
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Sign note (mark as final)
   */
  const signNote = async (): Promise<void> => {
    if (!currentNote?.id) {
      throw new Error('Note must be saved before signing');
    }

    try {
      // Get current document
      const fhirDoc = await fhirClient.read('DocumentReference' as any, currentNote.id) as any;
      
      // Update status to current (signed)
      fhirDoc.status = 'current';
      
      // Add authenticator extension
      if (!fhirDoc.extension) fhirDoc.extension = [];
      fhirDoc.extension.push({
        url: 'http://medgenemr.com/signed-at',
        valueDateTime: new Date().toISOString()
      });
      
      await fhirClient.update('DocumentReference' as any, currentNote.id, fhirDoc);
      
      // Refresh patient resources to update all contexts
      if (currentPatient?.id) {
        await refreshPatientResources(currentPatient.id);
      }
      
      // Reload the note to get updated status
      await loadNote(currentNote.id);
    } catch (error) {
      throw error;
    }
  };

  /**
   * Create addendum to existing note
   */
  const createAddendum = async (parentNoteId: string, content: string): Promise<any> => {
    if (!currentPatient) return;

    try {
      // Create a new note with type 'addendum'
      const addendumNote: ClinicalNote = {
        patientId: currentPatient.id,
        encounterId: currentEncounter?.id,
        noteType: 'addendum',
        status: 'draft'
      };

      // If content contains sections, parse them
      if (content.includes('Chief Complaint:') || content.includes('Subjective:')) {
        const sections: Partial<SOAPSections> = {
          chiefComplaint: content.match(/Chief Complaint:\n(.*?)(?=\n\n|Subjective:|Objective:|Assessment:|Plan:|$)/s)?.[1]?.trim(),
          subjective: content.match(/Subjective:\n(.*?)(?=\n\n|Objective:|Assessment:|Plan:|$)/s)?.[1]?.trim(),
          objective: content.match(/Objective:\n(.*?)(?=\n\n|Assessment:|Plan:|$)/s)?.[1]?.trim(),
          assessment: content.match(/Assessment:\n(.*?)(?=\n\n|Plan:|$)/s)?.[1]?.trim(),
          plan: content.match(/Plan:\n(.*?)(?=\n\n|$)/s)?.[1]?.trim(),
        };
        
        // Add non-empty sections to addendumNote
        Object.entries(sections).forEach(([key, value]) => {
          if (value) {
            (addendumNote as any)[key] = value;
          }
        });
      } else {
        // If not structured, put all content in assessment
        addendumNote.assessment = content;
      }

      // Create FHIR document
      const fhirDoc = transformToFHIRDocument(addendumNote);
      
      // Add relationship to parent note
      (fhirDoc as any).relatesTo = [{
        code: 'appends',
        target: {
          reference: `DocumentReference/${parentNoteId}`
        }
      }];

      const result = await fhirClient.create('DocumentReference' as any, fhirDoc);

      // Refresh patient resources to update all contexts
      if (currentPatient?.id) {
        await refreshPatientResources(currentPatient.id);
      }

      // Reload recent notes
      await loadRecentNotes(currentPatient.id);
      
      return result;
    } catch (error) {
      throw error;
    }
  };

  /**
   * Delete note (only drafts)
   */
  const deleteNote = async (noteId: string): Promise<void> => {
    try {
      // Check if note is a draft
      const fhirDoc = await fhirClient.read('DocumentReference' as any, noteId) as any;
      if (fhirDoc.status !== 'preliminary') {
        throw new Error('Only draft notes can be deleted');
      }
      
      await fhirClient.delete('DocumentReference' as any, noteId);
      
      // Refresh patient resources to update all contexts
      if (currentPatient?.id) {
        await refreshPatientResources(currentPatient.id);
      }
      
      if (currentNote?.id === noteId) {
        clearCurrentNote();
      }
      
      if (currentPatient) {
        await loadRecentNotes(currentPatient.id);
      }
    } catch (error) {
      throw error;
    }
  };

  /**
   * Expand smart phrase
   */
  const expandSmartPhrase = (phrase: string): string => {
    return SMART_PHRASES[phrase.toLowerCase()] || phrase;
  };

  /**
   * Clear current note
   */
  const clearCurrentNote = (): void => {
    setCurrentNote(null);
    setClinicalContextNote(null);
    setIsDirty(false);
  };

  // Context value with comprehensive typing
  const value: DocumentationContextType = {
    // Current state
    currentNote,
    noteTemplates,
    recentNotes,
    isDirty,
    isSaving,

    // Note operations
    createNewNote,
    loadNote,
    loadRecentNotes,
    loadNoteTemplates,
    saveNote,
    signNote,
    deleteNote,
    clearCurrentNote,

    // Content operations
    updateNoteField,
    updateSOAPSection,
    expandSmartPhrase,

    // Advanced operations
    createAddendum,

    // State management
    setIsDirty,

    // Utility functions
    transformFHIRDocument,
    transformToFHIRDocument,
    getNoteTypeCode,
    getNoteTypeDisplay
  };

  return (
    <DocumentationContext.Provider value={value}>
      {children}
    </DocumentationContext.Provider>
  );
};

export default DocumentationContext;