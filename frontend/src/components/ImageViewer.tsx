/**
 * ImageViewer Component
 * DICOM image viewer with Cornerstone.js integration
 * 
 * Migrated to TypeScript with comprehensive type safety for medical imaging.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Box,
  IconButton,
  Slider,
  Typography,
  Paper,
  Toolbar,
  Divider,
  CircularProgress,
  Alert,
  Tooltip,
  Stack,
  TextField,
  SxProps,
  Theme,
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Brightness6 as BrightnessIcon,
  Contrast as ContrastIcon,
  RestartAlt as ResetIcon,
  Straighten as RulerIcon,
  RadioButtonUnchecked as CircleIcon,
  CropFree as RectangleIcon,
  Timeline as AngleIcon,
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon,
  GridView as GridViewIcon,
  ViewModule as SingleViewIcon,
} from '@mui/icons-material';

import cornerstone from 'cornerstone-core';
import cornerstoneTools from 'cornerstone-tools';
import cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader';
import dicomParser from 'dicom-parser';
import Hammer from 'hammerjs';

/**
 * Type definitions for ImageViewer component
 */
export type ToolName = 
  | 'Pan' 
  | 'Wwwc' 
  | 'Zoom' 
  | 'Length' 
  | 'Angle' 
  | 'EllipticalRoi' 
  | 'RectangleRoi';

export interface ImageViewerProps {
  studyId: string;
  seriesId: string;
  onClose?: () => void;
  sx?: SxProps<Theme>;
}

export interface CornerstoneImage {
  imageId: string;
  minPixelValue: number;
  maxPixelValue: number;
  rows: number;
  columns: number;
  height: number;
  width: number;
  color: boolean;
  columnPixelSpacing: number;
  rowPixelSpacing: number;
  sizeInBytes: number;
  sliceThickness?: number;
  getPixelData: () => Uint16Array | Int16Array | Uint8Array;
}

export interface CornerstoneViewport {
  scale: number;
  translation: {
    x: number;
    y: number;
  };
  voi: {
    windowWidth: number;
    windowCenter: number;
  };
  invert: boolean;
  pixelReplication: boolean;
  rotation: number;
  hflip: boolean;
  vflip: boolean;
}

export interface ImageInfo {
  studyUID?: string;
  seriesUID?: string;
  width?: number;
  height?: number;
  rows?: number;
  columns?: number;
  pixelSpacing?: string;
  sliceThickness?: string;
}

export interface ViewerState {
  loading: boolean;
  error: string | null;
  currentImageIndex: number;
  imageIds: string[];
  viewport: CornerstoneViewport | null;
  windowWidth: number;
  windowCenter: number;
  zoom: number;
  activeTool: ToolName;
  imageInfo: ImageInfo;
}

export interface ToolConfig {
  name: ToolName;
  icon: React.ReactElement;
  tooltip: string;
  mouseButtonMask?: number;
}

/**
 * Constants
 */
const TOOL_CONFIGS: ToolConfig[] = [
  { name: 'Pan', icon: <GridViewIcon />, tooltip: 'Pan', mouseButtonMask: 1 },
  { name: 'Wwwc', icon: <BrightnessIcon />, tooltip: 'Window/Level', mouseButtonMask: 1 },
  { name: 'Zoom', icon: <ZoomInIcon />, tooltip: 'Zoom', mouseButtonMask: 1 },
  { name: 'Length', icon: <RulerIcon />, tooltip: 'Length Measurement', mouseButtonMask: 1 },
  { name: 'Angle', icon: <AngleIcon />, tooltip: 'Angle Measurement', mouseButtonMask: 1 },
  { name: 'EllipticalRoi', icon: <CircleIcon />, tooltip: 'Ellipse ROI', mouseButtonMask: 1 },
  { name: 'RectangleRoi', icon: <RectangleIcon />, tooltip: 'Rectangle ROI', mouseButtonMask: 1 },
];

