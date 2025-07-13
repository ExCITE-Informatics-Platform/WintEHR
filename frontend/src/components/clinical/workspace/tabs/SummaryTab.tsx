/**
 * Summary Tab Component
 * Patient overview dashboard with key clinical information
 * 
 * Migrated to TypeScript with comprehensive type safety for clinical dashboard management.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  CardHeader,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Divider,
  Button,
  IconButton,
  Skeleton,
  Alert,
  LinearProgress,
  useTheme,
  alpha,
  SxProps,
  Theme,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Medication as MedicationIcon,
  Assignment as ProblemIcon,
  Science as LabIcon,
  LocalHospital as EncounterIcon,
  Assessment as VitalsIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  ArrowForward as ArrowIcon,
  Refresh as RefreshIcon,
  CalendarMonth as CalendarIcon,
  Print as PrintIcon,
} from '@mui/icons-material';
import { format, formatDistanceToNow, parseISO, isWithinInterval, subDays } from 'date-fns';
import { useFHIRResource } from '../../../../contexts/FHIRResourceContext';
import { useNavigate } from 'react-router-dom';
import { useMedicationResolver } from '../../../../hooks/useMedicationResolver';
import { 
  printDocument, 
  formatConditionsForPrint, 
  formatMedicationsForPrint, 
  formatLabResultsForPrint 
} from '../../../../utils/printUtils';
import {
  Patient as FHIRPatient,
  Condition as FHIRCondition,
  MedicationRequest as FHIRMedicationRequest,
  Observation as FHIRObservation,
  Encounter as FHIREncounter,
  AllergyIntolerance as FHIRAllergyIntolerance,
  ServiceRequest as FHIRServiceRequest,
} from '@ahryman40k/ts-fhir-types/lib/R4';

/**
 * Type definitions for SummaryTab component
 */
export type TrendDirection = 'up' | 'down';
export type MetricColor = 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
export type ChipStatus = 'Critical' | 'High' | 'Low' | 'Normal' | 'Active' | 'Inactive';

export interface DashboardStats {
  activeProblems: number;
  activeMedications: number;
  recentLabs: number;
  upcomingAppointments: number;
  overdueItems: number;
}

export interface MetricCardProps {
  title: string;
  value: number | string;
  subValue?: string;
  icon: React.ReactElement;
  color?: MetricColor;
  trend?: TrendDirection | number;
  onClick?: () => void;
  sx?: SxProps<Theme>;
}

export interface RecentItemProps {
  primary: string | React.ReactNode;
  secondary: string | React.ReactNode;
  icon: React.ReactElement;
  status?: ChipStatus | string | null;
  onClick?: () => void;
}

export interface SummaryTabProps {
  patientId: string;
  onNotificationUpdate?: (count: number) => void;
  sx?: SxProps<Theme>;
}

export interface ProcessedClinicalData {
  recentConditions: FHIRCondition[];
  recentMedications: FHIRMedicationRequest[];
  recentLabs: FHIRObservation[];
  recentEncounters: FHIREncounter[];
}

export interface PatientInfo {
  name: string;
  mrn?: string;
  birthDate?: string;
  gender?: string;
  phone?: string;
}

export interface PrintableContent {
  title: string;
  patient: PatientInfo;
  content: string;
}

export interface FHIRResourceContextType {
  getPatientResources: (patientId: string, resourceType: string) => any[];
  searchResources: (resourceType: string, params: any) => Promise<any>;
  isResourceLoading: (resourceType: string) => boolean;
  currentPatient: FHIRPatient | null;
}

export interface MedicationResolverType {
  getMedicationDisplay: (medication: FHIRMedicationRequest) => string;
}

/**
 * Helper functions
 */
const isValidDate = (dateString?: string): boolean => {
  if (!dateString) return false;
  const date = new Date(dateString);
  return !isNaN(date.getTime());
};

const safeParseDate = (dateString?: string): Date => {
  if (!dateString || !isValidDate(dateString)) {
    return new Date(0); // Epoch time for invalid dates
  }
  return parseISO(dateString);
};

const formatSafeDate = (dateString?: string, formatString: string = 'MMM d, yyyy'): string => {
  if (!dateString || !isValidDate(dateString)) {
    return 'Date unknown';
  }
  try {
    return format(parseISO(dateString), formatString);
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Date unknown';
  }
};

