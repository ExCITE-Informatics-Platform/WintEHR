/**
 * ShareDialog Component
 * Provides secure sharing functionality for DICOM imaging studies
 * 
 * Migrated to TypeScript with comprehensive type safety for medical imaging sharing.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Alert,
  Stack,
  Chip,
  IconButton,
  InputAdornment,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  FormControlLabel,
  Switch,
  CircularProgress,
  Snackbar,
  SxProps,
  Theme,
  SelectChangeEvent,
} from '@mui/material';
import {
  Share as ShareIcon,
  ContentCopy as CopyIcon,
  Link as LinkIcon,
  AccessTime as TimeIcon,
  Lock as LockIcon,
  Email as EmailIcon,
} from '@mui/icons-material';
import { generateShareLink, copyShareLink } from '../../../utils/imagingUtils';
import { format, addHours } from 'date-fns';

/**
 * Type definitions for ShareDialog component
 */
export interface DICOMStudy {
  id: string;
  description?: string;
  modality?: Array<{ code: string; display?: string }>;
  numberOfInstances?: number;
  numberOfSeries?: number;
  started?: string;
  patientName?: string;
  patientId?: string;
  studyDate?: string;
}

export interface ShareOptions {
  expirationHours: number;
  requireAuth: boolean;
}

export interface ShareResult {
  shareUrl: string;
  shareCode?: string;
  expiresAt: string;
  accessToken?: string;
}

export interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  study: DICOMStudy | null;
  sx?: SxProps<Theme>;
}

/**
 * Constants
 */
const EXPIRATION_OPTIONS = [
  { value: 24, label: '24 hours' },
  { value: 72, label: '3 days' },
  { value: 168, label: '1 week' },
  { value: 720, label: '30 days' },
] as const;

const DEFAULT_EXPIRATION_HOURS = 72;

/**
 * Helper functions
 */
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const formatStudyDate = (dateString: string | undefined): string => {
  if (!dateString) return 'Unknown';
  
  try {
    return format(new Date(dateString), 'MMMM d, yyyy');
  } catch (error) {
    return 'Unknown';
  }
};

const formatExpirationDate = (dateString: string): string => {
  try {
    return format(new Date(dateString), 'MMM d, yyyy h:mm a');
  } catch (error) {
    return 'Unknown';
  }
};

const getModalityDisplay = (study: DICOMStudy | null): string => {
  return study?.modality?.[0]?.code || study?.modality?.[0]?.display || 'Unknown';
};

/**
 * ShareDialog Component
 */
