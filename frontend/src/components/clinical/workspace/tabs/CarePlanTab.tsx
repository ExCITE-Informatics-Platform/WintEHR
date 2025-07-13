/**
 * Care Plan Tab Component
 * Manage patient care plans, goals, and interventions
 * 
 * Migrated to TypeScript with comprehensive type safety for care plan management.
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
  CardHeader,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  FormControl,
  Select,
  InputLabel,
  CircularProgress,
  Alert,
  LinearProgress,
  Avatar,
  AvatarGroup,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  alpha,
  Snackbar,
  SxProps,
  Theme,
  SelectChangeEvent,
  AlertColor,
} from '@mui/material';
import {
  Flag as GoalIcon,
  Assignment as TaskIcon,
  LocalHospital as InterventionIcon,
  Group as TeamIcon,
  TrendingUp as ProgressIcon,
  CheckCircle as CompletedIcon,
  Schedule as InProgressIcon,
  Cancel as CancelledIcon,
  Warning as OverdueIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CalendarMonth as CalendarIcon,
  Person as PersonIcon,
  Notes as NotesIcon,
  Timeline as TimelineIcon,
  Assessment as OutcomeIcon,
  Favorite as HealthIcon,
  Psychology as BehavioralIcon,
  Restaurant as NutritionIcon,
  FitnessCenter as ExerciseIcon,
  MedicalServices as MedicalIcon,
  Print as PrintIcon,
  Close as CloseIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import { format, parseISO, formatDistanceToNow, addDays, isPast, isFuture } from 'date-fns';
import { Goal, CarePlan, CareTeam, Patient } from '@ahryman40k/ts-fhir-types/lib/R4';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useNavigate } from 'react-router-dom';
import { printDocument } from '../../../../utils/printUtils';
import fhirClient from '../../../../services/fhirClient';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';

/**
 * Type definitions for CarePlanTab component
 */
export type GoalCategory = 'health-maintenance' | 'behavioral' | 'nutrition' | 'exercise' | 'medical';

export type GoalStatus = 'proposed' | 'planned' | 'accepted' | 'active' | 'on-hold' | 'completed' | 'cancelled' | 'entered-in-error' | 'rejected';

export type GoalPriority = 'high-priority' | 'medium-priority' | 'low-priority';

export type ActivityStatus = 'not-started' | 'scheduled' | 'in-progress' | 'on-hold' | 'completed' | 'cancelled' | 'stopped' | 'unknown' | 'entered-in-error';

export type PerformerType = 'practitioner' | 'patient' | 'related-person' | 'care-team';

export type CareTeamRole = 'physician' | 'nurse' | 'therapist' | 'social-worker' | 'care-coordinator' | 'family' | 'other';

export type AchievementStatus = 'in-progress' | 'improving' | 'worsening' | 'no-change' | 'achieved' | 'not-achieved';

export type InterventionType = 'medication' | 'procedure' | 'education' | 'counseling' | 'referral';

export interface GoalCategoryConfig {
  icon: React.ReactElement;
  label: string;
  color: 'primary' | 'secondary' | 'warning' | 'info' | 'error';
}

export interface GoalStatusInfo {
  icon: React.ReactElement;
  color: 'success' | 'warning' | 'error' | 'default';
  label: string;
}

export interface GoalCardProps {
  goal: Goal;
  onEdit: (goal: Goal) => void;
  onViewProgress: (goal: Goal) => void;
  onUpdateProgress: (goal: Goal) => void;
  onAddIntervention?: (goal: Goal) => void;
}

export interface CareTeamCardProps {
  careTeam: CareTeam;
  onAddMember: () => void;
  onViewAll: () => void;
}

export interface InterventionListProps {
  activities: CarePlanActivity[];
  onEdit: (activity: CarePlanActivity) => void;
  onAddIntervention: () => void;
}

export interface AddCareTeamMemberDialogProps {
  open: boolean;
  onClose: () => void;
  careTeam: CareTeam | null;
  patientId: string;
  onSuccess?: () => void;
}

export interface GoalProgressDialogProps {
  open: boolean;
  onClose: () => void;
  goal: Goal | null;
  patientId: string;
}

export interface ActivityEditDialogProps {
  open: boolean;
  onClose: () => void;
  activity: CarePlanActivity | null;
  carePlanId?: string;
  onSuccess?: () => void;
}

export interface GoalEditorDialogProps {
  open: boolean;
  onClose: () => void;
  goal: Goal | null;
  patientId: string;
}

export interface CarePlanTabProps {
  patientId: string;
  onNotificationUpdate?: (message: string, severity: AlertColor) => void;
  sx?: SxProps<Theme>;
}

export interface CareTeamMemberData {
  name: string;
  role: CareTeamRole;
  contact: string;
  responsibilities: string;
}

export interface GoalData {
  description: string;
  category: GoalCategory;
  priority: string;
  targetDate: string;
  targetMeasure: string;
  targetValue: string;
  targetUnit: string;
  notes: string;
}

