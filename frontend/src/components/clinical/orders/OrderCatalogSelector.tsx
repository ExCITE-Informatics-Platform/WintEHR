/**
 * Order Catalog Selector Component
 * Searchable dropdown for medications, labs, and imaging
 * 
 * Migrated to TypeScript with comprehensive type safety for order catalog management.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Autocomplete,
  Chip,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Alert,
  SelectChangeEvent,
  SxProps,
  Theme,
} from '@mui/material';
import {
  LocalPharmacy as MedicationIcon,
  Science as LabIcon,
  Camera as ImagingIcon,
} from '@mui/icons-material';
import api from '../../../services/api';

/**
 * Type definitions for OrderCatalogSelector component
 */
export type OrderType = 'medication' | 'lab' | 'imaging';

export interface MedicationOption {
  id: string;
  generic_name: string;
  brand_name?: string;
  strength: string;
  drug_class: string;
  dosage_form: string;
  route: string;
  is_controlled_substance?: boolean;
  controlled_substance_schedule?: string;
  requires_authorization?: boolean;
  formulary_status?: string;
}

export interface LabTestOption {
  id: string;
  test_name: string;
  test_code?: string;
  test_category: string;
  specimen_type: string;
  fasting_required?: boolean;
  typical_turnaround_time: string;
  stat_available?: boolean;
  loinc_code?: string;
}

export interface ImagingStudyOption {
  id: string;
  study_name: string;
  modality: string;
  body_part: string;
  study_type: string;
  contrast_required?: boolean;
  typical_duration: string;
  cpt_code?: string;
}

export type OrderCatalogOption = MedicationOption | LabTestOption | ImagingStudyOption;

export interface MedicationFilters {
  drug_class?: string;
  formulary_only?: boolean;
}

export interface LabTestFilters {
  category?: string;
  stat_only?: boolean;
}

export interface ImagingFilters {
  modality?: string;
  body_part?: string;
}

export type OrderFilters = MedicationFilters | LabTestFilters | ImagingFilters;

export interface AvailableFilters {
  drug_classes?: string[];
  test_categories?: string[];
  modalities?: string[];
}

export interface OrderCatalogSelectorProps {
  orderType: OrderType | null;
  onSelect: (option: OrderCatalogOption | null) => void;
  value?: OrderCatalogOption | null;
  sx?: SxProps<Theme>;
  disabled?: boolean;
  placeholder?: string;
}

export interface ApiSearchParams {
  search?: string;
  drug_class?: string;
  formulary_only?: boolean;
  category?: string;
  stat_only?: boolean;
  modality?: string;
  body_part?: string;
}

/**
 * Constants
 */
const ORDER_TYPE_ICONS = {
  medication: MedicationIcon,
  lab: LabIcon,
  imaging: ImagingIcon
} as const;

const ORDER_TYPE_LABELS = {
  medication: 'medications',
  lab: 'lab tests',
  imaging: 'imaging studies'
} as const;

const API_ENDPOINTS = {
  medication: '/api/catalogs/medications',
  lab: '/api/catalogs/lab-tests',
  imaging: '/api/catalogs/imaging-studies'
} as const;

const FILTER_ENDPOINTS = {
  medication: [{ key: 'drug_classes' as const, url: '/api/catalogs/drug-classes' }],
  lab: [{ key: 'test_categories' as const, url: '/api/catalogs/test-categories' }],
  imaging: [{ key: 'modalities' as const, url: '/api/catalogs/imaging-modalities' }]
} as const;

/**
 * Type guards
 */
const isMedicationOption = (option: OrderCatalogOption): option is MedicationOption => {
  return 'generic_name' in option;
};

const isLabTestOption = (option: OrderCatalogOption): option is LabTestOption => {
  return 'test_name' in option;
};

const isImagingStudyOption = (option: OrderCatalogOption): option is ImagingStudyOption => {
  return 'study_name' in option;
};

/**
 * Helper functions
 */
const getOptionLabel = (option: OrderCatalogOption, orderType: OrderType): string => {
  switch (orderType) {
    case 'medication':
      if (isMedicationOption(option)) {
        return `${option.generic_name}${option.brand_name ? ` (${option.brand_name})` : ''} ${option.strength}`;
      }
      break;
    case 'lab':
      if (isLabTestOption(option)) {
        return `${option.test_name}${option.test_code ? ` (${option.test_code})` : ''}`;
      }
      break;
    case 'imaging':
      if (isImagingStudyOption(option)) {
        return `${option.study_name} - ${option.modality}`;
      }
      break;
  }
  return 'name' in option ? (option as any).name || '' : '';
};

