/**
 * ThemeSwitcher Component
 * Allows users to switch between different medical themes and modes
 * 
 * Migrated to TypeScript with comprehensive type safety for theme management.
 */

import React, { useState, MouseEvent } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Typography,
  Avatar,
  Chip,
  Switch,
  FormControlLabel,
  Stack,
  IconButton,
  Tooltip,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  SxProps,
  Theme,
} from '@mui/material';
import {
  Palette as PaletteIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  Accessibility as AccessibilityIcon,
  Colorize as ColorizeIcon,
  Preview as PreviewIcon,
  Check as CheckIcon,
  Settings as SettingsIcon,
  Visibility as VisibilityIcon,
  Psychology as PsychologyIcon,
  LocalHospital as MedicalIcon,
} from '@mui/icons-material';
import { themePresets } from '../../themes/medicalTheme';

/**
 * Type definitions for ThemeSwitcher component
 */
export type ThemeMode = 'light' | 'dark';
export type ThemeKey = 'professional' | 'accessible' | 'warm' | 'dark';

export interface ThemePreset {
  name: string;
  description: string;
  colors?: {
    primary: string;
    secondary: string;
    accent?: string;
  };
}

export interface ThemePreviewCardProps {
  theme: ThemePreset & { key: ThemeKey };
  isSelected: boolean;
  onSelect: () => void;
  mode?: ThemeMode;
}

export interface ThemeCustomizationOptions {
  highContrast?: boolean;
  largeText?: boolean;
  reducedMotion?: boolean;
  colorCodedSeverity?: boolean;
  departmentColors?: boolean;
}

export interface ThemeCustomizationPanelProps {
  theme: ThemeKey;
  onCustomize: (options: ThemeCustomizationOptions) => void;
}

export interface ThemeSwitcherProps {
  currentTheme?: ThemeKey;
  currentMode?: ThemeMode;
  onThemeChange?: (theme: ThemeKey) => void;
  onModeChange?: (mode: ThemeMode) => void;
  compact?: boolean;
  sx?: SxProps<Theme>;
}

export interface ColorScheme {
  primary: string;
  secondary: string;
  background: string;
}

export interface ThemePreviewStyles {
  [key in ThemeKey]: {
    light: ColorScheme;
    dark: ColorScheme;
  };
}

/**
 * Constants
 */
const THEME_PREVIEW_STYLES: ThemePreviewStyles = {
  professional: {
    light: { primary: '#1565C0', secondary: '#2E7D32', background: '#FAFBFC' },
    dark: { primary: '#42A5F5', secondary: '#66BB6A', background: '#0A0E13' }
  },
  accessible: {
    light: { primary: '#0066CC', secondary: '#006600', background: '#FFFFFF' },
    dark: { primary: '#3399FF', secondary: '#339933', background: '#000000' }
  },
  warm: {
    light: { primary: '#7C4DFF', secondary: '#FF7043', background: '#FFFEF7' },
    dark: { primary: '#B085F5', secondary: '#FFAB91', background: '#1A0E1A' }
  },
  dark: {
    light: { primary: '#1976D2', secondary: '#4CAF50', background: '#FAFAFA' },
    dark: { primary: '#42A5F5', secondary: '#66BB6A', background: '#0A0E13' }
  }
};

/**
 * ThemePreviewCard Component
 */