export interface ActivityData {
  description: string;
  status: ActivityStatus;
  scheduledPeriod: string;
  performerType: PerformerType;
  goal: string;
  notes: string;
}

export interface ProgressData {
  date: string;
  value: number;
  target: number;
}

export interface SnackbarState {
  open: boolean;
  message: string;
  severity: AlertColor;
}

export interface PatientInfo {
  name: string;
  mrn?: string;
  birthDate?: string;
  gender?: string;
  phone?: string;
}

export interface CarePlanActivity {
  detail?: {
    description?: string;
    status?: ActivityStatus;
    code?: {
      text?: string;
      coding?: Array<{
        system?: string;
        code?: string;
        display?: string;
      }>;
    };
    scheduledTiming?: {
      repeat?: {
        frequency?: number;
        period?: number;
        periodUnit?: string;
        boundsPeriod?: {
          start?: string;
          end?: string;
        };
      };
    };
    scheduledPeriod?: {
      start?: string;
      end?: string;
    };
    performer?: Array<{
      type?: {
        coding?: Array<{
          system?: string;
          code?: string;
        }>;
      };
    }>;
    goal?: Array<{
      reference?: string;
    }>;
    location?: {
      display?: string;
    };
    note?: string;
  };
}

export interface CarePlanParticipant {
  role?: Array<{
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  }>;
  member?: {
    display?: string;
  };
  period?: {
    start?: string;
    end?: string;
  };
}

/**
 * Constants and helper functions
 */
const goalCategories: Record<GoalCategory, GoalCategoryConfig> = {
  'health-maintenance': { icon: <HealthIcon />, label: 'Health Maintenance', color: 'primary' },
  'behavioral': { icon: <BehavioralIcon />, label: 'Behavioral', color: 'secondary' },
  'nutrition': { icon: <NutritionIcon />, label: 'Nutrition', color: 'warning' },
  'exercise': { icon: <ExerciseIcon />, label: 'Exercise', color: 'info' },
  'medical': { icon: <MedicalIcon />, label: 'Medical', color: 'error' }
};

const getGoalStatus = (goal: Goal): GoalStatusInfo => {
  const status = goal.lifecycleStatus as GoalStatus;
  switch (status) {
    case 'active':
    case 'on-hold':
      return { 
        icon: <InProgressIcon />, 
        color: 'warning', 
        label: 'In Progress' 
      };
    case 'completed':
      return { 
        icon: <CompletedIcon />, 
        color: 'success', 
        label: 'Completed' 
      };
    case 'cancelled':
    case 'entered-in-error':
    case 'rejected':
      return { 
        icon: <CancelledIcon />, 
        color: 'error', 
        label: 'Cancelled' 
      };
    default:
      return { 
        icon: <InProgressIcon />, 
        color: 'default', 
        label: status || 'Unknown' 
      };
  }
};

const getActivityStatus = (activity: CarePlanActivity): ActivityStatus => {
  if (activity.detail?.status === 'completed') return 'completed';
  if (activity.detail?.status === 'cancelled') return 'cancelled';
  if (activity.detail?.scheduledTiming?.repeat?.boundsPeriod?.end &&
      isPast(parseISO(activity.detail.scheduledTiming.repeat.boundsPeriod.end))) {
    return 'cancelled'; // Using cancelled for overdue
  }
  return activity.detail?.status || 'not-started';
};

const getStatusChip = (status: ActivityStatus): React.ReactElement => {
  switch (status) {
    case 'completed':
      return <Chip size="small" label="Completed" color="success" />;
    case 'cancelled':
      return <Chip size="small" label="Cancelled" color="error" />;
    case 'in-progress':
      return <Chip size="small" label="In Progress" color="primary" />;
    default:
      return <Chip size="small" label="Active" color="primary" />;
  }
};

const extractPatientInfo = (patient: Patient | null): PatientInfo => {
  if (!patient) {
    return {
      name: 'Unknown Patient',
    };
  }

  const name = patient.name?.[0] ? 
    `${patient.name[0].given?.join(' ') || ''} ${patient.name[0].family || ''}`.trim() : 
    'Unknown Patient';

  const mrn = patient.identifier?.find(id => id.type?.coding?.[0]?.code === 'MR')?.value || patient.id;

  return {
    name,
    mrn,
    birthDate: patient.birthDate,
    gender: patient.gender,
    phone: patient.telecom?.find(t => t.system === 'phone')?.value,
  };
};

const generateMockProgressData = (goal: Goal): ProgressData[] => {
  const targetValue = goal.target?.[0]?.detailQuantity?.value || 100;
  const startDate = new Date(goal.startDate || Date.now() - 90 * 24 * 60 * 60 * 1000);
  const data: ProgressData[] = [];
  
  for (let i = 0; i < 12; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + (i * 7)); // Weekly data points
    
    const progress = Math.min(
      targetValue,
      (targetValue / 12) * i + Math.random() * (targetValue / 12)
    );
    
    data.push({
      date: format(date, 'MMM d'),
      value: Math.round(progress),
      target: targetValue
    });
  }
  
  return data;
};

