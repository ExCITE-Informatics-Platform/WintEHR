/**
 * DownloadDialog Component
 * Provides DICOM study download functionality with format options
 * 
 * Migrated to TypeScript with comprehensive type safety for imaging downloads.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  FormLabel,
  Typography,
  Box,
  Alert,
  LinearProgress,
  Stack,
  Chip,
  SxProps,
  Theme,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Image as ImageIcon,
  Folder as FolderIcon,
} from '@mui/icons-material';
import { downloadDICOMStudy, exportDICOMImages, formatFileSize } from '../../../utils/imagingUtils';

/**
 * Type definitions for DownloadDialog component
 */
export type DownloadType = 'dicom' | 'images';
export type ImageFormat = 'jpeg' | 'png';

export interface DICOMStudy {
  id: string;
  description?: string;
  numberOfSeries?: number;
  numberOfInstances?: number;
  studyDate?: string;
  modality?: string;
  patientName?: string;
  patientId?: string;
}

export interface DownloadDialogProps {
  open: boolean;
  onClose: () => void;
  study: DICOMStudy | null;
  sx?: SxProps<Theme>;
}

export interface DownloadOptions {
  downloadType: DownloadType;
  imageFormat: ImageFormat;
}

export interface DownloadProgress {
  progress: number;
  stage: 'preparing' | 'downloading' | 'compressing' | 'complete';
  message?: string;
}

/**
 * Constants
 */
const BYTES_PER_DICOM_INSTANCE = 512000; // 500KB average
const BYTES_PER_IMAGE_INSTANCE = 100000; // 100KB average for JPEG/PNG

/**
 * Helper functions
 */
const getEstimatedSize = (study: DICOMStudy | null, downloadType: DownloadType): string => {
  if (!study || !study.numberOfInstances) return 'Unknown size';
  
  const bytesPerInstance = downloadType === 'dicom' ? BYTES_PER_DICOM_INSTANCE : BYTES_PER_IMAGE_INSTANCE;
  const estimatedBytes = study.numberOfInstances * bytesPerInstance;
  return formatFileSize(estimatedBytes);
};

const validateStudy = (study: DICOMStudy | null): boolean => {
  return !!(study && study.id && study.numberOfInstances && study.numberOfInstances > 0);
};

const getProgressMessage = (progress: number, stage: string): string => {
  switch (stage) {
    case 'preparing':
      return `Preparing download... ${progress}%`;
    case 'downloading':
      return `Downloading images... ${progress}%`;
    case 'compressing':
      return `Creating ZIP archive... ${progress}%`;
    case 'complete':
      return 'Download complete!';
    default:
      return `Processing... ${progress}%`;
  }
};

/**
 * DownloadDialog Component
 */
const DownloadDialog: React.FC<DownloadDialogProps> = ({ open, onClose, study, sx }) => {
  const [downloadType, setDownloadType] = useState<DownloadType>('dicom');
  const [imageFormat, setImageFormat] = useState<ImageFormat>('jpeg');
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [progressStage, setProgressStage] = useState<string>('preparing');
  const [error, setError] = useState<string | null>(null);
  
  const handleDownload = async (): Promise<void> => {
    if (!validateStudy(study)) {
      setError('Invalid study data');
      return;
    }

    setIsDownloading(true);
    setError(null);
    setDownloadProgress(0);
    setProgressStage('preparing');
    
    try {
      const progressCallback = (progress: number, stage?: string): void => {
        setDownloadProgress(Math.min(100, Math.max(0, progress)));
        if (stage) {
          setProgressStage(stage);
        }
      };

      if (downloadType === 'dicom') {
        await downloadDICOMStudy(study!, progressCallback);
      } else {
        await exportDICOMImages(study!.id, imageFormat, progressCallback);
      }
      
      setProgressStage('complete');
      setDownloadProgress(100);
      
      // Success - close dialog after a short delay
      setTimeout(() => {
        onClose();
        setIsDownloading(false);
        setDownloadProgress(0);
        setProgressStage('preparing');
      }, 1000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Download failed';
      setError(errorMessage);
      setIsDownloading(false);
      setProgressStage('preparing');
    }
  };

  const handleDownloadTypeChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setDownloadType(event.target.value as DownloadType);
  };

  const handleImageFormatChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    setImageFormat(event.target.value as ImageFormat);
  };

  const handleErrorClose = (): void => {
    setError(null);
  };

  const estimatedSize = getEstimatedSize(study, downloadType);
  const progressMessage = getProgressMessage(downloadProgress, progressStage);
  const isStudyValid = validateStudy(study);

  return (
    <Dialog 
      open={open} 
      onClose={!isDownloading ? onClose : undefined} 
      maxWidth="sm" 
      fullWidth
      sx={sx}
    >
      <DialogTitle>
        Download Imaging Study
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
                label={`${study?.numberOfSeries || 0} series`} 
                size="small" 
                icon={<FolderIcon />}
              />
              <Chip 
                label={`${study?.numberOfInstances || 0} images`} 
                size="small" 
                icon={<ImageIcon />}
              />
              <Chip 
                label={`~${estimatedSize}`} 
                size="small"
                color="primary"
              />
            </Stack>
          </Box>
          
          {/* Download Options */}
          <FormControl component="fieldset">
            <FormLabel component="legend">Download Format</FormLabel>
            <RadioGroup
              value={downloadType}
              onChange={handleDownloadTypeChange}
            >
              <FormControlLabel 
                value="dicom" 
                control={<Radio />} 
                label={
                  <Box>
                    <Typography>Original DICOM Files</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Full quality, includes all metadata
                    </Typography>
                  </Box>
                }
                disabled={isDownloading}
              />
              <FormControlLabel 
                value="images" 
                control={<Radio />} 
                label={
                  <Box>
                    <Typography>Image Files (JPEG/PNG)</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Compressed, easy to view and share
                    </Typography>
                  </Box>
                }
                disabled={isDownloading}
              />
            </RadioGroup>
          </FormControl>
          
          {/* Image Format Selection */}
          {downloadType === 'images' && (
            <FormControl component="fieldset">
              <FormLabel component="legend">Image Format</FormLabel>
              <RadioGroup
                row
                value={imageFormat}
                onChange={handleImageFormatChange}
              >
                <FormControlLabel 
                  value="jpeg" 
                  control={<Radio size="small" />} 
                  label="JPEG"
                  disabled={isDownloading}
                />
                <FormControlLabel 
                  value="png" 
                  control={<Radio size="small" />} 
                  label="PNG"
                  disabled={isDownloading}
                />
              </RadioGroup>
            </FormControl>
          )}
          
          {/* Progress */}
          {isDownloading && (
            <Box>
              <Typography variant="body2" gutterBottom>
                {progressMessage}
              </Typography>
              <LinearProgress variant="determinate" value={downloadProgress} />
            </Box>
          )}
          
          {/* Error */}
          {error && (
            <Alert severity="error" onClose={handleErrorClose}>
              {error}
            </Alert>
          )}

          {/* Validation Error */}
          {!isStudyValid && (
            <Alert severity="warning">
              Study data is incomplete. Please ensure the study has valid images before downloading.
            </Alert>
          )}
          
          {/* Info */}
          <Alert severity="info">
            Downloaded files will be compressed into a ZIP archive.
            Large studies may take several minutes to prepare.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isDownloading}>
          Cancel
        </Button>
        <Button 
          onClick={handleDownload} 
          variant="contained" 
          startIcon={<DownloadIcon />}
          disabled={isDownloading || !isStudyValid}
        >
          {isDownloading ? 'Downloading...' : 'Download'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DownloadDialog;