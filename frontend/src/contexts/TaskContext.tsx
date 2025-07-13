/**
 * Task Context Provider - TypeScript Migration
 * Manages clinical tasks using FHIR Task resources, inbox, and care team functionality
 * 
 * Migrated to TypeScript with comprehensive type safety for task management,
 * FHIR Task resource handling, and clinical workflow orchestration.
 */
import * as React from 'react';
import { createContext, useContext, useState, ReactNode } from 'react';
import api from '../services/api';
import { fhirClient } from '../services/fhirClient';
import { useClinical } from './ClinicalContext';
import { useFHIRResource } from './FHIRResourceContext';
import { Task, Patient } from '../types/fhir';

/**
 * FHIR R4 Task status values with comprehensive workflow support
 */
export type TaskStatus = 
  | 'draft'
  | 'requested'
  | 'received'
  | 'accepted'
  | 'rejected'
  | 'ready'
  | 'cancelled'
  | 'in-progress'
  | 'on-hold'
  | 'failed'
  | 'completed'
  | 'entered-in-error';

/**
 * FHIR R4 Task priority levels
 */
export type TaskPriority = 
  | 'routine'
  | 'urgent'
  | 'asap'
  | 'stat';

/**
 * FHIR R4 Task intent classification
 */
export type TaskIntent = 
  | 'proposal'
  | 'plan'
  | 'order'
  | 'original-order'
  | 'reflex-order'
  | 'filler-order'
  | 'instance-order'
  | 'option';

/**
 * Task type codes for clinical tasks
 */
export type TaskType = 
  | 'review'
  | 'follow-up'
  | 'lab-review'
  | 'med-recon'
  | 'prior-auth'
  | 'outreach'
  | 'referral'
  | 'documentation';

/**
 * Transformed task interface for internal use
 */
export interface TransformedTask {
  id?: string;
  status: TaskStatus;
  priority: TaskPriority;
  intent: TaskIntent;
  taskType: TaskType;
  taskTypeDisplay?: string;
  description?: string;
  patientId?: string;
  encounterId?: string;
  assignedTo?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  dueDate?: string;
  reason?: string;
  businessStatus?: string;
  notes: TaskNote[];
  startDate?: string;
  completedDate?: string;
}

/**
 * Task note interface
 */
export interface TaskNote {
  text: string;
  createdAt?: string;
  createdBy?: string;
}

/**
 * Task creation data interface
 */
export interface TaskCreationData {
  status?: TaskStatus;
  priority?: TaskPriority;
  intent?: TaskIntent;
  taskType?: TaskType;
  code?: TaskType;
  taskTypeDisplay?: string;
  description?: string;
  patientId?: string;
  encounterId?: string;
  assignedTo?: string;
  createdBy?: string;
  createdAt?: string;
  dueDate?: string;
  reason?: string;
  businessStatus?: string;
  notes?: TaskNote[];
  startDate?: string;
  completedDate?: string;
}

/**
 * Task update data interface
 */
export interface TaskUpdateData extends Partial<TransformedTask> {}

/**
 * Task completion notes interface
 */
export interface TaskCompletionNotes {
  notes?: string;
  outcome?: string;
}

/**
 * Task filters interface
 */
export interface TaskFilters {
  patient_id?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigned_to?: string;
  due_before?: string;
  limit?: number;
}

/**
 * Task statistics interface
 */
export interface TaskStats {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  overdue: number;
}

/**
 * Inbox item interface
 */
export interface InboxItem {
  id: string;
  type: string;
  priority: string;
  subject: string;
  patient?: Patient;
  createdAt: string;
  isRead: boolean;
  assignedTo?: string;
}

/**
 * Inbox statistics interface
 */
export interface InboxStats {
  total: number;
  unread: number;
  urgent: number;
  overdue: number;
}

/**
 * Inbox filters interface
 */
export interface InboxFilters {
  status?: string;
  priority?: string;
  patient_id?: string;
  assigned_to?: string;
  unread_only?: boolean;
}

/**
 * Care team interface
 */
