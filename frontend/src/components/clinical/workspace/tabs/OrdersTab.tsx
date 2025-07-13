/**
 * Orders Tab Component
 * Manage active orders, prescriptions, and order history
 * 
 * Migrated to TypeScript with comprehensive type safety for order management.
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
  Badge,
  SpeedDial,
  SpeedDialIcon,
  SpeedDialAction,
  Checkbox,
  FormControlLabel,
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
  Assignment as OrderIcon,
  Medication as MedicationIcon,
  Science as LabIcon,
  Image as ImagingIcon,
  LocalPharmacy as PharmacyIcon,
  CheckCircle as CompletedIcon,
  Schedule as PendingIcon,
  Cancel as CancelledIcon,
  Warning as UrgentIcon,
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Print as PrintIcon,
  Send as SendIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  CalendarMonth as CalendarIcon,
  AccessTime as TimeIcon,
  Person as ProviderIcon,
  Flag as PriorityIcon,
  MoreVert as MoreIcon,
  Close as CloseIcon,
  Assignment,
  GetApp as ExportIcon
} from '@mui/icons-material';
import { format, parseISO, formatDistanceToNow, isWithinInterval, subDays } from 'date-fns';
import { MedicationRequest, ServiceRequest, Patient } from '@ahryman40k/ts-fhir-types/lib/R4';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useClinicalWorkflow, CLINICAL_EVENTS } from '../../../../contexts/ClinicalWorkflowContext';
import { exportClinicalData, EXPORT_COLUMNS } from '../../../../utils/exportUtils';

/**
 * Type definitions for OrdersTab component
 */
export type OrderType = 'medication' | 'lab' | 'imaging' | 'other';
export type OrderStatus = 'active' | 'in-progress' | 'completed' | 'cancelled' | 'stopped' | 'on-hold' | 'draft' | 'entered-in-error';
export type OrderPriority = 'routine' | 'urgent' | 'asap' | 'stat';
export type FilterPeriod = 'all' | '7d' | '30d' | '90d';
export type ExportFormat = 'csv' | 'json' | 'pdf';
export type OrderAction = 'view' | 'edit' | 'cancel' | 'reorder' | 'send' | 'print';

export interface OrderResourceUnion extends Pick<MedicationRequest | ServiceRequest, 'id' | 'resourceType' | 'status' | 'priority' | 'authoredOn' | 'requester' | 'note'> {
  id: string;
  resourceType: 'MedicationRequest' | 'ServiceRequest';
  status: OrderStatus;
  priority?: OrderPriority;
  authoredOn?: string;
  occurrenceDateTime?: string;
  requester?: {
    display?: string;
    reference?: string;
  };
  note?: Array<{
    text?: string;
    time?: string;
  }>;
  // MedicationRequest specific fields
  medicationCodeableConcept?: {
    text?: string;
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  };
  dosageInstruction?: Array<{
    text?: string;
    timing?: any;
    route?: any;
    doseAndRate?: any;
    doseQuantity?: any;
    patientInstruction?: string;
  }>;
  dispenseRequest?: {
    quantity?: {
      value?: number;
      unit?: string;
    };
    numberOfRepeatsAllowed?: number;
    expectedSupplyDuration?: {
      value?: number;
      unit?: string;
    };
    validityPeriod?: {
      end?: string;
    };
  };
  // ServiceRequest specific fields
  code?: {
    text?: string;
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  };
  category?: Array<{
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  }>;
  orderDetail?: Array<{
    text?: string;
  }>;
  reasonCode?: Array<{
    text?: string;
  }>;
}

export interface OrderCardProps {
  order: OrderResourceUnion;
  onSelect: (order: OrderResourceUnion, selected: boolean) => void;
  onAction: (order: OrderResourceUnion, action: OrderAction) => void;
  selected: boolean;
}

export interface QuickOrderData {
  medication: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: string;
  refills: number;
  priority: OrderPriority;
  notes: string;
}

