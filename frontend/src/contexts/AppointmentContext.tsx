/**
 * Appointment Context Provider - TypeScript Migration
 * Manages FHIR R4 compliant appointment scheduling functionality
 * 
 * Migrated to TypeScript with comprehensive type safety for appointment management,
 * FHIR Appointment resource handling, and scheduling workflow orchestration.
 */
import * as React from 'react';
import { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import { fhirClient } from '../services/fhirClient';
import { useFHIRResource } from './FHIRResourceContext';
import { Appointment } from '../types/fhir';

/**
 * FHIR R4 Appointment status values
 */
export type AppointmentStatus = 
  | 'proposed' 
  | 'pending' 
  | 'booked' 
  | 'arrived' 
  | 'fulfilled' 
  | 'cancelled' 
  | 'noshow' 
  | 'entered-in-error' 
  | 'checked-in' 
  | 'waitlist';

/**
 * FHIR R4 Participant status values
 */
export type ParticipantStatus = 
  | 'accepted' 
  | 'declined' 
  | 'tentative' 
  | 'needs-action';

/**
 * Appointment status constants for easy reference
 */
export const APPOINTMENT_STATUS: Record<string, AppointmentStatus> = {
  PROPOSED: 'proposed',
  PENDING: 'pending',
  BOOKED: 'booked',
  ARRIVED: 'arrived',
  FULFILLED: 'fulfilled',
  CANCELLED: 'cancelled',
  NOSHOW: 'noshow',
  ENTERED_IN_ERROR: 'entered-in-error',
  CHECKED_IN: 'checked-in',
  WAITLIST: 'waitlist'
} as const;

/**
 * Participant status constants for easy reference
 */
export const PARTICIPANT_STATUS: Record<string, ParticipantStatus> = {
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  TENTATIVE: 'tentative',
  NEEDS_ACTION: 'needs-action'
} as const;

/**
 * Appointment action types for reducer
 */
export type AppointmentActionType = 
  | 'FETCH_APPOINTMENTS_START'
  | 'FETCH_APPOINTMENTS_SUCCESS'
  | 'FETCH_APPOINTMENTS_ERROR'
  | 'CREATE_APPOINTMENT_START'
  | 'CREATE_APPOINTMENT_SUCCESS'
  | 'CREATE_APPOINTMENT_ERROR'
  | 'UPDATE_APPOINTMENT_START'
  | 'UPDATE_APPOINTMENT_SUCCESS'
  | 'UPDATE_APPOINTMENT_ERROR'
  | 'DELETE_APPOINTMENT_START'
  | 'DELETE_APPOINTMENT_SUCCESS'
  | 'DELETE_APPOINTMENT_ERROR'
  | 'SET_SELECTED_APPOINTMENT'
  | 'SET_FILTERS'
  | 'CLEAR_ERROR';

/**
 * Appointment filters interface
 */
export interface AppointmentFilters {
  status?: AppointmentStatus;
  patient?: string;
  practitioner?: string;
  location?: string;
  dateRange: {
    start: string | null;
    end: string | null;
  };
}

/**
 * Pagination interface
 */
export interface AppointmentPagination {
  page: number;
  size: number;
  total: number;
}

/**
 * Appointment search result interface
 */
export interface AppointmentSearchResult {
  appointments: Appointment[];
  total: number;
}

/**
 * Create appointment data interface
 */
export interface CreateAppointmentData {
  status?: AppointmentStatus;
  start: string;
  end: string;
  participant?: any[];
  serviceType?: any;
  reasonCode?: any[];
  description?: string;
  comment?: string;
  priority?: number;
  appointmentType?: any;
  specialty?: any;
  supportingInformation?: any[];
  patientInstruction?: string;
  basedOn?: any[];
}

/**
 * Appointment state interface
 */
export interface AppointmentState {
  appointments: Appointment[];
  selectedAppointment: Appointment | null;
  loading: boolean;
  error: string | null;
  filters: AppointmentFilters;
  pagination: AppointmentPagination;
}

/**
 * Appointment action interface
 */
export interface AppointmentAction {
  type: AppointmentActionType;
  payload?: any;
}

/**
 * Appointment context interface
 */
export interface AppointmentContextType extends AppointmentState {
  // Actions
  fetchAppointments: (customFilters?: AppointmentFilters | null, customPagination?: AppointmentPagination | null) => Promise<AppointmentSearchResult>;
  createAppointment: (appointmentData: CreateAppointmentData) => Promise<Appointment>;
  updateAppointment: (appointmentId: string, updateData: Partial<Appointment>) => Promise<Appointment>;
  cancelAppointment: (appointmentId: string, reason?: string) => Promise<Appointment>;
  rescheduleAppointment: (appointmentId: string, newStart: string, newEnd: string) => Promise<Appointment>;
  deleteAppointment: (appointmentId: string) => Promise<void>;
  getAppointment: (appointmentId: string) => Promise<Appointment>;
  setSelectedAppointment: (appointment: Appointment | null) => void;
  setFilters: (newFilters: Partial<AppointmentFilters>) => void;
  clearError: () => void;
  
  // Helper functions
  getAppointmentsByPatient: (patientId: string) => Promise<AppointmentSearchResult>;
  getAppointmentsByPractitioner: (practitionerId: string) => Promise<AppointmentSearchResult>;
  getAppointmentsByDateRange: (startDate: string, endDate: string) => Promise<AppointmentSearchResult>;
  
  // Constants
  APPOINTMENT_STATUS: typeof APPOINTMENT_STATUS;
  PARTICIPANT_STATUS: typeof PARTICIPANT_STATUS;
}

/**
 * Provider props interface
 */
export interface AppointmentProviderProps {
  children: ReactNode;
}

/**
 * Appointment action constants
 */
const APPOINTMENT_ACTIONS: Record<string, AppointmentActionType> = {
  FETCH_APPOINTMENTS_START: 'FETCH_APPOINTMENTS_START',
  FETCH_APPOINTMENTS_SUCCESS: 'FETCH_APPOINTMENTS_SUCCESS',
  FETCH_APPOINTMENTS_ERROR: 'FETCH_APPOINTMENTS_ERROR',
  CREATE_APPOINTMENT_START: 'CREATE_APPOINTMENT_START',
  CREATE_APPOINTMENT_SUCCESS: 'CREATE_APPOINTMENT_SUCCESS',
  CREATE_APPOINTMENT_ERROR: 'CREATE_APPOINTMENT_ERROR',
  UPDATE_APPOINTMENT_START: 'UPDATE_APPOINTMENT_START',
  UPDATE_APPOINTMENT_SUCCESS: 'UPDATE_APPOINTMENT_SUCCESS',
  UPDATE_APPOINTMENT_ERROR: 'UPDATE_APPOINTMENT_ERROR',
  DELETE_APPOINTMENT_START: 'DELETE_APPOINTMENT_START',
  DELETE_APPOINTMENT_SUCCESS: 'DELETE_APPOINTMENT_SUCCESS',
  DELETE_APPOINTMENT_ERROR: 'DELETE_APPOINTMENT_ERROR',
  SET_SELECTED_APPOINTMENT: 'SET_SELECTED_APPOINTMENT',
  SET_FILTERS: 'SET_FILTERS',
  CLEAR_ERROR: 'CLEAR_ERROR'
} as const;

/**
 * Initial state for appointment context
 */
const initialState: AppointmentState = {
  appointments: [],
  selectedAppointment: null,
  loading: false,
  error: null,
  filters: {
    status: undefined,
    patient: '',
    practitioner: '',
    location: '',
    dateRange: {
      start: null,
      end: null
    }
  },
  pagination: {
    page: 0,
    size: 20,
    total: 0
  }
};

/**
 * Appointment reducer function with comprehensive type safety
 */
function appointmentReducer(state: AppointmentState, action: AppointmentAction): AppointmentState {
  switch (action.type) {
    case APPOINTMENT_ACTIONS.FETCH_APPOINTMENTS_START:
    case APPOINTMENT_ACTIONS.CREATE_APPOINTMENT_START:
    case APPOINTMENT_ACTIONS.UPDATE_APPOINTMENT_START:
    case APPOINTMENT_ACTIONS.DELETE_APPOINTMENT_START:
      return {
        ...state,
        loading: true,
        error: null
      };

    case APPOINTMENT_ACTIONS.FETCH_APPOINTMENTS_SUCCESS:
      return {
        ...state,
        loading: false,
        appointments: action.payload.appointments,
        pagination: {
          ...state.pagination,
          total: action.payload.total
        },
        error: null
      };

    case APPOINTMENT_ACTIONS.CREATE_APPOINTMENT_SUCCESS:
      return {
        ...state,
        loading: false,
        appointments: [action.payload, ...state.appointments],
        error: null
      };

    case APPOINTMENT_ACTIONS.UPDATE_APPOINTMENT_SUCCESS:
      return {
        ...state,
        loading: false,
        appointments: state.appointments.map(appointment =>
          appointment.id === action.payload.id ? action.payload : appointment
        ),
        selectedAppointment: action.payload,
        error: null
      };

    case APPOINTMENT_ACTIONS.DELETE_APPOINTMENT_SUCCESS:
      return {
        ...state,
        loading: false,
        appointments: state.appointments.filter(appointment => appointment.id !== action.payload),
        selectedAppointment: null,
        error: null
      };

    case APPOINTMENT_ACTIONS.FETCH_APPOINTMENTS_ERROR:
    case APPOINTMENT_ACTIONS.CREATE_APPOINTMENT_ERROR:
    case APPOINTMENT_ACTIONS.UPDATE_APPOINTMENT_ERROR:
    case APPOINTMENT_ACTIONS.DELETE_APPOINTMENT_ERROR:
      return {
        ...state,
        loading: false,
        error: action.payload
      };

    case APPOINTMENT_ACTIONS.SET_SELECTED_APPOINTMENT:
      return {
        ...state,
        selectedAppointment: action.payload
      };

    case APPOINTMENT_ACTIONS.SET_FILTERS:
      return {
        ...state,
        filters: {
          ...state.filters,
          ...action.payload
        }
      };

    case APPOINTMENT_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null
      };

    default:
      return state;
  }
}

