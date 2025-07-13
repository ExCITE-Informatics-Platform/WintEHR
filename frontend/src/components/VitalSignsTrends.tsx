/**
 * Vital Signs Trends Component
 * Interactive chart displaying vital signs trends over time with normal range indicators
 * 
 * Migrated to TypeScript with comprehensive type safety for vital signs data visualization.
 */

import React, { useState, useEffect, Fragment } from 'react';
import {
  Box,
  Paper,
  Typography,
  FormControl,
  Select,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
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
import { format, subDays, parseISO } from 'date-fns';
import { R4 } from '@ahryman40k/ts-fhir-types';

/**
 * Type definitions for VitalSignsTrends component
 */
export interface VitalSignsData {
  id: string;
  code: string;
  value: string;
  observation_date: string;
  unit?: string;
  display?: string;
}

export interface ChartDataPoint {
  date: string;
  displayDate: string;
  value?: number;
  systolic?: number;
  diastolic?: number;
}

export interface VitalLineConfig {
  key: string;
  name: string;
  color: string;
  normalMin?: number;
  normalMax?: number;
}

export interface VitalConfig {
  name: string;
  lines: VitalLineConfig[];
  unit: string;
}

export type VitalType = 'blood_pressure' | 'heart_rate' | 'temperature' | 'oxygen_saturation' | 'respiratory_rate';
export type TimeRange = 90 | 365 | 1095 | 'all';

export interface VitalSignsTrendsProps {
  vitals: VitalSignsData[];
  patientId: string;
  defaultVital?: VitalType;
  defaultTimeRange?: TimeRange;
  height?: number;
  sx?: SxProps<Theme>;
  onVitalChange?: (vital: VitalType) => void;
  onTimeRangeChange?: (range: TimeRange) => void;
}

/**
 * Constants
 */
const VITAL_CONFIGS: Record<VitalType, VitalConfig> = {
  blood_pressure: {
    name: 'Blood Pressure',
    lines: [
      { key: 'systolic', name: 'Systolic', color: '#ff4444', normalMin: 90, normalMax: 140 },
      { key: 'diastolic', name: 'Diastolic', color: '#4444ff', normalMin: 60, normalMax: 90 }
    ],
    unit: 'mmHg'
  },
  heart_rate: {
    name: 'Heart Rate',
    lines: [
      { key: 'value', name: 'Heart Rate', color: '#ff9800', normalMin: 60, normalMax: 100 }
    ],
    unit: 'bpm'
  },
  temperature: {
    name: 'Temperature',
    lines: [
      { key: 'value', name: 'Temperature', color: '#4caf50', normalMin: 97.0, normalMax: 99.0 }
    ],
    unit: '°F'
  },
  oxygen_saturation: {
    name: 'Oxygen Saturation',
    lines: [
      { key: 'value', name: 'SpO2', color: '#2196f3', normalMin: 95, normalMax: 100 }
    ],
    unit: '%'
  },
  respiratory_rate: {
    name: 'Respiratory Rate',
    lines: [
      { key: 'value', name: 'Resp Rate', color: '#9c27b0', normalMin: 12, normalMax: 20 }
    ],
    unit: 'breaths/min'
  }
};

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: 90, label: '90 Days' },
  { value: 365, label: '1 Year' },
  { value: 1095, label: '3 Years' },
  { value: 'all', label: 'All Time' }
];

/**
 * Helper functions
 */
const parseBloodPressureValue = (value: string): { systolic?: number; diastolic?: number } => {
  try {
    const parts = value.split('/');
    if (parts.length === 2) {
      const systolic = parseFloat(parts[0]);
      const diastolic = parseFloat(parts[1]);
      if (!isNaN(systolic) && !isNaN(diastolic)) {
        return { systolic, diastolic };
      }
    }
  } catch (error) {
    console.error('Error parsing blood pressure value:', value, error);
  }
  return {};
};

const parseNumericValue = (value: string): number | undefined => {
  try {
    const numValue = parseFloat(value);
    return isNaN(numValue) ? undefined : numValue;
  } catch (error) {
    console.error('Error parsing numeric value:', value, error);
    return undefined;
  }
};

const formatTooltipValue = (value: number | undefined, unit: string): string => {
  return value !== undefined ? `${value} ${unit}` : 'N/A';
};

/**
 * VitalSignsTrends Component
 */
