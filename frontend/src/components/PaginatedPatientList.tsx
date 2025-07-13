/**
 * Paginated Patient List Component
 * Displays patients in a paginated table with search and filtering capabilities
 * 
 * Migrated to TypeScript with comprehensive type safety for patient data management.
 */

import React, { useState, useEffect, useCallback, ChangeEvent, MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  Alert,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  Tabs,
  Tab,
  Badge,
  Tooltip,
  CircularProgress,
  TablePagination,
  LinearProgress,
  Stack,
  SxProps,
  Theme,
} from '@mui/material';
import {
  Search as SearchIcon,
  Add as AddIcon,
  Refresh as RefreshIcon,
  People as PeopleIcon,
  PersonSearch as PersonSearchIcon,
  Download as DownloadIcon,
  ViewList as ViewListIcon,
  GridView as GridViewIcon,
} from '@mui/icons-material';
import { DataGrid, GridColDef, GridRowParams, GridRenderCellParams } from '@mui/x-data-grid';
import { format } from 'date-fns';
import { R4 } from '@ahryman40k/ts-fhir-types';
import { fhirClient } from '../services/fhirClient';
import PatientForm, { PatientFormSubmissionData } from './PatientForm';
import { getPatientDetailUrl } from '../utils/navigationUtils';
import { debounce } from 'lodash';

/**
 * Type definitions for PaginatedPatientList component
 */
export interface PatientData {
  id: string;
  mrn?: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  gender?: string;
  phone?: string;
  email?: string;
  insurance_name?: string;
  last_encounter?: string;
  status?: 'active' | 'inactive';
}

export interface PaginatedPatientListProps {
  sx?: SxProps<Theme>;
  defaultPageSize?: number;
  showMyPatients?: boolean;
  onPatientSelect?: (patient: PatientData) => void;
}

export type ViewMode = 'grid' | 'list';
export type PatientTab = 0 | 1; // 0: My Patients, 1: All Patients

export interface SearchParams {
  name?: string;
  identifier?: string;
  _count?: number;
  _offset?: number;
  _sort?: string;
}

/**
 * Constants
 */
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;

/**
 * PaginatedPatientList Component
 */
