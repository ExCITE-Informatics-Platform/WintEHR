/**
 * ImageViewerV2_Simple Component
 * Simplified DICOM image viewer with basic interaction tools
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
  CircularProgress,
  Alert,
  Stack,
  SxProps,
  Theme,
} from '@mui/material';
import {
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Brightness6 as BrightnessIcon,
  RestartAlt as ResetIcon,
  NavigateBefore as PrevIcon,
  NavigateNext as NextIcon,
  PanTool as PanIcon,
  TouchApp as WindowLevelIcon,
} from '@mui/icons-material';
import api from '../services/api';

import cornerstone from 'cornerstone-core';
import cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader';
import dicomParser from 'dicom-parser';

/**
 * Type definitions for ImageViewerV2_Simple component
 */
export type MouseTool = 'Wwwc' | 'Pan';

export interface ImageViewerV2SimpleProps {
  studyId: string;
  seriesId?: string;
  onClose?: () => void;
  sx?: SxProps<Theme>;
}

export interface ViewportSettings {
  voi: {
    windowWidth: number;
    windowCenter: number;
  };
  scale: number;
  translation: {
    x: number;
    y: number;
  };
  invert: boolean;
  pixelReplication: boolean;
  rotation: number;
  hflip: boolean;
  vflip: boolean;
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
  getPixelData: () => Uint16Array | Int16Array | Uint8Array;
}

export interface ImageInstance {
  id: string;
  sop_instance_uid: string;
  instance_number: number;
  file_path?: string;
}

export interface SeriesData {
  series_instance_uid: string;
  series_description?: string;
  modality: string;
  instances: ImageInstance[];
}

export interface StudyResponse {
  success: boolean;
  data: SeriesData[];
  message?: string;
}

export interface MouseHandlers {
  mousedown: (event: MouseEvent) => void;
  mousemove: (event: MouseEvent) => void;
  mouseup: (event: MouseEvent) => void;
  mouseleave: (event: MouseEvent) => void;
  contextmenu: (event: MouseEvent) => boolean;
  wheel: (event: WheelEvent) => void;
}

export interface ViewerElement extends HTMLDivElement {
  _mouseHandlers?: MouseHandlers;
}

export interface CornerstoneEvent extends Event {
  target: HTMLElement;
}

/**
 * Initialize Cornerstone
 */
cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
cornerstoneWADOImageLoader.external.dicomParser = dicomParser;

// Configure image loader
cornerstoneWADOImageLoader.configure({
  beforeSend: function(xhr: XMLHttpRequest) {
    const token = localStorage.getItem('token');
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }
  }
});

/**
 * Helper functions
 */
const clampZoom = (zoom: number): number => {
  return Math.max(0.1, Math.min(5, zoom));
};

const clampWindowWidth = (width: number): number => {
  return Math.max(1, width);
};

/**
 * ImageViewerV2_Simple Component
 */