export interface CareTeam {
  id: string;
  name: string;
  patientId: string;
  members: CareTeamMember[];
  status: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Care team member interface
 */
export interface CareTeamMember {
  id: string;
  practitionerId: string;
  role: string;
  name: string;
  specialty?: string;
  isLead: boolean;
}

/**
 * Care team creation data interface
 */
export interface CareTeamCreationData {
  name: string;
  patientId: string;
  members: Omit<CareTeamMember, 'id'>[];
  description?: string;
}

/**
 * Patient list interface
 */
export interface PatientList {
  id: string;
  name: string;
  description?: string;
  patientIds: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Patient list creation data interface
 */
export interface PatientListCreationData {
  name: string;
  description?: string;
  patientIds?: string[];
}

/**
 * Task context interface
 */
export interface TaskContextType {
  // Inbox state and methods
  inboxItems: InboxItem[];
  inboxStats: InboxStats | null;
  loadInboxItems: (filters?: InboxFilters) => Promise<void>;
  loadInboxStats: () => Promise<void>;
  markInboxItemRead: (itemId: string) => Promise<void>;
  acknowledgeInboxItems: (itemIds: string[]) => Promise<void>;
  forwardInboxItems: (itemIds: string[], recipientId: string, note?: string) => Promise<void>;
  createTaskFromInbox: (itemId: string, taskData: TaskCreationData) => Promise<void>;

  // Task state and methods
  tasks: TransformedTask[];
  taskStats: TaskStats | null;
  loadTasks: (filters?: TaskFilters) => Promise<void>;
  loadTaskStats: () => Promise<void>;
  createTask: (taskData: TaskCreationData) => Promise<TransformedTask>;
  updateTask: (taskId: string, updates: TaskUpdateData) => Promise<void>;
  completeTask: (taskId: string, completionNotes?: TaskCompletionNotes) => Promise<void>;

  // Care team state and methods
  careTeams: CareTeam[];
  loadPatientCareTeams: (patientId: string) => Promise<void>;
  createCareTeam: (teamData: CareTeamCreationData) => Promise<CareTeam>;
  updateCareTeamMembers: (teamId: string, members: CareTeamMember[]) => Promise<void>;

  // Patient list state and methods
  patientLists: PatientList[];
  loadPatientLists: () => Promise<void>;
  createPatientList: (listData: PatientListCreationData) => Promise<PatientList>;
  addPatientToList: (listId: string, patientId: string) => Promise<void>;
  removePatientFromList: (listId: string, patientId: string) => Promise<void>;
  getPatientListPatients: (listId: string) => Promise<Patient[]>;

