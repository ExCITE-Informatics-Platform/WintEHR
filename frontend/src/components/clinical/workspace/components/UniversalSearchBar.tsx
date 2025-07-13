/**
 * Universal Search Bar Component
 * Provides unified search across all clinical resources
 * 
 * Migrated to TypeScript with comprehensive type safety for universal clinical search.
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  TextField,
  Autocomplete,
  Paper,
  Typography,
  Chip,
  Stack,
  CircularProgress,
  Divider,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  SxProps,
  Theme,
} from '@mui/material';
import {
  Search as SearchIcon,
  Medication as MedicationIcon,
  Assignment as ProblemIcon,
  Warning as AllergyIcon,
  Science as LabIcon,
  CameraAlt as ImagingIcon,
  Close as CloseIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { debounce } from 'lodash';
import { searchService } from '../../../../services/searchService';

/**
 * Type definitions for UniversalSearchBar component
 */
export type ResourceType = 'conditions' | 'medications' | 'labTests' | 'imagingProcedures';
export type ResourceColor = 'warning' | 'primary' | 'info' | 'secondary';

export interface SearchResult {
  id?: string;
  display?: string;
  name?: string;
  code?: string;
  system?: string;
  description?: string;
  category?: string;
}

export interface SearchResultWithType extends SearchResult {
  resourceType: ResourceType;
}

export interface SearchResults {
  [key: string]: SearchResult[];
}

export interface ResourceConfig {
  label: string;
  icon: React.ComponentType<any>;
  color: ResourceColor;
}

export interface UniversalSearchBarProps {
  placeholder?: string;
  onResultSelect?: (result: SearchResult, resourceType: ResourceType) => void;
  onAddToPatient?: (result: SearchResultWithType, resourceType: ResourceType) => Promise<void>;
  patientId?: string;
  compact?: boolean;
  sx?: SxProps<Theme>;
}

export interface SearchServiceResponse {
  conditions?: SearchResult[];
  medications?: SearchResult[];
  labTests?: SearchResult[];
  imagingProcedures?: SearchResult[];
}

/**
 * Constants
 */
const RESOURCE_TYPES: Record<ResourceType, ResourceConfig> = {
  conditions: { label: 'Problems', icon: ProblemIcon, color: 'warning' },
  medications: { label: 'Medications', icon: MedicationIcon, color: 'primary' },
  labTests: { label: 'Lab Tests', icon: LabIcon, color: 'info' },
  imagingProcedures: { label: 'Imaging', icon: ImagingIcon, color: 'secondary' }
};

const DEFAULT_PLACEHOLDER = "Search conditions, medications, lab tests, imaging...";
const MIN_SEARCH_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 300;
const MAX_RESULTS_HEIGHT = 400;

/**
 * Helper functions
 */
const getTotalResults = (searchResults: SearchResults): number => {
  return Object.values(searchResults).reduce((total, results) => total + (results?.length || 0), 0);
};

const getResourceLabel = (resourceType: ResourceType): string => {
  return RESOURCE_TYPES[resourceType]?.label || resourceType;
};

const getResourceIcon = (resourceType: ResourceType): React.ComponentType<any> => {
  return RESOURCE_TYPES[resourceType]?.icon || SearchIcon;
};

const getResourceColor = (resourceType: ResourceType): ResourceColor => {
  return RESOURCE_TYPES[resourceType]?.color || 'primary';
};

const extractSystemName = (system: string): string => {
  return system.split('/').pop() || system;
};

const isValidResourceType = (type: string): type is ResourceType => {
  return Object.keys(RESOURCE_TYPES).includes(type);
};

/**
 * UniversalSearchBar Component
 */
