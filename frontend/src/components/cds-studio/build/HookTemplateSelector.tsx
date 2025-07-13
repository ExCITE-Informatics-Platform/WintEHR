/**
 * Hook Template Selector - Pre-built hook templates for common scenarios
 * 
 * Migrated to TypeScript with comprehensive type safety for CDS Hook templates.
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Stack,
  TextField,
  InputAdornment,
  IconButton,
  Collapse,
  SxProps,
  Theme,
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  LocalHospital as ClinicalIcon,
  Science as LabIcon,
  Medication as MedIcon,
  Warning as SafetyIcon,
  Assignment as ComplianceIcon,
  TrendingUp as QualityIcon,
} from '@mui/icons-material';

/**
 * Type definitions for HookTemplateSelector component
 */
export type HookType = 'patient-view' | 'medication-prescribe' | 'order-sign' | 'order-select';
export type CardIndicator = 'info' | 'warning' | 'critical' | 'success';
export type ConditionOperator = '=' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'not_contains';
export type TemplateCategory = 'clinical' | 'safety' | 'laboratory' | 'preventive' | 'quality';

export interface TemplateCondition {
  id?: string;
  field: string;
  operator: ConditionOperator;
  value: string | number | boolean;
}

export interface CardSuggestion {
  label: string;
  type: 'create' | 'update' | 'delete';
  resource?: string;
}

export interface TemplateCard {
  id?: string;
  summary: string;
  detail: string;
  indicator: CardIndicator;
  source?: {
    label: string;
    url?: string;
  };
  suggestions?: CardSuggestion[];
}

export interface HookTemplate {
  id: string;
  title: string;
  description: string;
  hook: HookType;
  conditions: TemplateCondition[];
  cards: TemplateCard[];
}

export interface TemplateCategory {
  label: string;
  icon: React.ReactElement;
  color: string;
  templates: HookTemplate[];
}

export interface HookTemplateSelectorProps {
  onSelectTemplate: (template: HookTemplate) => void;
  onClose?: () => void;
  sx?: SxProps<Theme>;
}

/**
 * Constants
 */
const HOOK_TEMPLATES: Record<TemplateCategory, TemplateCategory> = {
  clinical: {
    label: 'Clinical Guidelines',
    icon: <ClinicalIcon />,
    color: '#2196F3',
    templates: [
      {
        id: 'diabetes-management',
        title: 'Diabetes Management Alert',
        description: 'Monitor HbA1c levels and suggest interventions for diabetic patients',
        hook: 'patient-view',
        conditions: [
          { field: 'has_condition', operator: 'contains', value: 'Diabetes' },
          { field: 'hba1c', operator: '>', value: 7 }
        ],
        cards: [{
          summary: 'Elevated HbA1c - Intervention Needed',
          detail: 'Patient\'s HbA1c is above target. Consider medication adjustment or lifestyle counseling.',
          indicator: 'warning',
          source: { label: 'ADA Guidelines' }
        }]
      },
      {
        id: 'hypertension-control',
        title: 'Hypertension Control',
        description: 'Alert for uncontrolled blood pressure readings',
        hook: 'patient-view',
        conditions: [
          { field: 'blood_pressure_systolic', operator: '>=', value: 140 }
        ],
        cards: [{
          summary: 'Elevated Blood Pressure',
          detail: 'Consider medication adjustment or lifestyle modifications.',
          indicator: 'warning'
        }]
      }
    ]
  },
  safety: {
    label: 'Medication Safety',
    icon: <SafetyIcon />,
    color: '#F44336',
    templates: [
      {
        id: 'drug-interaction',
        title: 'Drug Interaction Check',
        description: 'Alert for potential drug interactions when prescribing',
        hook: 'medication-prescribe',
        conditions: [
          { field: 'drug_interaction', operator: '=', value: true }
        ],
        cards: [{
          summary: 'Potential Drug Interaction Detected',
          detail: 'Review medication list for potential interactions.',
          indicator: 'critical',
          source: { label: 'Drug Interaction Database' }
        }]
      },
      {
        id: 'allergy-alert',
        title: 'Allergy Alert',
        description: 'Warn about medication allergies',
        hook: 'medication-prescribe',
        conditions: [
          { field: 'allergy', operator: 'contains', value: '{{context.medication}}' }
        ],
        cards: [{
          summary: 'Allergy Alert',
          detail: 'Patient has documented allergy to this medication class.',
          indicator: 'critical'
        }]
      }
    ]
  },
  laboratory: {
    label: 'Lab Results',
    icon: <LabIcon />,
    color: '#4CAF50',
    templates: [
      {
        id: 'critical-lab',
        title: 'Critical Lab Value',
        description: 'Alert for critical laboratory results',
        hook: 'patient-view',
        conditions: [
          { field: 'lab_result', operator: '>', value: 'critical_high' }
        ],
        cards: [{
          summary: 'Critical Lab Result',
          detail: 'Immediate action required for critical lab value.',
          indicator: 'critical'
        }]
      },
      {
        id: 'kidney-function',
        title: 'Kidney Function Alert',
        description: 'Monitor creatinine levels for kidney disease',
        hook: 'patient-view',
        conditions: [
          { field: 'creatinine', operator: '>', value: 1.5 }
        ],
        cards: [{
          summary: 'Elevated Creatinine',
          detail: 'Consider medication dose adjustment for renal function.',
          indicator: 'warning'
        }]
      }
    ]
  },
  preventive: {
    label: 'Preventive Care',
    icon: <ComplianceIcon />,
    color: '#FF9800',
    templates: [
      {
        id: 'screening-due',
        title: 'Screening Reminder',
        description: 'Remind about due preventive screenings',
        hook: 'patient-view',
        conditions: [
          { field: 'age', operator: '>=', value: 50 },
          { field: 'days_since', operator: '>', value: 365 }
        ],
        cards: [{
          summary: 'Preventive Screening Due',
          detail: 'Patient is due for age-appropriate screening.',
          indicator: 'info',
          suggestions: [{ label: 'Order Screening', type: 'create' }]
        }]
      },
      {
        id: 'immunization-due',
        title: 'Immunization Reminder',
        description: 'Alert for due immunizations',
        hook: 'patient-view',
        conditions: [
          { field: 'days_since', operator: '>', value: 365 }
        ],
        cards: [{
          summary: 'Immunization Due',
          detail: 'Review immunization schedule.',
          indicator: 'info'
        }]
      }
    ]
  },
  quality: {
    label: 'Quality Measures',
    icon: <QualityIcon />,
    color: '#9C27B0',
    templates: [
      {
        id: 'care-gap',
        title: 'Care Gap Alert',
        description: 'Identify and close care gaps',
        hook: 'patient-view',
        conditions: [
          { field: 'has_condition', operator: 'contains', value: 'Chronic' }
        ],
        cards: [{
          summary: 'Care Gap Identified',
          detail: 'Patient has not received recommended care for chronic condition.',
          indicator: 'warning',
          suggestions: [{ label: 'Schedule Follow-up', type: 'create' }]
        }]
      }
    ]
  }
};

