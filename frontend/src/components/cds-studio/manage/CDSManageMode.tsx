/**
 * CDS Manage Mode - Manage, analyze, and organize CDS hooks
 * 
 * Migrated to TypeScript with comprehensive type safety for CDS Hook management.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Button,
  TextField,
  InputAdornment,
  Stack,
  Alert,
  Tooltip,
  Menu,
  MenuItem,
  SxProps,
  Theme,
} from '@mui/material';
import {
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as DuplicateIcon,
  MoreVert as MoreIcon,
  Analytics as AnalyticsIcon,
  Group as TeamIcon,
  History as HistoryIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { cdsHooksService } from '../../../services/cdsHooksService';
import { useCDSStudio } from '../../../pages/CDSHooksStudio';

/**
 * Type definitions for CDSManageMode component
 */
export type HookType = 'patient-view' | 'medication-prescribe' | 'order-sign' | 'order-select';

export interface CDSHookMetadata {
  created: Date;
  modified: Date;
  version?: string;
  author?: string;
  tags?: string[];
}

export interface CDSCondition {
  id: string;
  description: string;
  logic: string;
  enabled: boolean;
}

export interface CDSCard {
  id: string;
  summary: string;
  indicator: 'info' | 'warning' | 'critical' | 'success';
  detail?: string;
  source?: {
    label: string;
    url?: string;
  };
}

export interface CDSHook {
  id?: string;
  title: string;
  description?: string;
  hook: HookType;
  conditions: CDSCondition[];
  cards: CDSCard[];
  prefetch: Record<string, string>;
  enabled?: boolean;
  _meta?: CDSHookMetadata;
}

export interface HookStats {
  total: number;
  byType: Record<string, number>;
  active: number;
}

export interface CDSStudioActions {
  setCurrentHook: (hook: CDSHook) => void;
}

export interface CDSStudioContext {
  actions: CDSStudioActions;
}

export interface CDSManageModeProps {
  sx?: SxProps<Theme>;
  onHookSelect?: (hook: CDSHook) => void;
  onModeChange?: (mode: string) => void;
}

/**
 * Constants
 */
const DEFAULT_TEAM_MEMBER_COUNT = 5;

const HOOK_TYPE_LABELS: Record<HookType, string> = {
  'patient-view': 'Patient View',
  'medication-prescribe': 'Medication Prescribe',
  'order-sign': 'Order Sign',
  'order-select': 'Order Select'
};

/**
 * Helper functions
 */
const createNewHook = (): CDSHook => ({
  id: '',
  title: '',
  description: '',
  hook: 'patient-view',
  conditions: [],
  cards: [],
  prefetch: {}
});

const createHookDuplicate = (hook: CDSHook): CDSHook => ({
  ...hook,
  id: undefined,
  title: `${hook.title} (Copy)`,
  _meta: {
    ...hook._meta,
    created: new Date(),
    modified: new Date()
  }
});

const calculateStats = (hooks: CDSHook[]): HookStats => ({
  total: hooks.length,
  byType: hooks.reduce((acc: Record<string, number>, hook: CDSHook) => {
    acc[hook.hook] = (acc[hook.hook] || 0) + 1;
    return acc;
  }, {}),
  active: hooks.filter((h: CDSHook) => h.enabled !== false).length
});

const filterHooks = (hooks: CDSHook[], searchTerm: string): CDSHook[] => {
  const term = searchTerm.toLowerCase();
  return hooks.filter((hook: CDSHook) => 
    hook.title.toLowerCase().includes(term) ||
    hook.description?.toLowerCase().includes(term) ||
    hook.hook.toLowerCase().includes(term)
  );
};

const formatDate = (date: Date | string | undefined): string => {
  if (!date) return 'Unknown';
  
  try {
    return new Date(date).toLocaleDateString();
  } catch (error) {
    return 'Invalid date';
  }
};

const getHookTypeLabel = (hookType: HookType): string => {
  return HOOK_TYPE_LABELS[hookType] || hookType;
};

/**
 * CDSManageMode Component
 */
