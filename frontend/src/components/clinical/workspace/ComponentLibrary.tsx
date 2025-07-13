/**
 * ComponentLibrary Component
 * Displays available components for custom layouts with drag-and-drop support
 * 
 * Migrated to TypeScript with comprehensive type safety for workspace component management.
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  Stack,
  Tooltip,
  TextField,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
  alpha,
  SxProps,
  Theme,
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Assignment as ChartIcon,
  EventNote as EncountersIcon,
  Science as ResultsIcon,
  LocalPharmacy as OrdersIcon,
  Description as DocumentationIcon,
  AssignmentTurnedIn as CarePlanIcon,
  Timeline as TimelineIcon,
  MonitorHeart as VitalsIcon,
  Warning as AlertsIcon,
  TrendingUp as TrendsIcon,
  Group as TeamIcon,
  Search as SearchIcon,
  Category as CategoryIcon,
  ShowChart as ChartLineIcon,
  Biotech as LabIcon,
} from '@mui/icons-material';

/**
 * Type definitions for ComponentLibrary
 */
export type ComponentCategory = 'overview' | 'clinical' | 'care' | 'charts';

export type ComponentId = 
  | 'summary' 
  | 'timeline' 
  | 'alerts' 
  | 'chart' 
  | 'encounters' 
  | 'results' 
  | 'orders' 
  | 'documentation' 
  | 'vitals' 
  | 'careplan' 
  | 'team' 
  | 'trends' 
  | 'vitalschart' 
  | 'labtrends';

export interface ComponentDefinition {
  id: ComponentId;
  name: string;
  description: string;
  icon: React.ReactElement;
  category: ComponentCategory;
  minWidth: number;
  minHeight: number;
  defaultWidth: number;
  defaultHeight: number;
}

export interface ComponentLibraryProps {
  onComponentSelect?: (component: ComponentDefinition) => void;
  selectedCategory?: ComponentCategory | 'all';
  searchTerm?: string;
  sx?: SxProps<Theme>;
}

export interface DragStartEvent extends React.DragEvent<HTMLDivElement> {
  dataTransfer: DataTransfer;
}

/**
 * Extended component library with more options
 */
export const COMPONENT_LIBRARY: ComponentDefinition[] = [
  // Overview Components
  {
    id: 'summary',
    name: 'Summary Dashboard',
    description: 'Patient overview with key metrics',
    icon: <DashboardIcon />,
    category: 'overview',
    minWidth: 6,
    minHeight: 4,
    defaultWidth: 12,
    defaultHeight: 6
  },
  {
    id: 'timeline',
    name: 'Clinical Timeline',
    description: 'Chronological view of events',
    icon: <TimelineIcon />,
    category: 'overview',
    minWidth: 4,
    minHeight: 6,
    defaultWidth: 6,
    defaultHeight: 8
  },
  {
    id: 'alerts',
    name: 'Clinical Alerts',
    description: 'Active alerts and warnings',
    icon: <AlertsIcon />,
    category: 'overview',
    minWidth: 3,
    minHeight: 3,
    defaultWidth: 4,
    defaultHeight: 4
  },

  // Clinical Components
  {
    id: 'chart',
    name: 'Chart Review',
    description: 'Problems, medications, allergies',
    icon: <ChartIcon />,
    category: 'clinical',
    minWidth: 4,
    minHeight: 4,
    defaultWidth: 6,
    defaultHeight: 6
  },
  {
    id: 'encounters',
    name: 'Encounters',
    description: 'Visit history and notes',
    icon: <EncountersIcon />,
    category: 'clinical',
    minWidth: 4,
    minHeight: 4,
    defaultWidth: 6,
    defaultHeight: 6
  },
  {
    id: 'results',
    name: 'Results',
    description: 'Labs, imaging, diagnostics',
    icon: <ResultsIcon />,
    category: 'clinical',
    minWidth: 4,
    minHeight: 4,
    defaultWidth: 8,
    defaultHeight: 6
  },
  {
    id: 'orders',
    name: 'Orders',
    description: 'Active orders and prescriptions',
    icon: <OrdersIcon />,
    category: 'clinical',
    minWidth: 4,
    minHeight: 4,
    defaultWidth: 6,
    defaultHeight: 6
  },
  {
    id: 'documentation',
    name: 'Documentation',
    description: 'Clinical notes and forms',
    icon: <DocumentationIcon />,
    category: 'clinical',
    minWidth: 4,
    minHeight: 4,
    defaultWidth: 8,
    defaultHeight: 8
  },
  {
    id: 'vitals',
    name: 'Vital Signs',
    description: 'Current and trending vitals',
    icon: <VitalsIcon />,
    category: 'clinical',
    minWidth: 3,
    minHeight: 3,
    defaultWidth: 4,
    defaultHeight: 4
  },

  // Care Management Components
  {
    id: 'careplan',
    name: 'Care Plan',
    description: 'Goals, interventions, care team',
    icon: <CarePlanIcon />,
    category: 'care',
    minWidth: 4,
    minHeight: 4,
    defaultWidth: 6,
    defaultHeight: 6
  },
  {
    id: 'team',
    name: 'Care Team',
    description: 'Care team members and roles',
    icon: <TeamIcon />,
    category: 'care',
    minWidth: 3,
    minHeight: 3,
    defaultWidth: 4,
    defaultHeight: 4
  },
  {
    id: 'trends',
    name: 'Health Trends',
    description: 'Trending health metrics',
    icon: <TrendsIcon />,
    category: 'care',
    minWidth: 4,
    minHeight: 3,
    defaultWidth: 6,
    defaultHeight: 4
  },

  // Data Visualization Components
  {
    id: 'vitalschart',
    name: 'Vital Signs Chart',
    description: 'Interactive vital signs trends',
    icon: <ChartLineIcon />,
    category: 'charts',
    minWidth: 4,
    minHeight: 4,
    defaultWidth: 6,
    defaultHeight: 5
  },
  {
    id: 'labtrends',
    name: 'Lab Trends',
    description: 'Laboratory result trends',
    icon: <LabIcon />,
    category: 'charts',
    minWidth: 4,
    minHeight: 4,
    defaultWidth: 6,
    defaultHeight: 5
  }
];

