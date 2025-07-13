/**
 * Inbox Tab Component
 * Clinical notifications and alerts management
 * 
 * Migrated to TypeScript with comprehensive type safety for clinical inbox management.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemButton,
  Button,
  IconButton,
  Chip,
  Alert,
  Badge,
  Card,
  CardContent,
  Divider,
  Menu,
  MenuItem,
  SxProps,
  Theme,
} from '@mui/material';
import {
  Inbox as InboxIcon,
  Email as EmailIcon,
  NotificationsActive as AlertIcon,
  Assignment as TaskIcon,
  MoreVert as MoreIcon,
  MarkEmailRead as MarkReadIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { R4 } from '@ahryman40k/ts-fhir-types';
import { useInbox } from '../../../contexts/InboxContext';
import { useClinical } from '../../../contexts/ClinicalContext';

/**
 * Type definitions for InboxTab component
 */
export type InboxCategory = 'all' | 'alert' | 'task' | 'notification';
export type InboxPriority = 'urgent' | 'stat' | 'high' | 'medium' | 'low';

export interface InboxPayload {
  content: string;
  type?: string;
  data?: Record<string, any>;
}

export interface InboxItem {
  id: string;
  topic?: string;
  category: InboxCategory;
  priority: InboxPriority;
  sent?: string;
  isRead?: boolean;
  note?: string;
  payload?: InboxPayload[];
  patientId?: string;
  resourceType?: string;
  resourceId?: string;
}

export interface InboxStats {
  total: number;
  unread: number;
  priority: {
    urgent: number;
    stat: number;
    high: number;
    medium: number;
    low: number;
  };
  category: {
    alert: number;
    task: number;
    notification: number;
  };
}

export interface Patient {
  id: string;
  name?: R4.IHumanName[];
  birthDate?: string;
  gender?: string;
}

export interface InboxContextType {
  messages: InboxItem[];
  stats: InboxStats;
  loadInboxItems: (filters?: { patient_id?: string }) => Promise<void>;
  loadInboxStats: () => Promise<void>;
  markInboxItemRead: (itemId: string) => Promise<void>;
}

export interface ClinicalContextType {
  currentPatient?: Patient | null;
}

export interface InboxTabProps {
  sx?: SxProps<Theme>;
  patientId?: string;
  compact?: boolean;
}

/**
 * Constants
 */
const PRIORITY_COLORS: Record<InboxPriority, 'error' | 'warning' | 'info' | 'default'> = {
  urgent: 'error',
  stat: 'error',
  high: 'warning',
  medium: 'info',
  low: 'default'
};

const CATEGORY_COLORS: Record<InboxCategory, 'primary' | 'warning' | 'info' | 'default'> = {
  all: 'primary',
  alert: 'warning',
  task: 'info',
  notification: 'default'
};

/**
 * Helper functions
 */
const getItemIcon = (category: InboxCategory, priority: InboxPriority): JSX.Element => {
  if (priority === 'urgent' || priority === 'stat') {
    return <ErrorIcon color="error" />;
  }
  
  switch (category) {
    case 'alert':
      return <AlertIcon color="warning" />;
    case 'task':
      return <TaskIcon color="primary" />;
    case 'notification':
      return <InfoIcon color="info" />;
    default:
      return <EmailIcon />;
  }
};

const getPriorityColor = (priority: InboxPriority): 'error' | 'warning' | 'info' | 'default' => {
  return PRIORITY_COLORS[priority] || 'default';
};

const getCategoryColor = (category: InboxCategory): 'primary' | 'warning' | 'info' | 'default' => {
  return CATEGORY_COLORS[category] || 'default';
};

const formatDateTime = (dateString: string | undefined): string => {
  if (!dateString) return 'Unknown time';
  
  try {
    return new Date(dateString).toLocaleString();
  } catch (error) {
    return 'Invalid date';
  }
};

const getItemContent = (item: InboxItem): string => {
  return item.payload?.[0]?.content || item.note || 'No message content';
};

const isHighPriority = (priority: InboxPriority): boolean => {
  return priority === 'urgent' || priority === 'stat';
};

const filterItemsByCategory = (items: InboxItem[], category: InboxCategory): InboxItem[] => {
  if (category === 'all') return items;
  return items.filter(item => item.category === category);
};

const getCategoryLabel = (category: InboxCategory): string => {
  switch (category) {
    case 'all':
      return 'All';
    case 'alert':
      return 'Alerts';
    case 'task':
      return 'Tasks';
    case 'notification':
      return 'Notifications';
    default:
      return category;
  }
};

/**
 * InboxTab Component
 */