/**
 * GoalCard Component
 */
const GoalCard: React.FC<GoalCardProps> = ({ 
  goal, 
  onEdit, 
  onViewProgress, 
  onUpdateProgress, 
  onAddIntervention 
}) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState<boolean>(false);
  
  const category = (goal.category?.[0]?.coding?.[0]?.code as GoalCategory) || 'health-maintenance';
  const categoryConfig = goalCategories[category] || goalCategories['health-maintenance'];
  const status = getGoalStatus(goal);
  const targetDate = goal.target?.[0]?.dueDate;
  const isOverdue = targetDate && isPast(parseISO(targetDate)) && goal.lifecycleStatus === 'active';

  const progressPercentage = goal.achievementStatus?.coding?.[0]?.code === 'achieved' ? 100 :
                            goal.achievementStatus?.coding?.[0]?.code === 'in-progress' ? 60 : 0;

  const handleEdit = useCallback((): void => {
    onEdit(goal);
  }, [goal, onEdit]);

  const handleViewProgress = useCallback((): void => {
    onViewProgress(goal);
  }, [goal, onViewProgress]);

  const handleUpdateProgress = useCallback((): void => {
    onUpdateProgress(goal);
  }, [goal, onUpdateProgress]);

  const handleAddIntervention = useCallback((): void => {
    onAddIntervention?.(goal);
  }, [goal, onAddIntervention]);

  return (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={2} alignItems="center" mb={2}>
              <Avatar 
                sx={{ 
                  bgcolor: categoryConfig?.color && theme.palette[categoryConfig.color]?.main
                    ? alpha(theme.palette[categoryConfig.color].main, 0.1)
                    : alpha(theme.palette.primary.main, 0.1),
                  color: categoryConfig?.color && theme.palette[categoryConfig.color]?.main
                    ? theme.palette[categoryConfig.color].main
                    : theme.palette.primary.main 
                }}
              >
                {categoryConfig.icon}
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6">
                  {goal.description?.text || 'Goal'}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip 
                    label={categoryConfig.label} 
                    size="small" 
                    variant="outlined"
                  />
                  <Chip 
                    icon={status.icon}
                    label={status.label} 
                    size="small" 
                    color={status.color}
                  />
                  {isOverdue && (
                    <Chip 
                      icon={<OverdueIcon />}
                      label="Overdue" 
                      size="small" 
                      color="error"
                    />
                  )}
                </Stack>
              </Box>
            </Stack>

            <Box mb={2}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="body2" color="text.secondary">
                  Progress
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {progressPercentage}%
                </Typography>
              </Stack>
              <LinearProgress 
                variant="determinate" 
                value={progressPercentage} 
                sx={{ height: 8, borderRadius: 1 }}
                color={progressPercentage === 100 ? 'success' : 'primary'}
              />
            </Box>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">Target Date</Typography>
                <Typography variant="body2">
                  {targetDate ? format(parseISO(targetDate), 'MMM d, yyyy') : 'No target date'}
                </Typography>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">Priority</Typography>
                <Typography variant="body2">
                  {goal.priority?.text || goal.priority?.coding?.[0]?.display || 'Normal'}
                </Typography>
              </Grid>
            </Grid>

            {goal.note?.[0] && expanded && (
              <Box mt={2}>
                <Typography variant="caption" color="text.secondary">Notes</Typography>
                <Typography variant="body2">{goal.note[0].text}</Typography>
              </Box>
            )}

            {goal.target?.[0]?.measure && (
              <Box mt={2}>
                <Typography variant="caption" color="text.secondary">Target Measure</Typography>
                <Typography variant="body2">
                  {goal.target[0].measure.text || goal.target[0].measure.coding?.[0]?.display}
                  {goal.target[0].detailQuantity && 
                    `: ${goal.target[0].detailQuantity.value} ${goal.target[0].detailQuantity.unit}`
                  }
                </Typography>
              </Box>
            )}
          </Box>

          <Stack direction="column" spacing={1}>
            <IconButton size="small" onClick={handleEdit}>
              <EditIcon />
            </IconButton>
            <IconButton size="small" onClick={handleViewProgress}>
              <TimelineIcon />
            </IconButton>
          </Stack>
        </Stack>
      </CardContent>

      <CardActions>
        <Button 
          size="small" 
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Show Less' : 'Show More'}
        </Button>
        <Button size="small" color="primary" onClick={handleUpdateProgress}>
          Update Progress
        </Button>
        <Button size="small" onClick={handleAddIntervention}>
          Add Intervention
        </Button>
      </CardActions>
    </Card>
  );
};

/**
 * CareTeamCard Component
 */