const buildSearchParams = (orderType: OrderType, searchTerm: string, filters: OrderFilters): ApiSearchParams => {
  const params: ApiSearchParams = { search: searchTerm };

  switch (orderType) {
    case 'medication':
      const medFilters = filters as MedicationFilters;
      if (medFilters.drug_class) params.drug_class = medFilters.drug_class;
      if (medFilters.formulary_only !== undefined) params.formulary_only = medFilters.formulary_only;
      break;
    case 'lab':
      const labFilters = filters as LabTestFilters;
      if (labFilters.category) params.category = labFilters.category;
      if (labFilters.stat_only) params.stat_only = labFilters.stat_only;
      break;
    case 'imaging':
      const imagingFilters = filters as ImagingFilters;
      if (imagingFilters.modality) params.modality = imagingFilters.modality;
      if (imagingFilters.body_part) params.body_part = imagingFilters.body_part;
      break;
  }

  return params;
};

/**
 * OrderCatalogSelector Component
 */
const OrderCatalogSelector: React.FC<OrderCatalogSelectorProps> = ({
  orderType,
  onSelect,
  value,
  sx,
  disabled = false,
  placeholder
}) => {
  const [options, setOptions] = useState<OrderCatalogOption[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filters, setFilters] = useState<OrderFilters>({});
  const [availableFilters, setAvailableFilters] = useState<AvailableFilters>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (orderType) {
      loadOptions();
      loadFilters();
    }
  }, [orderType, searchTerm, filters]);

  const loadOptions = async (): Promise<void> => {
    if (!orderType) return;

    setLoading(true);
    setError(null);

    try {
      const endpoint = API_ENDPOINTS[orderType];
      const params = buildSearchParams(orderType, searchTerm, filters);

      const response = await api.get(endpoint, { params });
      setOptions(response.data || []);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load catalog options';
      setError(errorMessage);
      console.error('Error loading options:', error);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  };

  const loadFilters = async (): Promise<void> => {
    if (!orderType) return;

    try {
      const endpoints = FILTER_ENDPOINTS[orderType];
      const filterData: AvailableFilters = {};

      for (const endpoint of endpoints) {
        const response = await api.get(endpoint.url);
        filterData[endpoint.key] = response.data || [];
      }

      setAvailableFilters(filterData);
    } catch (error) {
      console.error('Error loading filters:', error);
    }
  };

  const getOptionDetails = (option: OrderCatalogOption): React.ReactNode => {
    if (!orderType) return null;

    switch (orderType) {
      case 'medication':
        if (isMedicationOption(option)) {
          return (
            <Box>
              <Typography variant="body2" color="text.secondary">
                {option.drug_class} • {option.dosage_form} • {option.route}
              </Typography>
              {option.is_controlled_substance && (
                <Chip 
                  label={`Schedule ${option.controlled_substance_schedule}`} 
                  size="small" 
                  color="warning" 
                  sx={{ mr: 1, mt: 0.5 }}
                />
              )}
              {option.requires_authorization && (
                <Chip 
                  label="Prior Auth Required" 
                  size="small" 
                  color="error" 
                  sx={{ mt: 0.5 }}
                />
              )}
            </Box>
          );
        }
        break;
      case 'lab':
        if (isLabTestOption(option)) {
          return (
            <Box>
              <Typography variant="body2" color="text.secondary">
                {option.test_category} • {option.specimen_type}
                {option.fasting_required && ' • Fasting Required'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Turnaround: {option.typical_turnaround_time}
              </Typography>
            </Box>
          );
        }
        break;
      case 'imaging':
        if (isImagingStudyOption(option)) {
          return (
            <Box>
              <Typography variant="body2" color="text.secondary">
                {option.body_part} • {option.study_type}
                {option.contrast_required && ' • Contrast Required'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Duration: {option.typical_duration}
              </Typography>
            </Box>
          );
        }
        break;
    }
    return null;
  };

  const getIcon = (): React.ReactNode => {
    if (!orderType) return null;
    
    const IconComponent = ORDER_TYPE_ICONS[orderType];
    const colorMap = {
      medication: 'primary' as const,
      lab: 'secondary' as const,
      imaging: 'info' as const
    };
    
    return <IconComponent color={colorMap[orderType]} />;
  };

  const handleFilterChange = (key: string, value: any): void => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setSearchTerm(event.target.value);
  };

  const handleSelectionChange = (event: React.SyntheticEvent, newValue: OrderCatalogOption | null): void => {
    onSelect(newValue);
  };

  const renderFilters = (): React.ReactNode => {
    if (!orderType) return null;

    switch (orderType) {
      case 'medication':
        const medFilters = filters as MedicationFilters;
        return (
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Drug Class</InputLabel>
                <Select
                  value={medFilters.drug_class || ''}
                  label="Drug Class"
                  onChange={(e: SelectChangeEvent) => 
                    handleFilterChange('drug_class', e.target.value)
                  }
                >
                  <MenuItem value="">All Classes</MenuItem>
                  {availableFilters.drug_classes?.map((cls: string) => (
                    <MenuItem key={cls} value={cls}>{cls}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Formulary</InputLabel>
                <Select
                  value={medFilters.formulary_only !== undefined ? medFilters.formulary_only : true}
                  label="Formulary"
                  onChange={(e: SelectChangeEvent) => 
                    handleFilterChange('formulary_only', e.target.value)
                  }
                >
                  <MenuItem value={true as any}>Formulary Only</MenuItem>
                  <MenuItem value={false as any}>All Medications</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        );

      case 'lab':
        const labFilters = filters as LabTestFilters;
        return (
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Category</InputLabel>
                <Select
                  value={labFilters.category || ''}
                  label="Category"
                  onChange={(e: SelectChangeEvent) => 
                    handleFilterChange('category', e.target.value)
                  }
                >
                  <MenuItem value="">All Categories</MenuItem>
                  {availableFilters.test_categories?.map((cat: string) => (
                    <MenuItem key={cat} value={cat}>{cat}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Urgency</InputLabel>
                <Select
                  value={labFilters.stat_only || false}
                  label="Urgency"
                  onChange={(e: SelectChangeEvent) => 
                    handleFilterChange('stat_only', e.target.value)
                  }
                >
                  <MenuItem value={false as any}>All Tests</MenuItem>
                  <MenuItem value={true as any}>STAT Available Only</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        );

      case 'imaging':
        const imagingFilters = filters as ImagingFilters;
        return (
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Modality</InputLabel>
                <Select
                  value={imagingFilters.modality || ''}
                  label="Modality"
                  onChange={(e: SelectChangeEvent) => 
                    handleFilterChange('modality', e.target.value)
                  }
                >
                  <MenuItem value="">All Modalities</MenuItem>
                  {availableFilters.modalities?.map((mod: string) => (
                    <MenuItem key={mod} value={mod}>{mod}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        );

      default:
        return null;
    }
  };

  if (!orderType) {
    return (
      <Alert severity="info" sx={sx}>
        Please select an order type to choose from the catalog.
      </Alert>
    );
  }

  return (
    <Box sx={sx}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {renderFilters()}
      
      <Autocomplete
        options={options}
        value={value || null}
        loading={loading}
        disabled={disabled}
        getOptionLabel={(option) => getOptionLabel(option, orderType)}
        onChange={handleSelectionChange}
        renderInput={(params) => (
          <TextField
            {...params}
            label={placeholder || `Search ${ORDER_TYPE_LABELS[orderType]}`}
            variant="outlined"
            fullWidth
            onChange={handleSearchChange}
            InputProps={{
              ...params.InputProps,
              startAdornment: (
                <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
                  {getIcon()}
                </Box>
              ),
            }}
          />
        )}
        renderOption={(props, option) => (
          <Box component="li" {...props}>
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              <Box sx={{ mr: 2 }}>
                {getIcon()}
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body1">
                  {getOptionLabel(option, orderType)}
                </Typography>
                {getOptionDetails(option)}
              </Box>
            </Box>
          </Box>
        )}
        noOptionsText={searchTerm ? "No matching items found" : "Start typing to search..."}
        filterOptions={(x) => x} // We handle filtering on the server
        isOptionEqualToValue={(option, value) => option.id === value?.id}
      />
    </Box>
  );
};

export default OrderCatalogSelector;