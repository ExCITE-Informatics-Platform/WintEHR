/**
 * Tasks Tab Component
 * Clinical task management and tracking
 * 
 * Migrated to TypeScript with comprehensive type safety for task management.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  FormControl,
  InputLabel,
  MenuItem,
  Chip,
  Alert,
  Card,
  CardContent,
  Checkbox,
  LinearProgress,
  Fab,
  SxProps,
  Theme,
  SelectChangeEvent,
} from '@mui/material';
import {
  Add as AddIcon,
  Assignment as TaskIcon,
  CheckCircle as CompleteIcon,
  Schedule as PendingIcon,
  Flag as FlagIcon,
  Person as AssigneeIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useTask } from '../../../contexts/TaskContext';
import { useClinical } from '../../../contexts/ClinicalContext';
import api from '../../../services/api';

/**
 * Type definitions for TasksTab component
 */
export type TaskPriority = 'low' | 'medium' | 'high';

export type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'cancelled';

export type TaskFilter = 'all' | TaskStatus;

export interface ClinicalTask {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  due_date?: string;
  assignee?: string;
  patient_id: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string;
  assigned_by?: string;
}

export interface TaskStats {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  overdue: number;
}

export interface NewTaskFormData {
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string;
  assignee: string;
}

export interface TaskContextType {
  tasks: ClinicalTask[];
  taskStats: TaskStats | null;
  loadTasks: (filters?: { patient_id?: string }) => Promise<void>;
  loadTaskStats: () => Promise<void>;
  createTask: (task: Partial<ClinicalTask>) => Promise<void>;
  updateTask: (taskId: string, updates: Partial<ClinicalTask>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
}

export interface ClinicalContextType {
  currentPatient: any | null;
}

export interface TasksTabProps {
  sx?: SxProps<Theme>;
}

/**
 * Helper functions
 */
const getPriorityColor = (priority: TaskPriority): 'error' | 'warning' | 'info' | 'default' => {
  switch (priority) {
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    case 'low':
      return 'info';
    default:
      return 'default';
  }
};

const getStatusIcon = (status: TaskStatus): React.ReactElement => {
  switch (status) {
    case 'completed':
      return <CompleteIcon color="success" />;
    case 'in-progress':
      return <PendingIcon color="primary" />;
    case 'pending':
      return <TaskIcon color="action" />;
    default:
      return <TaskIcon />;
  }
};

const formatDate = (dateString: string): string => {
  try {
    return new Date(dateString).toLocaleDateString();
  } catch (error) {
    console.error('Error formatting date:', error);
    return dateString;
  }
};

const calculateCompletionPercentage = (completedTasks: number, totalTasks: number): number => {
  return totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
};

const getInitialNewTask = (): NewTaskFormData => ({
  title: '',
  description: '',
  priority: 'medium',
  status: 'pending',
  due_date: '',
  assignee: ''
});

/**
 * TasksTab Component
 */
const TasksTab: React.FC<TasksTabProps> = ({ sx }) => {
  const { currentPatient } = useClinical();
  const { tasks, taskStats, loadTasks, loadTaskStats } = useTask();
  const [newTaskDialog, setNewTaskDialog] = useState<boolean>(false);
  const [selectedFilter, setSelectedFilter] = useState<TaskFilter>('all');
  const [newTask, setNewTask] = useState<NewTaskFormData>(getInitialNewTask());
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load tasks when patient changes
  useEffect(() => {
    const loadPatientTasks = async (): Promise<void> => {
      if (currentPatient) {
        try {
          setLoading(true);
          await Promise.all([
            loadTasks({ patient_id: currentPatient.id }),
            loadTaskStats()
          ]);
        } catch (err) {
          setError('Failed to load tasks');
          console.error('Error loading tasks:', err);
        } finally {
          setLoading(false);
        }
      }
    };

    loadPatientTasks();
  }, [currentPatient, loadTasks, loadTaskStats]);

  const handleCreateTask = useCallback(async (): Promise<void> => {
    if (!currentPatient || !newTask.title.trim()) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await api.post('/api/clinical/tasks/', {
        ...newTask,
        patient_id: currentPatient.id
      });

      setNewTaskDialog(false);
      setNewTask(getInitialNewTask());
      
      await Promise.all([
        loadTasks({ patient_id: currentPatient.id }),
        loadTaskStats()
      ]);
    } catch (err) {
      setError('Failed to create task');
      console.error('Error creating task:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPatient, newTask, loadTasks, loadTaskStats]);

  const handleCompleteTask = useCallback(async (taskId: string): Promise<void> => {
    if (!currentPatient) return;

    try {
      setLoading(true);
      setError(null);

      await api.put(`/api/clinical/tasks/${taskId}`, {
        status: 'completed'
      });

      await Promise.all([
        loadTasks({ patient_id: currentPatient.id }),
        loadTaskStats()
      ]);
    } catch (err) {
      setError('Failed to complete task');
      console.error('Error completing task:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPatient, loadTasks, loadTaskStats]);

  const handleFilterChange = useCallback((filter: TaskFilter): void => {
    setSelectedFilter(filter);
  }, []);

  const handleNewTaskChange = useCallback(<K extends keyof NewTaskFormData>(
    field: K, 
    value: NewTaskFormData[K]
  ): void => {
    setNewTask(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleCloseDialog = useCallback((): void => {
    setNewTaskDialog(false);
    setNewTask(getInitialNewTask());
    setError(null);
  }, []);

  const filteredTasks = tasks?.filter(task => {
    if (selectedFilter === 'all') return true;
    return task.status === selectedFilter;
  }) || [];

  const completedTasks = tasks?.filter(task => task.status === 'completed').length || 0;
  const totalTasks = tasks?.length || 0;
  const completionPercentage = calculateCompletionPercentage(completedTasks, totalTasks);

  return (
    <Box sx={{ p: 3, ...sx }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">
          Task Management
        </Typography>
        <Fab
          color="primary"
          size="medium"
          onClick={() => setNewTaskDialog(true)}
          disabled={!currentPatient}
          aria-label="Add new task"
        >
          <AddIcon />
        </Fab>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Task Stats */}
        <Grid item xs={12}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="primary">
                    {taskStats?.total || totalTasks}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Tasks
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="success.main">
                    {completedTasks}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Completed
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="warning.main">
                    {totalTasks - completedTasks}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Pending
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="text.primary">
                    {Math.round(completionPercentage)}%
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Complete
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={completionPercentage} 
                    sx={{ mt: 1 }}
                  />
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Grid>

        {/* Task Filters */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                label="All"
                variant={selectedFilter === 'all' ? 'filled' : 'outlined'}
                onClick={() => handleFilterChange('all')}
                color="primary"
              />
              <Chip
                label="Pending"
                variant={selectedFilter === 'pending' ? 'filled' : 'outlined'}
                onClick={() => handleFilterChange('pending')}
                color="warning"
              />
              <Chip
                label="In Progress"
                variant={selectedFilter === 'in-progress' ? 'filled' : 'outlined'}
                onClick={() => handleFilterChange('in-progress')}
                color="info"
              />
              <Chip
                label="Completed"
                variant={selectedFilter === 'completed' ? 'filled' : 'outlined'}
                onClick={() => handleFilterChange('completed')}
                color="success"
              />
            </Box>
          </Paper>
        </Grid>

        {/* Tasks List */}
        <Grid item xs={12}>
          <Paper>
            {filteredTasks.length > 0 ? (
              <List>
                {filteredTasks.map((task) => (
                  <ListItem key={task.id} divider>
                    <ListItemIcon>
                      <Checkbox
                        checked={task.status === 'completed'}
                        onChange={() => handleCompleteTask(task.id)}
                        disabled={task.status === 'completed' || loading}
                        aria-label={`Mark task "${task.title}" as complete`}
                      />
                    </ListItemIcon>
                    <ListItemIcon>
                      {getStatusIcon(task.status)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography 
                            variant="subtitle1"
                            sx={{ 
                              textDecoration: task.status === 'completed' ? 'line-through' : 'none'
                            }}
                          >
                            {task.title}
                          </Typography>
                          <Chip 
                            label={task.priority} 
                            size="small" 
                            color={getPriorityColor(task.priority)}
                          />
                          <Chip 
                            label={task.status} 
                            size="small" 
                            variant="outlined"
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          {task.description && (
                            <Typography variant="body2" color="text.secondary">
                              {task.description}
                            </Typography>
                          )}
                          {task.due_date && (
                            <Typography variant="caption" color="text.secondary">
                              Due: {formatDate(task.due_date)}
                            </Typography>
                          )}
                          {task.assignee && (
                            <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                              Assignee: {task.assignee}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                    <IconButton size="small" aria-label={`Edit task "${task.title}"`}>
                      <EditIcon />
                    </IconButton>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <TaskIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No {selectedFilter === 'all' ? '' : selectedFilter} tasks
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedFilter === 'all' 
                    ? 'No tasks found for this patient.'
                    : `No ${selectedFilter} tasks found.`
                  }
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* New Task Dialog */}
      <Dialog open={newTaskDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Task</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              fullWidth
              label="Task Title"
              value={newTask.title}
              onChange={(e) => handleNewTaskChange('title', e.target.value)}
              required
              error={!newTask.title.trim()}
              helperText={!newTask.title.trim() ? 'Title is required' : ''}
            />

            <TextField
              fullWidth
              label="Description"
              value={newTask.description}
              onChange={(e) => handleNewTaskChange('description', e.target.value)}
              multiline
              rows={3}
            />

            <FormControl fullWidth>
              <InputLabel>Priority</InputLabel>
              <Select
                value={newTask.priority}
                label="Priority"
                onChange={(e: SelectChangeEvent<TaskPriority>) => 
                  handleNewTaskChange('priority', e.target.value as TaskPriority)
                }
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Due Date"
              type="date"
              value={newTask.due_date}
              onChange={(e) => handleNewTaskChange('due_date', e.target.value)}
              InputLabelProps={{
                shrink: true,
              }}
            />

            <TextField
              fullWidth
              label="Assignee"
              value={newTask.assignee}
              onChange={(e) => handleNewTaskChange('assignee', e.target.value)}
              placeholder="Provider name or ID"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            onClick={handleCreateTask} 
            variant="contained"
            disabled={!newTask.title.trim() || loading}
          >
            Create Task
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TasksTab;