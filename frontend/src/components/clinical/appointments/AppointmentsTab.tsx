/**
 * AppointmentsTab Component
 * Shows patient appointments within the clinical workspace
 * 
 * Migrated to TypeScript with comprehensive type safety for appointment management.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Button,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  CircularProgress,
  Tooltip,
  Stack,
  SxProps,
  Theme,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Cancel as CancelIcon,
  Schedule as ScheduleIcon,
  Event as EventIcon,
  Person as PersonIcon,
  LocationOn as LocationIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material';
import { format, parseISO, isToday, isFuture, isPast } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useAppointments } from '../../../contexts/AppointmentContext';
import { useClinical } from '../../../contexts/ClinicalContext';

/**
 * Type definitions for AppointmentsTab component
 */
export type AppointmentStatus = 
  | 'proposed' 
  | 'pending' 
  | 'booked' 
  | 'arrived' 
  | 'fulfilled' 
  | 'cancelled' 
  | 'noshow' 
  | 'entered-in-error';

export interface AppointmentParticipant {
  actor?: {
    reference?: string;
    display?: string;
  };
  status?: string;
  required?: string;
}

export interface AppointmentReasonCode {
  coding?: Array<{
    system?: string;
    code?: string;
    display?: string;
  }>;
  text?: string;
}

export interface Appointment {
  id: string;
  status: AppointmentStatus;
  start: string;
  end: string;
  participant?: AppointmentParticipant[];
  reasonCode?: AppointmentReasonCode[];
  description?: string;
  comment?: string;
  minutesDuration?: number;
  slot?: Array<{
    reference: string;
  }>;
  created?: string;
  patientInstruction?: string;
}

export interface AppointmentSummary {
  today: number;
  upcoming: number;
  past: number;
  total: number;
}

export interface AppointmentContextType {
  appointments: Appointment[];
  loading: boolean;
  error: string | null;
  getAppointmentsByPatient: (patientId: string) => Promise<{ appointments: Appointment[] }>;
  cancelAppointment: (appointmentId: string, reason: string) => Promise<void>;
  clearError: () => void;
  APPOINTMENT_STATUS: Record<string, AppointmentStatus>;
}

export interface ClinicalContextType {
  currentPatient: any | null;
}

export interface AppointmentsTabProps {
  sx?: SxProps<Theme>;
}

/**
 * Helper functions
 */
const getStatusColor = (status: AppointmentStatus): 'primary' | 'info' | 'success' | 'error' | 'warning' | 'default' => {
  switch (status) {
    case 'booked': return 'primary';
    case 'arrived': return 'info';
    case 'fulfilled': return 'success';
    case 'cancelled': return 'error';
    case 'noshow': return 'warning';
    default: return 'default';
  }
};

const getAppointmentIcon = (status: AppointmentStatus, startDate: string): React.ReactElement => {
  const appointmentDate = parseISO(startDate);
  
  if (isToday(appointmentDate)) {
    return <EventIcon color="primary" />;
  } else if (isFuture(appointmentDate)) {
    return <ScheduleIcon color="action" />;
  } else {
    return <EventIcon color="disabled" />;
  }
};

const getPractitionerName = (appointment: Appointment): string => {
  const practitioner = appointment.participant?.find(p => 
    p.actor?.reference?.startsWith('Practitioner/')
  );
  return practitioner?.actor?.display || 'Unknown Practitioner';
};

const getLocationName = (appointment: Appointment): string => {
  const location = appointment.participant?.find(p => 
    p.actor?.reference?.startsWith('Location/')
  );
  return location?.actor?.display || 'No location specified';
};

const getAppointmentReason = (appointment: Appointment): string => {
  return appointment.reasonCode?.[0]?.text || appointment.description || 'No reason specified';
};

const formatTime = (dateString: string): string => {
  try {
    return format(parseISO(dateString), 'HH:mm');
  } catch (error) {
    console.error('Error formatting time:', error);
    return dateString;
  }
};

const formatDate = (dateString: string): string => {
  try {
    return format(parseISO(dateString), 'MMM dd, yyyy');
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString;
  }
};

const sortAppointmentsByDate = (appointments: Appointment[]): Appointment[] => {
  return [...appointments].sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
};

const categorizeAppointments = (appointments: Appointment[]): {
  today: Appointment[];
  upcoming: Appointment[];
  past: Appointment[];
} => {
  const today: Appointment[] = [];
  const upcoming: Appointment[] = [];
  const past: Appointment[] = [];

  appointments.forEach(apt => {
    const appointmentDate = parseISO(apt.start);
    if (isToday(appointmentDate)) {
      today.push(apt);
    } else if (isFuture(appointmentDate)) {
      upcoming.push(apt);
    } else {
      past.push(apt);
    }
  });

  return { today, upcoming, past };
};

/**
 * AppointmentsTab Component
 */