/**
 * Create appointment context with proper typing
 */
const AppointmentContext = createContext<AppointmentContextType | undefined>(undefined);

/**
 * Appointment provider component with comprehensive type safety
 */
export const AppointmentProvider: React.FC<AppointmentProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(appointmentReducer, initialState);
  const { refreshPatientResources } = useFHIRResource();

  /**
   * Helper function to build FHIR search parameters
   */
  const buildSearchParams = useCallback((filters: AppointmentFilters, pagination: AppointmentPagination): Record<string, any> => {
    const params: Record<string, any> = {};
    
    // Add pagination
    params._count = pagination.size.toString();
    params._offset = (pagination.page * pagination.size).toString();
    
    // Add filters
    if (filters.status) {
      params.status = filters.status;
    }
    
    if (filters.patient) {
      params.patient = filters.patient;
    }
    
    if (filters.practitioner) {
      params.practitioner = filters.practitioner;
    }
    
    if (filters.location) {
      params.location = filters.location;
    }
    
    if (filters.dateRange.start) {
      params.date = `ge${filters.dateRange.start}`;
    }
    
    if (filters.dateRange.end) {
      // If we already have a start date, combine them
      if (params.date) {
        params.date = [params.date, `le${filters.dateRange.end}`];
      } else {
        params.date = `le${filters.dateRange.end}`;
      }
    }
    
    return params;
  }, []);

  /**
   * Fetch appointments with optional filtering and pagination
   */
  const fetchAppointments = useCallback(async (
    customFilters: AppointmentFilters | null = null, 
    customPagination: AppointmentPagination | null = null
  ): Promise<AppointmentSearchResult> => {
    dispatch({ type: APPOINTMENT_ACTIONS.FETCH_APPOINTMENTS_START });
    
    try {
      const filters = customFilters || state.filters;
      const pagination = customPagination || state.pagination;
      const searchParams = buildSearchParams(filters, pagination);
      
      const response = await fhirClient.search('Appointment' as any, searchParams);
      
      const appointments = (response.resources || []).map((resource: any) => resource as Appointment);
      const total = response.total || 0;
      
      dispatch({
        type: APPOINTMENT_ACTIONS.FETCH_APPOINTMENTS_SUCCESS,
        payload: { appointments, total }
      });
      
      return { appointments, total };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch appointments';
      dispatch({
        type: APPOINTMENT_ACTIONS.FETCH_APPOINTMENTS_ERROR,
        payload: errorMessage
      });
      throw error;
    }
  }, [state.filters, state.pagination, buildSearchParams]);

  /**
   * Create new appointment
   */
  const createAppointment = useCallback(async (appointmentData: CreateAppointmentData): Promise<Appointment> => {
    dispatch({ type: APPOINTMENT_ACTIONS.CREATE_APPOINTMENT_START });
    
    try {
      // Ensure required FHIR fields
      const fhirAppointment: Omit<Appointment, 'id' | 'meta'> = {
        resourceType: 'Appointment',
        status: appointmentData.status || APPOINTMENT_STATUS.BOOKED,
        start: appointmentData.start,
        end: appointmentData.end,
        participant: appointmentData.participant || [],
        ...appointmentData
      } as any;
      
      const response = await fhirClient.create('Appointment' as any, fhirAppointment);
      const createdAppointment = response.resource || fhirAppointment;
      
      // Refresh patient resources if patient is involved
      const patientParticipant = fhirAppointment.participant?.find((p: any) => 
        p.actor?.reference?.startsWith('Patient/'));
      if (patientParticipant) {
        const patientId = patientParticipant.actor.reference.replace('Patient/', '');
        await refreshPatientResources(patientId);
      }
      
      dispatch({
        type: APPOINTMENT_ACTIONS.CREATE_APPOINTMENT_SUCCESS,
        payload: createdAppointment
      });
      
      return createdAppointment as Appointment;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create appointment';
      dispatch({
        type: APPOINTMENT_ACTIONS.CREATE_APPOINTMENT_ERROR,
        payload: errorMessage
      });
      throw error;
    }
  }, [refreshPatientResources]);

  /**
   * Update existing appointment
   */
  const updateAppointment = useCallback(async (appointmentId: string, updateData: Partial<Appointment>): Promise<Appointment> => {
    dispatch({ type: APPOINTMENT_ACTIONS.UPDATE_APPOINTMENT_START });
    
    try {
      await fhirClient.update('Appointment' as any, appointmentId, { ...updateData, resourceType: 'Appointment' });
      
      // Refresh patient resources if patient is involved
      const patientParticipant = (updateData as any).participant?.find((p: any) => 
        p.actor?.reference?.startsWith('Patient/'));
      if (patientParticipant) {
        const patientId = patientParticipant.actor.reference.replace('Patient/', '');
        await refreshPatientResources(patientId);
      }
      
      const updatedAppointment = { ...updateData, id: appointmentId } as Appointment;
      dispatch({
        type: APPOINTMENT_ACTIONS.UPDATE_APPOINTMENT_SUCCESS,
        payload: updatedAppointment
      });
      
      return updatedAppointment;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update appointment';
      dispatch({
        type: APPOINTMENT_ACTIONS.UPDATE_APPOINTMENT_ERROR,
        payload: errorMessage
      });
      throw error;
    }
  }, [refreshPatientResources]);

  /**
   * Cancel appointment with optional reason
   */
  const cancelAppointment = useCallback(async (appointmentId: string, reason?: string): Promise<Appointment> => {
    try {
      const updateData: Partial<Appointment> = {
        status: APPOINTMENT_STATUS.CANCELLED as any,
        cancelationReason: reason ? {
          text: reason
        } : undefined
      } as any;
      
      return await updateAppointment(appointmentId, updateData);
    } catch (error) {
      throw error;
    }
  }, [updateAppointment]);

  /**
   * Reschedule appointment to new time
   */
  const rescheduleAppointment = useCallback(async (appointmentId: string, newStart: string, newEnd: string): Promise<Appointment> => {
    try {
      const updateData: Partial<Appointment> = {
        start: newStart,
        end: newEnd,
        status: APPOINTMENT_STATUS.BOOKED as any // Reset to booked when rescheduled
      };
      
      return await updateAppointment(appointmentId, updateData);
    } catch (error) {
      throw error;
    }
  }, [updateAppointment]);

  /**
   * Delete appointment permanently
   */
  const deleteAppointment = useCallback(async (appointmentId: string): Promise<void> => {
    dispatch({ type: APPOINTMENT_ACTIONS.DELETE_APPOINTMENT_START });
    
    try {
      // Read appointment to get patient reference before deleting
      const appointment = await fhirClient.read('Appointment' as any, appointmentId) as any;
      
      await fhirClient.delete('Appointment' as any, appointmentId);
      
      // Refresh patient resources if patient is involved
      const patientParticipant = appointment.participant?.find((p: any) => 
        p.actor?.reference?.startsWith('Patient/'));
      if (patientParticipant) {
        const patientId = patientParticipant.actor.reference.replace('Patient/', '');
        await refreshPatientResources(patientId);
      }
      
      dispatch({
        type: APPOINTMENT_ACTIONS.DELETE_APPOINTMENT_SUCCESS,
        payload: appointmentId
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete appointment';
      dispatch({
        type: APPOINTMENT_ACTIONS.DELETE_APPOINTMENT_ERROR,
        payload: errorMessage
      });
      throw error;
    }
  }, [refreshPatientResources]);

  /**
   * Get appointment by ID
   */
  const getAppointment = useCallback(async (appointmentId: string): Promise<Appointment> => {
    try {
      const appointment = await fhirClient.read('Appointment' as any, appointmentId);
      return appointment as Appointment;
    } catch (error) {
      throw error;
    }
  }, []);

  /**
   * Set selected appointment
   */
  const setSelectedAppointment = useCallback((appointment: Appointment | null): void => {
    dispatch({
      type: APPOINTMENT_ACTIONS.SET_SELECTED_APPOINTMENT,
      payload: appointment
    });
  }, []);

  /**
   * Set filters for appointment search
   */
  const setFilters = useCallback((newFilters: Partial<AppointmentFilters>): void => {
    dispatch({
      type: APPOINTMENT_ACTIONS.SET_FILTERS,
      payload: newFilters
    });
  }, []);

  /**
   * Clear error state
   */
  const clearError = useCallback((): void => {
    dispatch({ type: APPOINTMENT_ACTIONS.CLEAR_ERROR });
  }, []);

  /**
   * Helper function: Get appointments by patient
   */
  const getAppointmentsByPatient = useCallback(async (patientId: string): Promise<AppointmentSearchResult> => {
    return fetchAppointments({ ...state.filters, patient: `Patient/${patientId}` });
  }, [fetchAppointments, state.filters]);

  /**
   * Helper function: Get appointments by practitioner
   */
  const getAppointmentsByPractitioner = useCallback(async (practitionerId: string): Promise<AppointmentSearchResult> => {
    return fetchAppointments({ ...state.filters, practitioner: `Practitioner/${practitionerId}` });
  }, [fetchAppointments, state.filters]);

  /**
   * Helper function: Get appointments by date range
   */
  const getAppointmentsByDateRange = useCallback(async (startDate: string, endDate: string): Promise<AppointmentSearchResult> => {
    return fetchAppointments({
      ...state.filters,
      dateRange: {
        start: startDate,
        end: endDate
      }
    });
  }, [fetchAppointments, state.filters]);

  // Context value with comprehensive typing
  const value: AppointmentContextType = {
    // State
    ...state,
    
    // Actions
    fetchAppointments,
    createAppointment,
    updateAppointment,
    cancelAppointment,
    rescheduleAppointment,
    deleteAppointment,
    getAppointment,
    setSelectedAppointment,
    setFilters,
    clearError,
    
    // Helper functions
    getAppointmentsByPatient,
    getAppointmentsByPractitioner,
    getAppointmentsByDateRange,
    
    // Constants
    APPOINTMENT_STATUS,
    PARTICIPANT_STATUS
  };

  return (
    <AppointmentContext.Provider value={value}>
      {children}
    </AppointmentContext.Provider>
  );
};

/**
 * Custom hook for using appointment context with type safety
 */
export const useAppointments = (): AppointmentContextType => {
  const context = useContext(AppointmentContext);
  if (!context) {
    throw new Error('useAppointments must be used within an AppointmentProvider');
  }
  return context;
};

export default AppointmentContext;