export interface QuickOrderDialogProps {
  open: boolean;
  onClose: () => void;
  patientId: string;
  orderType: OrderType | null;
  onNotificationUpdate?: (notification: NotificationMessage) => void;
  onOrderCreated?: (order: OrderResourceUnion, orderType: OrderType) => void;
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

export interface ViewOrderDialogState {
  open: boolean;
  order: OrderResourceUnion | null;
}

export interface EditOrderDialogState {
  open: boolean;
  order: OrderResourceUnion | null;
}

export interface QuickOrderDialogState {
  open: boolean;
  type: OrderType | null;
}

export interface SpeedDialActionItem {
  icon: React.ReactElement;
  name: string;
  onClick: () => void;
}

export interface OrdersTabProps {
  patientId: string;
  onNotificationUpdate?: (notification: NotificationMessage) => void;
  sx?: SxProps<Theme>;
}

/**
 * Helper functions
 */
const getOrderTypeIcon = (order: OrderResourceUnion): React.ReactElement => {
  if (order.resourceType === 'MedicationRequest') {
    return <MedicationIcon color="primary" />;
  } else if (order.resourceType === 'ServiceRequest') {
    const category = order.category?.[0]?.coding?.[0]?.code;
    switch (category) {
      case 'laboratory':
        return <LabIcon color="info" />;
      case 'imaging':
        return <ImagingIcon color="secondary" />;
      default:
        return <OrderIcon color="action" />;
    }
  }
  return <OrderIcon color="action" />;
};

const getOrderStatusColor = (status: OrderStatus): 'primary' | 'success' | 'error' | 'warning' | 'default' => {
  switch (status) {
    case 'active':
    case 'in-progress':
      return 'primary';
    case 'completed':
      return 'success';
    case 'cancelled':
    case 'stopped':
      return 'error';
    case 'on-hold':
      return 'warning';
    case 'draft':
      return 'default';
    default:
      return 'default';
  }
};

const getPriorityColor = (priority?: OrderPriority): 'error' | 'default' => {
  switch (priority) {
    case 'urgent':
    case 'asap':
    case 'stat':
      return 'error';
    case 'routine':
    default:
      return 'default';
  }
};

const validateOrderData = (orderData: QuickOrderData): string | null => {
  if (!orderData.medication?.trim()) {
    return 'Medication/test name is required';
  }
  if (!orderData.priority) {
    return 'Priority is required';
  }
  return null;
};

const safeParseNumber = (value: string | number): number => {
  if (typeof value === 'number') return value;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Order Card Component
 */
const OrderCard: React.FC<OrderCardProps> = ({ order, onSelect, onAction, selected }) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  
  const handleMenuClose = useCallback((): void => {
    setAnchorEl(null);
  }, []);

  const getOrderTitle = useCallback((): string => {
    if (order.resourceType === 'MedicationRequest') {
      return order.medicationCodeableConcept?.text || 
             order.medicationCodeableConcept?.coding?.[0]?.display ||
             'Medication Order';
    } else if (order.resourceType === 'ServiceRequest') {
      return order.code?.text || 
             order.code?.coding?.[0]?.display ||
             'Service Order';
    }
    return 'Order';
  }, [order]);

  const getOrderDetails = useCallback((): string => {
    if (order.resourceType === 'MedicationRequest') {
      return order.dosageInstruction?.[0]?.text || 'No dosage information';
    } else if (order.resourceType === 'ServiceRequest') {
      return order.orderDetail?.[0]?.text || 
             order.reasonCode?.[0]?.text ||
             'No additional details';
    }
    return '';
  }, [order]);

  const orderDate = order.authoredOn || order.occurrenceDateTime;

  const handleMenuItemClick = useCallback((action: OrderAction) => {
    handleMenuClose();
    onAction(order, action);
  }, [handleMenuClose, onAction, order]);

  const handleSelectChange = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
    onSelect(order, event.target.checked);
  }, [onSelect, order]);

  return (
    <Card 
      sx={{ 
        mb: 2,
        border: selected ? 2 : 0,
        borderColor: 'primary.main',
        backgroundColor: selected ? alpha(theme.palette.primary.main, 0.05) : 'background.paper'
      }}
    >
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={2} alignItems="center" mb={1}>
              <Checkbox
                checked={selected}
                onChange={handleSelectChange}
                inputProps={{ 'aria-label': `Select ${getOrderTitle()}` }}
              />
              {getOrderTypeIcon(order)}
              <Typography variant="h6">
                {getOrderTitle()}
              </Typography>
              <Chip 
                label={order.status} 
                size="small" 
                color={getOrderStatusColor(order.status)}
              />
              {order.priority && (
                <Chip 
                  label={order.priority} 
                  size="small" 
                  color={getPriorityColor(order.priority)}
                  icon={order.priority === 'urgent' ? <UrgentIcon /> : undefined}
                />
              )}
            </Stack>

            <Typography variant="body2" color="text.secondary" gutterBottom>
              {getOrderDetails()}
            </Typography>

            <Stack direction="row" spacing={3} alignItems="center">
              {orderDate && (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <CalendarIcon fontSize="small" color="action" />
                  <Typography variant="caption">
                    {format(parseISO(orderDate), 'MMM d, yyyy')}
                  </Typography>
                </Stack>
              )}
              
              {order.requester && (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <ProviderIcon fontSize="small" color="action" />
                  <Typography variant="caption">
                    {order.requester.display || 'Unknown provider'}
                  </Typography>
                </Stack>
              )}

              {order.dispenseRequest && (
                <Typography variant="caption" color="text.secondary">
                  Quantity: {order.dispenseRequest.quantity?.value} {order.dispenseRequest.quantity?.unit}
                  {order.dispenseRequest.numberOfRepeatsAllowed && 
                    ` • Refills: ${order.dispenseRequest.numberOfRepeatsAllowed}`
                  }
                </Typography>
              )}
            </Stack>
          </Box>

          <Tooltip title="More actions">
            <IconButton 
              onClick={(e) => setAnchorEl(e.currentTarget)}
              aria-label="More order actions"
            >
              <MoreIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </CardContent>

      <CardActions>
        {order.status === 'active' && (
          <>
            <Button 
              size="small" 
              startIcon={<SendIcon />}
              onClick={() => onAction(order, 'send')}
            >
              Send to Pharmacy
            </Button>
            <Button 
              size="small" 
              startIcon={<EditIcon />}
              onClick={() => onAction(order, 'edit')}
            >
              Edit
            </Button>
          </>
        )}
        {order.status === 'completed' && (
          <Button 
            size="small" 
            startIcon={<RefreshIcon />}
            onClick={() => onAction(order, 'reorder')}
          >
            Reorder
          </Button>
        )}
      </CardActions>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleMenuItemClick('view')}>
          View Details
        </MenuItem>
        <MenuItem onClick={() => handleMenuItemClick('print')}>
          Print Order
        </MenuItem>
        {order.status === 'active' && (
          <MenuItem onClick={() => handleMenuItemClick('cancel')}>
            Cancel Order
          </MenuItem>
        )}
      </Menu>
    </Card>
  );
};