const CareTeamCard: React.FC<CareTeamCardProps> = ({ 
  careTeam, 
  onAddMember, 
  onViewAll 
}) => {
  const participants = careTeam.participant || [];
  const activeParticipants = participants.filter((p: CarePlanParticipant) => 
    !p.period?.end || isFuture(parseISO(p.period.end))
  );

  return (
    <Card>
      <CardHeader
        avatar={<TeamIcon color="primary" />}
        title="Care Team"
        subheader={`${activeParticipants.length} active members`}
      />
      <CardContent>
        <List>
          {activeParticipants.map((participant: CarePlanParticipant, index: number) => (
            <ListItem key={index}>
              <ListItemIcon>
                <Avatar sx={{ width: 32, height: 32 }}>
                  <PersonIcon />
                </Avatar>
              </ListItemIcon>
              <ListItemText
                primary={participant.member?.display || 'Team Member'}
                secondary={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="caption">
                      {participant.role?.[0]?.text || participant.role?.[0]?.coding?.[0]?.display || 'Role not specified'}
                    </Typography>
                    {participant.period?.start && (
                      <Typography variant="caption" color="text.secondary">
                        • Since {format(parseISO(participant.period.start), 'MMM yyyy')}
                      </Typography>
                    )}
                  </Stack>
                }
              />
            </ListItem>
          ))}
        </List>
        
        {activeParticipants.length === 0 && (
          <Typography variant="body2" color="text.secondary" align="center">
            No care team members assigned
          </Typography>
        )}
      </CardContent>
      <CardActions>
        <Button size="small" startIcon={<AddIcon />} onClick={onAddMember}>
          Add Member
        </Button>
        <Button size="small" onClick={onViewAll}>
          View All
        </Button>
      </CardActions>
    </Card>
  );
};

/**
 * InterventionList Component
 */