  // Utility functions
  transformFHIRTask: (fhirTask: Task) => TransformedTask;
  transformToFHIRTask: (task: TaskCreationData) => Omit<Task, 'id' | 'meta'>;
  getTaskTypeDisplay: (taskType: TaskType) => string;
}

/**
 * Provider props interface
 */
export interface TaskProviderProps {
  children: ReactNode;
}

/**
 * Task type display mapping
 */
const TASK_TYPE_DISPLAYS: Record<TaskType, string> = {
  'review': 'Review',
  'follow-up': 'Follow-up',
  'lab-review': 'Lab Review',
  'med-recon': 'Medication Reconciliation',
  'prior-auth': 'Prior Authorization',
  'outreach': 'Patient Outreach',
  'referral': 'Referral',
  'documentation': 'Documentation'
} as const;

/**
 * Create task context with proper typing
 */
const TaskContext = createContext<TaskContextType | undefined>(undefined);

/**
 * Custom hook for using task context with type safety
 */
export const useTask = (): TaskContextType => {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTask must be used within a TaskProvider');
  }
  return context;
};

/**
 * Task provider component with comprehensive type safety
 */
export const TaskProvider: React.FC<TaskProviderProps> = ({ children }) => {
  const { currentPatient } = useClinical();
  const { refreshPatientResources } = useFHIRResource();
  
  // State management
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [inboxStats, setInboxStats] = useState<InboxStats | null>(null);
  const [tasks, setTasks] = useState<TransformedTask[]>([]);
  const [taskStats, setTaskStats] = useState<TaskStats | null>(null);
  const [careTeams, setCareTeams] = useState<CareTeam[]>([]);
  const [patientLists, setPatientLists] = useState<PatientList[]>([]);

  /**
   * Transform FHIR Task to internal format with comprehensive type safety
   */
  const transformFHIRTask = (fhirTask: Task): TransformedTask => {
    return {
      id: fhirTask.id,
      status: (fhirTask.status as TaskStatus) || 'requested',
      priority: (fhirTask.priority as TaskPriority) || 'routine',
      intent: (fhirTask.intent as TaskIntent) || 'order',
      taskType: (fhirTask.code?.coding?.[0]?.code as TaskType) || 'review',
      taskTypeDisplay: fhirTask.code?.text || fhirTask.code?.coding?.[0]?.display,
      description: fhirTask.description,
      patientId: fhirTask.for?.reference?.split('/')[1],
      encounterId: fhirTask.encounter?.reference?.split('/')[1],
      assignedTo: fhirTask.owner?.reference?.split('/')[1],
      createdBy: fhirTask.requester?.reference?.split('/')[1],
      createdAt: fhirTask.authoredOn,
      updatedAt: fhirTask.lastModified,
      dueDate: (fhirTask.restriction as any)?.period?.end,
      reason: (fhirTask.reasonCode as any)?.text,
      businessStatus: (fhirTask.businessStatus as any)?.text,
      notes: (fhirTask.note || []).map((n: any) => ({
        text: n.text,
        createdAt: n.time,
        createdBy: n.authorReference?.reference?.split('/')[1]
      })),
      startDate: fhirTask.executionPeriod?.start,
      completedDate: fhirTask.executionPeriod?.end
    };
  };

  /**
   * Transform internal task to FHIR Task format
   */
  const transformToFHIRTask = (task: TaskCreationData): Omit<Task, 'id' | 'meta'> => {
    const fhirTask: any = {
      resourceType: 'Task',
      status: task.status || 'requested',
      intent: task.intent || 'order',
      priority: task.priority || 'routine',
      authoredOn: task.createdAt || new Date().toISOString()
    };

    // Set task type/code
    if (task.taskType || task.code) {
      fhirTask.code = {
        coding: [{
          system: 'http://medgenemr.com/task-type',
          code: task.taskType || task.code || 'review',
          display: task.taskTypeDisplay || getTaskTypeDisplay(task.taskType || task.code || 'review')
        }]
      };
      if (task.description) {
        fhirTask.code.text = task.description;
      }
    }

    // Set description
    if (task.description) {
      fhirTask.description = task.description;
    }

    // Set patient reference
    if (task.patientId) {
      fhirTask.for = { reference: `Patient/${task.patientId}` };
    }

    // Set encounter reference
    if (task.encounterId) {
      fhirTask.encounter = { reference: `Encounter/${task.encounterId}` };
    }

    // Set owner (assigned to)
    if (task.assignedTo) {
      fhirTask.owner = { reference: `Practitioner/${task.assignedTo}` };
    }

    // Set requester (created by)
    if (task.createdBy) {
      fhirTask.requester = { reference: `Practitioner/${task.createdBy}` };
    }

    // Set due date
    if (task.dueDate) {
      fhirTask.restriction = {
        period: { end: task.dueDate }
      };
    }

    // Set reason
    if (task.reason) {
      fhirTask.reasonCode = { text: task.reason };
    }

    // Set business status
    if (task.businessStatus) {
      fhirTask.businessStatus = { text: task.businessStatus };
    }

    // Set notes
    if (task.notes && task.notes.length > 0) {
      fhirTask.note = task.notes.map(note => {
        const fhirNote: any = { text: note.text };
        if (note.createdAt) fhirNote.time = note.createdAt;
        if (note.createdBy) fhirNote.authorReference = { reference: `Practitioner/${note.createdBy}` };
        return fhirNote;
      });
    }

    // Set execution period
    if (task.startDate || task.completedDate) {
      fhirTask.executionPeriod = {};
      if (task.startDate) fhirTask.executionPeriod.start = task.startDate;
      if (task.completedDate) fhirTask.executionPeriod.end = task.completedDate;
    }

    return fhirTask as Omit<Task, 'id' | 'meta'>;
  };

  /**
   * Helper to get task type display name
   */
  const getTaskTypeDisplay = (taskType: TaskType): string => {
    return TASK_TYPE_DISPLAYS[taskType] || 'Task';
  };

  // Inbox methods with type safety
  const loadInboxItems = async (filters?: InboxFilters): Promise<void> => {
    try {
      const response = await api.get('/api/clinical/inbox/', { params: filters });
      setInboxItems(response.data);
    } catch (error) {
      throw error;
    }
  };

  const loadInboxStats = async (): Promise<void> => {
    try {
      const response = await api.get('/api/clinical/inbox/stats');
      setInboxStats(response.data);
    } catch (error) {
      throw error;
    }
  };

  const markInboxItemRead = async (itemId: string): Promise<void> => {
    try {
      await api.get(`/api/clinical/inbox/${itemId}`);
      await loadInboxItems();
      await loadInboxStats();
    } catch (error) {
      throw error;
    }
  };

  const acknowledgeInboxItems = async (itemIds: string[]): Promise<void> => {
    try {
      await api.post('/api/clinical/inbox/bulk-action', {
        action: 'acknowledge',
        item_ids: itemIds
      });
      await loadInboxItems();
      await loadInboxStats();
    } catch (error) {
      throw error;
    }
  };

  const forwardInboxItems = async (itemIds: string[], recipientId: string, note?: string): Promise<void> => {
    try {
      await api.post('/api/clinical/inbox/bulk-action', {
        action: 'forward',
        item_ids: itemIds,
        forward_to_id: recipientId,
        forward_note: note
      });
      await loadInboxItems();
    } catch (error) {
      throw error;
    }
  };

  const createTaskFromInbox = async (itemId: string, taskData: TaskCreationData): Promise<void> => {
    try {
      await api.post('/api/clinical/inbox/create-task', {
        item_id: itemId,
        ...taskData
      });
      await loadInboxItems();
      await loadTasks();
    } catch (error) {
      throw error;
    }
  };

  // Task methods with comprehensive type safety
  const loadTasks = async (filters: TaskFilters = {}): Promise<void> => {
    try {
      const searchParams: Record<string, any> = {};
      
      // Map filters to FHIR search parameters
      if (filters.patient_id) {
        searchParams.patient = filters.patient_id;
      }
      if (filters.status) {
        searchParams.status = filters.status;
      }
      if (filters.priority) {
        searchParams.priority = filters.priority;
      }
      if (filters.assigned_to) {
        searchParams.owner = `Practitioner/${filters.assigned_to}`;
      }
      if (filters.due_before) {
        searchParams.period = `le${filters.due_before}`;
      }
      
      searchParams._sort = '-authored-on';
      searchParams._count = filters.limit || 50;
      
      const result = await fhirClient.search('Task' as any, searchParams);
      const tasks = (result.resources || []).map((resource: any) => transformFHIRTask(resource as Task));
      setTasks(tasks);
    } catch (error) {
      throw error;
    }
  };

  const loadTaskStats = async (): Promise<void> => {
    try {
      // Get task counts by status
      const statuses: TaskStatus[] = ['requested', 'accepted', 'in-progress', 'completed', 'cancelled'];
      const counts: Record<string, number> = {};
      
      // Get counts for each status
      await Promise.all(statuses.map(async (status) => {
        const result = await fhirClient.search('Task' as any, {
          status,
          _summary: 'count'
        });
        counts[status] = result.total || 0;
      }));
      
      // Calculate stats
      const stats: TaskStats = {
        total: Object.values(counts).reduce((sum, count) => sum + count, 0),
        pending: counts['requested'] || 0,
        in_progress: (counts['accepted'] || 0) + (counts['in-progress'] || 0),
        completed: counts['completed'] || 0,
        overdue: 0 // Would need to query with date filter
      };
      
      setTaskStats(stats);
    } catch (error) {
      throw error;
    }
  };

  const createTask = async (taskData: TaskCreationData): Promise<TransformedTask> => {
    try {
      const fhirTask = transformToFHIRTask(taskData);
      const result = await fhirClient.create('Task' as any, fhirTask);
      
      // Refresh patient resources to update all contexts
      if (currentPatient?.id) {
        await refreshPatientResources(currentPatient.id);
      }
      
      await loadTasks();
      await loadTaskStats();
      
      return { 
        ...taskData, 
        id: result.id,
        status: taskData.status || 'requested',
        priority: taskData.priority || 'routine',
        intent: taskData.intent || 'order',
        taskType: taskData.taskType || 'review',
        notes: taskData.notes || []
      };
    } catch (error) {
      throw error;
    }
  };

  const updateTask = async (taskId: string, updates: TaskUpdateData): Promise<void> => {
    try {
      // Get current task
      const currentFhirTask = await fhirClient.read('Task' as any, taskId) as Task;
      const currentTask = transformFHIRTask(currentFhirTask);
      
      // Merge updates
      const updatedTask = { ...currentTask, ...updates };
      
      // Transform to FHIR and update
      const fhirTask = transformToFHIRTask(updatedTask);
      await fhirClient.update('Task' as any, taskId, { ...fhirTask, resourceType: 'Task' });
      
      // Refresh patient resources to update all contexts
      if (currentPatient?.id) {
        await refreshPatientResources(currentPatient.id);
      }
      
      await loadTasks();
      await loadTaskStats();
    } catch (error) {
      throw error;
    }
  };

  const completeTask = async (taskId: string, completionNotes?: TaskCompletionNotes): Promise<void> => {
    try {
      // Get current task
      const currentFhirTask = await fhirClient.read('Task' as any, taskId) as any;
      
      // Update status to completed
      currentFhirTask.status = 'completed';
      currentFhirTask.lastModified = new Date().toISOString();
      
      // Set completion date
      if (!currentFhirTask.executionPeriod) {
        currentFhirTask.executionPeriod = {};
      }
      currentFhirTask.executionPeriod.end = new Date().toISOString();
      
      // Add completion notes
      if (completionNotes?.notes) {
        if (!currentFhirTask.note) currentFhirTask.note = [];
        currentFhirTask.note.push({
          text: completionNotes.notes,
          time: new Date().toISOString()
        });
      }
      
      // Update business status if provided
      if (completionNotes?.outcome) {
        currentFhirTask.businessStatus = { text: completionNotes.outcome };
      }
      
      await fhirClient.update('Task' as any, taskId, currentFhirTask);
      
      // Refresh patient resources to update all contexts
      if (currentPatient?.id) {
        await refreshPatientResources(currentPatient.id);
      }
      
      await loadTasks();
      await loadTaskStats();
    } catch (error) {
      throw error;
    }
  };

  // Care Team methods with type safety
  const loadPatientCareTeams = async (patientId: string): Promise<void> => {
    try {
      const response = await api.get(`/api/clinical/tasks/care-teams/patient/${patientId}`);
      setCareTeams(response.data);
    } catch (error) {
      throw error;
    }
  };

  const createCareTeam = async (teamData: CareTeamCreationData): Promise<CareTeam> => {
    try {
      const response = await api.post('/api/clinical/tasks/care-teams/', teamData);
      if (currentPatient) {
        await loadPatientCareTeams(currentPatient.id);
      }
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  const updateCareTeamMembers = async (teamId: string, members: CareTeamMember[]): Promise<void> => {
    try {
      await api.put(`/api/clinical/tasks/care-teams/${teamId}/members`, members);
      if (currentPatient) {
        await loadPatientCareTeams(currentPatient.id);
      }
    } catch (error) {
      throw error;
    }
  };

  // Patient List methods with type safety
  const loadPatientLists = async (): Promise<void> => {
    try {
      const response = await api.get('/api/clinical/tasks/patient-lists/');
      setPatientLists(response.data);
    } catch (error) {
      throw error;
    }
  };

  const createPatientList = async (listData: PatientListCreationData): Promise<PatientList> => {
    try {
      const response = await api.post('/api/clinical/tasks/patient-lists/', listData);
      await loadPatientLists();
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  const addPatientToList = async (listId: string, patientId: string): Promise<void> => {
    try {
      await api.put(`/api/clinical/tasks/patient-lists/${listId}/add-patient/${patientId}`);
      await loadPatientLists();
    } catch (error) {
      throw error;
    }
  };

  const removePatientFromList = async (listId: string, patientId: string): Promise<void> => {
    try {
      await api.delete(`/api/clinical/tasks/patient-lists/${listId}/remove-patient/${patientId}`);
      await loadPatientLists();
    } catch (error) {
      throw error;
    }
  };

  const getPatientListPatients = async (listId: string): Promise<Patient[]> => {
    try {
      const response = await api.get(`/api/clinical/tasks/patient-lists/${listId}/patients`);
      return response.data.patients;
    } catch (error) {
      throw error;
    }
  };

  // Context value with comprehensive typing
  const value: TaskContextType = {
    // Inbox
    inboxItems,
    inboxStats,
    loadInboxItems,
    loadInboxStats,
    markInboxItemRead,
    acknowledgeInboxItems,
    forwardInboxItems,
    createTaskFromInbox,
    
    // Tasks
    tasks,
    taskStats,
    loadTasks,
    loadTaskStats,
    createTask,
    updateTask,
    completeTask,
    
    // Care Team
    careTeams,
    loadPatientCareTeams,
    createCareTeam,
    updateCareTeamMembers,
    
    // Patient Lists
    patientLists,
    loadPatientLists,
    createPatientList,
    addPatientToList,
    removePatientFromList,
    getPatientListPatients,

    // Utility functions
    transformFHIRTask,
    transformToFHIRTask,
    getTaskTypeDisplay
  };

  return (
    <TaskContext.Provider value={value}>
      {children}
    </TaskContext.Provider>
  );
};

export default TaskContext;