const UniversalSearchBar: React.FC<UniversalSearchBarProps> = ({ 
  placeholder = DEFAULT_PLACEHOLDER,
  onResultSelect,
  onAddToPatient,
  patientId,
  compact = false,
  sx
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchResults>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [selectedResult, setSelectedResult] = useState<SearchResultWithType | null>(null);
  const [showAddDialog, setShowAddDialog] = useState<boolean>(false);
  const [addingToPatient, setAddingToPatient] = useState<boolean>(false);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (query: string): Promise<void> => {
      if (!query || query.length < MIN_SEARCH_LENGTH) {
        setSearchResults({});
        setShowResults(false);
        return;
      }

      setLoading(true);
      try {
        const results: SearchServiceResponse = await searchService.searchAll(query, 5);
        setSearchResults(results);
        setShowResults(true);
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults({});
      } finally {
        setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS),
    []
  );

  const handleInputChange = (event: React.SyntheticEvent, value: string): void => {
    setSearchQuery(value);
    debouncedSearch(value);
  };

  const handleResultClick = (result: SearchResult, resourceType: ResourceType): void => {
    const resultWithType: SearchResultWithType = { ...result, resourceType };
    setSelectedResult(resultWithType);
    setShowResults(false);
    
    if (onResultSelect) {
      onResultSelect(result, resourceType);
    }
  };

  const handleAddToPatient = (result: SearchResult, resourceType: ResourceType): void => {
    const resultWithType: SearchResultWithType = { ...result, resourceType };
    setSelectedResult(resultWithType);
    setShowAddDialog(true);
    setShowResults(false);
  };

  const handleConfirmAdd = async (): Promise<void> => {
    if (selectedResult && onAddToPatient) {
      setAddingToPatient(true);
      try {
        await onAddToPatient(selectedResult, selectedResult.resourceType);
        setShowAddDialog(false);
        setSelectedResult(null);
        setSearchQuery('');
      } catch (error) {
        console.error('Error adding to patient:', error);
      } finally {
        setAddingToPatient(false);
      }
    }
  };

  const handleCancelAdd = (): void => {
    setShowAddDialog(false);
    setSelectedResult(null);
  };

  const handleClearSearch = (): void => {
    setSearchQuery('');
    setShowResults(false);
    setSearchResults({});
  };

  const renderSearchResults = (): React.ReactNode => {
    const totalResults = getTotalResults(searchResults);
    
    if (loading) {
      return (
        <Paper sx={{ p: 2, mt: 1, textAlign: 'center' }}>
          <CircularProgress size={24} />
          <Typography variant="body2" sx={{ mt: 1 }}>
            Searching...
          </Typography>
        </Paper>
      );
    }

    if (totalResults === 0 && searchQuery.length >= MIN_SEARCH_LENGTH) {
      return (
        <Paper sx={{ p: 2, mt: 1, textAlign: 'center' }}>
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
      <Paper sx={{ mt: 1, maxHeight: MAX_RESULTS_HEIGHT, overflow: 'auto' }}>
        {Object.entries(searchResults).map(([resourceType, results]) => {
          if (!results || results.length === 0 || !isValidResourceType(resourceType)) return null;
          
          const resourceConfig = RESOURCE_TYPES[resourceType];
          const IconComponent = resourceConfig.icon;
          
          return (
            <Box key={resourceType}>
              <Box sx={{ p: 1, backgroundColor: 'grey.50', display: 'flex', alignItems: 'center', gap: 1 }}>
                <IconComponent fontSize="small" color={resourceConfig.color} />
                <Typography variant="subtitle2">
                  {resourceConfig.label} ({results.length})
                </Typography>
              </Box>
              
              {results.map((result: SearchResult, index: number) => (
                <ListItem
                  key={`${resourceType}-${index}`}
                  component="div"
                  onClick={() => handleResultClick(result, resourceType)}
                  sx={{ py: 1, cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                >
                  <ListItemIcon>
                    <IconComponent fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={result.display || result.name}
                    secondary={
                      <Stack direction="row" spacing={1} alignItems="center">
                        {result.code && (
                          <Chip label={result.code} size="small" variant="outlined" />
                        )}
                        {result.system && (
                          <Typography variant="caption" color="text.secondary">
                            {extractSystemName(result.system)}
                          </Typography>
                        )}
                      </Stack>
                    }
                  />
                  {patientId && onAddToPatient && (
                    <ListItemSecondaryAction>
                      <Tooltip title="Add to Patient">
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            handleAddToPatient(result, resourceType);
                          }}
                          aria-label={`Add ${result.display || result.name} to patient`}
                        >
                          <AddIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </ListItemSecondaryAction>
                  )}
                </ListItem>
              ))}
              
              <Divider />
            </Box>
          );
        })}
      </Paper>
    );
  };

  const renderAddConfirmationDialog = (): React.ReactNode => (
    <Dialog open={showAddDialog} onClose={handleCancelAdd}>
      <DialogTitle>Add to Patient Record</DialogTitle>
      <DialogContent>
        {selectedResult && (
          <Box>
            <Typography variant="body1" gutterBottom>
              Are you sure you want to add this {getResourceLabel(selectedResult.resourceType).toLowerCase().slice(0, -1)} to the patient record?
            </Typography>
            <Paper sx={{ p: 2, mt: 2, backgroundColor: 'grey.50' }}>
              <Stack direction="row" spacing={1} alignItems="center">
                {React.createElement(
                  getResourceIcon(selectedResult.resourceType),
                  { 
                    fontSize: 'small', 
                    color: getResourceColor(selectedResult.resourceType)
                  }
                )}
                <Typography variant="subtitle1">
                  {selectedResult.display || selectedResult.name}
                </Typography>
              </Stack>
              {selectedResult.code && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Code: {selectedResult.code}
                </Typography>
              )}
              {selectedResult.description && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {selectedResult.description}
                </Typography>
              )}
            </Paper>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancelAdd} disabled={addingToPatient}>
          Cancel
        </Button>
        <Button 
          onClick={handleConfirmAdd} 
          variant="contained"
          disabled={addingToPatient}
          startIcon={addingToPatient ? <CircularProgress size={16} /> : undefined}
        >
          {addingToPatient ? 'Adding...' : 'Add to Patient'}
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Box sx={{ position: 'relative', width: '100%', ...sx }}>
      <Autocomplete
        freeSolo
        open={false} // Disable default dropdown, use custom
        inputValue={searchQuery}
        onInputChange={handleInputChange}
        options={[]} // No options needed since we're using custom dropdown
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder={placeholder}
            variant="outlined"
            size={compact ? "small" : "medium"}
            fullWidth
            InputProps={{
              ...params.InputProps,
              startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
              endAdornment: loading ? (
                <CircularProgress size={20} />
              ) : searchQuery && (
                <IconButton
                  size="small"
                  onClick={handleClearSearch}
                  aria-label="Clear search"
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              ),
            }}
          />
        )}
      />
      
      {showResults && renderSearchResults()}
      
      {/* Add to Patient Confirmation Dialog */}
      {renderAddConfirmationDialog()}
    </Box>
  );
};

export default UniversalSearchBar;