const PaginatedPatientList: React.FC<PaginatedPatientListProps> = ({
  sx,
  defaultPageSize = DEFAULT_PAGE_SIZE,
  showMyPatients = true,
  onPatientSelect
}) => {
  const navigate = useNavigate();
  
  // Data state
  const [patients, setPatients] = useState<PatientData[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination state
  const [page, setPage] = useState<number>(0);
  const [pageSize, setPageSize] = useState<number>(defaultPageSize);
  
  // Search state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [searchLoading, setSearchLoading] = useState<boolean>(false);
  
  // UI state
  const [openNewPatient, setOpenNewPatient] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<PatientTab>(1); // 0: My Patients, 1: All Patients
  const [myPatientsCount, setMyPatientsCount] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Column definitions for DataGrid
  const columns: GridColDef[] = [
    {
      field: 'mrn',
      headerName: 'MRN',
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Chip
          label={params.value || 'N/A'}
          size="small"
          variant="outlined"
          color="primary"
        />
      ),
    },
    {
      field: 'name',
      headerName: 'Name',
      width: 200,
      valueGetter: (params) => 
        `${params.row.last_name}, ${params.row.first_name}`,
    },
    {
      field: 'date_of_birth',
      headerName: 'Date of Birth',
      width: 120,
      renderCell: (params: GridRenderCellParams) => {
        if (!params.value) return 'Unknown';
        try {
          const birthDate = new Date(params.value as string);
          const age = new Date().getFullYear() - birthDate.getFullYear();
          return (
            <Box>
              <Typography variant="body2">
                {format(birthDate, 'MM/dd/yyyy')}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {age} years
              </Typography>
            </Box>
          );
        } catch (error) {
          return 'Invalid Date';
        }
      },
    },
    {
      field: 'gender',
      headerName: 'Gender',
      width: 100,
      renderCell: (params: GridRenderCellParams) => {
        const gender = params.value as string;
        return (
          <Chip
            label={gender?.charAt(0).toUpperCase() + gender?.slice(1) || 'Unknown'}
            size="small"
            color={gender === 'male' ? 'info' : gender === 'female' ? 'secondary' : 'default'}
          />
        );
      },
    },
    {
      field: 'phone',
      headerName: 'Phone',
      width: 140,
    },
    {
      field: 'insurance_name',
      headerName: 'Insurance',
      width: 180,
      renderCell: (params: GridRenderCellParams) => params.value || 'Not Available',
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Button
          variant="contained"
          size="small"
          onClick={() => handlePatientClick(params.row as PatientData)}
        >
          View
        </Button>
      ),
    },
  ];

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (term: string) => {
      if (term.length >= 2) {
        setSearchLoading(true);
        await fetchPatients(0, pageSize, term);
        setSearchLoading(false);
      } else if (term.length === 0) {
        setSearchLoading(true);
        await fetchPatients(0, pageSize);
        setSearchLoading(false);
      }
    }, 300),
    [pageSize]
  );

  // Fetch patients data
  const fetchPatients = useCallback(async (
    pageNum: number = 0, 
    size: number = pageSize, 
    search: string = ''
  ): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const searchParams: SearchParams = {
        _count: size,
        _offset: pageNum * size,
        _sort: 'family'
      };

      if (search.trim()) {
        searchParams.name = search.trim();
      }

      const response = await fhirClient.searchPatients(searchParams);
      
      const transformedPatients: PatientData[] = (response.resources || []).map((patient: R4.IPatient) => {
        const name = patient.name?.[0] || {};
        const mrn = patient.identifier?.find(id => 
          id.type?.coding?.[0]?.code === 'MR' || 
          id.system?.includes('mrn')
        )?.value || patient.identifier?.[0]?.value;

        const phone = patient.telecom?.find(t => t.system === 'phone')?.value;
        const email = patient.telecom?.find(t => t.system === 'email')?.value;

        return {
          id: patient.id || '',
          mrn,
          first_name: name.given?.join(' ') || '',
          last_name: name.family || '',
          date_of_birth: patient.birthDate,
          gender: patient.gender,
          phone,
          email,
          insurance_name: undefined, // Would need to be fetched from Coverage resources
          status: patient.active ? 'active' : 'inactive'
        };
      });

      setPatients(transformedPatients);
      setTotalCount(response.total || transformedPatients.length);
      setPage(pageNum);
    } catch (err) {
      console.error('Error fetching patients:', err);
      setError(err instanceof Error ? err.message : 'Failed to load patients');
      setPatients([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [pageSize]);

  // Initial load
  useEffect(() => {
    fetchPatients();
  }, []);

  // Handle search input
  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const value = event.target.value;
    setSearchTerm(value);
    debouncedSearch(value);
  };

  // Handle page change
  const handlePageChange = (event: unknown, newPage: number): void => {
    fetchPatients(newPage, pageSize, searchTerm);
  };

  // Handle page size change
  const handlePageSizeChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const newSize = parseInt(event.target.value, 10);
    setPageSize(newSize);
    fetchPatients(0, newSize, searchTerm);
  };

  // Handle tab change
  const handleTabChange = (event: React.SyntheticEvent, newValue: PatientTab): void => {
    setActiveTab(newValue);
    // TODO: Implement filtering by "My Patients" vs "All Patients"
    // This would require additional API support or user context
  };

  // Handle patient click
  const handlePatientClick = (patient: PatientData): void => {
    if (onPatientSelect) {
      onPatientSelect(patient);
    } else {
      navigate(getPatientDetailUrl(patient.id));
    }
  };

  // Handle new patient creation
  const handleNewPatient = async (data: PatientFormSubmissionData): Promise<void> => {
    try {
      // Transform form data to FHIR Patient resource
      const patientResource: Partial<R4.IPatient> = {
        resourceType: 'Patient',
        name: [{
          family: data.last_name,
          given: [data.first_name]
        }],
        birthDate: data.date_of_birth,
        gender: data.gender as R4.PatientGenderKind,
        telecom: [
          ...(data.phone ? [{ system: 'phone' as const, value: data.phone }] : []),
          ...(data.email ? [{ system: 'email' as const, value: data.email }] : [])
        ],
        address: data.address ? [{
          line: [data.address],
          city: data.city,
          state: data.state,
          postalCode: data.zip_code
        }] : undefined,
        active: true
      };

      await fhirClient.createResource('Patient', patientResource);
      setOpenNewPatient(false);
      
      // Refresh the patient list
      await fetchPatients(page, pageSize, searchTerm);
    } catch (err) {
      console.error('Error creating patient:', err);
      setError(err instanceof Error ? err.message : 'Failed to create patient');
    }
  };

  // Handle refresh
  const handleRefresh = (): void => {
    setIsRefreshing(true);
    fetchPatients(page, pageSize, searchTerm);
  };

  // Handle view mode toggle
  const handleViewModeChange = (): void => {
    setViewMode(prev => prev === 'grid' ? 'list' : 'grid');
  };

  // Handle export
  const handleExport = (): void => {
    // TODO: Implement patient list export functionality
    console.log('Export functionality would be implemented here');
  };

  return (
    <Box sx={sx}>
      <Paper sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <PeopleIcon color="primary" sx={{ fontSize: 32 }} />
            <Typography variant="h4" fontWeight={600}>
              Patients
            </Typography>
            <Chip
              label={`${totalCount} Total`}
              color="primary"
              variant="outlined"
            />
          </Box>
          
          <Stack direction="row" spacing={1}>
            <Tooltip title="Refresh">
              <IconButton onClick={handleRefresh} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            
            <Tooltip title="Export">
              <IconButton onClick={handleExport} disabled={loading}>
                <DownloadIcon />
              </IconButton>
            </Tooltip>
            
            <Tooltip title={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}>
              <IconButton onClick={handleViewModeChange}>
                {viewMode === 'grid' ? <ViewListIcon /> : <GridViewIcon />}
              </IconButton>
            </Tooltip>
            
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setOpenNewPatient(true)}
            >
              New Patient
            </Button>
          </Stack>
        </Box>

        {/* Tabs */}
        {showMyPatients && (
          <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 2 }}>
            <Tab
              icon={<Badge badgeContent={myPatientsCount} color="primary"><PersonSearchIcon /></Badge>}
              label="My Patients"
            />
            <Tab
              icon={<PeopleIcon />}
              label="All Patients"
            />
          </Tabs>
        )}

        {/* Search */}
        <TextField
          fullWidth
          placeholder="Search patients by name, MRN, or phone..."
          value={searchTerm}
          onChange={handleSearchChange}
          sx={{ mb: 3 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
            endAdornment: searchLoading && (
              <InputAdornment position="end">
                <CircularProgress size={20} />
              </InputAdornment>
            )
          }}
        />

        {/* Loading Progress */}
        {(loading || isRefreshing) && <LinearProgress sx={{ mb: 2 }} />}

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Data Grid */}
        <Box sx={{ height: 600, width: '100%' }}>
          <DataGrid
            rows={patients}
            columns={columns}
            loading={loading}
            hideFooter
            disableRowSelectionOnClick
            onRowClick={(params: GridRowParams) => handlePatientClick(params.row as PatientData)}
            sx={{
              '& .MuiDataGrid-row': {
                cursor: 'pointer'
              }
            }}
          />
        </Box>

        {/* Pagination */}
        <TablePagination
          component="div"
          count={totalCount}
          page={page}
          onPageChange={handlePageChange}
          rowsPerPage={pageSize}
          onRowsPerPageChange={handlePageSizeChange}
          rowsPerPageOptions={PAGE_SIZE_OPTIONS}
          sx={{ mt: 2 }}
        />
      </Paper>

      {/* New Patient Dialog */}
      <PatientForm
        open={openNewPatient}
        onClose={() => setOpenNewPatient(false)}
        onSubmit={handleNewPatient}
      />
    </Box>
  );
};

export default PaginatedPatientList;