const getConditionStatus = (condition: FHIRCondition): string => {
  return condition.clinicalStatus?.coding?.[0]?.code || 
         condition.clinicalStatus?.code ||
         (condition.clinicalStatus as any) || 
         'unknown';
};

const isActiveCondition = (condition: FHIRCondition): boolean => {
  return getConditionStatus(condition) === 'active';
};

const isActiveMedication = (medication: FHIRMedicationRequest): boolean => {
  return medication.status === 'active';
};

const isLaboratoryObservation = (observation: FHIRObservation): boolean => {
  return observation.category?.[0]?.coding?.[0]?.code === 'laboratory';
};

const isRecentObservation = (observation: FHIRObservation, days: number = 7): boolean => {
  const date = observation.effectiveDateTime || observation.issued;
  if (!date) return false;
  
  try {
    return isWithinInterval(parseISO(date), {
      start: subDays(new Date(), days),
      end: new Date()
    });
  } catch (error) {
    console.error('Error checking if observation is recent:', error);
    return false;
  }
};

const getObservationValue = (observation: FHIRObservation): string => {
  if (observation.valueQuantity) {
    return `${observation.valueQuantity.value} ${observation.valueQuantity.unit || ''}`;
  }
  return observation.valueString || 'Result pending';
};

const getObservationStatus = (observation: FHIRObservation): ChipStatus | null => {
  const code = observation.interpretation?.[0]?.coding?.[0]?.code;
  switch (code) {
    case 'H': return 'High';
    case 'L': return 'Low';
    case 'N': return 'Normal';
    case 'A': return 'Critical';
    default: return null;
  }
};

/**
 * Metric Card Component
 */