/**
 * Helper functions
 */
const getCategoryDisplayName = (category: ComponentCategory | 'all'): string => {
  return category.charAt(0).toUpperCase() + category.slice(1);
};

const filterComponents = (
  components: ComponentDefinition[], 
  category: ComponentCategory | 'all', 
  search: string
): ComponentDefinition[] => {
  return components.filter(component => {
    const matchesCategory = category === 'all' || component.category === category;
    const matchesSearch = !search || 
      component.name.toLowerCase().includes(search.toLowerCase()) ||
      component.description.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });
};

/**
 * ComponentLibrary Component
 */
const ComponentLibrary: React.FC<ComponentLibraryProps> = ({ 
  onComponentSelect, 
  selectedCategory = 'all', 
  searchTerm = '',
  sx 
}) => {
  const theme = useTheme();
  const [category, setCategory] = useState<ComponentCategory | 'all'>(selectedCategory);
  const [search, setSearch] = useState<string>(searchTerm);

  // Filter components based on category and search
  const filteredComponents = filterComponents(COMPONENT_LIBRARY, category, search);

  // Get unique categories
  const categories: (ComponentCategory | 'all')[] = [
    'all', 
    ...Array.from(new Set(COMPONENT_LIBRARY.map(c => c.category)))
  ];

  const handleDragStart = (e: DragStartEvent, component: ComponentDefinition): void => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('component', JSON.stringify(component));
  };

  const handleCategoryChange = (
    event: React.MouseEvent<HTMLElement>, 
    newCategory: ComponentCategory | 'all' | null
  ): void => {
    if (newCategory) {
      setCategory(newCategory);
    }
  };

  const handleComponentClick = (component: ComponentDefinition): void => {
    if (onComponentSelect) {
      onComponentSelect(component);
    }
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setSearch(event.target.value);
  };

  return (
    <Box sx={sx}>
      <Stack spacing={2} mb={3}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search components..."
          value={search}
          onChange={handleSearchChange}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            )
          }}
          aria-label="Search components"
        />

        <ToggleButtonGroup
          value={category}
          exclusive
          onChange={handleCategoryChange}
          fullWidth
          size="small"
          aria-label="Component category filter"
        >
          {categories.map(cat => (
            <ToggleButton key={cat} value={cat} aria-label={`Filter by ${cat} category`}>
              <Stack direction="row" spacing={1} alignItems="center">
                {cat === 'all' && <CategoryIcon />}
                <Typography variant="caption">
                  {getCategoryDisplayName(cat)}
                </Typography>
              </Stack>
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Stack>

      <Grid container spacing={2}>
        {filteredComponents.map((component) => (
          <Grid item xs={12} sm={6} key={component.id}>
            <Card
              draggable
              onDragStart={(e) => handleDragStart(e, component)}
              onClick={() => handleComponentClick(component)}
              sx={{
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: theme.shadows[4],
                  backgroundColor: alpha(theme.palette.primary.main, 0.05)
                },
                '&:active': {
                  transform: 'translateY(0)',
                  boxShadow: theme.shadows[2]
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={`Add ${component.name} component`}
            >
              <CardContent>
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2,
                      backgroundColor: alpha(theme.palette.primary.main, 0.1),
                      color: 'primary.main'
                    }}
                  >
                    {component.icon}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                      {component.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                      {component.description}
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      <Chip 
                        label={component.category} 
                        size="small" 
                        variant="outlined"
                      />
                      <Chip 
                        label={`${component.minWidth}x${component.minHeight} min`} 
                        size="small" 
                        variant="outlined"
                      />
                    </Stack>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {filteredComponents.length === 0 && (
        <Box
          sx={{
            py: 4,
            textAlign: 'center',
            color: 'text.secondary'
          }}
        >
          <Typography>No components found</Typography>
        </Box>
      )}
    </Box>
  );
};

export default ComponentLibrary;