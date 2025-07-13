/**
 * Real-time order status component
 * Shows live updates for order status changes
 * 
 * Migrated to TypeScript with comprehensive type safety for real-time order tracking.
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  LinearProgress,
  Fade,
  SxProps,
  Theme,
} from '@mui/material';
import {
  CheckCircle as CompletedIcon,
  Schedule as PendingIcon,
  PlayArrow as ActiveIcon,
  Cancel as CancelledIcon,
} from '@mui/icons-material';
import { R4 } from '@ahryman40k/ts-fhir-types';
import { useWebSocket } from '../../../hooks/useWebSocket';

/**
 * Type definitions for RealTimeOrderStatus component
 */
export type OrderStatus = 
  | 'draft' 
  | 'active' 
  | 'on-hold' 
  | 'revoked' 
  | 'completed' 
  | 'entered-in-error'
  | 'unknown'
  | 'in-progress'
  | 'cancelled';

export interface RealTimeOrderStatusProps {
  orderId: string;
  initialStatus: OrderStatus;
  showLabel?: boolean;
  size?: 'small' | 'medium';
  sx?: SxProps<Theme>;
  onStatusChange?: (newStatus: OrderStatus) => void;
}

export interface WebSocketUpdate {
  resourceType: string;
  resourceId: string;
  resource?: R4.IServiceRequest;
  action: 'create' | 'update' | 'delete';
  timestamp: string;
}

export interface StatusConfig {
  icon: JSX.Element;
  color: 'success' | 'primary' | 'error' | 'warning' | 'default';
  label: string;
}

/**
 * Constants
 */
const STATUS_CONFIGS: Record<OrderStatus, StatusConfig> = {
  'completed': {
    icon: <CompletedIcon fontSize="small" />,
    color: 'success',
    label: 'Completed'
  },
  'active': {
    icon: <ActiveIcon fontSize="small" />,
    color: 'primary',
    label: 'Active'
  },
  'in-progress': {
    icon: <ActiveIcon fontSize="small" />,
    color: 'primary',
    label: 'In Progress'
  },
  'cancelled': {
    icon: <CancelledIcon fontSize="small" />,
    color: 'error',
    label: 'Cancelled'
  },
  'revoked': {
    icon: <CancelledIcon fontSize="small" />,
    color: 'error',
    label: 'Revoked'
  },
  'on-hold': {
    icon: <PendingIcon fontSize="small" />,
    color: 'warning',
    label: 'On Hold'
  },
  'draft': {
    icon: <PendingIcon fontSize="small" />,
    color: 'default',
    label: 'Draft'
  },
  'entered-in-error': {
    icon: <CancelledIcon fontSize="small" />,
    color: 'error',
    label: 'Error'
  },
  'unknown': {
    icon: <PendingIcon fontSize="small" />,
    color: 'default',
    label: 'Unknown'
  }
};

/**
 * Helper functions
 */
const isValidOrderStatus = (status: string): status is OrderStatus => {
  return Object.keys(STATUS_CONFIGS).includes(status);
};

const normalizeStatus = (status: string): OrderStatus => {
  if (isValidOrderStatus(status)) {
    return status;
  }
  return 'unknown';
};

/**
 * RealTimeOrderStatus Component
 */
const RealTimeOrderStatus: React.FC<RealTimeOrderStatusProps> = ({
  orderId,
  initialStatus,
  showLabel = true,
  size = 'small',
  sx,
  onStatusChange
}) => {
  const [status, setStatus] = useState<OrderStatus>(normalizeStatus(initialStatus));
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  // Subscribe to ServiceRequest updates
  const { lastUpdate } = useWebSocket({
    resourceTypes: ['ServiceRequest'],
    enabled: !!orderId
  });

  useEffect(() => {
    if (
      lastUpdate &&
      lastUpdate.resourceType === 'ServiceRequest' &&
      lastUpdate.resourceId === orderId
    ) {
      setIsUpdating(true);
      
      // Update status from the resource
      const newStatusRaw = (lastUpdate as WebSocketUpdate).resource?.status;
      if (newStatusRaw) {
        const newStatus = normalizeStatus(newStatusRaw);
        
        setTimeout(() => {
          setStatus(newStatus);
          setIsUpdating(false);
          
          // Notify parent component of status change
          if (onStatusChange && newStatus !== status) {
            onStatusChange(newStatus);
          }
        }, 500); // Small delay for visual feedback
      } else {
        setIsUpdating(false);
      }
    }
  }, [lastUpdate, orderId, status, onStatusChange]);

  const statusConfig = STATUS_CONFIGS[status];

  return (
    <Box sx={{ position: 'relative', ...sx }}>
      <Fade in={isUpdating}>
        <LinearProgress
          sx={{
            position: 'absolute',
            top: -4,
            left: 0,
            right: 0,
            height: 2,
            borderRadius: 1
          }}
        />
      </Fade>
      
      <Chip
        icon={statusConfig.icon}
        label={showLabel ? statusConfig.label : undefined}
        color={statusConfig.color}
        size={size}
        sx={{
          transition: 'all 0.3s ease',
          minWidth: showLabel ? 'auto' : 32,
          '& .MuiChip-label': {
            paddingLeft: showLabel ? 1 : 0,
            paddingRight: showLabel ? 1 : 0
          },
          ...(isUpdating && {
            '@keyframes pulse': {
              '0%': { transform: 'scale(1)' },
              '50%': { transform: 'scale(1.05)' },
              '100%': { transform: 'scale(1)' }
            },
            animation: 'pulse 1s ease-in-out'
          })
        }}
      />
    </Box>
  );
};

export default RealTimeOrderStatus;