const AppointmentsTab: React.FC<AppointmentsTabProps> = ({ sx }) => {
  const navigate = useNavigate();
  const { currentPatient } = useClinical();
  const {
    appointments,
    loading,
    error,
    getAppointmentsByPatient,
    cancelAppointment,
    clearError,
    APPOINTMENT_STATUS
  } = useAppointments();

  const [patientAppointments, setPatientAppointments] = useState<Appointment[]>([]);

  const loadPatientAppointments = useCallback(async (): Promise<void> => {
    if (!currentPatient?.id) return;

    try {
      const result = await getAppointmentsByPatient(currentPatient.id);
      if (result?.appointments) {
        setPatientAppointments(result.appointments);
      }
    } catch (err) {
      console.error('Error loading patient appointments:', err);
    }
  }, [currentPatient?.id, getAppointmentsByPatient]);

  useEffect(() => {
    loadPatientAppointments();
  }, [loadPatientAppointments]);

  const handleCancelAppointment = useCallback(async (appointment: Appointment): Promise<void> => {
    if (window.confirm('Are you sure you want to cancel this appointment?')) {
      try {
        await cancelAppointment(appointment.id, 'Cancelled from clinical workspace');
        await loadPatientAppointments(); // Refresh the list
      } catch (err) {
        console.error('Error cancelling appointment:', err);
      }
    }
  }, [cancelAppointment, loadPatientAppointments]);

  const handleScheduleNew = useCallback((): void => {
    navigate(`/schedule?patient=${currentPatient?.id}`);
  }, [navigate, currentPatient?.id]);

  const handleEditAppointment = useCallback((appointment: Appointment): void => {
    navigate(`/schedule?edit=${appointment.id}`);
  }, [navigate]);

  const { today: todayAppointments, upcoming: upcomingAppointments, past: pastAppointments } = 
    categorizeAppointments(patientAppointments);

  const getPatientDisplayName = (): string => {
    if (!currentPatient) return '';
    return currentPatient.name?.[0]?.given?.[0] + ' ' + currentPatient.name?.[0]?.family || 'Unknown Patient';
  };

  if (!currentPatient) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200} sx={sx}>
        <Typography color="textSecondary">
          Select a patient to view appointments
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={sx}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">
          Appointments for {getPatientDisplayName()}
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleScheduleNew}
          aria-label="Schedule new appointment"
        >
          Schedule Appointment
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={clearError}>
          {error}
        </Alert>
      )}

      {loading && (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      )}

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1}>
                <EventIcon color="primary" />
                <Typography variant="h6">Today</Typography>
              </Box>
              <Typography variant="h4" color="primary">
                {todayAppointments.length}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {todayAppointments.length === 1 ? 'Appointment' : 'Appointments'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1}>
                <ScheduleIcon color="action" />
                <Typography variant="h6">Upcoming</Typography>
              </Box>
              <Typography variant="h4" color="text.primary">
                {upcomingAppointments.length}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Future appointments
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={1}>
                <EventIcon color="disabled" />
                <Typography variant="h6">Past</Typography>
              </Box>
              <Typography variant="h4" color="text.primary">
                {pastAppointments.length}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Previous appointments
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Today's Appointments */}
      {todayAppointments.length > 0 && (
        <Paper sx={{ mb: 3 }}>
          <Box p={2}>
            <Typography variant="h6" gutterBottom>
              Today's Appointments
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Time</TableCell>
                    <TableCell>Practitioner</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {todayAppointments.map((appointment) => (
                    <TableRow key={appointment.id}>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <TimeIcon fontSize="small" />
                          {formatTime(appointment.start)} - {formatTime(appointment.end)}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <PersonIcon fontSize="small" />
                          {getPractitionerName(appointment)}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          <LocationIcon fontSize="small" />
                          {getLocationName(appointment)}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={appointment.status}
                          color={getStatusColor(appointment.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1}>
                          <Tooltip title="Edit appointment">
                            <IconButton
                              size="small"
                              onClick={() => handleEditAppointment(appointment)}
                              aria-label="Edit appointment"
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Cancel appointment">
                            <IconButton
                              size="small"
                              onClick={() => handleCancelAppointment(appointment)}
                              disabled={appointment.status === APPOINTMENT_STATUS.CANCELLED}
                              aria-label="Cancel appointment"
                            >
                              <CancelIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Paper>
      )}

      {/* All Appointments */}
      <Paper>
        <Box p={2}>
          <Typography variant="h6" gutterBottom>
            All Appointments ({patientAppointments.length} total)
          </Typography>
          
          {patientAppointments.length === 0 ? (
            <Box textAlign="center" py={4}>
              <Typography color="textSecondary" gutterBottom>
                No appointments found for this patient
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={handleScheduleNew}
              >
                Schedule First Appointment
              </Button>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date & Time</TableCell>
                    <TableCell>Practitioner</TableCell>
                    <TableCell>Location</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Reason</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortAppointmentsByDate(patientAppointments).map((appointment) => (
                    <TableRow key={appointment.id}>
                      <TableCell>
                        <Box display="flex" alignItems="center" gap={1}>
                          {getAppointmentIcon(appointment.status, appointment.start)}
                          <Box>
                            <Typography variant="body2">
                              {formatDate(appointment.start)}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              {formatTime(appointment.start)} - {formatTime(appointment.end)}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>{getPractitionerName(appointment)}</TableCell>
                      <TableCell>{getLocationName(appointment)}</TableCell>
                      <TableCell>
                        <Chip
                          label={appointment.status}
                          color={getStatusColor(appointment.status)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {getAppointmentReason(appointment)}
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1}>
                          <Tooltip title="Edit appointment">
                            <IconButton
                              size="small"
                              onClick={() => handleEditAppointment(appointment)}
                              aria-label="Edit appointment"
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Cancel appointment">
                            <IconButton
                              size="small"
                              onClick={() => handleCancelAppointment(appointment)}
                              disabled={appointment.status === APPOINTMENT_STATUS.CANCELLED}
                              aria-label="Cancel appointment"
                            >
                              <CancelIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default AppointmentsTab;