const ThemePreviewCard: React.FC<ThemePreviewCardProps> = ({ 
  theme, 
  isSelected, 
  onSelect, 
  mode = 'light' 
}) => {
  const colors = THEME_PREVIEW_STYLES[theme.key]?.[mode] || THEME_PREVIEW_STYLES.professional[mode];

  return (
    <Card 
      sx={{ 
        cursor: 'pointer',
        border: isSelected ? 2 : 1,
        borderColor: isSelected ? 'primary.main' : 'divider',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          boxShadow: 3,
          transform: 'translateY(-2px)'
        }
      }}
      onClick={onSelect}
    >
      <CardHeader
        avatar={
          <Avatar 
            sx={{ 
              bgcolor: colors.primary,
              width: 32,
              height: 32
            }}
          >
            {isSelected ? <CheckIcon /> : <PaletteIcon />}
          </Avatar>
        }
        title={theme.name}
        titleTypographyProps={{ variant: 'subtitle1', fontWeight: 600 }}
        subheader={theme.description}
        subheaderTypographyProps={{ variant: 'caption' }}
        action={
          isSelected && (
            <Chip 
              label="Active" 
              color="primary" 
              size="small"
              icon={<CheckIcon />}
            />
          )
        }
      />
      <CardContent sx={{ pt: 0 }}>
        {/* Theme Preview */}
        <Paper 
          sx={{ 
            p: 2, 
            backgroundColor: colors.background,
            border: 1,
            borderColor: 'divider',
            borderRadius: 2
          }}
          elevation={0}
        >
          <Stack spacing={1}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Box 
                sx={{ 
                  width: 16, 
                  height: 16, 
                  borderRadius: '50%', 
                  backgroundColor: colors.primary 
                }} 
              />
              <Box 
                sx={{ 
                  width: 16, 
                  height: 16, 
                  borderRadius: '50%', 
                  backgroundColor: colors.secondary 
                }} 
              />
              <Box 
                sx={{ 
                  width: 16, 
                  height: 16, 
                  borderRadius: '50%', 
                  backgroundColor: mode === 'dark' ? '#EF5350' : '#D32F2F' 
                }} 
              />
            </Box>
            <Typography 
              variant="caption" 
              sx={{ 
                color: mode === 'dark' ? '#F7FAFC' : '#1A202C',
                fontSize: '0.7rem'
              }}
            >
              Sample clinical interface
            </Typography>
          </Stack>
        </Paper>
      </CardContent>
    </Card>
  );
};

/**
 * ThemeCustomizationPanel Component
 */
