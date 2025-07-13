/**
 * VitalSignsChart Component
 * Reusable vital signs chart for displaying trends
 * 
 * Migrated to TypeScript with comprehensive type safety for vital signs visualization.
 */

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  FormControl,
  Select,
  MenuItem,
  Stack,
  Chip,
  useTheme,
  alpha,
  SelectChangeEvent,
  SxProps,
  Theme,
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
  TooltipProps,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { R4 } from '@ahryman40k/ts-fhir-types';

/**
 * Type definitions for VitalSignsChart component
 */
export type VitalType = 
  | 'bloodPressure' 
  | 'heartRate' 
  | 'temperature' 
  | 'oxygenSaturation' 
  | 'respiratoryRate' 
  | 'weight' 
  | 'bmi';

export interface VitalConfig {
  label: string;
  codes: string[];
  unit: string;
  normalRange?: [number, number];
  normalRanges?: {
    systolic: [number, number];
    diastolic: [number, number];
  };
  color?: string;
  colors?: {
    systolic: string;
    diastolic: string;
  };
}

export interface ChartDataPoint {
  date: string;
  fullDate: string;
  id: string;
  value?: number;
  systolic?: number;
  diastolic?: number;
}

export interface VitalSignsChartProps {
  patientId?: string;
  vitalSigns: R4.IObservation[];
  selectedVitalType?: VitalType;
  height?: number;
  sx?: SxProps<Theme>;
}

export interface CustomTooltipProps extends TooltipProps<number, string> {
  vitalConfig: VitalConfig;
}

/**
 * Constants
 */
const VITAL_TYPES: Record<VitalType, VitalConfig> = {
  bloodPressure: {
    label: 'Blood Pressure',
    codes: ['85354-9', '55284-4'],
    unit: 'mmHg',
    normalRanges: { systolic: [90, 140], diastolic: [60, 90] },
    colors: { systolic: '#ff4444', diastolic: '#ff9999' }
  },
  heartRate: {
    label: 'Heart Rate',
    codes: ['8867-4'],
    unit: 'bpm',
    normalRange: [60, 100],
    color: '#ff9800'
  },
  temperature: {
    label: 'Temperature',
    codes: ['8310-5'],
    unit: '°F',
    normalRange: [97.0, 99.5],
    color: '#4caf50'
  },
  oxygenSaturation: {
    label: 'Oxygen Saturation',
    codes: ['2708-6', '59408-5'],
    unit: '%',
    normalRange: [95, 100],
    color: '#2196f3'
  },
  respiratoryRate: {
    label: 'Respiratory Rate',
    codes: ['9279-1'],
    unit: 'breaths/min',
    normalRange: [12, 20],
    color: '#9c27b0'
  },
  weight: {
    label: 'Weight',
    codes: ['29463-7', '3141-9'],
    unit: 'kg',
    color: '#607d8b'
  },
  bmi: {
    label: 'BMI',
    codes: ['39156-5'],
    unit: 'kg/m²',
    normalRange: [18.5, 25],
    color: '#795548'
  }
};

/**
 * Helper functions
 */
const isValidVitalType = (type: string): type is VitalType => {
  return Object.keys(VITAL_TYPES).includes(type);
};

const getObservationCode = (observation: R4.IObservation): string | undefined => {
  return observation.code?.coding?.[0]?.code;
};

const getObservationDate = (observation: R4.IObservation): string => {
  return observation.effectiveDateTime || observation.issued || '';
};

const formatChartDate = (dateString: string): string => {
  if (!dateString) return 'Unknown';
  
  try {
    return format(parseISO(dateString), 'MMM d, yyyy');
  } catch (error) {
    return 'Unknown';
  }
};

const findComponentByCode = (
  components: R4.IObservationComponent[] | undefined, 
  code: string
): R4.IObservationComponent | undefined => {
  return components?.find(c => c.code?.coding?.[0]?.code === code);
};

const isValueOutOfRange = (
  value: number, 
  range: [number, number]
): boolean => {
  return value < range[0] || value > range[1];
};

/**
 * Custom Tooltip Component
 */
const CustomTooltip: React.FC<CustomTooltipProps> = ({ 
  active, 
  payload, 
  label, 
  vitalConfig 
}) => {
  if (active && payload && payload.length) {
    return (
      <Paper sx={{ p: 1.5 }}>
        <Typography variant="caption" display="block" gutterBottom>
          {label}
        </Typography>
        {payload.map((entry, index) => (
          <Typography key={index} variant="body2" sx={{ color: entry.color }}>
            {entry.name}: {entry.value} {vitalConfig.unit}
          </Typography>
        ))}
      </Paper>
    );
  }
  return null;
};

/**
 * VitalSignsChart Component
 */