const InboxTab: React.FC<InboxTabProps> = ({ sx, patientId, compact = false }) => {
  const { 
    messages: inboxItems, 
    stats: inboxStats, 
    loadInboxItems, 
    loadInboxStats, 
    markInboxItemRead 
  } = useInbox() as InboxContextType;
  
  const { currentPatient } = useClinical() as ClinicalContextType;
  const [selectedCategory, setSelectedCategory] = useState<InboxCategory>('all');
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const effectivePatientId = patientId || currentPatient?.id;

  useEffect(() => {
    if (effectivePatientId) {
      loadData();
    }
  }, [effectivePatientId]);

  const loadData = async (): Promise<void> => {
    if (!effectivePatientId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      await Promise.all([
        loadInboxItems({ patient_id: effectivePatientId }),
        loadInboxStats()
      ]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load inbox data';
      setError(errorMessage);
      console.error('Error loading inbox data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (itemId: string | undefined): Promise<void> => {
    if (!itemId) return;
    
    try {
      await markInboxItemRead(itemId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to mark item as read';
      setError(errorMessage);
      console.error('Error marking item as read:', error);
    }
  };

  const handleDeleteItem = async (itemId: string | undefined): Promise<void> => {
    if (!itemId) return;
    
    try {
      // For now, just mark as read since FHIR doesn't support delete
      await markInboxItemRead(itemId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete item';
      setError(errorMessage);
      console.error('Error deleting item:', error);
    }
  };

  const handleCategoryChange = (category: InboxCategory): void => {
    setSelectedCategory(category);
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, item: InboxItem): void => {
    setAnchorEl(event.currentTarget);
    setSelectedItem(item);
  };

  const handleMenuClose = (): void => {
    setAnchorEl(null);
    setSelectedItem(null);
  };

  const handleMarkAsReadFromMenu = async (): Promise<void> => {
    await handleMarkAsRead(selectedItem?.id);
    handleMenuClose();
  };

  const handleDeleteFromMenu = async (): Promise<void> => {
    await handleDeleteItem(selectedItem?.id);
    handleMenuClose();
  };

  const filteredItems = filterItemsByCategory(inboxItems || [], selectedCategory);
  const urgentCount = (inboxStats?.priority?.urgent || 0) + (inboxStats?.priority?.stat || 0);

  if (!effectivePatientId) {
    return (
      <Box sx={{ p: 3, ...sx }}>
        <Alert severity="info">
          Please select a patient to view their clinical inbox.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: compact ? 2 : 3, ...sx }}>
      {!compact && (
        <Typography variant="h5" gutterBottom>
          Clinical Inbox
        </Typography>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Inbox Stats */}
        <Grid item xs={12}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="primary">
                    {inboxStats?.total || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Items
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="error">
                    {inboxStats?.unread || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Unread
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="warning">
                    {urgentCount}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Urgent/Stat
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="info">
                    {inboxStats?.category?.alert || 0}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Alerts
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Grid>

        {/* Category Filter */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {(['all', 'alert', 'task', 'notification'] as InboxCategory[]).map((category) => (
                <Chip
                  key={category}
                  label={getCategoryLabel(category)}
                  variant={selectedCategory === category ? 'filled' : 'outlined'}
                  onClick={() => handleCategoryChange(category)}
                  color={getCategoryColor(category)}
                />
              ))}
            </Box>
          </Paper>
        </Grid>

        {/* Inbox Items */}
        <Grid item xs={12}>
          <Paper>
            {loading ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography>Loading inbox items...</Typography>
              </Box>
            ) : filteredItems.length > 0 ? (
              <List>
                {filteredItems.map((item: InboxItem, index: number) => (
                  <React.Fragment key={item.id || index}>
                    <ListItem
                      sx={{
                        bgcolor: !item.isRead ? 'action.hover' : 'transparent',
                        borderLeft: isHighPriority(item.priority) ? '4px solid red' : 'none'
                      }}
                    >
                      <ListItemIcon>
                        {getItemIcon(item.category, item.priority)}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography 
                              variant="subtitle1" 
                              sx={{ 
                                fontWeight: !item.isRead ? 'bold' : 'normal' 
                              }}
                            >
                              {item.topic || 'Clinical Message'}
                            </Typography>
                            <Chip 
                              label={item.priority} 
                              size="small" 
                              color={getPriorityColor(item.priority)}
                            />
                            {item.category === 'alert' && (
                              <Chip label="Action Required" size="small" color="error" />
                            )}
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {getItemContent(item)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatDateTime(item.sent)}
                            </Typography>
                          </Box>
                        }
                      />
                      <IconButton 
                        onClick={(e) => handleMenuClick(e, item)}
                        size="small"
                        aria-label={`Actions for ${item.topic || 'message'}`}
                      >
                        <MoreIcon />
                      </IconButton>
                    </ListItem>
                    {index < filteredItems.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <InboxIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No items in {selectedCategory === 'all' ? 'inbox' : selectedCategory}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedCategory === 'all' 
                    ? 'Your clinical inbox is empty.'
                    : `No ${selectedCategory} items found.`
                  }
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleMarkAsReadFromMenu}>
          <MarkReadIcon sx={{ mr: 1 }} />
          Mark as Read
        </MenuItem>
        <MenuItem onClick={handleDeleteFromMenu}>
          <DeleteIcon sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default InboxTab;