/**
 * Quick Order Dialog Component
 */
const QuickOrderDialog: React.FC<QuickOrderDialogProps> = ({ 
  open, 
  onClose, 
  patientId, 
  orderType, 
  onNotificationUpdate, 
  onOrderCreated 
}) => {
  const [orderData, setOrderData] = useState<QuickOrderData>({
    medication: '',
    dosage: '',
    frequency: '',
    duration: '',
    quantity: '',
    refills: 0,
    priority: 'routine',
    notes: ''
  });
  const [loading, setLoading] = useState<boolean>(false);

  const resetForm = useCallback((): void => {
    setOrderData({
      medication: '',
      dosage: '',
      frequency: '',
      duration: '',
      quantity: '',
      refills: 0,
      priority: 'routine',
      notes: ''
    });
  }, []);

  const handleClose = useCallback((): void => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const handleFieldChange = useCallback(<K extends keyof QuickOrderData>(
    field: K
  ) => (value: QuickOrderData[K]): void => {
    setOrderData(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const handleSelectChange = useCallback((event: SelectChangeEvent<string>): void => {
    handleFieldChange('priority')(event.target.value as OrderPriority);
  }, [handleFieldChange]);

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!orderType) return;

    try {
      setLoading(true);

      // Validate form data
      const validationError = validateOrderData(orderData);
      if (validationError) {
        onNotificationUpdate?.({
          type: 'error',
          message: validationError
        });
        return;
      }

      let response;

      if (orderType === 'medication') {
        const medicationRequest: Partial<MedicationRequest> = {
          resourceType: 'MedicationRequest',
          status: 'active',
          intent: 'order',
          priority: orderData.priority,
          subject: { reference: `Patient/${patientId}` },
          authoredOn: new Date().toISOString(),
          medicationCodeableConcept: {
            text: orderData.medication
          },
          dosageInstruction: [{
            text: `${orderData.dosage} ${orderData.frequency} for ${orderData.duration}`
          }],
          dispenseRequest: {
            quantity: { 
              value: safeParseNumber(orderData.quantity) || 30,
              unit: 'dose'
            },
            numberOfRepeatsAllowed: orderData.refills
          },
          ...(orderData.notes && {
            note: [{ text: orderData.notes }]
          })
        };
        
        response = await axios.post('/fhir/R4/MedicationRequest', medicationRequest);
      } else {
        const serviceRequest: Partial<ServiceRequest> = {
          resourceType: 'ServiceRequest',
          status: 'active',
          intent: 'order',
          priority: orderData.priority,
          subject: { reference: `Patient/${patientId}` },
          authoredOn: new Date().toISOString(),
          category: [{
            coding: [{
              system: 'http://snomed.info/sct',
              code: orderType === 'lab' ? '108252007' : '363679005',
              display: orderType === 'lab' ? 'Laboratory procedure' : 'Imaging'
            }]
          }],
          code: {
            text: orderData.medication // Using medication field for test/study name
          },
          ...(orderData.notes && {
            note: [{ text: orderData.notes }]
          })
        };
        
        response = await axios.post('/fhir/R4/ServiceRequest', serviceRequest);
      }
      
      if (response.data) {
        // Refresh patient resources to show new order
        window.dispatchEvent(new CustomEvent('fhir-resources-updated', { 
          detail: { patientId } 
        }));
        
        // Notify parent component about the created order
        onOrderCreated?.(response.data, orderType);
        
        onNotificationUpdate?.({
          type: 'success',
          message: `${orderType === 'medication' ? 'Medication order' : 'Service request'} created successfully`
        });
      }
      
      handleClose();
    } catch (error) {
      console.error('Error creating order:', error);
      const errorMessage = error instanceof Error ? error.message : 
                          (error as any)?.response?.data?.message || 
                          'Failed to create order';
      onNotificationUpdate?.({
        type: 'error',
        message: errorMessage
      });
    } finally {
      setLoading(false);
    }
  }, [orderType, orderData, patientId, onOrderCreated, onNotificationUpdate, handleClose]);

  const getDialogTitle = (): string => {
    switch (orderType) {
      case 'medication': return 'New Medication Order';
      case 'lab': return 'New Lab Order';
      case 'imaging': return 'New Imaging Order';
      default: return 'New Order';
    }
  };

  const getInputLabel = (): string => {
    switch (orderType) {
      case 'medication': return 'Medication';
      case 'lab': return 'Lab Test';
      case 'imaging': return 'Imaging Study';
      default: return 'Order Item';
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {getDialogTitle()}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 2 }}>
          {orderType === 'medication' ? (
            <>
              <TextField
                fullWidth
                label={getInputLabel()}
                value={orderData.medication}
                onChange={(e) => handleFieldChange('medication')(e.target.value)}
                required
                error={!orderData.medication?.trim()}
                helperText={!orderData.medication?.trim() ? 'Medication name is required' : ''}
              />
              <TextField
                fullWidth
                label="Dosage"
                value={orderData.dosage}
                onChange={(e) => handleFieldChange('dosage')(e.target.value)}
                placeholder="e.g., 10mg, 1 tablet"
              />
              <TextField
                fullWidth
                label="Frequency"
                value={orderData.frequency}
                onChange={(e) => handleFieldChange('frequency')(e.target.value)}
                placeholder="e.g., twice daily, once daily"
              />
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Duration"
                    value={orderData.duration}
                    onChange={(e) => handleFieldChange('duration')(e.target.value)}
                    placeholder="e.g., 30 days"
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Refills"
                    type="number"
                    value={orderData.refills}
                    onChange={(e) => handleFieldChange('refills')(parseInt(e.target.value) || 0)}
                    inputProps={{ min: 0, max: 12 }}
                  />
                </Grid>
              </Grid>
            </>
          ) : (
            <TextField
              fullWidth
              label={getInputLabel()}
              value={orderData.medication}
              onChange={(e) => handleFieldChange('medication')(e.target.value)}
              required
              error={!orderData.medication?.trim()}
              helperText={!orderData.medication?.trim() ? `${getInputLabel()} name is required` : ''}
            />
          )}
          
          <FormControl fullWidth>
            <InputLabel>Priority</InputLabel>
            <Select
              value={orderData.priority}
              onChange={handleSelectChange}
              label="Priority"
            >
              <MenuItem value="routine">Routine</MenuItem>
              <MenuItem value="urgent">Urgent</MenuItem>
              <MenuItem value="stat">STAT</MenuItem>
            </Select>
          </FormControl>
          
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Clinical Notes"
            value={orderData.notes}
            onChange={(e) => handleFieldChange('notes')(e.target.value)}
            placeholder="Additional instructions or notes..."
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button 
          variant="contained" 
          onClick={handleSubmit}
          disabled={loading || !orderData.medication?.trim()}
          startIcon={loading ? <CircularProgress size={20} /> : undefined}
        >
          {loading ? 'Creating...' : 'Submit Order'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/**
 * Main OrdersTab Component
 */
const OrdersTab: React.FC<OrdersTabProps> = ({ patientId, onNotificationUpdate, sx }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { getPatientResources, isLoading, currentPatient } = useFHIRResource();
  const { publish } = useClinicalWorkflow();
  
  const [tabValue, setTabValue] = useState<number>(0);
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(true);
  const [snackbar, setSnackbar] = useState<SnackbarState>({ open: false, message: '', severity: 'success' });
  const [speedDialOpen, setSpeedDialOpen] = useState<boolean>(false);
  const [quickOrderDialog, setQuickOrderDialog] = useState<QuickOrderDialogState>({ open: false, type: null });
  const [viewOrderDialog, setViewOrderDialog] = useState<ViewOrderDialogState>({ open: false, order: null });
  const [editOrderDialog, setEditOrderDialog] = useState<EditOrderDialogState>({ open: false, order: null });
  const [exportAnchorEl, setExportAnchorEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setLoading(false);
  }, []);

  // Get all orders with proper typing
  const medicationRequests = useMemo(() => 
    (getPatientResources(patientId, 'MedicationRequest') as MedicationRequest[] || [])
      .map(mr => ({ ...mr, resourceType: 'MedicationRequest' as const })),
  [getPatientResources, patientId]);

  const serviceRequests = useMemo(() => 
    (getPatientResources(patientId, 'ServiceRequest') as ServiceRequest[] || [])
      .map(sr => ({ ...sr, resourceType: 'ServiceRequest' as const })),
  [getPatientResources, patientId]);
  
  // Combine all orders
  const allOrders = useMemo(() => 
    [...medicationRequests, ...serviceRequests] as OrderResourceUnion[],
  [medicationRequests, serviceRequests]);
  
  // Separate by category
  const medicationOrders = useMemo(() => medicationRequests, [medicationRequests]);
  
  const labOrders = useMemo(() => 
    serviceRequests.filter(sr => 
      sr.category?.[0]?.coding?.[0]?.code === 'laboratory'
    ),
  [serviceRequests]);
  
  const imagingOrders = useMemo(() => 
    serviceRequests.filter(sr => 
      sr.category?.[0]?.coding?.[0]?.code === 'imaging'
    ),
  [serviceRequests]);
  
  const otherOrders = useMemo(() => 
    serviceRequests.filter(sr => 
      !['laboratory', 'imaging'].includes(sr.category?.[0]?.coding?.[0]?.code || '')
    ),
  [serviceRequests]);

  // Filter orders
  const filterOrders = useCallback((orders: OrderResourceUnion[]): OrderResourceUnion[] => {
    return orders.filter(order => {
      // Status filter
      if (filterStatus !== 'all' && order.status !== filterStatus) {
        return false;
      }

      // Period filter
      if (filterPeriod !== 'all') {
        const orderDate = order.authoredOn || order.occurrenceDateTime;
        if (orderDate) {
          try {
            const date = parseISO(orderDate);
            const periodMap = {
              '7d': subDays(new Date(), 7),
              '30d': subDays(new Date(), 30),
              '90d': subDays(new Date(), 90)
            };
            if (!isWithinInterval(date, {
              start: periodMap[filterPeriod],
              end: new Date()
            })) {
              return false;
            }
          } catch (error) {
            console.warn('Invalid date format:', orderDate);
          }
        }
      }

      // Search filter
      if (searchTerm) {
        const searchableText = [
          (order as any).medicationCodeableConcept?.text,
          (order as any).medicationCodeableConcept?.coding?.[0]?.display,
          order.code?.text,
          order.code?.coding?.[0]?.display
        ].filter(Boolean).join(' ').toLowerCase();
        
        if (!searchableText.includes(searchTerm.toLowerCase())) {
          return false;
        }
      }

      return true;
    });
  }, [filterStatus, filterPeriod, searchTerm]);

  // Get current orders based on tab
  const getCurrentOrders = useCallback((): OrderResourceUnion[] => {
    switch (tabValue) {
      case 0: return filterOrders(allOrders);
      case 1: return filterOrders(medicationOrders);
      case 2: return filterOrders(labOrders);
      case 3: return filterOrders(imagingOrders);
      case 4: return filterOrders(otherOrders);
      default: return [];
    }
  }, [tabValue, filterOrders, allOrders, medicationOrders, labOrders, imagingOrders, otherOrders]);

  const currentOrders = getCurrentOrders();
  
  const sortedOrders = useMemo(() => 
    [...currentOrders].sort((a, b) => {
      const dateA = new Date(a.authoredOn || a.occurrenceDateTime || 0);
      const dateB = new Date(b.authoredOn || b.occurrenceDateTime || 0);
      return dateB.getTime() - dateA.getTime();
    }),
  [currentOrders]);

  // Count active orders
  const activeOrdersCount = useMemo(() => 
    allOrders.filter(o => o.status === 'active').length,
  [allOrders]);
  
  const urgentOrdersCount = useMemo(() => 
    allOrders.filter(o => 
      o.priority === 'urgent' || o.priority === 'stat'
    ).length,
  [allOrders]);

  const handleSelectOrder = useCallback((order: OrderResourceUnion, selected: boolean): void => {
    const newSelected = new Set(selectedOrders);
    if (selected) {
      newSelected.add(order.id);
    } else {
      newSelected.delete(order.id);
    }
    setSelectedOrders(newSelected);
  }, [selectedOrders]);

  const handleSelectAll = useCallback((event: React.ChangeEvent<HTMLInputElement>): void => {
    if (event.target.checked) {
      const newSelected = new Set(sortedOrders.map(o => o.id));
      setSelectedOrders(newSelected);
    } else {
      setSelectedOrders(new Set());
    }
  }, [sortedOrders]);

  // Send medication to pharmacy workflow
  const handleSendToPharmacy = useCallback(async (order: OrderResourceUnion): Promise<void> => {
    if (order.resourceType !== 'MedicationRequest') {
      setSnackbar({
        open: true,
        message: 'Only medication orders can be sent to pharmacy',
        severity: 'error'
      });
      return;
    }

    try {
      // Update pharmacy status to pending
      await axios.put(`/api/clinical/pharmacy/status/${order.id}`, {
        status: 'pending',
        notes: 'Sent from orders tab',
        updated_by: 'Current User' // This would come from auth context
      });

      // Publish workflow event for pharmacy notification
      await publish(CLINICAL_EVENTS.WORKFLOW_NOTIFICATION, {
        workflowType: 'prescription-dispense',
        step: 'sent-to-pharmacy',
        data: {
          ...order,
          medicationName: (order as any).medicationCodeableConcept?.text || 
                         (order as any).medicationCodeableConcept?.coding?.[0]?.display || 
                         'Unknown medication',
          patientId,
          timestamp: new Date().toISOString()
        }
      });

      setSnackbar({
        open: true,
        message: `${(order as any).medicationCodeableConcept?.text || 'Medication'} sent to pharmacy queue`,
        severity: 'success'
      });
    } catch (error) {
      console.error('Error sending to pharmacy:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send to pharmacy';
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error'
      });
    }
  }, [publish, patientId]);

  // Cancel order
  const handleCancelOrder = useCallback(async (order: OrderResourceUnion): Promise<void> => {
    try {
      const updatedOrder = {
        ...order,
        status: 'cancelled' as OrderStatus
      };
      
      const endpoint = order.resourceType === 'MedicationRequest' 
        ? '/fhir/R4/MedicationRequest' 
        : '/fhir/R4/ServiceRequest';
      
      const response = await axios.put(`${endpoint}/${order.id}`, updatedOrder);
      
      if (response.data) {
        // Refresh patient resources to show updated status
        window.dispatchEvent(new CustomEvent('fhir-resources-updated', { 
          detail: { patientId } 
        }));
        
        setSnackbar({
          open: true,
          message: 'Order cancelled successfully',
          severity: 'success'
        });
      }
    } catch (error) {
      console.error('Error cancelling order:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to cancel order';
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error'
      });
    }
  }, [patientId]);

  // Batch send selected orders to pharmacy
  const handleBatchSendToPharmacy = useCallback(async (): Promise<void> => {
    const medicationOrdersToSend = sortedOrders.filter(order => 
      selectedOrders.has(order.id) && order.resourceType === 'MedicationRequest'
    );

    if (medicationOrdersToSend.length === 0) {
      setSnackbar({
        open: true,
        message: 'No medication orders selected',
        severity: 'warning'
      });
      return;
    }

    try {
      // Send all selected medication orders to pharmacy
      const promises = medicationOrdersToSend.map(order =>
        axios.put(`/api/clinical/pharmacy/status/${order.id}`, {
          status: 'pending',
          notes: 'Batch sent from orders tab',
          updated_by: 'Current User'
        })
      );

      await Promise.all(promises);

      // Publish workflow event for batch pharmacy notification
      await publish(CLINICAL_EVENTS.WORKFLOW_NOTIFICATION, {
        workflowType: 'prescription-dispense',
        step: 'batch-sent-to-pharmacy',
        data: {
          orderCount: medicationOrdersToSend.length,
          orderIds: medicationOrdersToSend.map(o => o.id),
          patientId,
          timestamp: new Date().toISOString()
        }
      });

      setSnackbar({
        open: true,
        message: `${medicationOrdersToSend.length} medication orders sent to pharmacy`,
        severity: 'success'
      });

      // Clear selections
      setSelectedOrders(new Set());
    } catch (error) {
      console.error('Error batch sending to pharmacy:', error);
      setSnackbar({
        open: true,
        message: 'Failed to send selected orders to pharmacy',
        severity: 'error'
      });
    }
  }, [sortedOrders, selectedOrders, publish, patientId]);

  // Reorder - create a new order with same details
  const handleReorder = useCallback(async (order: OrderResourceUnion): Promise<void> => {
    try {
      let newOrder: Partial<MedicationRequest | ServiceRequest>;
      let endpoint: string;
      let successMessage: string;
      
      if (order.resourceType === 'MedicationRequest') {
        newOrder = {
          ...(order as MedicationRequest),
          id: undefined,
          meta: undefined,
          status: 'active',
          authoredOn: new Date().toISOString()
        };
        endpoint = '/fhir/R4/MedicationRequest';
        successMessage = 'Medication reordered successfully';
      } else {
        newOrder = {
          ...(order as ServiceRequest),
          id: undefined,
          meta: undefined,
          status: 'active',
          authoredOn: new Date().toISOString()
        };
        endpoint = '/fhir/R4/ServiceRequest';
        successMessage = 'Service reordered successfully';
      }
      
      const response = await axios.post(endpoint, newOrder);
      
      if (response.data) {
        // Refresh patient resources
        window.dispatchEvent(new CustomEvent('fhir-resources-updated', { 
          detail: { patientId } 
        }));
        
        setSnackbar({
          open: true,
          message: successMessage,
          severity: 'success'
        });
      }
    } catch (error) {
      console.error('Error reordering:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to reorder';
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error'
      });
    }
  }, [patientId]);

  // Batch cancel selected orders
  const handleBatchCancelOrders = useCallback(async (): Promise<void> => {
    const ordersToCancel = sortedOrders.filter(order => 
      selectedOrders.has(order.id) && order.status === 'active'
    );

    if (ordersToCancel.length === 0) {
      setSnackbar({
        open: true,
        message: 'No active orders selected to cancel',
        severity: 'warning'
      });
      return;
    }

    try {
      const promises = ordersToCancel.map(order => {
        const updatedOrder = { ...order, status: 'cancelled' as OrderStatus };
        const endpoint = order.resourceType === 'MedicationRequest' 
          ? '/fhir/R4/MedicationRequest' 
          : '/fhir/R4/ServiceRequest';
        return axios.put(`${endpoint}/${order.id}`, updatedOrder);
      });

      await Promise.all(promises);

      // Refresh patient resources
      window.dispatchEvent(new CustomEvent('fhir-resources-updated', { 
        detail: { patientId } 
      }));

      setSnackbar({
        open: true,
        message: `${ordersToCancel.length} orders cancelled successfully`,
        severity: 'success'
      });

      // Clear selections
      setSelectedOrders(new Set());
    } catch (error) {
      console.error('Error batch cancelling orders:', error);
      setSnackbar({
        open: true,
        message: 'Failed to cancel selected orders',
        severity: 'error'
      });
    }
  }, [sortedOrders, selectedOrders, patientId]);

  const handleOrderAction = useCallback((order: OrderResourceUnion, action: OrderAction): void => {
    switch (action) {
      case 'view':
        setViewOrderDialog({ open: true, order });
        break;
      case 'edit':
        setEditOrderDialog({ open: true, order });
        break;
      case 'cancel':
        handleCancelOrder(order);
        break;
      case 'reorder':
        handleReorder(order);
        break;
      case 'send':
        handleSendToPharmacy(order);
        break;
      case 'print':
        window.print();
        break;
      default:
        break;
    }
  }, [handleCancelOrder, handleReorder, handleSendToPharmacy]);

  // Handle order creation from QuickOrderDialog
  const handleOrderCreated = useCallback(async (order: OrderResourceUnion, orderType: OrderType): Promise<void> => {
    try {
      // Publish ORDER_PLACED event
      await publish(CLINICAL_EVENTS.ORDER_PLACED, {
        ...order,
        orderType,
        patientId,
        timestamp: new Date().toISOString()
      });

      // For lab orders, notify the results tab
      if (orderType === 'lab') {
        await publish(CLINICAL_EVENTS.TAB_UPDATE, {
          targetTabs: ['results'],
          updateType: 'pending_lab_order',
          data: order
        });
      }

      // For imaging orders, notify the imaging tab
      if (orderType === 'imaging') {
        await publish(CLINICAL_EVENTS.TAB_UPDATE, {
          targetTabs: ['imaging'],
          updateType: 'pending_imaging_order',
          data: order
        });
      }
    } catch (error) {
      console.error('Error handling order creation events:', error);
    }
  }, [publish, patientId]);

  // Export handler
  const handleExportOrders = useCallback((format: ExportFormat): void => {
    // Get the currently displayed orders based on tab
    let ordersToExport: OrderResourceUnion[] = [];
    let exportTitle = '';
    
    switch (tabValue) {
      case 0: // All Orders
        ordersToExport = sortedOrders;
        exportTitle = 'All_Orders';
        break;
      case 1: // Medications
        ordersToExport = sortedOrders.filter(o => o.resourceType === 'MedicationRequest');
        exportTitle = 'Medication_Orders';
        break;
      case 2: // Labs
        ordersToExport = sortedOrders.filter(o => 
          o.resourceType === 'ServiceRequest' && (o as any).category?.[0]?.coding?.[0]?.code === 'laboratory'
        );
        exportTitle = 'Lab_Orders';
        break;
      case 3: // Imaging
        ordersToExport = sortedOrders.filter(o => 
          o.resourceType === 'ServiceRequest' && (o as any).category?.[0]?.coding?.[0]?.code === 'imaging'
        );
        exportTitle = 'Imaging_Orders';
        break;
      case 4: // Other
        ordersToExport = sortedOrders.filter(o => 
          o.resourceType === 'ServiceRequest' && 
          !['laboratory', 'imaging'].includes((o as any).category?.[0]?.coding?.[0]?.code || '')
        );
        exportTitle = 'Other_Orders';
        break;
    }
    
    // Transform orders to include display values
    const transformedOrders = ordersToExport.map(order => ({
      ...order,
      code: {
        text: order.resourceType === 'MedicationRequest' 
          ? ((order as any).medicationCodeableConcept?.text || (order as any).medicationCodeableConcept?.coding?.[0]?.display)
          : (order.code?.text || order.code?.coding?.[0]?.display)
      }
    }));
    
    exportClinicalData({
      patient: currentPatient as Patient,
      data: transformedOrders,
      columns: EXPORT_COLUMNS.orders,
      format,
      title: exportTitle,
      formatForPrint: (data) => {
        let html = '<h2>Orders & Prescriptions</h2>';
        data.forEach(order => {
          const orderName = order.resourceType === 'MedicationRequest' 
            ? ((order as any).medicationCodeableConcept?.text || (order as any).medicationCodeableConcept?.coding?.[0]?.display || 'Unknown')
            : (order.code?.text || order.code?.coding?.[0]?.display || 'Unknown');
          
          html += `
            <div class="section">
              <h3>${orderName}</h3>
              <p><strong>Type:</strong> ${order.resourceType === 'MedicationRequest' ? 'Medication' : 'Service Request'}</p>
              <p><strong>Status:</strong> ${order.status}</p>
              <p><strong>Priority:</strong> ${order.priority || 'Routine'}</p>
              <p><strong>Ordered:</strong> ${order.authoredOn ? format(parseISO(order.authoredOn), 'MMM d, yyyy h:mm a') : 'Unknown'}</p>
              ${order.requester?.display ? `<p><strong>Ordered By:</strong> ${order.requester.display}</p>` : ''}
              ${order.note?.[0]?.text ? `<p><strong>Instructions:</strong> ${order.note[0].text}</p>` : ''}
            </div>
          `;
        });
        return html;
      }
    });
  }, [tabValue, sortedOrders, currentPatient]);

  const speedDialActions: SpeedDialActionItem[] = useMemo(() => [
    { 
      icon: <MedicationIcon />, 
      name: 'Medication Order',
      onClick: () => setQuickOrderDialog({ open: true, type: 'medication' })
    },
    { 
      icon: <LabIcon />, 
      name: 'Lab Order',
      onClick: () => setQuickOrderDialog({ open: true, type: 'lab' })
    },
    { 
      icon: <ImagingIcon />, 
      name: 'Imaging Order',
      onClick: () => setQuickOrderDialog({ open: true, type: 'imaging' })
    }
  ], []);

  const handleTabChange = useCallback((event: React.SyntheticEvent, newValue: number): void => {
    setTabValue(newValue);
  }, []);

  const handleStatusFilterChange = useCallback((event: SelectChangeEvent<string>): void => {
    setFilterStatus(event.target.value);
  }, []);

  const handlePeriodFilterChange = useCallback((event: SelectChangeEvent<string>): void => {
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
          Orders & Prescriptions
        </Typography>
        <Stack direction="row" spacing={2}>
          {selectedOrders.size > 0 && (
            <>
              <Button
                variant="outlined"
                startIcon={<SendIcon />}
                onClick={handleBatchSendToPharmacy}
              >
                Send to Pharmacy ({selectedOrders.size})
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={handleBatchCancelOrders}
              >
                Cancel Selected
              </Button>
            </>
          )}
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setQuickOrderDialog({ open: true, type: 'medication' })}
          >
            New Order
          </Button>
          <Button
            variant="outlined"
            startIcon={<ExportIcon />}
            onClick={(e) => setExportAnchorEl(e.currentTarget)}
          >
            Export
          </Button>
        </Stack>
      </Stack>

      {/* Alerts */}
      {urgentOrdersCount > 0 && (
        <Alert 
          severity="warning" 
          sx={{ mb: 3 }}
          icon={<UrgentIcon />}
        >
          <Typography variant="subtitle2">
            {urgentOrdersCount} urgent orders require immediate attention
          </Typography>
        </Alert>
      )}

      {/* Summary Stats */}
      <Stack direction="row" spacing={2} mb={3}>
        <Chip 
          label={`${activeOrdersCount} Active Orders`} 
          color="primary" 
          icon={<Assignment />}
        />
        <Chip 
          label={`${medicationOrders.filter(o => o.status === 'active').length} Active Medications`} 
          color="info" 
        />
        <Chip 
          label={`${labOrders.filter(o => o.status === 'active').length} Pending Labs`} 
          color="warning" 
        />
      </Stack>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label={`All Orders (${allOrders.length})`} />
          <Tab label={`Medications (${medicationOrders.length})`} />
          <Tab label={`Lab Orders (${labOrders.length})`} />
          <Tab label={`Imaging (${imagingOrders.length})`} />
          <Tab label={`Other (${otherOrders.length})`} />
        </Tabs>
      </Paper>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField
            placeholder="Search orders..."
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
            <InputLabel>Status</InputLabel>
            <Select
              value={filterStatus}
              onChange={handleStatusFilterChange}
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
            <InputLabel>Period</InputLabel>
            <Select
              value={filterPeriod}
              onChange={handlePeriodFilterChange}
              label="Period"
            >
              <MenuItem value="all">All Time</MenuItem>
              <MenuItem value="7d">Last 7 Days</MenuItem>
              <MenuItem value="30d">Last 30 Days</MenuItem>
              <MenuItem value="90d">Last 90 Days</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Checkbox
                checked={selectedOrders.size === sortedOrders.length && sortedOrders.length > 0}
                indeterminate={selectedOrders.size > 0 && selectedOrders.size < sortedOrders.length}
                onChange={handleSelectAll}
                inputProps={{ 'aria-label': 'Select all orders' }}
              />
            }
            label="Select All"
          />
        </Stack>
      </Paper>

      {/* Orders List */}
      {sortedOrders.length === 0 ? (
        <Alert severity="info">
          No orders found matching your criteria
        </Alert>
      ) : (
        <Box>
          {sortedOrders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              selected={selectedOrders.has(order.id)}
              onSelect={handleSelectOrder}
              onAction={handleOrderAction}
            />
          ))}
        </Box>
      )}

      {/* Speed Dial for Quick Orders */}
      <SpeedDial
        ariaLabel="Quick order actions"
        sx={{ position: 'fixed', bottom: 16, right: 16 }}
        icon={<SpeedDialIcon />}
        onClose={() => setSpeedDialOpen(false)}
        onOpen={() => setSpeedDialOpen(true)}
        open={speedDialOpen}
      >
        {speedDialActions.map((action) => (
          <SpeedDialAction
            key={action.name}
            icon={action.icon}
            tooltipTitle={action.name}
            onClick={() => {
              setSpeedDialOpen(false);
              action.onClick();
            }}
          />
        ))}
      </SpeedDial>

      {/* Quick Order Dialog */}
      <QuickOrderDialog
        open={quickOrderDialog.open}
        onClose={() => setQuickOrderDialog({ open: false, type: null })}
        patientId={patientId}
        orderType={quickOrderDialog.type}
        onNotificationUpdate={handleNotificationUpdate}
        onOrderCreated={handleOrderCreated}
      />

      {/* View Order Dialog */}
      <Dialog 
        open={viewOrderDialog.open} 
        onClose={() => setViewOrderDialog({ open: false, order: null })} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle>
          Order Details
          <IconButton
            edge="end"
            color="inherit"
            onClick={() => setViewOrderDialog({ open: false, order: null })}
            sx={{ position: 'absolute', right: 8, top: 8 }}
            aria-label="Close dialog"
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {viewOrderDialog.order && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" gutterBottom>
                {viewOrderDialog.order.resourceType === 'MedicationRequest' 
                  ? ((viewOrderDialog.order as any).medicationCodeableConcept?.text || (viewOrderDialog.order as any).medicationCodeableConcept?.coding?.[0]?.display || 'Unknown Medication')
                  : (viewOrderDialog.order.code?.text || viewOrderDialog.order.code?.coding?.[0]?.display || 'Unknown Order')}
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Order Type</Typography>
                  <Typography variant="body1">
                    {viewOrderDialog.order.resourceType === 'MedicationRequest' ? 'Medication' : 'Service Request'}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Status</Typography>
                  <Chip
                    label={viewOrderDialog.order.status}
                    size="small"
                    color={viewOrderDialog.order.status === 'active' ? 'success' : 'default'}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Priority</Typography>
                  <Typography variant="body1">{viewOrderDialog.order.priority || 'Routine'}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Ordered Date</Typography>
                  <Typography variant="body1">
                    {viewOrderDialog.order.authoredOn ? format(parseISO(viewOrderDialog.order.authoredOn), 'MMM d, yyyy h:mm a') : 'Unknown'}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">Ordered By</Typography>
                  <Typography variant="body1">{viewOrderDialog.order.requester?.display || 'Unknown Provider'}</Typography>
                </Grid>
                {viewOrderDialog.order.note?.[0]?.text && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary">Instructions</Typography>
                    <Typography variant="body1">{viewOrderDialog.order.note[0].text}</Typography>
                  </Grid>
                )}
                {viewOrderDialog.order.resourceType === 'MedicationRequest' && (viewOrderDialog.order as any).dosageInstruction?.[0] && (
                  <Grid item xs={12}>
                    <Typography variant="subtitle2" color="text.secondary">Dosage Instructions</Typography>
                    <Typography variant="body1">{(viewOrderDialog.order as any).dosageInstruction[0].text || 'See prescription'}</Typography>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewOrderDialog({ open: false, order: null })}>Close</Button>
        </DialogActions>
      </Dialog>

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

      {/* Export Menu */}
      <Menu
        anchorEl={exportAnchorEl}
        open={Boolean(exportAnchorEl)}
        onClose={() => setExportAnchorEl(null)}
      >
        <MenuItem onClick={() => { handleExportOrders('csv'); setExportAnchorEl(null); }}>
          Export as CSV
        </MenuItem>
        <MenuItem onClick={() => { handleExportOrders('json'); setExportAnchorEl(null); }}>
          Export as JSON
        </MenuItem>
        <MenuItem onClick={() => { handleExportOrders('pdf'); setExportAnchorEl(null); }}>
          Export as PDF
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default OrdersTab;