const CDSManageMode: React.FC<CDSManageModeProps> = ({ sx, onHookSelect, onModeChange }) => {
  const { actions } = useCDSStudio() as CDSStudioContext;
  const [hooks, setHooks] = useState<CDSHook[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [selectedHook, setSelectedHook] = useState<CDSHook | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadHooks();
  }, []);

  const loadHooks = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      const customHooks = await cdsHooksService.getHooks();
      setHooks(customHooks);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load hooks';
      setError(errorMessage);
      console.error('Error loading hooks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (hook: CDSHook): void => {
    actions.setCurrentHook(hook);
    if (onHookSelect) {
      onHookSelect(hook);
    }
    if (onModeChange) {
      onModeChange('build');
    }
  };

  const handleDelete = async (hookId: string | undefined): Promise<void> => {
    if (!hookId) return;
    
    if (window.confirm('Are you sure you want to delete this hook?')) {
      try {
        await cdsHooksService.deleteHook(hookId);
        await loadHooks();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to delete hook';
        setError(errorMessage);
        console.error('Error deleting hook:', error);
      }
    }
  };

  const handleDuplicate = async (hook: CDSHook): Promise<void> => {
    const duplicate = createHookDuplicate(hook);
    
    try {
      await cdsHooksService.createHook(duplicate);
      await loadHooks();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to duplicate hook';
      setError(errorMessage);
      console.error('Error duplicating hook:', error);
    }
  };

  const handleNewHook = (): void => {
    const newHook = createNewHook();
    actions.setCurrentHook(newHook);
    if (onModeChange) {
      onModeChange('build');
    }
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setSearchTerm(event.target.value);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, hook: CDSHook): void => {
    setAnchorEl(event.currentTarget);
    setSelectedHook(hook);
  };

  const handleMenuClose = (): void => {
    setAnchorEl(null);
    setSelectedHook(null);
  };

  const handleMenuAction = (action: string): void => {
    console.log(`Menu action: ${action} for hook:`, selectedHook);
    handleMenuClose();
    // TODO: Implement specific actions
  };

  const filteredHooks = filterHooks(hooks, searchTerm);
  const stats = calculateStats(hooks);

  return (
    <Box sx={sx}>
      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Total Hooks
              </Typography>
              <Typography variant="h4">
                {stats.total}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Active Hooks
              </Typography>
              <Typography variant="h4">
                {stats.active}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Hook Types
              </Typography>
              <Typography variant="h4">
                {Object.keys(stats.byType).length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Team Members
              </Typography>
              <Typography variant="h4">
                {DEFAULT_TEAM_MEMBER_COUNT}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Search and Actions */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <TextField
          placeholder="Search hooks..."
          value={searchTerm}
          onChange={handleSearchChange}
          sx={{ width: 300 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            )
          }}
        />
        
        <Stack direction="row" spacing={2}>
          <Button 
            startIcon={<AnalyticsIcon />}
            onClick={() => handleMenuAction('analytics')}
          >
            Analytics
          </Button>
          <Button 
            startIcon={<TeamIcon />}
            onClick={() => handleMenuAction('team')}
          >
            Team
          </Button>
          <Button 
            startIcon={<HistoryIcon />}
            onClick={() => handleMenuAction('history')}
          >
            History
          </Button>
          <Button 
            variant="contained" 
            startIcon={<AddIcon />}
            onClick={handleNewHook}
          >
            New Hook
          </Button>
        </Stack>
      </Box>

      {/* Hooks Table */}
      {loading ? (
        <Alert severity="info">Loading hooks...</Alert>
      ) : filteredHooks.length === 0 ? (
        <Alert severity="warning">
          {searchTerm ? `No hooks found matching "${searchTerm}"` : 'No hooks created yet'}
        </Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Hook Type</TableCell>
                <TableCell>Conditions</TableCell>
                <TableCell>Cards</TableCell>
                <TableCell>Modified</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredHooks.map((hook: CDSHook) => (
                <TableRow key={hook.id || `hook-${Math.random()}`}>
                  <TableCell>
                    <Typography variant="subtitle2">{hook.title || 'Untitled Hook'}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {hook.description || 'No description'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={getHookTypeLabel(hook.hook)} size="small" />
                  </TableCell>
                  <TableCell>{hook.conditions?.length || 0}</TableCell>
                  <TableCell>{hook.cards?.length || 0}</TableCell>
                  <TableCell>
                    {formatDate(hook._meta?.modified)}
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={hook.enabled !== false ? 'Active' : 'Inactive'}
                      color={hook.enabled !== false ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Tooltip title="Edit">
                        <IconButton 
                          size="small" 
                          onClick={() => handleEdit(hook)}
                          aria-label={`Edit ${hook.title}`}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Duplicate">
                        <IconButton 
                          size="small" 
                          onClick={() => handleDuplicate(hook)}
                          aria-label={`Duplicate ${hook.title}`}
                        >
                          <DuplicateIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton 
                          size="small" 
                          onClick={() => handleDelete(hook.id)} 
                          color="error"
                          aria-label={`Delete ${hook.title}`}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                      <IconButton 
                        size="small"
                        onClick={(e) => handleMenuOpen(e, hook)}
                        aria-label={`More actions for ${hook.title}`}
                      >
                        <MoreIcon />
                      </IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* More Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleMenuAction('analytics')}>View Analytics</MenuItem>
        <MenuItem onClick={() => handleMenuAction('history')}>View History</MenuItem>
        <MenuItem onClick={() => handleMenuAction('export')}>Export</MenuItem>
        <MenuItem onClick={() => handleMenuAction('share')}>Share</MenuItem>
      </Menu>
    </Box>
  );
};

export default CDSManageMode;