const MetricCard: React.FC<MetricCardProps> = ({ 
  title, 
  value, 
  subValue, 
  icon, 
  color = 'primary', 
  trend, 
  onClick,
  sx 
}) => {
  const theme = useTheme();
  
  const getTrendValue = (): number | null => {
    if (typeof trend === 'number') return trend;
    return null;
  };

  const getTrendDirection = (): TrendDirection | null => {
    if (trend === 'up' || trend === 'down') return trend;
    if (typeof trend === 'number') return trend > 0 ? 'up' : 'down';
    return null;
  };

  const trendValue = getTrendValue();
  const trendDirection = getTrendDirection();
  
  return (
    <Card 
      sx={{ 
        height: '100%', 
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s',
        '&:hover': onClick ? {
          transform: 'translateY(-2px)',
          boxShadow: 3
        } : {},
        ...sx
      }}
      onClick={onClick}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: color && theme.palette[color]?.main 
                ? alpha(theme.palette[color].main, 0.1)
                : alpha(theme.palette.primary.main, 0.1),
              color: color && theme.palette[color]?.main 
                ? theme.palette[color].main 
                : theme.palette.primary.main
            }}
          >
            {icon}
          </Box>
          {trendDirection && trendValue !== null && (
            <Chip
              size="small"
              icon={trendDirection === 'up' ? <TrendingUpIcon /> : <TrendingDownIcon />}
              label={`${trendValue > 0 ? '+' : ''}${trendValue}%`}
              color={trendDirection === 'up' ? 'success' : 'error'}
              variant="outlined"
            />
          )}
        </Box>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          {value}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {title}
        </Typography>
        {subValue && (
          <Typography variant="caption" color="text.secondary">
            {subValue}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * Recent Item Component
 */
const RecentItem: React.FC<RecentItemProps> = ({ 
  primary, 
  secondary, 
  icon, 
  status, 
  onClick 
}) => (
  <ListItem 
    button 
    onClick={onClick}
    sx={{ 
      borderRadius: 1,
      mb: 1,
      '&:hover': { backgroundColor: 'action.hover' }
    }}
  >
    <ListItemIcon>{icon}</ListItemIcon>
    <ListItemText 
      primary={primary}
      secondary={secondary}
    />
    {status && (
      <Chip 
        label={status} 
        size="small" 
        color={status === 'Critical' ? 'error' : 'default'}
      />
    )}
  </ListItem>
);

/**
 * SummaryTab Component
 */
const SummaryTab: React.FC<SummaryTabProps> = ({ 
  patientId, 
  onNotificationUpdate,
  sx 
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { 
    getPatientResources, 
    searchResources, 
    isResourceLoading,
    currentPatient 
  } = useFHIRResource() as FHIRResourceContextType;

  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [stats, setStats] = useState<DashboardStats>({
    activeProblems: 0,
    activeMedications: 0,
    recentLabs: 0,
    upcomingAppointments: 0,
    overdueItems: 0
  });

  const loadDashboardData = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      
      // Get all resources
      const conditions: FHIRCondition[] = getPatientResources(patientId, 'Condition') || [];
      const medications: FHIRMedicationRequest[] = getPatientResources(patientId, 'MedicationRequest') || [];
      const observations: FHIRObservation[] = getPatientResources(patientId, 'Observation') || [];
      const encounters: FHIREncounter[] = getPatientResources(patientId, 'Encounter') || [];
      const allergies: FHIRAllergyIntolerance[] = getPatientResources(patientId, 'AllergyIntolerance') || [];

      // Calculate stats
      const activeConditions = conditions.filter(isActiveCondition);
      const activeMeds = medications.filter(isActiveMedication);
      
      // Recent labs (last 7 days)
      const recentLabs = observations.filter(obs => 
        isLaboratoryObservation(obs) && isRecentObservation(obs, 7)
      );

      // Count upcoming appointments (encounters with future dates)
      const upcomingAppointments = encounters.filter(enc => {
        const startDate = enc.period?.start;
        return startDate && new Date(startDate) > new Date() && enc.status === 'planned';
      }).length;

      // Calculate overdue items (medications needing refill, overdue lab orders, etc.)
      let overdueCount = 0;
      
      // Check for medications that might need refills
      medications.forEach(med => {
        if (med.status === 'active' && med.dispenseRequest?.validityPeriod?.end) {
          const endDate = new Date(med.dispenseRequest.validityPeriod.end);
          if (endDate < new Date()) {
            overdueCount++;
          }
        }
      });

      // Check for overdue lab orders
      const labOrders: FHIRServiceRequest[] = getPatientResources(patientId, 'ServiceRequest') || [];
      labOrders.forEach(order => {
        if (order.status === 'active' && order.occurrenceDateTime) {
          const dueDate = new Date(order.occurrenceDateTime);
          if (dueDate < new Date()) {
            overdueCount++;
          }
        }
      });

      // Update stats
      setStats({
        activeProblems: activeConditions.length,
        activeMedications: activeMeds.length,
        recentLabs: recentLabs.length,
        upcomingAppointments: upcomingAppointments,
        overdueItems: overdueCount
      });

      // Update notifications
      if (onNotificationUpdate && recentLabs.length > 0) {
        onNotificationUpdate(recentLabs.length);
      }

      setLastRefresh(new Date());
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [patientId, getPatientResources, onNotificationUpdate]);

  // Load all patient data
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Reload data when resources change
  useEffect(() => {
    // Get conditions to check if data has been loaded
    const conditions = getPatientResources(patientId, 'Condition') || [];
    
    // If we previously had no conditions but now have some, reload
    if (conditions.length > 0 && stats.activeProblems === 0) {
      loadDashboardData();
    }
  }, [getPatientResources, patientId, stats.activeProblems, loadDashboardData]);

  const handleRefresh = useCallback((): void => {
    setRefreshing(true);
    loadDashboardData();
  }, [loadDashboardData]);

  const handlePrintSummary = useCallback((): void => {
    const conditions: FHIRCondition[] = getPatientResources(patientId, 'Condition') || [];
    const medications: FHIRMedicationRequest[] = getPatientResources(patientId, 'MedicationRequest') || [];
    const observations: FHIRObservation[] = getPatientResources(patientId, 'Observation') || [];
    const allergies: FHIRAllergyIntolerance[] = getPatientResources(patientId, 'AllergyIntolerance') || [];

    const recentLabs = observations.filter(obs => 
      isLaboratoryObservation(obs) && isRecentObservation(obs, 7)
    );

    const patientInfo: PatientInfo = {
      name: currentPatient ? 
        `${currentPatient.name?.[0]?.given?.join(' ') || ''} ${currentPatient.name?.[0]?.family || ''}`.trim() : 
        'Unknown Patient',
      mrn: currentPatient?.identifier?.find(id => id.type?.coding?.[0]?.code === 'MR')?.value || currentPatient?.id,
      birthDate: currentPatient?.birthDate,
      gender: currentPatient?.gender,
      phone: currentPatient?.telecom?.find(t => t.system === 'phone')?.value
    };
    
    // Create comprehensive summary content
    let content = '<h2>Clinical Summary</h2>';
    
    // Active Problems
    content += '<h3>Active Problems</h3>';
    const activeConditions = conditions.filter(isActiveCondition);
    content += formatConditionsForPrint(activeConditions);
    
    // Active Medications
    content += '<h3>Active Medications</h3>';
    const activeMeds = medications.filter(isActiveMedication);
    content += formatMedicationsForPrint(activeMeds);
    
    // Recent Lab Results
    content += '<h3>Recent Lab Results (Last 7 Days)</h3>';
    content += formatLabResultsForPrint(recentLabs);
    
    // Allergies
    if (allergies.length > 0) {
      content += '<h3>Allergies</h3>';
      content += '<ul>';
      allergies.forEach(allergy => {
        const allergyText = allergy.code?.text || allergy.code?.coding?.[0]?.display || 'Unknown';
        const criticality = allergy.criticality ? ` (${allergy.criticality})` : '';
        content += `<li>${allergyText}${criticality}</li>`;
      });
      content += '</ul>';
    }
    
    const printContent: PrintableContent = {
      title: 'Clinical Summary',
      patient: patientInfo,
      content
    };

    printDocument(printContent);
  }, [currentPatient, patientId, getPatientResources]);

  // Get recent items
  const conditions: FHIRCondition[] = getPatientResources(patientId, 'Condition') || [];
  const medications: FHIRMedicationRequest[] = getPatientResources(patientId, 'MedicationRequest') || [];
  const observations: FHIRObservation[] = getPatientResources(patientId, 'Observation') || [];
  const encounters: FHIREncounter[] = getPatientResources(patientId, 'Encounter') || [];
  const allergies: FHIRAllergyIntolerance[] = getPatientResources(patientId, 'AllergyIntolerance') || [];
  
  // Resolve medication references
  const { getMedicationDisplay } = useMedicationResolver(medications) as MedicationResolverType;

  // Memoized data processing to prevent recalculation on every render
  const processedData: ProcessedClinicalData = useMemo(() => {
    return {
      recentConditions: conditions
        .sort((a, b) => safeParseDate(b.recordedDate).getTime() - safeParseDate(a.recordedDate).getTime())
        .slice(0, 5),
      
      recentMedications: medications
        .filter(isActiveMedication)
        .sort((a, b) => safeParseDate(b.authoredOn).getTime() - safeParseDate(a.authoredOn).getTime())
        .slice(0, 5),
      
      recentLabs: observations
        .filter(isLaboratoryObservation)
        .sort((a, b) => safeParseDate(b.effectiveDateTime || b.issued).getTime() - safeParseDate(a.effectiveDateTime || a.issued).getTime())
        .slice(0, 5),
      
      recentEncounters: encounters
        .sort((a, b) => safeParseDate(b.period?.start).getTime() - safeParseDate(a.period?.start).getTime())
        .slice(0, 5)
    };
  }, [conditions, medications, observations, encounters]);
  
  const { recentConditions, recentMedications, recentLabs, recentEncounters } = processedData;

  const handleNavigateToTab = useCallback((tab: string): void => {
    navigate(`/clinical/${patientId}?tab=${tab}`);
  }, [navigate, patientId]);

  if (loading && !refreshing) {
    return (
      <Box sx={{ p: 3, ...sx }}>
        <Grid container spacing={3}>
          {[1, 2, 3, 4].map(i => (
            <Grid item xs={12} sm={6} md={3} key={i}>
              <Skeleton variant="rectangular" height={140} />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, ...sx }}>
      {refreshing && <LinearProgress sx={{ mb: 2 }} />}
      
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold">
          Clinical Summary
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Last updated: {formatDistanceToNow(lastRefresh, { addSuffix: true })}
          </Typography>
          <IconButton onClick={handlePrintSummary} title="Print Summary" aria-label="Print summary">
            <PrintIcon />
          </IconButton>
          <IconButton onClick={handleRefresh} disabled={refreshing} aria-label="Refresh data">
            <RefreshIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Metric Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Active Problems"
            value={stats.activeProblems}
            icon={<ProblemIcon />}
            color="warning"
            onClick={() => handleNavigateToTab('chart')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Active Medications"
            value={stats.activeMedications}
            icon={<MedicationIcon />}
            color="primary"
            onClick={() => handleNavigateToTab('chart')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Recent Labs"
            value={stats.recentLabs}
            subValue="Last 7 days"
            icon={<LabIcon />}
            color="info"
            onClick={() => handleNavigateToTab('results')}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Overdue Items"
            value={stats.overdueItems}
            icon={<WarningIcon />}
            color="error"
            trend={-25}
          />
        </Grid>
      </Grid>

      {/* Clinical Alerts */}
      {allergies.length > 0 && (
        <Alert 
          severity="error" 
          sx={{ mb: 3 }}
          action={
            <Button size="small" onClick={() => handleNavigateToTab('chart')}>
              View All
            </Button>
          }
        >
          <Typography variant="subtitle2" fontWeight="bold">
            Allergies ({allergies.length})
          </Typography>
          {allergies.slice(0, 3).map((allergy, index) => (
            <Typography key={allergy.id || index} variant="body2">
              • {allergy.code?.text || allergy.code?.coding?.[0]?.display || 'Unknown'} 
              {allergy.criticality && ` (${allergy.criticality})`}
            </Typography>
          ))}
        </Alert>
      )}

      {/* Recent Activity Grid */}
      <Grid container spacing={3}>
        {/* Recent Problems */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              title="Recent Problems"
              action={
                <IconButton onClick={() => handleNavigateToTab('chart')} aria-label="View all problems">
                  <ArrowIcon />
                </IconButton>
              }
            />
            <CardContent>
              <List disablePadding>
                {recentConditions.length > 0 ? (
                  recentConditions.map((condition) => (
                    <RecentItem
                      key={condition.id}
                      primary={condition.code?.text || condition.code?.coding?.[0]?.display || 'Unknown condition'}
                      secondary={condition.recordedDate ? 
                        `Recorded ${formatSafeDate(condition.recordedDate)}` : 
                        'Date unknown'
                      }
                      icon={<ProblemIcon color="warning" />}
                      status={getConditionStatus(condition)}
                      onClick={() => handleNavigateToTab('chart')}
                    />
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No problems recorded
                  </Typography>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Medications */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              title="Active Medications"
              action={
                <IconButton onClick={() => handleNavigateToTab('chart')} aria-label="View all medications">
                  <ArrowIcon />
                </IconButton>
              }
            />
            <CardContent>
              <List disablePadding>
                {recentMedications.length > 0 ? (
                  recentMedications.map((med) => (
                    <RecentItem
                      key={med.id}
                      primary={getMedicationDisplay(med)}
                      secondary={med.dosageInstruction?.[0]?.text || 'No dosage information'}
                      icon={<MedicationIcon color="primary" />}
                      onClick={() => handleNavigateToTab('chart')}
                    />
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No active medications
                  </Typography>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Labs */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              title="Recent Lab Results"
              action={
                <IconButton onClick={() => handleNavigateToTab('results')} aria-label="View all lab results">
                  <ArrowIcon />
                </IconButton>
              }
            />
            <CardContent>
              <List disablePadding>
                {recentLabs.length > 0 ? (
                  recentLabs.map((lab) => (
                    <RecentItem
                      key={lab.id}
                      primary={lab.code?.text || lab.code?.coding?.[0]?.display || 'Unknown test'}
                      secondary={
                        <Box>
                          <Typography variant="caption">
                            {getObservationValue(lab)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {formatSafeDate(lab.effectiveDateTime || lab.issued)}
                          </Typography>
                        </Box>
                      }
                      icon={<LabIcon color="info" />}
                      status={getObservationStatus(lab)}
                      onClick={() => handleNavigateToTab('results')}
                    />
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No recent lab results
                  </Typography>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Encounters */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader
              title="Recent Encounters"
              action={
                <IconButton onClick={() => handleNavigateToTab('encounters')} aria-label="View all encounters">
                  <ArrowIcon />
                </IconButton>
              }
            />
            <CardContent>
              <List disablePadding>
                {recentEncounters.length > 0 ? (
                  recentEncounters.map((encounter) => (
                    <RecentItem
                      key={encounter.id}
                      primary={encounter.type?.[0]?.text || encounter.type?.[0]?.coding?.[0]?.display || 'Encounter'}
                      secondary={
                        encounter.period?.start ? 
                          formatSafeDate(encounter.period.start, 'MMM d, yyyy h:mm a') : 
                          'Date unknown'
                      }
                      icon={<EncounterIcon color="secondary" />}
                      status={encounter.status}
                      onClick={() => handleNavigateToTab('encounters')}
                    />
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No recent encounters
                  </Typography>
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SummaryTab;