const ThemeCustomizationPanel: React.FC<ThemeCustomizationPanelProps> = ({ theme, onCustomize }) => {
  const [options, setOptions] = useState<ThemeCustomizationOptions>({
    highContrast: false,
    largeText: false,
    reducedMotion: false,
    colorCodedSeverity: true,
    departmentColors: false
  });

  const handleOptionChange = (key: keyof ThemeCustomizationOptions) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const newOptions = { ...options, [key]: event.target.checked };
    setOptions(newOptions);
    onCustomize(newOptions);
  };

  return (
    <Paper sx={{ p: 3, borderRadius: 3 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SettingsIcon />
        Theme Customization
      </Typography>
      
      <Stack spacing={3}>
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Accessibility Features
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon>
                <AccessibilityIcon />
              </ListItemIcon>
              <ListItemText 
                primary="High Contrast Mode" 
                secondary="Enhances visibility for users with visual impairments"
              />
              <ListItemSecondaryAction>
                <Switch 
                  checked={options.highContrast}
                  onChange={handleOptionChange('highContrast')}
                />
              </ListItemSecondaryAction>
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <VisibilityIcon />
              </ListItemIcon>
              <ListItemText 
                primary="Large Text" 
                secondary="Increases font sizes throughout the interface"
              />
              <ListItemSecondaryAction>
                <Switch 
                  checked={options.largeText}
                  onChange={handleOptionChange('largeText')}
                />
              </ListItemSecondaryAction>
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <PsychologyIcon />
              </ListItemIcon>
              <ListItemText 
                primary="Reduced Motion" 
                secondary="Minimizes animations and transitions"
              />
              <ListItemSecondaryAction>
                <Switch 
                  checked={options.reducedMotion}
                  onChange={handleOptionChange('reducedMotion')}
                />
              </ListItemSecondaryAction>
            </ListItem>
          </List>
        </Box>

        <Divider />

        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Clinical Interface Options
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon>
                <MedicalIcon />
              </ListItemIcon>
              <ListItemText 
                primary="Color-Coded Severity" 
                secondary="Use colors to indicate clinical severity levels"
              />
              <ListItemSecondaryAction>
                <Switch 
                  checked={options.colorCodedSeverity}
                  onChange={handleOptionChange('colorCodedSeverity')}
                />
              </ListItemSecondaryAction>
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <ColorizeIcon />
              </ListItemIcon>
              <ListItemText 
                primary="Department Colors" 
                secondary="Color-code interface by medical department"
              />
              <ListItemSecondaryAction>
                <Switch 
                  checked={options.departmentColors}
                  onChange={handleOptionChange('departmentColors')}
                />
              </ListItemSecondaryAction>
            </ListItem>
          </List>
        </Box>
      </Stack>
    </Paper>
  );
};

/**
 * ThemeSwitcher Component
 */
const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ 
  currentTheme = 'professional', 
  currentMode = 'light', 
  onThemeChange,
  onModeChange,
  compact = false,
  sx
}) => {
  const [open, setOpen] = useState<boolean>(false);
  const [selectedTheme, setSelectedTheme] = useState<ThemeKey>(currentTheme);
  const [selectedMode, setSelectedMode] = useState<ThemeMode>(currentMode);
  const [showCustomization, setShowCustomization] = useState<boolean>(false);

  const handleOpen = (): void => {
    setOpen(true);
  };

  const handleClose = (): void => {
    setOpen(false);
    setSelectedTheme(currentTheme);
    setSelectedMode(currentMode);
    setShowCustomization(false);
  };

  const handleApply = (): void => {
    onThemeChange?.(selectedTheme);
    onModeChange?.(selectedMode);
    setOpen(false);
  };

  const handleThemeSelect = (themeKey: ThemeKey): void => {
    setSelectedTheme(themeKey);
  };

  const handleModeSelect = (mode: ThemeMode): void => {
    setSelectedMode(mode);
  };

  const handleCustomizationToggle = (): void => {
    setShowCustomization(!showCustomization);
  };

  const handleCustomize = (options: ThemeCustomizationOptions): void => {
    // Handle customization options
    console.log('Theme customization options:', options);
  };

  // Transform theme presets to include keys
  const themes = Object.entries(themePresets).map(([key, preset]) => ({
    key: key as ThemeKey,
    ...preset
  }));

  if (compact) {
    return (
      <>
        <Tooltip title="Change Theme">
          <IconButton onClick={handleOpen} sx={sx}>
            <PaletteIcon />
          </IconButton>
        </Tooltip>

        <Dialog 
          open={open} 
          onClose={handleClose}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Theme Settings</DialogTitle>
          <DialogContent>
            <Stack spacing={2}>
              <FormControlLabel
                control={
                  <Switch
                    checked={selectedMode === 'dark'}
                    onChange={(e) => handleModeSelect(e.target.checked ? 'dark' : 'light')}
                  />
                }
                label={`${selectedMode === 'dark' ? 'Dark' : 'Light'} Mode`}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>Cancel</Button>
            <Button variant="contained" onClick={handleApply}>Apply</Button>
          </DialogActions>
        </Dialog>
      </>
    );
  }

  return (
    <Box sx={sx}>
      <Tooltip title="Change Theme">
        <IconButton onClick={handleOpen}>
          <PaletteIcon />
        </IconButton>
      </Tooltip>

      <Dialog 
        open={open} 
        onClose={handleClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3 }
        }}
      >
        <DialogTitle>
          <Stack direction="row" spacing={2} alignItems="center">
            <PaletteIcon color="primary" />
            <Box>
              <Typography variant="h6">
                Theme Settings
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Customize the appearance of your medical interface
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>

        <DialogContent>
          <Stack spacing={4}>
            {/* Mode Selection */}
            <Box>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {selectedMode === 'dark' ? <DarkModeIcon /> : <LightModeIcon />}
                Display Mode
              </Typography>
              
              <Stack direction="row" spacing={2}>
                <Button
                  variant={selectedMode === 'light' ? 'contained' : 'outlined'}
                  startIcon={<LightModeIcon />}
                  onClick={() => handleModeSelect('light')}
                  sx={{ flex: 1 }}
                >
                  Light Mode
                </Button>
                <Button
                  variant={selectedMode === 'dark' ? 'contained' : 'outlined'}
                  startIcon={<DarkModeIcon />}
                  onClick={() => handleModeSelect('dark')}
                  sx={{ flex: 1 }}
                >
                  Dark Mode
                </Button>
              </Stack>
            </Box>

            {/* Theme Selection */}
            <Box>
              <Typography variant="h6" gutterBottom>
                Color Scheme
              </Typography>
              
              <Grid container spacing={2}>
                {themes.map((theme) => (
                  <Grid item xs={12} sm={6} key={theme.key}>
                    <ThemePreviewCard
                      theme={theme}
                      isSelected={selectedTheme === theme.key}
                      onSelect={() => handleThemeSelect(theme.key)}
                      mode={selectedMode}
                    />
                  </Grid>
                ))}
              </Grid>
            </Box>

            {/* Customization Panel */}
            <Box>
              <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="h6">
                  Advanced Options
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleCustomizationToggle}
                >
                  {showCustomization ? 'Hide' : 'Show'} Options
                </Button>
              </Stack>
              
              {showCustomization && (
                <ThemeCustomizationPanel 
                  theme={selectedTheme}
                  onCustomize={handleCustomize}
                />
              )}
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 3, pt: 1 }}>
          <Button onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleApply}
            startIcon={<CheckIcon />}
          >
            Apply Theme
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ThemeSwitcher;