const InterventionList: React.FC<InterventionListProps> = ({ 
  activities, 
  onEdit, 
  onAddIntervention 
}) => {
  const handleEdit = useCallback((activity: CarePlanActivity) => (): void => {
    onEdit(activity);
  }, [onEdit]);

  return (
    <Card>
      <CardHeader
        avatar={<InterventionIcon color="secondary" />}
        title="Interventions & Activities"
        subheader={`${activities.length} total activities`}
      />
      <CardContent>
        <List>
          {activities.map((activity: CarePlanActivity, index: number) => {
            const status = getActivityStatus(activity);
            return (
              <React.Fragment key={index}>
                <ListItem>
                  <ListItemIcon>
                    <TaskIcon color={status === 'cancelled' ? 'error' : 'action'} />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body1">
                          {activity.detail?.description || 
                           activity.detail?.code?.text || 
                           activity.detail?.code?.coding?.[0]?.display ||
                           'Activity'}
                        </Typography>
                        {getStatusChip(status)}
                      </Stack>
                    }
                    secondary={
                      <Box>
                        {activity.detail?.scheduledTiming?.repeat?.frequency && (
                          <Typography variant="caption">
                            Frequency: {activity.detail.scheduledTiming.repeat.frequency} times per {activity.detail.scheduledTiming.repeat.period} {activity.detail.scheduledTiming.repeat.periodUnit}
                          </Typography>
                        )}
                        {activity.detail?.location && (
                          <Typography variant="caption" display="block">
                            Location: {activity.detail.location.display}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton edge="end" size="small" onClick={handleEdit(activity)}>
                      <EditIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
                {index < activities.length - 1 && <Divider component="li" />}
              </React.Fragment>
            );
          })}
        </List>
        
        {activities.length === 0 && (
          <Typography variant="body2" color="text.secondary" align="center">
            No interventions or activities defined
          </Typography>
        )}
      </CardContent>
      <CardActions>
        <Button size="small" startIcon={<AddIcon />} onClick={onAddIntervention}>
          Add Intervention
        </Button>
      </CardActions>
    </Card>
  );
};

/**
 * AddCareTeamMemberDialog Component
 */
const AddCareTeamMemberDialog: React.FC<AddCareTeamMemberDialogProps> = ({ 
  open, 
  onClose, 
  careTeam, 
  patientId, 
  onSuccess 
}) => {
  const [memberData, setMemberData] = useState<CareTeamMemberData>({
    name: '',
    role: 'physician',
    contact: '',
    responsibilities: ''
  });

  const handleSave = useCallback(async (): Promise<void> => {
    try {
      if (!memberData.name || !memberData.role) {
        alert('Please provide member name and role');
        return;
      }

      // Create or update CareTeam resource
      let careTeamResource: CareTeam;
      
      if (careTeam && careTeam.id) {
        // Update existing CareTeam
        careTeamResource = { ...careTeam };
        if (!careTeamResource.participant) {
          careTeamResource.participant = [];
        }
        
        // Add new participant
        careTeamResource.participant.push({
          role: [{
            coding: [{
              system: 'http://snomed.info/sct',
              code: memberData.role,
              display: memberData.role.charAt(0).toUpperCase() + memberData.role.slice(1).replace('-', ' ')
            }],
            text: memberData.role.charAt(0).toUpperCase() + memberData.role.slice(1).replace('-', ' ')
          }],
          member: {
            display: memberData.name
          },
          period: {
            start: new Date().toISOString()
          }
        });
        
        await fhirClient.updateCareTeam(careTeam.id, careTeamResource);
      } else {
        // Create new CareTeam
        careTeamResource = {
          resourceType: 'CareTeam',
          status: 'active',
          subject: {
            reference: `Patient/${patientId}`
          },
          period: {
            start: new Date().toISOString()
          },
          participant: [{
            role: [{
              coding: [{
                system: 'http://snomed.info/sct',
                code: memberData.role,
                display: memberData.role.charAt(0).toUpperCase() + memberData.role.slice(1).replace('-', ' ')
              }],
              text: memberData.role.charAt(0).toUpperCase() + memberData.role.slice(1).replace('-', ' ')
            }],
            member: {
              display: memberData.name
            },
            period: {
              start: new Date().toISOString()
            }
          }],
          name: 'Patient Care Team'
        };
        
        // Store contact and responsibilities as extensions if provided
        if (memberData.contact || memberData.responsibilities) {
          careTeamResource.extension = [];
          if (memberData.contact) {
            careTeamResource.extension.push({
              url: 'http://example.org/fhir/StructureDefinition/member-contact',
              valueString: memberData.contact
            });
          }
          if (memberData.responsibilities) {
            careTeamResource.extension.push({
              url: 'http://example.org/fhir/StructureDefinition/member-responsibilities',
              valueString: memberData.responsibilities
            });
          }
        }
        
        await fhirClient.createCareTeam(careTeamResource);
      }
      
      // Reset form and close
      setMemberData({ name: '', role: 'physician', contact: '', responsibilities: '' });
      onClose();
      onSuccess?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert('Failed to add care team member: ' + errorMessage);
    }
  }, [memberData, careTeam, patientId, onClose, onSuccess]);

  const handleFieldChange = useCallback(<K extends keyof CareTeamMemberData>(
    field: K
  ) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | SelectChangeEvent<CareTeamRole>): void => {
    const value = event.target.value as CareTeamMemberData[K];
    setMemberData(prev => ({ ...prev, [field]: value }));
  }, []);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Add Care Team Member
        <IconButton
          edge="end"
          color="inherit"
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <TextField
            fullWidth
            label="Member Name"
            placeholder="Enter care team member name"
            value={memberData.name}
            onChange={handleFieldChange('name')}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Role</InputLabel>
            <Select 
              label="Role" 
              value={memberData.role}
              onChange={handleFieldChange('role')}
            >
              <MenuItem value="physician">Physician</MenuItem>
              <MenuItem value="nurse">Nurse</MenuItem>
              <MenuItem value="therapist">Therapist</MenuItem>
              <MenuItem value="social-worker">Social Worker</MenuItem>
              <MenuItem value="care-coordinator">Care Coordinator</MenuItem>
              <MenuItem value="family">Family Member</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Contact Information"
            placeholder="Phone or email"
            value={memberData.contact}
            onChange={handleFieldChange('contact')}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Responsibilities"
            placeholder="Describe the member's responsibilities in the care plan"
            value={memberData.responsibilities}
            onChange={handleFieldChange('responsibilities')}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          variant="contained" 
          onClick={handleSave}
          disabled={!memberData.name || !memberData.role}
        >
          Add Member
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/**
 * GoalProgressDialog Component
 */
const GoalProgressDialog: React.FC<GoalProgressDialogProps> = ({ 
  open, 
  onClose, 
  goal, 
  patientId 
}) => {
  const [progressData, setProgressData] = useState<ProgressData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const theme = useTheme();

  useEffect(() => {
    if (open && goal) {
      loadProgressData();
    }
  }, [open, goal]);

  const loadProgressData = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      // In a real implementation, this would fetch actual measurements
      // For now, we'll generate sample progress data
      const mockData = goal ? generateMockProgressData(goal) : [];
      setProgressData(mockData);
    } catch (error) {
      console.error('Error loading progress data:', error);
    } finally {
      setLoading(false);
    }
  }, [goal]);

  const calculateProgress = useCallback((): number => {
    if (!progressData.length || !goal) return 0;
    const latestValue = progressData[progressData.length - 1].value;
    const targetValue = goal.target?.[0]?.detailQuantity?.value || 100;
    return Math.round((latestValue / targetValue) * 100);
  }, [progressData, goal]);

  const getProgressColor = useCallback((percentage: number): string => {
    if (percentage >= 80) return theme.palette.success.main;
    if (percentage >= 50) return theme.palette.warning.main;
    return theme.palette.error.main;
  }, [theme.palette]);

  const progressPercentage = calculateProgress();

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Goal Progress Tracking
        <IconButton
          edge="end"
          color="inherit"
          onClick={onClose}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ mt: 2 }}>
            {/* Goal Info */}
            <Card sx={{ mb: 3, bgcolor: alpha(theme.palette.primary.main, 0.08) }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {goal?.description?.text || 'Goal'}
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Target: {goal?.target?.[0]?.detailQuantity?.value} {goal?.target?.[0]?.detailQuantity?.unit || 'units'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Due Date: {goal?.target?.[0]?.dueDate ? format(parseISO(goal.target[0].dueDate), 'MMM d, yyyy') : 'Not set'}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {/* Progress Overview */}
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={4}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Box sx={{ position: 'relative', display: 'inline-flex', mb: 2 }}>
                      <CircularProgress
                        variant="determinate"
                        value={progressPercentage}
                        size={120}
                        thickness={6}
                        sx={{ color: getProgressColor(progressPercentage) }}
                      />
                      <Box
                        sx={{
                          top: 0,
                          left: 0,
                          bottom: 0,
                          right: 0,
                          position: 'absolute',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Typography variant="h4" component="div" color="text.secondary">
                          {progressPercentage}%
                        </Typography>
                      </Box>
                    </Box>
                    <Typography variant="subtitle1">Overall Progress</Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={4}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h3" color="primary">
                      {progressData.length ? progressData[progressData.length - 1].value : 0}
                    </Typography>
                    <Typography variant="subtitle1">Current Value</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Target: {goal?.target?.[0]?.detailQuantity?.value || 'Not set'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              
              <Grid item xs={12} sm={4}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Typography variant="h3" color={progressPercentage >= 100 ? 'success.main' : 'warning.main'}>
                      {progressPercentage >= 100 ? 'Achieved' : 'In Progress'}
                    </Typography>
                    <Typography variant="subtitle1">Status</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Started {goal?.startDate ? format(parseISO(goal.startDate), 'MMM d, yyyy') : 'Recently'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Progress Chart */}
            <Card>
              <CardHeader title="Progress Over Time" />
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={progressData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <RechartsTooltip />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="value" 
                      stroke={theme.palette.primary.main} 
                      strokeWidth={2}
                      name="Actual Progress"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="target" 
                      stroke={theme.palette.error.main} 
                      strokeDasharray="5 5"
                      name="Target"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                onClick={() => {
                  // Update progress
                  onClose();
                }}
              >
                Update Progress
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  // Export data
                  alert('Export functionality would be implemented here');
                }}
              >
                Export Data
              </Button>
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

/**
 * CarePlanTab Component
 */
const CarePlanTab: React.FC<CarePlanTabProps> = ({ 
  patientId, 
  onNotificationUpdate,
  sx 
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { getPatientResources, isLoading, currentPatient } = useFHIRResource();
  
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [goalEditorOpen, setGoalEditorOpen] = useState<boolean>(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [progressDialogOpen, setProgressDialogOpen] = useState<boolean>(false);
  const [selectedGoalForProgress, setSelectedGoalForProgress] = useState<Goal | null>(null);
  const [interventionDialogOpen, setInterventionDialogOpen] = useState<boolean>(false);
  const [selectedGoalForIntervention, setSelectedGoalForIntervention] = useState<Goal | null>(null);
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState<boolean>(false);
  const [viewAllMembersDialogOpen, setViewAllMembersDialogOpen] = useState<boolean>(false);
  const [selectedCareTeam, setSelectedCareTeam] = useState<CareTeam | null>(null);
  const [snackbar, setSnackbar] = useState<SnackbarState>({ 
    open: false, 
    message: '', 
    severity: 'success' 
  });
  const [activityEditDialogOpen, setActivityEditDialogOpen] = useState<boolean>(false);
  const [selectedActivity, setSelectedActivity] = useState<CarePlanActivity | null>(null);

  useEffect(() => {
    setLoading(false);
  }, []);

  // Get care plan resources
  const carePlans = (getPatientResources(patientId, 'CarePlan') as CarePlan[]) || [];
  const goals = (getPatientResources(patientId, 'Goal') as Goal[]) || [];
  const careTeams = (getPatientResources(patientId, 'CareTeam') as CareTeam[]) || [];

  // Get active care plan
  const activeCarePlan = carePlans.find(cp => cp.status === 'active') || carePlans[0];
  const activities: CarePlanActivity[] = activeCarePlan?.activity || [];

  // Filter goals
  const filteredGoals = useMemo(() => {
    return goals.filter(goal => {
      if (filterStatus !== 'all' && goal.lifecycleStatus !== filterStatus) {
        return false;
      }
      if (filterCategory !== 'all') {
        const category = goal.category?.[0]?.coding?.[0]?.code;
        if (category !== filterCategory) return false;
      }
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const goalText = (goal.description?.text || '').toLowerCase();
        const targetMeasure = (goal.target?.[0]?.measure?.text || goal.target?.[0]?.measure?.coding?.[0]?.display || '').toLowerCase();
        const notes = (goal.note?.[0]?.text || '').toLowerCase();
        
        if (!goalText.includes(searchLower) && 
            !targetMeasure.includes(searchLower) && 
            !notes.includes(searchLower)) {
          return false;
        }
      }
      return true;
    });
  }, [goals, filterStatus, filterCategory, searchTerm]);

  // Sort goals by priority and date
  const sortedGoals = useMemo(() => {
    return [...filteredGoals].sort((a, b) => {
      // Sort by priority first
      const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
      const aPriority = priorityOrder[a.priority?.coding?.[0]?.code || ''] ?? 3;
      const bPriority = priorityOrder[b.priority?.coding?.[0]?.code || ''] ?? 3;
      if (aPriority !== bPriority) return aPriority - bPriority;
      
      // Then by target date
      const aDate = a.target?.[0]?.dueDate || '';
      const bDate = b.target?.[0]?.dueDate || '';
      return aDate.localeCompare(bDate);
    });
  }, [filteredGoals]);

  const handleEditGoal = useCallback((goal: Goal): void => {
    setSelectedGoal(goal);
    setGoalEditorOpen(true);
  }, []);

  const handleViewProgress = useCallback((goal: Goal): void => {
    setSelectedGoalForProgress(goal);
    setProgressDialogOpen(true);
  }, []);

  const handleEditActivity = useCallback((activity: CarePlanActivity): void => {
    setSelectedActivity(activity);
    setActivityEditDialogOpen(true);
  }, []);

  const handleUpdateProgress = useCallback((goal: Goal): void => {
    setSelectedGoalForProgress(goal);
    setProgressDialogOpen(true);
  }, []);

  const handleAddIntervention = useCallback((goal: Goal): void => {
    setSelectedGoalForIntervention(goal);
    setInterventionDialogOpen(true);
  }, []);
  
  const handlePrintCarePlan = useCallback((): void => {
    const patientInfo = extractPatientInfo(currentPatient);
    
    let content = '<h2>Care Plan & Goals</h2>';
    
    // Active Care Plan Summary
    if (activeCarePlan) {
      content += '<div class="section">';
      content += `<h3>${activeCarePlan.title || 'Comprehensive Care Plan'}</h3>`;
      content += `<p>Started: ${activeCarePlan.period?.start ? 
        format(parseISO(activeCarePlan.period.start), 'MMMM d, yyyy') : 
        'Unknown'}</p>`;
      content += '</div>';
    }
    
    // Goals
    content += '<h3>Goals</h3>';
    if (sortedGoals.length === 0) {
      content += '<p>No goals defined.</p>';
    } else {
      sortedGoals.forEach(goal => {
        const category = (goal.category?.[0]?.coding?.[0]?.code as GoalCategory) || 'health-maintenance';
        const categoryLabel = goalCategories[category]?.label || 'Health Maintenance';
        const targetDate = goal.target?.[0]?.dueDate;
        const status = goal.lifecycleStatus;
        
        content += '<div class="note-box avoid-break">';
        content += `<h4>${goal.description?.text || 'Goal'}</h4>`;
        content += `<p><strong>Category:</strong> ${categoryLabel} | <strong>Status:</strong> ${status}</p>`;
        if (targetDate) {
          content += `<p><strong>Target Date:</strong> ${format(parseISO(targetDate), 'MMMM d, yyyy')}</p>`;
        }
        if (goal.target?.[0]?.measure) {
          content += `<p><strong>Target Measure:</strong> ${goal.target[0].measure.text || goal.target[0].measure.coding?.[0]?.display}`;
          if (goal.target[0].detailQuantity) {
            content += ` - ${goal.target[0].detailQuantity.value} ${goal.target[0].detailQuantity.unit}`;
          }
          content += '</p>';
        }
        if (goal.note?.[0]) {
          content += `<p><strong>Notes:</strong> ${goal.note[0].text}</p>`;
        }
        content += '</div>';
      });
    }
    
    // Care Team
    if (careTeams.length > 0 && careTeams[0].participant) {
      content += '<h3>Care Team</h3>';
      content += '<ul>';
      careTeams[0].participant.forEach((participant: CarePlanParticipant) => {
        const member = participant.member?.display || 'Team Member';
        const role = participant.role?.[0]?.text || participant.role?.[0]?.coding?.[0]?.display || 'Role not specified';
        content += `<li>${member} - ${role}</li>`;
      });
      content += '</ul>';
    }
    
    // Activities/Interventions
    if (activities.length > 0) {
      content += '<h3>Interventions & Activities</h3>';
      content += '<ul>';
      activities.forEach(activity => {
        const description = activity.detail?.description || 
                          activity.detail?.code?.text || 
                          activity.detail?.code?.coding?.[0]?.display ||
                          'Activity';
        content += `<li>${description}`;
        if (activity.detail?.scheduledTiming?.repeat?.frequency) {
          content += ` - ${activity.detail.scheduledTiming.repeat.frequency} times per ${activity.detail.scheduledTiming.repeat.period} ${activity.detail.scheduledTiming.repeat.periodUnit}`;
        }
        content += '</li>';
      });
      content += '</ul>';
    }
    
    printDocument({
      title: 'Care Plan & Goals',
      patient: patientInfo,
      content
    });
  }, [currentPatient, activeCarePlan, sortedGoals, careTeams, activities]);

  const handleFilterChange = useCallback((filterType: 'status' | 'category') => (
    event: SelectChangeEvent<string>
  ): void => {
    const value = event.target.value;
    if (filterType === 'status') {
      setFilterStatus(value);
    } else {
      setFilterCategory(value);
    }
  }, []);

  const updateSnackbar = useCallback((updates: Partial<SnackbarState>): void => {
    setSnackbar(prev => ({ ...prev, ...updates }));
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
          Care Plan & Goals
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={handlePrintCarePlan}
          >
            Print
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setSelectedGoal(null);
              setGoalEditorOpen(true);
            }}
          >
            New Goal
          </Button>
        </Stack>
      </Stack>

      {/* Care Plan Summary */}
      {activeCarePlan && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="subtitle2">
            Active Care Plan: {activeCarePlan.title || 'Comprehensive Care Plan'}
          </Typography>
          <Typography variant="caption">
            Started {activeCarePlan.period?.start ? 
              formatDistanceToNow(parseISO(activeCarePlan.period.start), { addSuffix: true }) : 
              'recently'
            }
          </Typography>
        </Alert>
      )}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            placeholder="Search goals..."
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
            <InputLabel>Status</InputLabel>
            <Select
              value={filterStatus}
              onChange={handleFilterChange('status')}
              label="Status"
            >
              <MenuItem value="all">All Status</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
              <MenuItem value="on-hold">On Hold</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Category</InputLabel>
            <Select
              value={filterCategory}
              onChange={handleFilterChange('category')}
              label="Category"
            >
              <MenuItem value="all">All Categories</MenuItem>
              {Object.entries(goalCategories).map(([key, config]) => (
                <MenuItem key={key} value={key}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {config.icon}
                    <span>{config.label}</span>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      <Grid container spacing={3}>
        {/* Goals Section */}
        <Grid item xs={12} lg={8}>
          <Typography variant="h6" gutterBottom>
            Goals ({sortedGoals.length})
          </Typography>
          
          {sortedGoals.length === 0 ? (
            <Alert severity="info">
              No goals found matching your criteria
            </Alert>
          ) : (
            <Box>
              {sortedGoals.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  onEdit={handleEditGoal}
                  onViewProgress={handleViewProgress}
                  onUpdateProgress={handleUpdateProgress}
                  onAddIntervention={handleAddIntervention}
                />
              ))}
            </Box>
          )}
        </Grid>

        {/* Right Column */}
        <Grid item xs={12} lg={4}>
          <Stack spacing={3}>
            {/* Care Team */}
            {careTeams.length > 0 && (
              <CareTeamCard 
                careTeam={careTeams[0]} 
                onAddMember={() => {
                  setSelectedCareTeam(careTeams[0]);
                  setAddMemberDialogOpen(true);
                }}
                onViewAll={() => {
                  setSelectedCareTeam(careTeams[0]);
                  setViewAllMembersDialogOpen(true);
                }}
              />
            )}

            {/* Interventions */}
            <InterventionList 
              activities={activities} 
              onEdit={handleEditActivity}
              onAddIntervention={() => setInterventionDialogOpen(true)}
            />

            {/* Outcomes Summary */}
            <Card>
              <CardHeader
                avatar={<OutcomeIcon color="success" />}
                title="Outcomes"
                subheader="Goal achievement summary"
              />
              <CardContent>
                <Stack spacing={2}>
                  <Box>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2">Completed Goals</Typography>
                      <Typography variant="h6" color="success.main">
                        {goals.filter(g => g.lifecycleStatus === 'completed').length}
                      </Typography>
                    </Stack>
                  </Box>
                  <Box>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2">Active Goals</Typography>
                      <Typography variant="h6" color="primary">
                        {goals.filter(g => g.lifecycleStatus === 'active').length}
                      </Typography>
                    </Stack>
                  </Box>
                  <Box>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2">Success Rate</Typography>
                      <Typography variant="h6">
                        {goals.length > 0 ? 
                          Math.round((goals.filter(g => g.lifecycleStatus === 'completed').length / goals.length) * 100) : 0
                        }%
                      </Typography>
                    </Stack>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>

      {/* Add Care Team Member Dialog */}
      <AddCareTeamMemberDialog 
        open={addMemberDialogOpen} 
        onClose={() => setAddMemberDialogOpen(false)}
        careTeam={selectedCareTeam}
        patientId={patientId}
        onSuccess={() => {
          updateSnackbar({ 
            open: true, 
            message: 'Care team member added successfully', 
            severity: 'success' 
          });
          fhirClient.refreshPatientResources(patientId);
        }}
      />

      {/* Goal Progress Dialog */}
      <GoalProgressDialog
        open={progressDialogOpen}
        onClose={() => {
          setProgressDialogOpen(false);
          setSelectedGoalForProgress(null);
        }}
        goal={selectedGoalForProgress}
        patientId={patientId}
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

export default CarePlanTab;