const DEFAULT_WINDOW_WIDTH = 400;
const DEFAULT_WINDOW_CENTER = 40;
const DEFAULT_ZOOM = 1;
const IMAGE_SIZE = 512;

// Initialize Cornerstone
cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
cornerstoneWADOImageLoader.external.dicomParser = dicomParser;
cornerstoneTools.external.cornerstone = cornerstone;
cornerstoneTools.external.Hammer = Hammer;

// Initialize tools once
let toolsInitialized = false;
if (!toolsInitialized) {
  try {
    cornerstoneTools.init();
    toolsInitialized = true;
  } catch (error) {
    console.error('Error initializing cornerstone tools:', error);
  }
}

// Configure image loader
cornerstoneWADOImageLoader.configure({
  beforeSend: function(xhr: XMLHttpRequest) {
    // Add authorization headers if needed
    const token = localStorage.getItem('token');
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
  }
});

/**
 * Helper functions
 */
const createDemoImage = (studyId: string, seriesId: string): CornerstoneImage => {
  // Create a simple canvas with demo image
  const canvas = document.createElement('canvas');
  canvas.width = IMAGE_SIZE;
  canvas.height = IMAGE_SIZE;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }
  
  // Create a gradient background
  const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
  gradient.addColorStop(0, '#444');
  gradient.addColorStop(1, '#000');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, IMAGE_SIZE, IMAGE_SIZE);
  
  // Add some text
  ctx.fillStyle = '#fff';
  ctx.font = '24px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('DICOM Viewer Demo', 256, 256);
  ctx.font = '16px Arial';
  ctx.fillText('Study: ' + studyId, 256, 290);
  ctx.fillText('Series: ' + seriesId, 256, 310);
  
  // Create a simple image object that cornerstone can display
  return {
    imageId: 'demo:image1',
    minPixelValue: 0,
    maxPixelValue: 255,
    rows: IMAGE_SIZE,
    columns: IMAGE_SIZE,
    height: IMAGE_SIZE,
    width: IMAGE_SIZE,
    color: false,
    columnPixelSpacing: 1,
    rowPixelSpacing: 1,
    sizeInBytes: IMAGE_SIZE * IMAGE_SIZE * 2,
    getPixelData: function(): Uint16Array {
      // Create pixel data from canvas
      const imageData = ctx.getImageData(0, 0, IMAGE_SIZE, IMAGE_SIZE);
      const pixelData = new Uint16Array(IMAGE_SIZE * IMAGE_SIZE);
      for (let i = 0; i < imageData.data.length; i += 4) {
        pixelData[i / 4] = imageData.data[i]; // Use red channel
      }
      return pixelData;
    }
  };
};

const initializeTools = (element: HTMLDivElement): void => {
  try {
    // Import tools
    const WwwcTool = cornerstoneTools.WwwcTool;
    const PanTool = cornerstoneTools.PanTool;
    const ZoomTool = cornerstoneTools.ZoomTool;
    const LengthTool = cornerstoneTools.LengthTool;
    const AngleTool = cornerstoneTools.AngleTool;
    const EllipticalRoiTool = cornerstoneTools.EllipticalRoiTool;
    const RectangleRoiTool = cornerstoneTools.RectangleRoiTool;

    // Add tools
    cornerstoneTools.addTool(WwwcTool);
    cornerstoneTools.addTool(PanTool);
    cornerstoneTools.addTool(ZoomTool);
    cornerstoneTools.addTool(LengthTool);
    cornerstoneTools.addTool(AngleTool);
    cornerstoneTools.addTool(EllipticalRoiTool);
    cornerstoneTools.addTool(RectangleRoiTool);

    // Set initial tool
    cornerstoneTools.setToolActive('Pan', { mouseButtonMask: 1 });
  } catch (error) {
    console.error('Error initializing tools:', error);
  }
};

const disableAllTools = (): void => {
  try {
    TOOL_CONFIGS.forEach(tool => {
      cornerstoneTools.setToolPassive(tool.name);
    });
  } catch (error) {
    console.error('Error disabling tools:', error);
  }
};

