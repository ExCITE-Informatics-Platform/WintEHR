/**
 * WorkspaceContent Component
 * Renders custom layouts with components arranged according to saved configurations
 * 
 * Migrated to TypeScript with comprehensive type safety for workspace layout management.
 */

import React from 'react';
import { Box, Paper, Typography, CircularProgress, SxProps, Theme } from '@mui/material';
import GridLayout, { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

// Import all available components
import SummaryTab from './tabs/SummaryTab';
import ChartReviewTab from './tabs/ChartReviewTab';
import EncountersTab from './tabs/EncountersTab';
import ResultsTab from './tabs/ResultsTab';
import OrdersTab from './tabs/OrdersTab';
import DocumentationTab from './tabs/DocumentationTab';
import CarePlanTab from './tabs/CarePlanTab';
import TimelineTab from './tabs/TimelineTab';

/**
 * Type definitions for WorkspaceContent component
 */
export type ComponentType = 
  | 'summary' 
  | 'chart' 
  | 'encounters' 
  | 'results' 
  | 'orders' 
  | 'documentation' 
  | 'careplan' 
  | 'timeline';

export interface ComponentConfig {
  component: React.ComponentType<any>;
  name: string;
}

export interface LayoutItem extends Layout {
  component: ComponentType;
  props?: Record<string, any>;
}

export interface WorkspaceLayout {
  items: LayoutItem[];
  editable?: boolean;
  name?: string;
  id?: string;
}

export interface WorkspaceContentProps {
  layout: WorkspaceLayout;
  patientId?: string;
  onLayoutChange?: (newLayout: Layout[]) => void;
  sx?: SxProps<Theme>;
}

export interface TabComponentProps {
  patientId?: string;
  compact?: boolean;
  [key: string]: any;
}

/**
 * Component registry
 */
const COMPONENT_REGISTRY: Record<ComponentType, ComponentConfig> = {
  'summary': { component: SummaryTab, name: 'Summary Dashboard' },
  'chart': { component: ChartReviewTab, name: 'Chart Review' },
  'encounters': { component: EncountersTab, name: 'Encounters' },
  'results': { component: ResultsTab, name: 'Results' },
  'orders': { component: OrdersTab, name: 'Orders' },
  'documentation': { component: DocumentationTab, name: 'Documentation' },
  'careplan': { component: CarePlanTab, name: 'Care Plan' },
  'timeline': { component: TimelineTab, name: 'Timeline' }
};

/**
 * Helper functions
 */
const isValidComponentType = (component: string): component is ComponentType => {
  return Object.keys(COMPONENT_REGISTRY).includes(component);
};

/**
 * WorkspaceContent Component
 */
const WorkspaceContent: React.FC<WorkspaceContentProps> = ({ 
  layout, 
  patientId, 
  onLayoutChange,
  sx 
}) => {
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    // Simulate loading delay
    const timer = setTimeout(() => {
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [layout]);

  const handleLayoutChange = (newLayout: Layout[]): void => {
    if (onLayoutChange) {
      onLayoutChange(newLayout);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4, ...sx }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3, ...sx }}>
        <Typography color="error">Error loading layout: {error}</Typography>
      </Box>
    );
  }

  if (!layout || !layout.items) {
    return (
      <Box sx={{ p: 3, ...sx }}>
        <Typography>No layout configuration found</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, height: '100%', overflow: 'auto', ...sx }}>
      <GridLayout
        className="layout"
        layout={layout.items}
        cols={12}
        rowHeight={60}
        width={1200}
        isDraggable={layout.editable}
        isResizable={layout.editable}
        onLayoutChange={handleLayoutChange}
        margin={[16, 16]}
        containerPadding={[0, 0]}
      >
        {layout.items.map((item: LayoutItem) => {
          const componentConfig = isValidComponentType(item.component) 
            ? COMPONENT_REGISTRY[item.component] 
            : null;

          if (!componentConfig) {
            return (
              <Paper
                key={item.i}
                sx={{ 
                  p: 2, 
                  height: '100%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center' 
                }}
              >
                <Typography color="error">
                  Unknown component: {item.component}
                </Typography>
              </Paper>
            );
          }

          const Component = componentConfig.component;
          return (
            <Paper
              key={item.i}
              sx={{ 
                height: '100%', 
                overflow: 'auto',
                display: 'flex',
                flexDirection: 'column'
              }}
              elevation={2}
            >
              <Box sx={{ 
                p: 1, 
                borderBottom: 1, 
                borderColor: 'divider',
                backgroundColor: 'grey.50'
              }}>
                <Typography variant="subtitle2" fontWeight="bold">
                  {componentConfig.name}
                </Typography>
              </Box>
              <Box sx={{ flex: 1, overflow: 'auto' }}>
                <Component 
                  patientId={patientId} 
                  compact={true}
                  {...(item.props || {})}
                />
              </Box>
            </Paper>
          );
        })}
      </GridLayout>
    </Box>
  );
};

export default WorkspaceContent;