/**
 * Helper functions
 */
const generateUniqueId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const filterTemplates = (templates: HookTemplate[], searchTerm: string): HookTemplate[] => {
  if (!searchTerm) return templates;
  
  const term = searchTerm.toLowerCase();
  return templates.filter(template => 
    template.title.toLowerCase().includes(term) ||
    template.description.toLowerCase().includes(term)
  );
};

const createTemplateWithIds = (template: HookTemplate): HookTemplate => {
  return {
    ...template,
    conditions: template.conditions.map(c => ({
      ...c,
      id: generateUniqueId()
    })),
    cards: template.cards.map(c => ({
      ...c,
      id: generateUniqueId()
    }))
  };
};

const getAllTemplates = (categoryFilter?: TemplateCategory | null): HookTemplate[] => {
  if (categoryFilter) {
    return HOOK_TEMPLATES[categoryFilter].templates;
  }
  
  return Object.values(HOOK_TEMPLATES).flatMap(category => category.templates);
};

const hasMatchingTemplates = (searchTerm: string, categoryFilter?: TemplateCategory | null): boolean => {
  const templates = getAllTemplates(categoryFilter);
  return filterTemplates(templates, searchTerm).length > 0;
};

/**
 * HookTemplateSelector Component
 */
const HookTemplateSelector: React.FC<HookTemplateSelectorProps> = ({ 
  onSelectTemplate, 
  onClose,
  sx 
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | null>(null);

  const handleSelectTemplate = (template: HookTemplate): void => {
    const templateWithIds = createTemplateWithIds(template);
    onSelectTemplate(templateWithIds);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setSearchTerm(event.target.value);
  };

  const handleCategorySelect = (category: TemplateCategory | null): void => {
    setSelectedCategory(category);
  };

  const handleClose = (): void => {
    if (onClose) {
      onClose();
    }
  };

  const categoriesToShow = selectedCategory 
    ? { [selectedCategory]: HOOK_TEMPLATES[selectedCategory] }
    : HOOK_TEMPLATES;

  const hasResults = hasMatchingTemplates(searchTerm, selectedCategory);

  return (
    <Box sx={sx}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6">Select a Template</Typography>
        {onClose && (
          <IconButton onClick={handleClose} size="small" aria-label="Close template selector">
            <CloseIcon />
          </IconButton>
        )}
      </Box>

      <TextField
        fullWidth
        placeholder="Search templates..."
        value={searchTerm}
        onChange={handleSearchChange}
        sx={{ mb: 3 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          )
        }}
      />

      {/* Category Chips */}
      <Stack direction="row" spacing={1} sx={{ mb: 3 }} flexWrap="wrap">
        <Chip
          label="All"
          onClick={() => handleCategorySelect(null)}
          color={selectedCategory === null ? 'primary' : 'default'}
        />
        {(Object.entries(HOOK_TEMPLATES) as Array<[TemplateCategory, TemplateCategory]>).map(([key, category]) => (
          <Chip
            key={key}
            icon={category.icon}
            label={category.label}
            onClick={() => handleCategorySelect(key)}
            color={selectedCategory === key ? 'primary' : 'default'}
          />
        ))}
      </Stack>

      {/* Templates Grid */}
      <Grid container spacing={2}>
        {Object.entries(categoriesToShow).map(([categoryKey, category]) => 
          filterTemplates(category.templates, searchTerm).map((template: HookTemplate) => (
            <Grid item xs={12} md={6} key={template.id}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <Box color={category.color}>
                      {category.icon}
                    </Box>
                    <Typography variant="h6">
                      {template.title}
                    </Typography>
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" paragraph>
                    {template.description}
                  </Typography>
                  
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip label={template.hook} size="small" />
                    <Chip 
                      label={`${template.conditions.length} condition${template.conditions.length !== 1 ? 's' : ''}`} 
                      size="small" 
                    />
                    <Chip 
                      label={`${template.cards.length} card${template.cards.length !== 1 ? 's' : ''}`} 
                      size="small" 
                    />
                  </Stack>
                </CardContent>
                
                <CardActions>
                  <Button 
                    size="small" 
                    onClick={() => handleSelectTemplate(template)}
                    aria-label={`Use ${template.title} template`}
                  >
                    Use Template
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))
        )}
      </Grid>

      {!hasResults && (
        <Box textAlign="center" py={4}>
          <Typography color="text.secondary">
            No templates found matching "{searchTerm}"
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default HookTemplateSelector;