const ShareDialog: React.FC<ShareDialogProps> = ({ open, onClose, study, sx }) => {
  const [shareLink, setShareLink] = useState<string>('');
  const [shareCode, setShareCode] = useState<string>('');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [expirationHours, setExpirationHours] = useState<number>(DEFAULT_EXPIRATION_HOURS);
  const [requireAuth, setRequireAuth] = useState<boolean>(true);
  const [recipientEmail, setRecipientEmail] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  const [emailError, setEmailError] = useState<string>('');
  
  const handleGenerateLink = async (): Promise<void> => {
    if (!study) {
      setError('No study data available');
      return;
    }

    setIsGenerating(true);
    setError(null);
    
    try {
      const options: ShareOptions = {
        expirationHours,
        requireAuth
      };
      
      const result: ShareResult = await generateShareLink(study, options);
      
      setShareLink(result.shareUrl);
      setShareCode(result.shareCode || '');
      setExpiresAt(result.expiresAt);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate share link';
      setError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };
  
  const handleCopyLink = async (): Promise<void> => {
    const success = await copyShareLink(shareLink);
    if (success) {
      setCopySuccess(true);
    }
  };

  const handleExpirationChange = (event: SelectChangeEvent<number>): void => {
    setExpirationHours(Number(event.target.value));
  };

  const handleAuthToggle = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setRequireAuth(event.target.checked);
  };

  const handleRecipientEmailChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const email = event.target.value;
    setRecipientEmail(email);
    
    if (email && !isValidEmail(email)) {
      setEmailError('Please enter a valid email address');
    } else {
      setEmailError('');
    }
  };
  
  const handleEmailShare = (): void => {
    if (!isValidEmail(recipientEmail)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    const subject = encodeURIComponent(`Shared Medical Imaging: ${study?.description || 'Imaging Study'}`);
    const studyDate = formatStudyDate(study?.started);
    const expirationDate = expiresAt ? formatExpirationDate(expiresAt) : 'Unknown';
    
    const body = encodeURIComponent(
      `You have been granted access to view medical imaging.\n\n` +
      `Study: ${study?.description || 'Imaging Study'}\n` +
      `Date: ${studyDate}\n\n` +
      `Access Link: ${shareLink}\n` +
      (shareCode ? `Access Code: ${shareCode}\n` : '') +
      `\nThis link will expire on ${expirationDate}.\n\n` +
      `Please keep this information secure and do not share with unauthorized individuals.`
    );
    
    const mailto = `mailto:${recipientEmail}?subject=${subject}&body=${body}`;
    window.location.href = mailto;
  };
  
  const handleClose = (): void => {
    setShareLink('');
    setShareCode('');
    setExpiresAt(null);
    setError(null);
    setEmailError('');
    setRecipientEmail('');
    onClose();
  };

  const handleErrorClose = (): void => {
    setError(null);
  };

  const handleCopySuccessClose = (): void => {
    setCopySuccess(false);
  };

  const isEmailShareDisabled = !recipientEmail || !!emailError || !shareLink;
  
  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth sx={sx}>
        <DialogTitle>
          Share Imaging Study
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3}>
            {/* Study Info */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Study Information
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {study?.description || 'Imaging Study'}
              </Typography>
              <Stack direction="row" spacing={1} mt={1}>
                <Chip 
                  label={getModalityDisplay(study)} 
                  size="small"
                  color="primary"
                />
                <Chip 
                  label={`${study?.numberOfInstances || 0} images`} 
                  size="small"
                />
                {study?.numberOfSeries && (
                  <Chip 
                    label={`${study.numberOfSeries} series`} 
                    size="small"
                  />
                )}
              </Stack>
            </Box>
            
            {!shareLink ? (
              <>
                {/* Share Settings */}
                <FormControl fullWidth>
                  <InputLabel>Link Expiration</InputLabel>
                  <Select
                    value={expirationHours}
                    onChange={handleExpirationChange}
                    label="Link Expiration"
                  >
                    {EXPIRATION_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={requireAuth}
                      onChange={handleAuthToggle}
                    />
                  }
                  label={
                    <Box>
                      <Typography>Require Authentication</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Recipients will need to verify their identity
                      </Typography>
                    </Box>
                  }
                />
                
                {/* Error */}
                {error && (
                  <Alert severity="error" onClose={handleErrorClose}>
                    {error}
                  </Alert>
                )}
              </>
            ) : (
              <>
                {/* Generated Link */}
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Share Link Generated
                  </Typography>
                  <TextField
                    fullWidth
                    value={shareLink}
                    InputProps={{
                      readOnly: true,
                      startAdornment: (
                        <InputAdornment position="start">
                          <LinkIcon />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={handleCopyLink} edge="end" aria-label="Copy link">
                            <CopyIcon />
                          </IconButton>
                        </InputAdornment>
                      )
                    }}
                    helperText={expiresAt ? `Expires ${formatExpirationDate(expiresAt)}` : ''}
                  />
                </Box>
                
                {/* Access Code (if auth required) */}
                {shareCode && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Access Code
                    </Typography>
                    <TextField
                      fullWidth
                      value={shareCode}
                      InputProps={{
                        readOnly: true,
                        startAdornment: (
                          <InputAdornment position="start">
                            <LockIcon />
                          </InputAdornment>
                        )
                      }}
                      helperText="Share this code separately for added security"
                    />
                  </Box>
                )}
                
                {/* Email Share */}
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Email Link
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <TextField
                      fullWidth
                      type="email"
                      placeholder="recipient@example.com"
                      value={recipientEmail}
                      onChange={handleRecipientEmailChange}
                      error={!!emailError}
                      helperText={emailError}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <EmailIcon />
                          </InputAdornment>
                        )
                      }}
                    />
                    <Button
                      variant="outlined"
                      onClick={handleEmailShare}
                      disabled={isEmailShareDisabled}
                    >
                      Send
                    </Button>
                  </Stack>
                </Box>
                
                {/* Security Info */}
                <Alert severity="info" icon={<TimeIcon />}>
                  This link will expire in {expirationHours} hours and can only be used to view the images.
                  No download or modification permissions are granted.
                </Alert>
              </>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>
            {shareLink ? 'Done' : 'Cancel'}
          </Button>
          {!shareLink && (
            <Button 
              onClick={handleGenerateLink} 
              variant="contained" 
              startIcon={isGenerating ? <CircularProgress size={20} /> : <ShareIcon />}
              disabled={isGenerating || !study}
            >
              Generate Link
            </Button>
          )}
        </DialogActions>
      </Dialog>
      
      {/* Copy Success Notification */}
      <Snackbar
        open={copySuccess}
        autoHideDuration={3000}
        onClose={handleCopySuccessClose}
        message="Link copied to clipboard"
      />
    </>
  );
};

export default ShareDialog;