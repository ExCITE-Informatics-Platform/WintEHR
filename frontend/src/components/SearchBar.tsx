/**
 * Main Application Search Bar Component
 * Provides global search functionality across patients and clinical resources
 * 
 * Migrated to TypeScript with comprehensive type safety for search functionality.
 */

import React, { useState, useCallback, ChangeEvent, FocusEvent, MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  InputBase,
  Paper,
  IconButton,
  Typography,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  alpha,
  Popper,
  ClickAwayListener,
  SxProps,
  Theme,
} from '@mui/material';
import {
  Search as SearchIcon,
  Person as PersonIcon,
  Close as CloseIcon,
  LocalHospital as HospitalIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material';
import { debounce } from 'lodash';
import { R4 } from '@ahryman40k/ts-fhir-types';
import { fhirClient } from '../services/fhirClient';
import { searchService } from '../services/searchService';
import { getPatientDetailUrl } from '../utils/navigationUtils';

/**
 * Type definitions for SearchBar component
 */
export interface SearchBarProps {
  compact?: boolean;
  sx?: SxProps<Theme>;
  placeholder?: string;
  onResultSelect?: (result: SearchResult) => void;
}

export interface PatientSearchResult {
  id: string;
  type: 'patient';
  display: string;
  secondary: string;
  resource: R4.IPatient;
}

export interface ResourceSearchResult {
  id?: string;
  type: 'resource';
  display?: string;
  name?: string;
  code?: string;
  resourceType: string;
}

export type SearchResult = PatientSearchResult | ResourceSearchResult;

export interface SearchResults {
  patients: PatientSearchResult[];
  resources: Record<string, ResourceSearchResult[]>;
}

export interface ResourceTypeConfig {
  label: string;
  icon: React.ComponentType<any>;
}

/**
 * SearchBar Component
 */
const SearchBar: React.FC<SearchBarProps> = ({ 
  compact = false, 
  sx,
  placeholder = "Search patients, conditions, medications...",
  onResultSelect
}) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchResults>({
    patients: [],
    resources: {}
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (query: string): Promise<void> => {
      if (!query || query.length < 2) {
        setSearchResults({ patients: [], resources: {} });
        setShowResults(false);
        return;
      }

      setLoading(true);
      try {
        // Search patients
        const patientResults = await fhirClient.searchPatients({
          name: query,
          _count: 5,
          _sort: '-_lastUpdated'
        });

        const transformedPatients: PatientSearchResult[] = patientResults.resources?.map((patient: R4.IPatient) => {
          const name = patient.name?.[0] || {};
          const mrn = patient.identifier?.find(id => 
            id.type?.coding?.[0]?.code === 'MR' || 
            id.system?.includes('mrn')
          )?.value || patient.identifier?.[0]?.value || '';

          const displayName = `${name.family || ''}, ${name.given?.join(' ') || ''}`.trim();

          return {
            id: patient.id || '',
            type: 'patient',
            display: displayName || 'Unknown Patient',
            secondary: `MRN: ${mrn} | DOB: ${patient.birthDate || 'Unknown'}`,
            resource: patient
          };
        }) || [];

        // Search clinical resources
        const resourceResults = await searchService.searchAll(query, 3);

        setSearchResults({
          patients: transformedPatients,
          resources: resourceResults
        });
        setShowResults(true);
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults({ patients: [], resources: {} });
      } finally {
        setLoading(false);
      }
    }, 300),
    []
  );

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const value = event.target.value;
    setSearchQuery(value);
    debouncedSearch(value);
    
    if (value && !showResults) {
      setShowResults(true);
    }
  };

  const handlePatientClick = (patient: PatientSearchResult): void => {
    navigate(getPatientDetailUrl(patient.id));
    setSearchQuery('');
    setShowResults(false);
    
    if (onResultSelect) {
      onResultSelect(patient);
    }
  };

  const handleResourceClick = (resource: ResourceSearchResult, resourceType: string): void => {
    // Navigate to appropriate page based on resource type
    switch (resourceType) {
      case 'medications':
        navigate('/medications');
        break;
      case 'conditions':
        navigate('/dashboard'); // or appropriate conditions page
        break;
      case 'labTests':
        navigate('/lab-results');
        break;
      case 'procedures':
        navigate('/dashboard'); // or appropriate procedures page
        break;
      default:
        break;
    }
    setSearchQuery('');
    setShowResults(false);
    
    if (onResultSelect) {
      onResultSelect(resource);
    }
  };

  const handleClear = (): void => {
    setSearchQuery('');
    setShowResults(false);
    setSearchResults({ patients: [], resources: {} });
  };

  const handleFocus = (event: FocusEvent<HTMLInputElement>): void => {
    setAnchorEl(event.currentTarget);
    if (searchQuery && searchQuery.length >= 2) {
      setShowResults(true);
    }
  };

  const handleClickAway = (): void => {
    setShowResults(false);
  };

  const getTotalResults = (): number => {
    const patientCount = searchResults.patients?.length || 0;
    const resourceCount = Object.values(searchResults.resources).reduce(
      (total, results) => total + (results?.length || 0), 0
    );
    return patientCount + resourceCount;
  };

  const renderPatientResults = (): JSX.Element | null => {
    if (!searchResults.patients?.length) return null;

    return (
      <Box>
        <Box sx={{ p: 1, backgroundColor: 'grey.50', display: 'flex', alignItems: 'center', gap: 1 }}>
          <PersonIcon fontSize="small" color="primary" />
          <Typography variant="subtitle2">
            Patients ({searchResults.patients.length})
          </Typography>
        </Box>
        {searchResults.patients.map((patient, index) => (
          <ListItem
            key={`patient-${index}`}
            button
            onClick={() => handlePatientClick(patient)}
            sx={{ py: 1 }}
          >
            <ListItemIcon>
              <PersonIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={patient.display}
              secondary={patient.secondary}
              primaryTypographyProps={{ fontSize: '0.875rem' }}
              secondaryTypographyProps={{ fontSize: '0.75rem' }}
            />
          </ListItem>
        ))}
        <Divider />
      </Box>
    );
  };

  const renderResourceResults = (): JSX.Element[] => {
    const resourceTypes: Record<string, ResourceTypeConfig> = {
      medications: { label: 'Medications', icon: HospitalIcon },
      conditions: { label: 'Conditions', icon: AssignmentIcon },
      labTests: { label: 'Lab Tests', icon: HospitalIcon },
      procedures: { label: 'Procedures', icon: AssignmentIcon }
    };

    return Object.entries(searchResults.resources).map(([resourceType, results]) => {
      if (!results || results.length === 0) return null;
      
      const config = resourceTypes[resourceType] || { label: resourceType, icon: AssignmentIcon };
      const IconComponent = config.icon;
      
      return (
        <Box key={resourceType}>
          <Box sx={{ p: 1, backgroundColor: 'grey.50', display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconComponent fontSize="small" color="secondary" />
            <Typography variant="subtitle2">
              {config.label} ({results.length})
            </Typography>
          </Box>
          
          {results.slice(0, 3).map((result, index) => (
            <ListItem
              key={`${resourceType}-${index}`}
              button
              onClick={() => handleResourceClick(result, resourceType)}
              sx={{ py: 1 }}
            >
              <ListItemIcon>
                <IconComponent fontSize="small" />
              </ListItemIcon>
              <ListItemText
                primary={result.display || result.name || 'Unknown'}
                secondary={result.code}
                primaryTypographyProps={{ fontSize: '0.875rem' }}
                secondaryTypographyProps={{ fontSize: '0.75rem' }}
              />
            </ListItem>
          ))}
          <Divider />
        </Box>
      );
    }).filter(Boolean) as JSX.Element[];
  };

  const renderSearchResults = (): JSX.Element | null => {
    const totalResults = getTotalResults();
    
    if (loading) {
      return (
        <Paper sx={{ p: 2, textAlign: 'center' }}>
          <CircularProgress size={24} />
          <Typography variant="body2" sx={{ mt: 1 }}>
            Searching...
          </Typography>
        </Paper>
      );
    }

    if (totalResults === 0 && searchQuery.length >= 2) {
      return (
        <Paper sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No results found for "{searchQuery}"
          </Typography>
        </Paper>
      );
    }

    if (totalResults === 0) {
      return null;
    }

    return (
      <Paper sx={{ maxHeight: 400, overflow: 'auto' }}>
        {renderPatientResults()}
        {renderResourceResults()}
      </Paper>
    );
  };

  const searchBarWidth = compact ? 300 : 400;

  return (
    <ClickAwayListener onClickAway={handleClickAway}>
      <Box sx={{ position: 'relative', width: searchBarWidth, ...sx }}>
        <Paper
          sx={{
            p: '2px 4px',
            display: 'flex',
            alignItems: 'center',
            backgroundColor: alpha('#000', 0.02),
            border: 1,
            borderColor: 'divider',
            '&:hover': {
              backgroundColor: alpha('#000', 0.04),
            },
            '&:focus-within': {
              backgroundColor: 'background.paper',
              boxShadow: 1,
            }
          }}
        >
          <SearchIcon sx={{ m: 1, color: 'text.secondary' }} />
          <InputBase
            sx={{ ml: 1, flex: 1 }}
            placeholder={placeholder}
            value={searchQuery}
            onChange={handleInputChange}
            onFocus={handleFocus}
            inputProps={{ 'aria-label': 'search' }}
          />
          {loading && <CircularProgress size={20} sx={{ mr: 1 }} />}
          {searchQuery && (
            <IconButton 
              type="button" 
              sx={{ p: '10px' }} 
              onClick={handleClear}
              size="small"
              aria-label="clear search"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Paper>
        
        <Popper
          open={showResults && Boolean(anchorEl)}
          anchorEl={anchorEl}
          placement="bottom-start"
          sx={{ 
            width: anchorEl?.offsetWidth || searchBarWidth,
            zIndex: 1300,
            mt: 1
          }}
        >
          {renderSearchResults()}
        </Popper>
      </Box>
    </ClickAwayListener>
  );
};

export default SearchBar;