const ImageViewerV2Simple: React.FC<ImageViewerV2SimpleProps> = ({ 
  studyId, 
  seriesId, 
  onClose,
  sx 
}) => {
  const viewerRef = useRef<ViewerElement>(null);
  const activeToolRef = useRef<MouseTool>('Wwwc');
  const currentImageIndexRef = useRef<number>(0);
  const imageIdsRef = useRef<string[]>([]);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [imageIds, setImageIds] = useState<string[]>([]);
  const [windowWidth, setWindowWidth] = useState<number>(400);
  const [windowCenter, setWindowCenter] = useState<number>(40);
  const [zoom, setZoom] = useState<number>(1);
  const [activeTool, setActiveTool] = useState<MouseTool>('Wwwc');
  
  // Update refs when state changes
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);
  
  useEffect(() => {
    currentImageIndexRef.current = currentImageIndex;
  }, [currentImageIndex]);
  
  useEffect(() => {
    imageIdsRef.current = imageIds;
  }, [imageIds]);

  const fetchImageData = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      // Fetch series data
      const seriesResponse = await api.get<StudyResponse>(`/api/imaging/wado/studies/${studyId}/series`);
      const seriesResult = seriesResponse.data;
      
      if (!seriesResult.success || !seriesResult.data || seriesResult.data.length === 0) {
        throw new Error('No series found');
      }

      // Get first series or matching series
      let targetSeries = seriesResult.data[0];
      if (seriesId) {
        const found = seriesResult.data.find(s => s.series_instance_uid === seriesId);
        if (found) targetSeries = found;
      }

      if (!targetSeries.instances || targetSeries.instances.length === 0) {
        throw new Error('No images found');
      }

      // Create image IDs
      const baseUrl = window.location.origin;
      const imageIdArray = targetSeries.instances.map((inst: ImageInstance) => 
        `wadouri:${baseUrl}/api/imaging/wado/instances/${inst.id}`
      );
      
      setImageIds(imageIdArray);
      setLoading(false);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch image data';
      console.error('Error fetching image data:', err);
      setError(errorMessage);
      setLoading(false);
    }
  }, [studyId, seriesId]);

  const loadAndDisplayImage = useCallback(async (imageId: string): Promise<void> => {
    try {
      const element = viewerRef.current;
      if (!element) return;

      const image = await cornerstone.loadImage(imageId);
      cornerstone.displayImage(element, image);
      
      const viewport = cornerstone.getDefaultViewportForImage(element, image);
      cornerstone.setViewport(element, viewport);
      cornerstone.resize(element);
      
      setWindowWidth(viewport.voi.windowWidth);
      setWindowCenter(viewport.voi.windowCenter);
      setZoom(viewport.scale);
    } catch (err) {
      console.error('Error loading image:', err);
      setError('Failed to load image');
    }
  }, []);

  const onImageRendered = useCallback((e: CornerstoneEvent): void => {
    const viewport = cornerstone.getViewport(e.target as HTMLElement);
    if (viewport) {
      setWindowWidth(Math.round(viewport.voi.windowWidth));
      setWindowCenter(Math.round(viewport.voi.windowCenter));
      setZoom(parseFloat(viewport.scale.toFixed(2)));
    }
  }, []);

  const onNewImage = useCallback((e: CornerstoneEvent): void => {
    const viewport = cornerstone.getViewport(e.target as HTMLElement);
    if (viewport) {
      setWindowWidth(Math.round(viewport.voi.windowWidth));
      setWindowCenter(Math.round(viewport.voi.windowCenter));
      setZoom(parseFloat(viewport.scale.toFixed(2)));
    }
  }, []);

  const setupMouseTools = useCallback((element: ViewerElement): void => {
    try {
      // Track mouse state
      let mouseDown = false;
      let lastX = 0;
      let lastY = 0;
      let startX = 0;
      let startY = 0;
      let mouseButton = 0;
      
      // Mouse down handler
      const handleMouseDown = (e: MouseEvent): void => {
        if (!element) return;
        
        mouseDown = true;
        mouseButton = e.button;
        startX = lastX = e.pageX;
        startY = lastY = e.pageY;
        
        // Change cursor based on button
        if (mouseButton === 0) element.style.cursor = 'grabbing';
        else if (mouseButton === 2) element.style.cursor = 'zoom-in';
        
        e.preventDefault();
      };
      
      // Mouse move handler
      const handleMouseMove = (e: MouseEvent): void => {
        if (!mouseDown || !element) return;
        
        const deltaX = e.pageX - lastX;
        const deltaY = e.pageY - lastY;
        
        try {
          const viewport = cornerstone.getViewport(element);
          const currentTool = activeToolRef.current;
          
          if (mouseButton === 0 && currentTool === 'Wwwc') {
            // Window/Level adjustment
            viewport.voi.windowWidth = clampWindowWidth(viewport.voi.windowWidth + (deltaX * 2));
            viewport.voi.windowCenter = viewport.voi.windowCenter + (deltaY * 2);
            cornerstone.setViewport(element, viewport);
          } else if (mouseButton === 0 && currentTool === 'Pan') {
            // Pan
            viewport.translation.x += deltaX / viewport.scale;
            viewport.translation.y += deltaY / viewport.scale;
            cornerstone.setViewport(element, viewport);
          } else if (mouseButton === 2) {
            // Zoom
            const zoomSpeed = 0.01;
            const zoomDelta = deltaY * zoomSpeed;
            viewport.scale = clampZoom(viewport.scale - zoomDelta);
            cornerstone.setViewport(element, viewport);
          } else if (mouseButton === 1) {
            // Middle button - Pan
            viewport.translation.x += deltaX / viewport.scale;
            viewport.translation.y += deltaY / viewport.scale;
            cornerstone.setViewport(element, viewport);
          }
        } catch (err) {
          console.error('Error in mouse move:', err);
        }
        
        lastX = e.pageX;
        lastY = e.pageY;
        e.preventDefault();
      };
      
      // Mouse up handler
      const handleMouseUp = (e: MouseEvent): void => {
        mouseDown = false;
        const currentTool = activeToolRef.current;
        element.style.cursor = currentTool === 'Pan' ? 'grab' : currentTool === 'Wwwc' ? 'crosshair' : 'default';
        e.preventDefault();
      };
      
      // Prevent context menu on right click
      const handleContextMenu = (e: MouseEvent): boolean => {
        e.preventDefault();
        return false;
      };
      
      // Wheel handler for image navigation
      const handleWheel = (e: WheelEvent): void => {
        if (imageIdsRef.current.length <= 1) return;
        
        e.preventDefault();
        const direction = e.deltaY > 0 ? 1 : -1;
        
        // Calculate new index using ref values
        const currentIdx = currentImageIndexRef.current;
        const newIndex = currentIdx + direction;
        
        if (newIndex >= 0 && newIndex < imageIdsRef.current.length) {
          setCurrentImageIndex(newIndex);
          loadAndDisplayImage(imageIdsRef.current[newIndex]);
        }
      };
      
      // Add mouse event listeners
      element.addEventListener('mousedown', handleMouseDown);
      element.addEventListener('mousemove', handleMouseMove);
      element.addEventListener('mouseup', handleMouseUp);
      element.addEventListener('mouseleave', handleMouseUp);
      element.addEventListener('contextmenu', handleContextMenu);
      element.addEventListener('wheel', handleWheel, { passive: false });
      
      // Store handlers for cleanup
      element._mouseHandlers = {
        mousedown: handleMouseDown,
        mousemove: handleMouseMove,
        mouseup: handleMouseUp,
        mouseleave: handleMouseUp,
        contextmenu: handleContextMenu,
        wheel: handleWheel
      };
      
      // Add viewport update listeners
      element.addEventListener('cornerstoneimagerendered', onImageRendered as EventListener);
      element.addEventListener('cornerstonenewimage', onNewImage as EventListener);

    } catch (error) {
      console.error('Error setting up mouse tools:', error);
    }
  }, [loadAndDisplayImage, onImageRendered, onNewImage]);

  const initializeViewer = useCallback(async (): Promise<void> => {
    try {
      const element = viewerRef.current;
      if (!element) return;

      cornerstone.enable(element);
      
      // Setup mouse tools
      setupMouseTools(element);
      
      // Load first image
      if (imageIds.length > 0) {
        await loadAndDisplayImage(imageIds[0]);
      }
    } catch (err) {
      console.error('Error initializing viewer:', err);
      setError('Failed to initialize viewer');
    }
  }, [imageIds, setupMouseTools, loadAndDisplayImage]);

  const handleWindowingChange = useCallback((width: number, center: number): void => {
    const element = viewerRef.current;
    if (!element) return;

    try {
      const viewport = cornerstone.getViewport(element);
      viewport.voi.windowWidth = clampWindowWidth(width);
      viewport.voi.windowCenter = center;
      cornerstone.setViewport(element, viewport);
      
      setWindowWidth(width);
      setWindowCenter(center);
    } catch (error) {
      console.error('Error changing windowing:', error);
    }
  }, []);

  const handleZoomChange = useCallback((newZoom: number): void => {
    const element = viewerRef.current;
    if (!element) return;

    try {
      const clampedZoom = clampZoom(newZoom);
      const viewport = cornerstone.getViewport(element);
      viewport.scale = clampedZoom;
      cornerstone.setViewport(element, viewport);
      
      setZoom(clampedZoom);
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
      setWindowWidth(viewport.voi.windowWidth);
      setWindowCenter(viewport.voi.windowCenter);
      setZoom(viewport.scale);
    } catch (error) {
      console.error('Error resetting viewer:', error);
    }
  }, []);

  const handleImageNavigation = useCallback((direction: number): void => {
    const newIndex = currentImageIndex + direction;
    if (newIndex >= 0 && newIndex < imageIds.length) {
      setCurrentImageIndex(newIndex);
      loadAndDisplayImage(imageIds[newIndex]);
    }
  }, [currentImageIndex, imageIds, loadAndDisplayImage]);

  const handleKeyPress = useCallback((e: KeyboardEvent): void => {
    if (!viewerRef.current) return;
    
    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault();
        handleImageNavigation(-1);
        break;
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault();
        handleImageNavigation(1);
        break;
      case 'r':
      case 'R':
        e.preventDefault();
        handleReset();
        break;
      default:
        break;
    }
  }, [handleImageNavigation, handleReset]);

  // Fetch image data
  useEffect(() => {
    fetchImageData();
  }, [fetchImageData]);

  // Initialize viewer when element is ready
  useEffect(() => {
    if (!loading && imageIds.length > 0 && viewerRef.current) {
      initializeViewer();
    }
  }, [loading, imageIds, initializeViewer]);

  // Keyboard navigation
  useEffect(() => {
    if (!loading) {
      document.addEventListener('keydown', handleKeyPress);
      return () => document.removeEventListener('keydown', handleKeyPress);
    }
  }, [loading, handleKeyPress]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const element = viewerRef.current;
      if (element) {
        try {
          // Remove custom mouse handlers
          if (element._mouseHandlers) {
            Object.entries(element._mouseHandlers).forEach(([event, handler]) => {
              element.removeEventListener(event, handler as EventListener);
            });
          }
          
          // Remove event listeners
          element.removeEventListener('cornerstoneimagerendered', onImageRendered as EventListener);
          element.removeEventListener('cornerstonenewimage', onNewImage as EventListener);
          
          // Disable cornerstone
          cornerstone.disable(element);
        } catch (err) {
          console.error('Error cleaning up viewer:', err);
        }
      }
    };
  }, [onImageRendered, onNewImage]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height={600}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Paper elevation={3} sx={{ height: '80vh', display: 'flex', flexDirection: 'column', ...sx }}>
      {/* Toolbar */}
      <Toolbar sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" spacing={2} alignItems="center">
          {/* Mouse Tool Selection */}
          <IconButton 
            onClick={() => setActiveTool('Wwwc')}
            color={activeTool === 'Wwwc' ? 'primary' : 'default'}
            title="Window/Level (Left Click + Drag)"
            aria-label="Window/Level tool"
          >
            <WindowLevelIcon />
          </IconButton>
          <IconButton 
            onClick={() => setActiveTool('Pan')}
            color={activeTool === 'Pan' ? 'primary' : 'default'}
            title="Pan (Middle Click + Drag)"
            aria-label="Pan tool"
          >
            <PanIcon />
          </IconButton>
          
          {/* Manual Controls */}
          <IconButton 
            onClick={() => handleZoomChange(zoom * 1.2)} 
            title="Zoom In"
            aria-label="Zoom in"
          >
            <ZoomInIcon />
          </IconButton>
          <IconButton 
            onClick={() => handleZoomChange(zoom * 0.8)} 
            title="Zoom Out"
            aria-label="Zoom out"
          >
            <ZoomOutIcon />
          </IconButton>
          <IconButton 
            onClick={handleReset} 
            title="Reset View"
            aria-label="Reset view"
          >
            <ResetIcon />
          </IconButton>
          
          {imageIds.length > 1 && (
            <>
              <IconButton 
                onClick={() => handleImageNavigation(-1)}
                disabled={currentImageIndex === 0}
                aria-label="Previous image"
              >
                <PrevIcon />
              </IconButton>
              <Typography>{currentImageIndex + 1} / {imageIds.length}</Typography>
              <IconButton 
                onClick={() => handleImageNavigation(1)}
                disabled={currentImageIndex === imageIds.length - 1}
                aria-label="Next image"
              >
                <NextIcon />
              </IconButton>
            </>
          )}
        </Stack>
      </Toolbar>

      {/* Viewer */}
      <Box sx={{ flexGrow: 1, position: 'relative', bgcolor: 'black' }}>
        <div 
          ref={viewerRef}
          tabIndex={0}
          style={{
            width: '100%',
            height: '100%',
            position: 'absolute',
            outline: 'none',
            cursor: activeTool === 'Pan' ? 'grab' : activeTool === 'Wwwc' ? 'crosshair' : 'default'
          }}
        />
        
        {/* Instructions overlay */}
        <Box 
          sx={{ 
            position: 'absolute', 
            top: 10, 
            left: 10, 
            color: 'white', 
            backgroundColor: 'rgba(0,0,0,0.7)',
            padding: 1,
            borderRadius: 1,
            fontSize: '0.75rem',
            pointerEvents: 'none'
          }}
        >
          <div>Left Click: Adjust Contrast/Brightness</div>
          <div>Middle Click: Pan</div>
          <div>Right Click: Zoom</div>
          {imageIds.length > 1 && (
            <div>Mouse Wheel: Navigate Images</div>
          )}
          <div>Arrow Keys: Navigate</div>
          <div>R: Reset View</div>
        </Box>
      </Box>

      {/* Controls */}
      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Stack direction="row" spacing={4}>
          <Box sx={{ minWidth: 200 }}>
            <Typography variant="caption">Window Width (Contrast)</Typography>
            <Slider
              value={windowWidth}
              onChange={(e, value) => handleWindowingChange(value as number, windowCenter)}
              min={1}
              max={4000}
              valueLabelDisplay="auto"
              aria-label="Window width"
            />
          </Box>
          
          <Box sx={{ minWidth: 200 }}>
            <Typography variant="caption">Window Center (Brightness)</Typography>
            <Slider
              value={windowCenter}
              onChange={(e, value) => handleWindowingChange(windowWidth, value as number)}
              min={-1000}
              max={3000}
              valueLabelDisplay="auto"
              aria-label="Window center"
            />
          </Box>
          
          <Box sx={{ minWidth: 150 }}>
            <Typography variant="caption">Zoom</Typography>
            <Slider
              value={zoom}
              onChange={(e, value) => handleZoomChange(value as number)}
              min={0.1}
              max={5}
              step={0.1}
              valueLabelDisplay="auto"
              aria-label="Zoom level"
            />
          </Box>
        </Stack>
      </Box>
    </Paper>
  );
};

export default ImageViewerV2Simple;