const validateElement = (element: HTMLDivElement | null): boolean => {
  if (!element) {
    console.error('Viewer element not found');
    return false;
  }
  
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    console.error('Viewer container not properly sized');
    return false;
  }
  
  return true;
};

/**
 * ImageViewer Component
 */
const ImageViewer: React.FC<ImageViewerProps> = ({ 
  studyId, 
  seriesId, 
  onClose,
  sx 
}) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [viewerState, setViewerState] = useState<ViewerState>({
    loading: true,
    error: null,
    currentImageIndex: 0,
    imageIds: [],
    viewport: null,
    windowWidth: DEFAULT_WINDOW_WIDTH,
    windowCenter: DEFAULT_WINDOW_CENTER,
    zoom: DEFAULT_ZOOM,
    activeTool: 'Pan',
    imageInfo: {}
  });

  const initializeViewer = useCallback(async (): Promise<void> => {
    try {
      setViewerState(prev => ({ ...prev, loading: true, error: null }));
      
      const element = viewerRef.current;
      if (!validateElement(element)) {
        setViewerState(prev => ({ 
          ...prev, 
          error: 'Viewer is initializing, please try again', 
          loading: false 
        }));
        return;
      }
      
      // Enable cornerstone for this element
      try {
        cornerstone.enable(element!);
      } catch (err) {
        console.error('Error enabling cornerstone:', err);
      }

      // Create demo image (in production, this would load actual DICOM files)
      const image = createDemoImage(studyId, seriesId);
      
      // Display the image
      cornerstone.displayImage(element!, image);
      
      // Initialize tools
      initializeTools(element!);
      
      // Update state
      setViewerState(prev => ({
        ...prev,
        loading: false,
        imageInfo: {
          studyUID: studyId,
          seriesUID: seriesId,
          rows: IMAGE_SIZE,
          columns: IMAGE_SIZE,
          width: IMAGE_SIZE,
          height: IMAGE_SIZE,
          pixelSpacing: '1.0\\1.0',
          sliceThickness: 'N/A'
        }
      }));
      
    } catch (err) {
      console.error('Error initializing viewer:', err);
      setViewerState(prev => ({ 
        ...prev, 
        error: err instanceof Error ? err.message : 'Failed to initialize image viewer', 
        loading: false 
      }));
    }
  }, [studyId, seriesId]);

  const loadAndDisplayImage = useCallback(async (imageId: string): Promise<void> => {
    try {
      const element = viewerRef.current;
      if (!element) return;

      const image = await cornerstone.loadImage(imageId);
      
      cornerstone.displayImage(element, image);
      
      // Set default viewport
      const viewport = cornerstone.getDefaultViewportForImage(element, image);
      cornerstone.setViewport(element, viewport);
      
      // Update state
      setViewerState(prev => ({
        ...prev,
        viewport,
        windowWidth: viewport.voi.windowWidth,
        windowCenter: viewport.voi.windowCenter,
        zoom: viewport.scale,
        imageInfo: {
          ...prev.imageInfo,
          width: image.width,
          height: image.height,
          pixelSpacing: image.rowPixelSpacing ? 
            `${image.rowPixelSpacing.toFixed(2)} x ${image.columnPixelSpacing.toFixed(2)} mm` : 
            'N/A',
          sliceThickness: image.sliceThickness ? `${image.sliceThickness.toFixed(2)} mm` : 'N/A'
        }
      }));
    } catch (err) {
      console.error('Error loading image:', err);
      setViewerState(prev => ({ ...prev, error: 'Failed to load image' }));
    }
  }, []);

  const handleToolChange = useCallback((toolName: ToolName): void => {
    const element = viewerRef.current;
    if (!element) return;

    try {
      // Disable all tools
      disableAllTools();

      // Enable selected tool
      const toolConfig = TOOL_CONFIGS.find(t => t.name === toolName);
      cornerstoneTools.setToolActive(toolName, { 
        mouseButtonMask: toolConfig?.mouseButtonMask || 1 
      });
      
      setViewerState(prev => ({ ...prev, activeTool: toolName }));
    } catch (error) {
      console.error('Error changing tool:', error);
    }
  }, []);

  const handleWindowingChange = useCallback((width: number, center: number): void => {
    const element = viewerRef.current;
    if (!element) return;

    try {
      const viewport = cornerstone.getViewport(element);
      viewport.voi.windowWidth = width;
      viewport.voi.windowCenter = center;
      cornerstone.setViewport(element, viewport);
      
      setViewerState(prev => ({
        ...prev,
        windowWidth: width,
        windowCenter: center,
        viewport
      }));
    } catch (error) {
      console.error('Error changing windowing:', error);
    }
  }, []);

  const handleZoomChange = useCallback((newZoom: number): void => {
    const element = viewerRef.current;
    if (!element) return;

    try {
      const viewport = cornerstone.getViewport(element);
      viewport.scale = newZoom;
      cornerstone.setViewport(element, viewport);
      
      setViewerState(prev => ({
        ...prev,
        zoom: newZoom,
        viewport
      }));
    } catch (error) {
      console.error('Error changing zoom:', error);
    }
  }, []);

  const handleReset = useCallback((): void => {
    const element = viewerRef.current;
    if (!element) return;

    try {
      cornerstone.reset(element);
      const viewport = cornerstone.getViewport(element);
      
      setViewerState(prev => ({
        ...prev,
        windowWidth: viewport.voi.windowWidth,
        windowCenter: viewport.voi.windowCenter,
        zoom: viewport.scale,
        viewport
      }));
    } catch (error) {
      console.error('Error resetting viewer:', error);
    }
  }, []);

  const handleImageNavigation = useCallback((direction: number): void => {
    const newIndex = viewerState.currentImageIndex + direction;
    if (newIndex >= 0 && newIndex < viewerState.imageIds.length) {
      setViewerState(prev => ({ ...prev, currentImageIndex: newIndex }));
      loadAndDisplayImage(viewerState.imageIds[newIndex]);
    }
  }, [viewerState.currentImageIndex, viewerState.imageIds, loadAndDisplayImage]);

  // Initialize viewer on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      if (viewerRef.current) {
        initializeViewer();
      }
    }, 100);
    
    return () => {
      clearTimeout(timer);
      if (viewerRef.current) {
        try {
          cornerstone.disable(viewerRef.current);
        } catch (err) {
          console.error('Error disabling cornerstone:', err);
        }
      }
    };
  }, [initializeViewer]);

  if (viewerState.loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height={600}>
        <CircularProgress />
      </Box>
    );
  }

  if (viewerState.error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {viewerState.error}
      </Alert>
    );
  }

  return (
    <Paper 
      elevation={3} 
      sx={{ 
        height: '80vh', 
        display: 'flex', 
        flexDirection: 'column', 
        overflow: 'hidden',
        ...sx 
      }}
    >
      {/* Toolbar */}
      <Toolbar sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexGrow: 1 }}>
          {/* Tool Selection */}
          {TOOL_CONFIGS.slice(0, 3).map((tool) => (
            <Tooltip key={tool.name} title={tool.tooltip}>
              <IconButton 
                onClick={() => handleToolChange(tool.name)}
                color={viewerState.activeTool === tool.name ? 'primary' : 'default'}
                aria-label={tool.tooltip}
              >
                {tool.icon}
              </IconButton>
            </Tooltip>
          ))}
          
          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
          
          {/* Measurement Tools */}
          {TOOL_CONFIGS.slice(3).map((tool) => (
            <Tooltip key={tool.name} title={tool.tooltip}>
              <IconButton 
                onClick={() => handleToolChange(tool.name)}
                color={viewerState.activeTool === tool.name ? 'primary' : 'default'}
                aria-label={tool.tooltip}
              >
                {tool.icon}
              </IconButton>
            </Tooltip>
          ))}
          
          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
          
          {/* Reset */}
          <Tooltip title="Reset">
            <IconButton onClick={handleReset} aria-label="Reset view">
              <ResetIcon />
            </IconButton>
          </Tooltip>
          
          {/* Image Navigation */}
          {viewerState.imageIds.length > 1 && (
            <>
              <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
              <IconButton 
                onClick={() => handleImageNavigation(-1)}
                disabled={viewerState.currentImageIndex === 0}
                aria-label="Previous image"
              >
                <PrevIcon />
              </IconButton>
              <Typography variant="body2">
                {viewerState.currentImageIndex + 1} / {viewerState.imageIds.length}
              </Typography>
              <IconButton 
                onClick={() => handleImageNavigation(1)}
                disabled={viewerState.currentImageIndex === viewerState.imageIds.length - 1}
                aria-label="Next image"
              >
                <NextIcon />
              </IconButton>
            </>
          )}
        </Stack>
      </Toolbar>

      {/* Main Viewer */}
      <Box sx={{ flexGrow: 1, position: 'relative', bgcolor: 'black', minHeight: '400px', height: '100%' }}>
        <div 
          ref={viewerRef}
          style={{
            width: '100%',
            height: '100%',
            minHeight: '400px',
            position: 'absolute',
            top: 0,
            left: 0,
            display: 'block'
          }}
        />
        
        {/* Image Info Overlay */}
        <Box
          sx={{
            position: 'absolute',
            top: 10,
            left: 10,
            color: 'white',
            fontSize: '12px',
            fontFamily: 'monospace',
            pointerEvents: 'none'
          }}
        >
          <div>Size: {viewerState.imageInfo.width} x {viewerState.imageInfo.height}</div>
          <div>Pixel Spacing: {viewerState.imageInfo.pixelSpacing}</div>
          <div>Slice Thickness: {viewerState.imageInfo.sliceThickness}</div>
        </Box>
        
        {/* Window/Level Display */}
        <Box
          sx={{
            position: 'absolute',
            top: 10,
            right: 10,
            color: 'white',
            fontSize: '12px',
            fontFamily: 'monospace',
            pointerEvents: 'none'
          }}
        >
          <div>W: {Math.round(viewerState.windowWidth)} L: {Math.round(viewerState.windowCenter)}</div>
          <div>Zoom: {(viewerState.zoom * 100).toFixed(0)}%</div>
        </Box>
      </Box>

      {/* Controls Panel */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Stack direction="row" spacing={4} alignItems="center">
          {/* Window Width */}
          <Box sx={{ minWidth: 200 }}>
            <Typography variant="caption">Window Width</Typography>
            <Slider
              value={viewerState.windowWidth}
              onChange={(e, value) => handleWindowingChange(value as number, viewerState.windowCenter)}
              min={1}
              max={4000}
              valueLabelDisplay="auto"
              aria-label="Window width"
            />
          </Box>
          
          {/* Window Center */}
          <Box sx={{ minWidth: 200 }}>
            <Typography variant="caption">Window Center</Typography>
            <Slider
              value={viewerState.windowCenter}
              onChange={(e, value) => handleWindowingChange(viewerState.windowWidth, value as number)}
              min={-1000}
              max={3000}
              valueLabelDisplay="auto"
              aria-label="Window center"
            />
          </Box>
          
          {/* Zoom */}
          <Box sx={{ minWidth: 150 }}>
            <Typography variant="caption">Zoom</Typography>
            <Slider
              value={viewerState.zoom}
              onChange={(e, value) => handleZoomChange(value as number)}
              min={0.1}
              max={5}
              step={0.1}
              valueLabelDisplay="auto"
              valueLabelFormat={(value) => `${(value * 100).toFixed(0)}%`}
              aria-label="Zoom level"
            />
          </Box>
        </Stack>
      </Box>
    </Paper>
  );
};

export default ImageViewer;