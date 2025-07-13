/**
 * Enhanced Patient Header Component
 * Comprehensive patient demographics and clinical summary for the workspace
 * 
 * Migrated to TypeScript with comprehensive type safety for patient header management.
 */

import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Chip,
  Stack,
  Avatar,
  IconButton,
  Tooltip,
  Divider,
  Button,
  useTheme,
  alpha,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  SxProps,
  Theme,
} from '@mui/material';
import {
  Person as PersonIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Home as HomeIcon,
  LocalHospital as HospitalIcon,
  Warning as WarningIcon,
  Medication as MedicationIcon,
  Assignment as AssignmentIcon,
  AccountCircle as AccountIcon,
  LocalHospital as EmergencyIcon,
  Print as PrintIcon,
  MoreVert as MoreIcon,
  CalendarMonth as CalendarIcon,
  Badge as BadgeIcon,
  HealthAndSafety as InsuranceIcon,
  Groups as TeamIcon,
  Edit as EditIcon,
  History as HistoryIcon,
  Share as ShareIcon,
  Description as DocumentIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';
import { format, differenceInYears, isValid, parseISO } from 'date-fns';
import { useFHIRResource } from '../../../contexts/FHIRResourceContext';
import { useNavigate } from 'react-router-dom';
import {
  Patient as FHIRPatient,
  AllergyIntolerance as FHIRAllergyIntolerance,
  Condition as FHIRCondition,
  MedicationRequest as FHIRMedicationRequest,
  Encounter as FHIREncounter,
  HumanName,
  ContactPoint,
  Address,
  Identifier,
} from '@ahryman40k/ts-fhir-types/lib/R4';

/**
 * Type definitions for EnhancedPatientHeader component
 */
export type CodeStatus = 'full-code' | 'dnr' | 'dni' | 'comfort-care' | 'limited-interventions';
export type ClinicalStatus = 'active' | 'inactive' | 'resolved' | 'remission' | 'entered-in-error';
export type EncounterStatus = 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled' | 'entered-in-error' | 'unknown';

export interface EnhancedPatientHeaderProps {
  patientId: string;
  onPrint?: () => void;
  onNavigateToTab?: (tabId: string) => void;
  sx?: SxProps<Theme>;
}

export interface PatientContactInfo {
  address: string;
  phone: string;
  email: string;
}

export interface PatientClinicalSummary {
  activeAllergies: number;
  activeConditions: number;
  activeMedications: number;
  lastEncounterDate?: string;
  primaryCareProvider: string;
  insurance: string;
  codeStatus: CodeStatus;
}

export interface SharePatientInfo {
  title: string;
  text: string;
  url: string;
}

export interface FHIRResourceContextType {
  currentPatient: FHIRPatient | null;
  getPatientResources: (patientId: string, resourceType: string) => any[];
}

/**
 * Helper functions
 */
const calculateAge = (birthDate?: string): string | number => {
  if (!birthDate) return 'Unknown';
  try {
    const date = typeof birthDate === 'string' ? parseISO(birthDate) : new Date(birthDate);
    if (!isValid(date)) return 'Unknown';
    return differenceInYears(new Date(), date);
  } catch (error) {
    console.error('Error calculating age:', error);
    return 'Unknown';
  }
};

const formatDate = (dateValue?: string, formatString: string = 'MMM d, yyyy'): string => {
  if (!dateValue) return 'Unknown';
  try {
    const date = typeof dateValue === 'string' ? parseISO(dateValue) : new Date(dateValue);
    if (!isValid(date)) return 'Unknown';
    return format(date, formatString);
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Unknown';
  }
};

const formatMRN = (patient: FHIRPatient): string => {
  const mrn = patient?.identifier?.find((id: Identifier) => 
    id.type?.coding?.[0]?.code === 'MR' || 
    id.type?.text === 'Medical Record Number'
  );
  if (!mrn?.value) return 'No MRN';
  
  // If it's a UUID (more than 10 characters), show shortened version
  if (mrn.value.length > 10) {
    return mrn.value.substring(0, 8) + '...';
  }
  return mrn.value;
};

const getPatientAddress = (patient: FHIRPatient): string => {
  const address: Address | undefined = patient?.address?.[0];
  if (!address) return 'No address on file';
  
  const addressParts = [
    address.line?.join(' ') || '',
    address.city || '',
    `${address.state || ''} ${address.postalCode || ''}`.trim()
  ].filter(part => part.trim() !== '');
  
  return addressParts.join(', ') || 'No address on file';
};

const getPatientPhone = (patient: FHIRPatient): string => {
  const phone = patient?.telecom?.find((t: ContactPoint) => t.system === 'phone');
  return phone?.value || 'No phone';
};

const getPatientEmail = (patient: FHIRPatient): string => {
  const email = patient?.telecom?.find((t: ContactPoint) => t.system === 'email');
  return email?.value || 'No email';
};

const getPatientInsurance = (patient: FHIRPatient): string => {
  // This would typically come from Coverage resources
  // For now, returning a placeholder
  return 'Blue Cross Blue Shield';
};

const getPatientPCP = (patient: FHIRPatient): string => {
  // This would typically come from the patient's care team
  // For now, returning a placeholder
  return 'Dr. Sarah Johnson';
};

const getFullPatientName = (patient: FHIRPatient): string => {
  const name: HumanName | undefined = patient.name?.[0];
  if (!name) return 'Unknown Patient';
  
  const given = name.given?.join(' ') || '';
  const family = name.family || '';
  return `${given} ${family}`.trim() || 'Unknown Patient';
};

const isActiveResource = (resource: any): boolean => {
  if (!resource) return false;
  
  // Handle different status field patterns
  if (resource.clinicalStatus?.coding?.[0]?.code) {
    return resource.clinicalStatus.coding[0].code === 'active';
  }
  if (resource.status) {
    return resource.status === 'active';
  }
  
  return false;
};

const getMostRecentEncounter = (encounters: FHIREncounter[]): FHIREncounter | null => {
  if (!encounters || encounters.length === 0) return null;
  
  const sortedEncounters = [...encounters].sort((a, b) => {
    const dateA = new Date(a.period?.start || a.period?.end || 0);
    const dateB = new Date(b.period?.start || b.period?.end || 0);
    return dateB.getTime() - dateA.getTime();
  });
  
  return sortedEncounters[0] || null;
};

/**
 * EnhancedPatientHeader Component
 */
const EnhancedPatientHeader: React.FC<EnhancedPatientHeaderProps> = ({ 
  patientId, 
  onPrint, 
  onNavigateToTab,
  sx 
}) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { currentPatient, getPatientResources } = useFHIRResource() as FHIRResourceContextType;
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<HTMLElement | null>(null);

  // Get patient resources
  const allergies: FHIRAllergyIntolerance[] = getPatientResources(patientId, 'AllergyIntolerance') || [];
  const conditions: FHIRCondition[] = getPatientResources(patientId, 'Condition') || [];
  const medications: FHIRMedicationRequest[] = getPatientResources(patientId, 'MedicationRequest') || [];
  const encounters: FHIREncounter[] = getPatientResources(patientId, 'Encounter') || [];

  const activeAllergies = allergies.filter(isActiveResource);
  const activeConditions = conditions.filter(isActiveResource);
  const activeMedications = medications.filter(isActiveResource);

  // Get most recent encounter
  const lastEncounter = getMostRecentEncounter(encounters);

  const handleChipClick = useCallback((tabId: string): void => {
    if (onNavigateToTab) {
      onNavigateToTab(tabId);
    }
  }, [onNavigateToTab]);

  const handlePrintClick = useCallback((): void => {
    if (onPrint) {
      onPrint();
    }
  }, [onPrint]);

  const handleMoreMenuClick = useCallback((event: React.MouseEvent<HTMLElement>): void => {
    setMoreMenuAnchor(event.currentTarget);
  }, []);

  const handleMoreMenuClose = useCallback((): void => {
    setMoreMenuAnchor(null);
  }, []);

  const handleEditDemographics = useCallback((): void => {
    handleMoreMenuClose();
    navigate(`/patients/${patientId}/edit`);
  }, [navigate, patientId, handleMoreMenuClose]);

  const handleViewHistory = useCallback((): void => {
    handleMoreMenuClose();
    if (onNavigateToTab) {
      onNavigateToTab('timeline');
    }
  }, [onNavigateToTab, handleMoreMenuClose]);

  const handleSharePatient = useCallback((): void => {
    handleMoreMenuClose();
    
    if (!currentPatient) return;
    
    const shareUrl = `${window.location.origin}/patients/${patientId}/view?readonly=true`;
    const shareInfo: SharePatientInfo = {
      title: `Patient: ${getFullPatientName(currentPatient)}`,
      text: 'Patient medical record',
      url: shareUrl
    };
    
    if (navigator.share) {
      navigator.share(shareInfo).catch(err => {
        console.error('Error sharing:', err);
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(shareUrl).then(() => {
        // Could show a toast notification here
      }).catch(err => {
        console.error('Error copying to clipboard:', err);
      });
    }
  }, [currentPatient, patientId, handleMoreMenuClose]);

  const handleViewDocuments = useCallback((): void => {
    handleMoreMenuClose();
    if (onNavigateToTab) {
      onNavigateToTab('documentation');
    }
  }, [onNavigateToTab, handleMoreMenuClose]);

  const handlePrivacySettings = useCallback((): void => {
    handleMoreMenuClose();
    navigate(`/patients/${patientId}/privacy`);
  }, [navigate, patientId, handleMoreMenuClose]);

  if (!currentPatient) {
    return null;
  }

  const contactInfo: PatientContactInfo = {
    address: getPatientAddress(currentPatient),
    phone: getPatientPhone(currentPatient),
    email: getPatientEmail(currentPatient)
  };

  const clinicalSummary: PatientClinicalSummary = {
    activeAllergies: activeAllergies.length,
    activeConditions: activeConditions.length,
    activeMedications: activeMedications.length,
    lastEncounterDate: lastEncounter?.period?.start || lastEncounter?.period?.end,
    primaryCareProvider: getPatientPCP(currentPatient),
    insurance: getPatientInsurance(currentPatient),
    codeStatus: 'full-code' // This would typically come from patient directives
  };

  return (
    <Paper
      elevation={0}
      sx={{
        backgroundColor: theme.palette.background.paper,
        borderRadius: 0,
        borderBottom: `1px solid ${theme.palette.divider}`,
        position: 'relative',
        overflow: 'hidden',
        ...sx
      }}
    >
      <Box sx={{ p: 1.5 }}>
        <Grid container spacing={1.5} alignItems="center">
          {/* Patient Photo and Basic Info */}
          <Grid item xs={12} md={5}>
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
              <Avatar
                sx={{
                  width: 48,
                  height: 48,
                  bgcolor: theme.palette.primary.main,
                  color: 'white',
                  fontSize: '1rem'
                }}
              >
                <PersonIcon sx={{ fontSize: 28 }} />
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Stack direction="row" spacing={2} alignItems="baseline">
                  <Typography variant="subtitle1" fontWeight="bold" sx={{ lineHeight: 1.2 }}>
                    {getFullPatientName(currentPatient)}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {clinicalSummary.activeAllergies > 0 && (
                      <Chip
                        icon={<WarningIcon />}
                        label={`${clinicalSummary.activeAllergies}`}
                        color="error"
                        size="small"
                        onClick={() => handleChipClick('chart')}
                        sx={{ cursor: onNavigateToTab ? 'pointer' : 'default', height: 20 }}
                        clickable={!!onNavigateToTab}
                      />
                    )}
                    {clinicalSummary.activeConditions > 0 && (
                      <Chip
                        icon={<AssignmentIcon />}
                        label={`${clinicalSummary.activeConditions}`}
                        color="warning"
                        size="small"
                        onClick={() => handleChipClick('chart')}
                        sx={{ cursor: onNavigateToTab ? 'pointer' : 'default', height: 20 }}
                        clickable={!!onNavigateToTab}
                      />
                    )}
                    {clinicalSummary.activeMedications > 0 && (
                      <Chip
                        icon={<MedicationIcon />}
                        label={`${clinicalSummary.activeMedications}`}
                        size="small"
                        onClick={() => handleChipClick('chart')}
                        sx={{ cursor: onNavigateToTab ? 'pointer' : 'default', height: 20 }}
                        clickable={!!onNavigateToTab}
                      />
                    )}
                  </Stack>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="caption" color="text.secondary">
                    {formatMRN(currentPatient)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">•</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {currentPatient.gender || 'Unknown'}, {calculateAge(currentPatient.birthDate)}y
                  </Typography>
                  <Typography variant="caption" color="text.secondary">•</Typography>
                  <Typography variant="caption" color="text.secondary">
                    DOB: {formatDate(currentPatient.birthDate)}
                  </Typography>
                </Stack>
              </Box>
            </Box>
          </Grid>

          {/* Contact Information */}
          <Grid item xs={12} md={4}>
            <Stack spacing={0.5}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <HomeIcon sx={{ fontSize: 16 }} color="action" />
                  <Typography variant="caption">{contactInfo.address}</Typography>
                </Stack>
              </Stack>
              <Stack direction="row" spacing={2} alignItems="center">
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <PhoneIcon sx={{ fontSize: 16 }} color="action" />
                  <Typography variant="caption">{contactInfo.phone}</Typography>
                </Stack>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <InsuranceIcon sx={{ fontSize: 16 }} color="action" />
                  <Typography variant="caption">{clinicalSummary.insurance}</Typography>
                </Stack>
              </Stack>
            </Stack>
          </Grid>

          {/* Clinical Summary */}
          <Grid item xs={12} md={3}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Stack direction="row" spacing={2} alignItems="center">
                {clinicalSummary.lastEncounterDate && (
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <CalendarIcon sx={{ fontSize: 16 }} color="action" />
                    <Typography variant="caption" color="text.secondary">
                      Last: {formatDate(clinicalSummary.lastEncounterDate, 'MMM d')}
                    </Typography>
                  </Stack>
                )}
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <TeamIcon sx={{ fontSize: 16 }} color="action" />
                  <Typography variant="caption" color="text.secondary">
                    {clinicalSummary.primaryCareProvider}
                  </Typography>
                </Stack>
                <Chip
                  icon={<EmergencyIcon />}
                  label="Full Code"
                  size="small"
                  color="success"
                  sx={{ height: 20 }}
                />
              </Stack>

              {/* Action Buttons */}
              <Stack direction="row" spacing={0.5}>
                <Tooltip title="Print Patient Summary">
                  <IconButton 
                    size="small" 
                    onClick={handlePrintClick}
                    sx={{ padding: 0.5 }}
                    aria-label="Print patient summary"
                  >
                    <PrintIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="More Options">
                  <IconButton 
                    size="small"
                    sx={{ padding: 0.5 }}
                    onClick={handleMoreMenuClick}
                    aria-label="More options"
                  >
                    <MoreIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* More Options Menu */}
      <Menu
        anchorEl={moreMenuAnchor}
        open={Boolean(moreMenuAnchor)}
        onClose={handleMoreMenuClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={handleEditDemographics}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit Demographics</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleViewHistory}>
          <ListItemIcon>
            <HistoryIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View History</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleSharePatient}>
          <ListItemIcon>
            <ShareIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Share Patient Info</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleViewDocuments}>
          <ListItemIcon>
            <DocumentIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>View Documents</ListItemText>
        </MenuItem>
        <MenuItem onClick={handlePrivacySettings}>
          <ListItemIcon>
            <SecurityIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Privacy Settings</ListItemText>
        </MenuItem>
      </Menu>
    </Paper>
  );
};

export default EnhancedPatientHeader;