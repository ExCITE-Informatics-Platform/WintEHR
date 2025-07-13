/**
 * Error Boundary Component
 * React error boundary for catching and handling component errors
 * 
 * Migrated to TypeScript with comprehensive type safety for error handling.
 */

import React, { ReactNode, Component, ErrorInfo } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Paper, 
  Stack,
  Alert,
  Collapse,
  IconButton,
  SxProps,
  Theme
} from '@mui/material';
import {
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  Home as HomeIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';

/**
 * Type definitions for Error Boundary
 */
export interface ErrorBoundaryProps {
  children: ReactNode;
  onReset?: () => void;
  fallback?: (error: Error, errorInfo: ErrorInfo) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export interface ComponentErrorBoundaryProps {
  children: ReactNode;
  name?: string;
  fallbackMessage?: string;
  sx?: SxProps<Theme>;
}

export interface ComponentErrorBoundaryState {
  hasError: boolean;
}

/**
 * Main Error Boundary Component
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null,
      showDetails: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to error reporting service
    this.logErrorToService(error, errorInfo);
    
    // Update state with error details
    this.setState({
      error,
      errorInfo
    });

    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private logErrorToService = (error: Error, errorInfo: ErrorInfo): void => {
    // In production, this would send to error tracking service (e.g., Sentry)
    if (process.env.NODE_ENV === 'production') {
      // Example: window.Sentry?.captureException(error, { extra: errorInfo });
      console.error('Production Error:', error, errorInfo);
    }
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error caught by ErrorBoundary:', error, errorInfo);
    }
  };

  private handleReset = (): void => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null,
      showDetails: false 
    });
    
    // Optionally call reset handler
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleGoHome = (): void => {
    window.location.href = '/';
  };

  private toggleDetails = (): void => {
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const { error, errorInfo, showDetails } = this.state;
      const isDevelopment = process.env.NODE_ENV === 'development';

      // If a custom fallback is provided, use it
      if (this.props.fallback && error && errorInfo) {
        return this.props.fallback(error, errorInfo);
      }

      return (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            bgcolor: 'background.default',
            p: 3
          }}
        >
          <Paper
            elevation={3}
            sx={{
              p: 4,
              maxWidth: 600,
              width: '100%',
              textAlign: 'center'
            }}
          >
            <ErrorIcon 
              sx={{ 
                fontSize: 64, 
                color: 'error.main',
                mb: 2
              }} 
            />
            
            <Typography variant="h4" gutterBottom>
              Oops! Something went wrong
            </Typography>
            
            <Typography variant="body1" color="text.secondary" paragraph>
              We encountered an unexpected error. The error has been logged and our team will look into it.
            </Typography>

            {/* Error message for development */}
            {isDevelopment && error && (
              <Alert severity="error" sx={{ mb: 2, textAlign: 'left' }}>
                <Typography variant="subtitle2" fontWeight="bold">
                  Error: {error.toString()}
                </Typography>
              </Alert>
            )}

            <Stack direction="row" spacing={2} justifyContent="center" sx={{ mb: 3 }}>
              <Button
                variant="contained"
                startIcon={<RefreshIcon />}
                onClick={this.handleReset}
              >
                Try Again
              </Button>
              <Button
                variant="outlined"
                startIcon={<HomeIcon />}
                onClick={this.handleGoHome}
              >
                Go Home
              </Button>
              <Button
                variant="outlined"
                onClick={this.handleReload}
              >
                Reload Page
              </Button>
            </Stack>

            {/* Expandable error details for development */}
            {isDevelopment && errorInfo && (
              <>
                <Button
                  endIcon={showDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  onClick={this.toggleDetails}
                  sx={{ mb: 2 }}
                >
                  {showDetails ? 'Hide' : 'Show'} Error Details
                </Button>
                
                <Collapse in={showDetails}>
                  <Box
                    sx={{
                      bgcolor: 'grey.100',
                      p: 2,
                      borderRadius: 1,
                      textAlign: 'left',
                      overflow: 'auto',
                      maxHeight: 400,
                      fontFamily: 'monospace',
                      fontSize: '0.875rem'
                    }}
                  >
                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                      Component Stack:
                    </Typography>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                      {errorInfo.componentStack}
                    </pre>
                    
                    {error?.stack && (
                      <>
                        <Typography variant="subtitle2" fontWeight="bold" gutterBottom sx={{ mt: 2 }}>
                          Error Stack:
                        </Typography>
                        <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                          {error.stack}
                        </pre>
                      </>
                    )}
                  </Box>
                </Collapse>
              </>
            )}
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

/**
 * Specific error boundary for smaller components
 */
export class ComponentErrorBoundary extends Component<ComponentErrorBoundaryProps, ComponentErrorBoundaryState> {
  constructor(props: ComponentErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ComponentErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(`Error in ${this.props.name || 'Component'}:`, error, errorInfo);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <Alert 
          severity="error" 
          sx={this.props.sx}
          action={
            <IconButton
              color="inherit"
              size="small"
              onClick={this.handleReset}
            >
              <RefreshIcon fontSize="inherit" />
            </IconButton>
          }
        >
          {this.props.fallbackMessage || 'This component encountered an error. Click refresh to try again.'}
        </Alert>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC for wrapping components with error boundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Partial<ComponentErrorBoundaryProps>
) {
  const WithErrorBoundaryComponent = (props: P) => (
    <ComponentErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ComponentErrorBoundary>
  );

  WithErrorBoundaryComponent.displayName = `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`;

  return WithErrorBoundaryComponent;
}

/**
 * Hook for error boundary (for functional components to trigger error boundaries)
 */
export function useErrorHandler(): (error: Error, errorInfo?: ErrorInfo) => void {
  return React.useCallback((error: Error, errorInfo?: ErrorInfo) => {
    // This will be caught by the nearest error boundary
    throw error;
  }, []);
}

export default ErrorBoundary;