const VitalSignsTrends: React.FC<VitalSignsTrendsProps> = ({
  vitals,
  patientId,
  defaultVital = 'blood_pressure',
  defaultTimeRange = 1095,
  height = 350,
  sx,
  onVitalChange,
  onTimeRangeChange
}) => {
  const [selectedVital, setSelectedVital] = useState<VitalType>(defaultVital);
  const [timeRange, setTimeRange] = useState<TimeRange>(defaultTimeRange);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);

  useEffect(() => {
    processVitalData();
  }, [vitals, selectedVital, timeRange]);

  const processVitalData = (): void => {
    try {
      const cutoffDate = timeRange === 'all' ? new Date(0) : subDays(new Date(), timeRange as number);
      
      // Filter vitals by type and date range
      const filteredVitals = vitals.filter(vital => {
        try {
          const vitalDate = parseISO(vital.observation_date);
          return vitalDate >= cutoffDate && vital.code === selectedVital;
        } catch (error) {
          console.error('Error parsing vital date:', vital.observation_date, error);
          return false;
        }
      });

      // Group by date and sort chronologically
      const dataByDate: Record<string, ChartDataPoint> = {};
      
      filteredVitals.forEach(vital => {
        try {
          const date = format(parseISO(vital.observation_date), 'yyyy-MM-dd');
          
          if (!dataByDate[date]) {
            dataByDate[date] = {
              date,
              displayDate: format(parseISO(vital.observation_date), 'MMM dd, yyyy')
            };
          }

          // Handle blood pressure specially (split systolic/diastolic)
          if (selectedVital === 'blood_pressure' && vital.value) {
            const { systolic, diastolic } = parseBloodPressureValue(vital.value);
            if (systolic !== undefined) dataByDate[date].systolic = systolic;
            if (diastolic !== undefined) dataByDate[date].diastolic = diastolic;
          } else {
            const numericValue = parseNumericValue(vital.value);
            if (numericValue !== undefined) {
              dataByDate[date].value = numericValue;
            }
          }
        } catch (error) {
          console.error('Error processing vital data:', vital, error);
        }
      });

      // Convert to array and sort by date
      const sortedData = Object.values(dataByDate)
        .filter(dataPoint => {
          // Ensure we have at least one valid value
          if (selectedVital === 'blood_pressure') {
            return dataPoint.systolic !== undefined || dataPoint.diastolic !== undefined;
          }
          return dataPoint.value !== undefined;
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setChartData(sortedData);
    } catch (error) {
      console.error('Error processing vital signs data:', error);
      setChartData([]);
    }
  };

  const handleVitalChange = (event: SelectChangeEvent<VitalType>): void => {
    const newVital = event.target.value as VitalType;
    setSelectedVital(newVital);
    onVitalChange?.(newVital);
  };

  const handleTimeRangeChange = (event: React.MouseEvent<HTMLElement>, newRange: TimeRange | null): void => {
    if (newRange !== null) {
      setTimeRange(newRange);
      onTimeRangeChange?.(newRange);
    }
  };

  const config = VITAL_CONFIGS[selectedVital];

  const customTooltip = (props: TooltipProps<number, string>): JSX.Element | null => {
    const { active, payload, label } = props;
    
    if (active && payload && payload.length > 0) {
      return (
        <Box
          sx={{
            bgcolor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            p: 1,
            boxShadow: 2
          }}
        >
          <Typography variant="subtitle2">{label}</Typography>
          {payload.map((entry, index) => (
            <Typography
              key={index}
              variant="body2"
              sx={{ color: entry.color }}
            >
              {entry.name}: {formatTooltipValue(entry.value as number, config.unit)}
            </Typography>
          ))}
        </Box>
      );
    }
    
    return null;
  };

  return (
    <Paper sx={{ p: 3, ...sx }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h6">Vital Signs Trends</Typography>
        
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <Select
              value={selectedVital}
              onChange={handleVitalChange}
              displayEmpty
            >
              {Object.entries(VITAL_CONFIGS).map(([key, vitalConfig]) => (
                <MenuItem key={key} value={key as VitalType}>
                  {vitalConfig.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <ToggleButtonGroup
            value={timeRange}
            exclusive
            onChange={handleTimeRangeChange}
            size="small"
          >
            {TIME_RANGE_OPTIONS.map(option => (
              <ToggleButton key={option.value} value={option.value}>
                {option.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
      </Box>

      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis 
              dataKey="displayDate"
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              label={{ 
                value: config.unit, 
                angle: -90, 
                position: 'insideLeft' 
              }}
              tick={{ fontSize: 12 }}
            />
            <Tooltip content={customTooltip} />
            <Legend />
            
            {/* Reference lines for normal ranges */}
            {config.lines.map(line => (
              <Fragment key={`ref-${line.key}`}>
                {line.normalMin !== undefined && (
                  <ReferenceLine 
                    y={line.normalMin} 
                    stroke="#999" 
                    strokeDasharray="5 5"
                    strokeOpacity={0.7}
                    label={{
                      value: `Min Normal (${line.normalMin})`,
                      position: 'topLeft',
                      fontSize: 10
                    }}
                  />
                )}
                {line.normalMax !== undefined && (
                  <ReferenceLine 
                    y={line.normalMax} 
                    stroke="#999" 
                    strokeDasharray="5 5"
                    strokeOpacity={0.7}
                    label={{
                      value: `Max Normal (${line.normalMax})`,
                      position: 'topLeft',
                      fontSize: 10
                    }}
                  />
                )}
              </Fragment>
            ))}
            
            {/* Data lines */}
            {config.lines.map(line => (
              <Line
                key={line.key}
                type="monotone"
                dataKey={line.key}
                stroke={line.color}
                strokeWidth={2}
                dot={{ fill: line.color, r: 4 }}
                activeDot={{ r: 6, stroke: line.color, strokeWidth: 2 }}
                name={line.name}
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <Box sx={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography color="text.secondary" variant="body1">
            No {config.name.toLowerCase()} data available for the selected time range
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default VitalSignsTrends;