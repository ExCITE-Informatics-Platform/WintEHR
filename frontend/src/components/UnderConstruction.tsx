/**
 * Under Construction Component
 * Display for features that are still being developed
 * 
 * Migrated to TypeScript with comprehensive type safety for feature status display.
 */

import React, { ReactNode } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Container,
  Grid,
  Card,
  CardContent,
  Chip,
  Divider,
  Alert,
  AlertTitle,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  SxProps,
  Theme,
} from '@mui/material';
import {
  Construction as ConstructionIcon,
  ArrowBack as ArrowBackIcon,
  Home as HomeIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Build as BuildIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';

/**
 * Type definitions for UnderConstruction component
 */
export interface AlternativeAction {
  label: string;
  path: string;
}

export interface UnderConstructionProps {
  featureName?: string;
  description?: string;
  estimatedDate?: string;
  plannedFeatures?: string[];
  alternativeActions?: AlternativeAction[];
  showHomeButton?: boolean;
  showBackButton?: boolean;
  customIcon?: ReactNode;
  sx?: SxProps<Theme>;
}

/**
 * UnderConstruction Component
 */
const UnderConstruction: React.FC<UnderConstructionProps> = ({ 
  featureName = "This Feature",
  description = "We're working hard to bring you this feature. Check back soon!",
  estimatedDate = "Coming Soon",
  plannedFeatures = [],
  alternativeActions = [],
  showHomeButton = true,
  showBackButton = true,
  customIcon = null,
  sx
}) => {
  const navigate = useNavigate();
  const theme = useTheme();

  const handleGoBack = (): void => {
    navigate(-1);
  };

  const handleGoHome = (): void => {
    navigate('/dashboard');
  };

  const handleAlternativeAction = (path: string): void => {
    navigate(path);
  };

  return (
    <Container maxWidth="lg" sx={sx}>
      <Box sx={{ py: 4 }}>
        {/* Main Card */}
        <Card 
          elevation={3}
          sx={{ 
            p: 4,
            textAlign: 'center',
            background: `linear-gradient(135deg, ${theme.palette.background.paper} 0%, ${theme.palette.grey[50]} 100%)`,
            borderRadius: 3
          }}
        >
          {/* Icon */}
          <Box sx={{ mb: 3 }}>
            {customIcon || (
              <ConstructionIcon 
                sx={{ 
                  fontSize: 80, 
                  color: theme.palette.warning.main,
                  opacity: 0.8
                }} 
              />
            )}
          </Box>

          {/* Title */}
          <Typography 
            variant="h3" 
            gutterBottom 
            sx={{ 
              fontWeight: 700,
              color: theme.palette.primary.dark,
              mb: 2
            }}
          >
            {featureName} Under Construction
          </Typography>

          {/* Status Chip */}
          <Chip 
            icon={<ScheduleIcon />}
            label={estimatedDate}
            color="primary"
            variant="outlined"
            sx={{ mb: 3, fontWeight: 600 }}
          />

          {/* Description */}
          <Typography 
            variant="h6" 
            color="textSecondary" 
            sx={{ mb: 4, maxWidth: 600, mx: 'auto' }}
          >
            {description}
          </Typography>

          {/* Navigation Buttons */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mb: 4 }}>
            {showBackButton && (
              <Button
                variant="outlined"
                startIcon={<ArrowBackIcon />}
                onClick={handleGoBack}
                sx={{ borderRadius: 2 }}
              >
                Go Back
              </Button>
            )}
            {showHomeButton && (
              <Button
                variant="contained"
                startIcon={<HomeIcon />}
                onClick={handleGoHome}
                sx={{ borderRadius: 2 }}
              >
                Go to Dashboard
              </Button>
            )}
          </Box>
        </Card>

        {/* Additional Information Grid */}
        <Grid container spacing={3} sx={{ mt: 3 }}>
          {/* Planned Features */}
          {plannedFeatures.length > 0 && (
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, height: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <BuildIcon sx={{ mr: 1, color: theme.palette.primary.main }} />
                  <Typography variant="h6" fontWeight={600}>
                    What's Coming
                  </Typography>
                </Box>
                <Divider sx={{ mb: 2 }} />
                <List dense>
                  {plannedFeatures.map((feature, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        <CheckCircleIcon 
                          fontSize="small" 
                          sx={{ color: theme.palette.success.light }} 
                        />
                      </ListItemIcon>
                      <ListItemText 
                        primary={feature}
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Grid>
          )}

          {/* Alternative Actions */}
          {alternativeActions.length > 0 && (
            <Grid item xs={12} md={6}>
              <Paper sx={{ p: 3, height: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <InfoIcon sx={{ mr: 1, color: theme.palette.info.main }} />
                  <Typography variant="h6" fontWeight={600}>
                    In the Meantime
                  </Typography>
                </Box>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {alternativeActions.map((action, index) => (
                    <Button
                      key={index}
                      variant="outlined"
                      size="small"
                      onClick={() => handleAlternativeAction(action.path)}
                      sx={{ 
                        justifyContent: 'flex-start',
                        textTransform: 'none',
                        borderRadius: 2
                      }}
                    >
                      {action.label}
                    </Button>
                  ))}
                </Box>
              </Paper>
            </Grid>
          )}
        </Grid>

        {/* Professional Notice */}
        <Alert 
          severity="info" 
          sx={{ 
            mt: 4,
            borderRadius: 2,
            '& .MuiAlert-icon': {
              fontSize: 28
            }
          }}
        >
          <AlertTitle sx={{ fontWeight: 600 }}>
            Development Notice
          </AlertTitle>
          <Typography variant="body2">
            This feature is currently being developed to meet healthcare industry standards 
            and ensure HIPAA compliance. We appreciate your patience as we build a secure 
            and reliable solution for your clinical needs.
          </Typography>
        </Alert>
      </Box>
    </Container>
  );
};

/**
 * Higher-order component for wrapping components with under construction display
 */
export function withUnderConstruction<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  constructionProps: Partial<UnderConstructionProps> = {}
) {
  const WithUnderConstructionComponent = (props: P & { isUnderConstruction?: boolean }) => {
    const { isUnderConstruction = true, ...componentProps } = props;
    
    if (isUnderConstruction) {
      return <UnderConstruction {...constructionProps} />;
    }
    
    return <WrappedComponent {...(componentProps as P)} />;
  };

  WithUnderConstructionComponent.displayName = `withUnderConstruction(${WrappedComponent.displayName || WrappedComponent.name})`;

  return WithUnderConstructionComponent;
}

export default UnderConstruction;