const VitalSignsChart: React.FC<VitalSignsChartProps> = ({ 
  patientId,
  vitalSigns, 
  selectedVitalType = 'bloodPressure', 
  height = 300,
  sx 
}) => {
  const theme = useTheme();
  const [vitalType, setVitalType] = useState<VitalType>(selectedVitalType);
  
  const vitalConfig = VITAL_TYPES[vitalType];
  
  // Filter and process vital signs based on selected type
  const processVitalSigns = (): ChartDataPoint[] => {
    const filtered = vitalSigns.filter((obs: R4.IObservation) => {
      const code = getObservationCode(obs);
      return code && vitalConfig.codes.includes(code);
    });
    
    // Sort by date
    const sorted = filtered.sort((a: R4.IObservation, b: R4.IObservation) => {
      const dateA = new Date(getObservationDate(a) || 0);
      const dateB = new Date(getObservationDate(b) || 0);
      return dateA.getTime() - dateB.getTime();
    });
    
    // Format for chart
    return sorted.map((obs: R4.IObservation) => {
      const date = getObservationDate(obs);
      const baseData: ChartDataPoint = {
        date: formatChartDate(date),
        fullDate: date,
        id: obs.id || ''
      };
      
      if (vitalType === 'bloodPressure' && obs.component) {
        // Handle blood pressure with systolic and diastolic
        const systolic = findComponentByCode(obs.component, '8480-6');
        const diastolic = findComponentByCode(obs.component, '8462-4');
        return {
          ...baseData,
          systolic: systolic?.valueQuantity?.value,
          diastolic: diastolic?.valueQuantity?.value
        };
      } else {
        // Handle single value vitals
        return {
          ...baseData,
          value: obs.valueQuantity?.value
        };
      }
    });
  };
  
  const chartData = processVitalSigns();
  
  // Check if values are out of normal range
  const hasAbnormalValues = (): boolean => {
    if (vitalType === 'bloodPressure' && vitalConfig.normalRanges) {
      return chartData.some((d: ChartDataPoint) => 
        (d.systolic && isValueOutOfRange(d.systolic, vitalConfig.normalRanges!.systolic)) ||
        (d.diastolic && isValueOutOfRange(d.diastolic, vitalConfig.normalRanges!.diastolic))
      );
    } else if (vitalConfig.normalRange) {
      return chartData.some((d: ChartDataPoint) => 
        d.value && isValueOutOfRange(d.value, vitalConfig.normalRange!)
      );
    }
    return false;
  };

  const handleVitalTypeChange = (event: SelectChangeEvent<VitalType>): void => {
    const newType = event.target.value as VitalType;
    if (isValidVitalType(newType)) {
      setVitalType(newType);
    }
  };
  
  const renderTooltip = (props: TooltipProps<number, string>) => (
    <CustomTooltip {...props} vitalConfig={vitalConfig} />
  );

  return (
    <Paper sx={{ p: 2, ...sx }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <Select
            value={vitalType}
            onChange={handleVitalTypeChange}
          >
            {Object.entries(VITAL_TYPES).map(([key, config]) => (
              <MenuItem key={key} value={key}>{config.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
        
        {hasAbnormalValues() && (
          <Chip 
            label="Contains abnormal values" 
            color="warning" 
            size="small" 
          />
        )}
      </Stack>
      
      {chartData.length === 0 ? (
        <Box sx={{ 
          height: height, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          bgcolor: alpha(theme.palette.action.hover, 0.05),
          borderRadius: 1
        }}>
          <Typography variant="body2" color="text.secondary">
            No {vitalConfig.label.toLowerCase()} data available
          </Typography>
        </Box>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.5)} />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              stroke={theme.palette.text.secondary}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              stroke={theme.palette.text.secondary}
              label={{ 
                value: vitalConfig.unit, 
                angle: -90, 
                position: 'insideLeft',
                style: { fill: theme.palette.text.secondary }
              }}
            />
            <Tooltip content={renderTooltip} />
            
            {vitalType === 'bloodPressure' && vitalConfig.normalRanges ? (
              <>
                <ReferenceLine 
                  y={vitalConfig.normalRanges.systolic[0]} 
                  stroke={alpha(theme.palette.error.main, 0.3)} 
                  strokeDasharray="5 5" 
                />
                <ReferenceLine 
                  y={vitalConfig.normalRanges.systolic[1]} 
                  stroke={alpha(theme.palette.error.main, 0.3)} 
                  strokeDasharray="5 5" 
                />
                <ReferenceLine 
                  y={vitalConfig.normalRanges.diastolic[0]} 
                  stroke={alpha(theme.palette.error.main, 0.3)} 
                  strokeDasharray="5 5" 
                />
                <ReferenceLine 
                  y={vitalConfig.normalRanges.diastolic[1]} 
                  stroke={alpha(theme.palette.error.main, 0.3)} 
                  strokeDasharray="5 5" 
                />
                <Line 
                  type="monotone" 
                  dataKey="systolic" 
                  stroke={vitalConfig.colors!.systolic} 
                  name="Systolic"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="diastolic" 
                  stroke={vitalConfig.colors!.diastolic} 
                  name="Diastolic"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Legend />
              </>
            ) : (
              <>
                {vitalConfig.normalRange && (
                  <>
                    <ReferenceLine 
                      y={vitalConfig.normalRange[0]} 
                      stroke={alpha(theme.palette.warning.main, 0.3)} 
                      strokeDasharray="5 5" 
                      label={{ value: "Lower Normal", fontSize: 10 }}
                    />
                    <ReferenceLine 
                      y={vitalConfig.normalRange[1]} 
                      stroke={alpha(theme.palette.warning.main, 0.3)} 
                      strokeDasharray="5 5" 
                      label={{ value: "Upper Normal", fontSize: 10 }}
                    />
                  </>
                )}
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke={vitalConfig.color} 
                  name={vitalConfig.label}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      )}
    </Paper>
  );
};

export default VitalSignsChart;