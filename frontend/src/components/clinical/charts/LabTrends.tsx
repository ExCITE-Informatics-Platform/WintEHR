/**
 * Lab Trends Component
 * Displays laboratory test trends over time with filtering
 * 
 * Migrated to TypeScript with comprehensive type safety for laboratory data visualization.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Chip,
  Grid,
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
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  TooltipProps,
  DotProps,
} from 'recharts';
import { format, parseISO, subDays } from 'date-fns';
import { R4 } from '@ahryman40k/ts-fhir-types';
import { fhirClient } from '../../../services/fhirClient';

/**
 * Type definitions for LabTrends component
 */
export type TimeRange = 90 | 365 | 1095 | 'all';

export interface LabObservation {
  id: string;
  patient_id: string;
  observation_date: string;
  display: string;
  loinc_code: string;
  value: string | number;
  value_unit: string;
  unit: string;
  status?: string;
  reference_range?: string;
  interpretation?: string;
  reference_range_low?: number;
  reference_range_high?: number;
  value_quantity?: number;
}

export interface LabTest {
  code: string;
  name: string;
  unit: string;
  count: number;
}

export interface ChartDataPoint {
  date: string;
  displayDate: string;
  value: number;
  unit: string;
  isAbnormal: boolean;
  interpretation?: string;
  referenceRangeLow?: number;
  referenceRangeHigh?: number;
}

export interface TestInfo {
  name?: string;
  unit: string;
  refLow?: number;
  refHigh?: number;
}

export interface FHIRClientLabResponse {
  resources: R4.IObservation[];
  total?: number;
  message?: string;
}

export interface LabTrendsProps {
  patientId?: string;
  height?: number;
  sx?: SxProps<Theme>;
  compact?: boolean;
}

export interface CustomTooltipProps extends TooltipProps<number, string> {
  testInfo?: TestInfo;
}

export interface CustomDotProps extends DotProps {
  payload?: ChartDataPoint;
}

/**
 * Constants
 */
const DEFAULT_HEIGHT = 300;
const DEFAULT_TIME_RANGE: TimeRange = 1095; // 3 years
const MAX_OBSERVATIONS = 1000;

const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: 90, label: '90 Days' },
  { value: 365, label: '1 Year' },
  { value: 1095, label: '3 Years' },
  { value: 'all', label: 'All Time' }
];

/**
 * Helper functions
 */
const transformFHIRObservation = (obs: R4.IObservation, patientId: string): LabObservation => ({
  id: obs.id || '',
  patient_id: patientId,
  observation_date: obs.effectiveDateTime || obs.issued || '',
  display: obs.code?.text || obs.code?.coding?.[0]?.display || 'Unknown',
  loinc_code: obs.code?.coding?.find(c => c.system?.includes('loinc'))?.code || 
             obs.code?.coding?.[0]?.code || '',
  value: obs.valueQuantity?.value || obs.valueString || '',
  value_unit: obs.valueQuantity?.unit || '',
  unit: obs.valueQuantity?.unit || '',
  status: obs.status,
  reference_range: obs.referenceRange?.[0]?.text,
  value_quantity: obs.valueQuantity?.value
});

const filterByTimeRange = (observations: LabObservation[], timeRange: TimeRange): LabObservation[] => {
  if (timeRange === 'all') return observations;
  
  const cutoffDate = subDays(new Date(), timeRange);
  return observations.filter(obs => {
    try {
      const obsDate = parseISO(obs.observation_date);
      return obsDate >= cutoffDate;
    } catch (error) {
      return false;
    }
  });
};

const extractUniqueTests = (observations: LabObservation[]): LabTest[] => {
  const testMap = new Map<string, LabTest>();
  
  observations.forEach(obs => {
    if (obs.loinc_code && obs.display) {
      const existing = testMap.get(obs.loinc_code);
      testMap.set(obs.loinc_code, {
        code: obs.loinc_code,
        name: obs.display,
        unit: obs.value_unit || obs.unit || '',
        count: (existing?.count || 0) + 1
      });
    }
  });

  return Array.from(testMap.values()).sort((a, b) => b.count - a.count);
};

const isNumericValue = (value: string | number): boolean => {
  if (typeof value === 'number') return !isNaN(value);
  if (typeof value === 'string') return !isNaN(parseFloat(value));
  return false;
};

const parseNumericValue = (value: string | number): number => {
  if (typeof value === 'number') return value;
  return parseFloat(value.toString());
};

const formatChartData = (observations: LabObservation[]): ChartDataPoint[] => {
  return observations
    .filter(obs => isNumericValue(obs.value))
    .map(obs => ({
      date: obs.observation_date,
      displayDate: format(parseISO(obs.observation_date), 'yyyy-MM-dd'),
      value: obs.value_quantity || parseNumericValue(obs.value),
      unit: obs.value_unit || obs.unit,
      isAbnormal: obs.interpretation === 'High' || obs.interpretation === 'Low',
      interpretation: obs.interpretation,
      referenceRangeLow: obs.reference_range_low,
      referenceRangeHigh: obs.reference_range_high
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

const formatXAxisDate = (dateStr: string): string => {
  try {
    return format(parseISO(dateStr), 'MM/dd');
  } catch (error) {
    return dateStr;
  }
};

const formatTooltipDate = (dateStr: string): string => {
  try {
    return format(parseISO(dateStr), 'MMM dd, yyyy');
  } catch (error) {
    return dateStr;
  }
};

/**
 * Custom Tooltip Component
 */
const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, testInfo }) => {
  if (active && payload && payload.length > 0) {
    const data = payload[0].payload as ChartDataPoint;
    return (
      <Paper sx={{ p: 1 }}>
        <Typography variant="body2">
          {formatTooltipDate(data.date)}
        </Typography>
        <Typography variant="body2" color={data.isAbnormal ? 'error' : 'primary'}>
          {payload[0].value} {testInfo?.unit}
          {data.interpretation && ` (${data.interpretation})`}
        </Typography>
        {testInfo?.refLow && testInfo?.refHigh && (
          <Typography variant="caption" color="text.secondary">
            Ref: {testInfo.refLow} - {testInfo.refHigh}
          </Typography>
        )}
      </Paper>
    );
  }
  return null;
};

/**
 * Custom Dot Component
 */
const CustomDot: React.FC<CustomDotProps> = (props) => {
  const { cx, cy, payload } = props;
  if (!cx || !cy || !payload) return null;
  
  return (
    <circle 
      cx={cx} 
      cy={cy} 
      r={4} 
      fill={payload.isAbnormal ? '#f44336' : '#8884d8'}
    />
  );
};

/**
 * LabTrends Component
 */
const LabTrends: React.FC<LabTrendsProps> = ({ 
  patientId, 
  height = DEFAULT_HEIGHT, 
  sx,
  compact = false 
}) => {
  const [allLabData, setAllLabData] = useState<LabObservation[]>([]);
  const [labData, setLabData] = useState<ChartDataPoint[]>([]);
  const [availableTests, setAvailableTests] = useState<LabTest[]>([]);
  const [selectedTest, setSelectedTest] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [testInfo, setTestInfo] = useState<TestInfo | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>(DEFAULT_TIME_RANGE);

  useEffect(() => {
    if (patientId) {
      fetchAllLabData();
    }
  }, [patientId, timeRange]);

  useEffect(() => {
    if (selectedTest && allLabData.length > 0) {
      filterLabDataByTest();
    }
  }, [selectedTest, allLabData]);

  const fetchAllLabData = async (): Promise<void> => {
    if (!patientId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await fhirClient.getLabResults(patientId) as FHIRClientLabResponse;
      
      const transformedData = result.resources.map(obs => 
        transformFHIRObservation(obs, patientId)
      );

      const filteredByTime = filterByTimeRange(transformedData, timeRange);
      setAllLabData(filteredByTime);

      const tests = extractUniqueTests(filteredByTime);
      setAvailableTests(tests);
      
      // Auto-select the most frequent test
      if (tests.length > 0 && !selectedTest) {
        setSelectedTest(tests[0].code);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load laboratory tests';
      setError(errorMessage);
      console.error('Error fetching lab data:', err);
    } finally {
      setLoading(false);
    }
  };

  const filterLabDataByTest = (): void => {
    if (!selectedTest || !allLabData.length) return;
    
    const filteredData = allLabData.filter(obs => obs.loinc_code === selectedTest);
    const chartData = formatChartData(filteredData);
    setLabData(chartData);
    
    // Set test info including reference ranges
    if (chartData.length > 0) {
      const latestResult = chartData[chartData.length - 1];
      const testConfig = availableTests.find(t => t.code === selectedTest);
      
      setTestInfo({
        name: testConfig?.name,
        unit: latestResult.unit,
        refLow: latestResult.referenceRangeLow,
        refHigh: latestResult.referenceRangeHigh
      });
    }
  };

  const handleTestChange = (event: SelectChangeEvent<string>): void => {
    setSelectedTest(event.target.value);
  };

  const handleTimeRangeChange = (
    event: React.MouseEvent<HTMLElement>,
    newTimeRange: TimeRange | null
  ): void => {
    if (newTimeRange !== null) {
      setTimeRange(newTimeRange);
    }
  };

  const renderTooltip = (props: TooltipProps<number, string>) => (
    <CustomTooltip {...props} testInfo={testInfo} />
  );

  const renderChart = (): React.ReactNode => {
    if (labData.length === 0) {
      return (
        <Box display="flex" justifyContent="center" alignItems="center" height={height}>
          <Typography color="text.secondary">
            No results available for the selected test
          </Typography>
        </Box>
      );
    }

    return (
      <Box>
        <Box mb={2}>
          <Typography variant="h6" gutterBottom>
            {testInfo?.name}
          </Typography>
          <Box display="flex" gap={1} flexWrap="wrap">
            <Chip 
              label={`${labData.length} results`} 
              size="small" 
              color="primary" 
              variant="outlined" 
            />
            {testInfo?.refLow && testInfo?.refHigh && (
              <Chip 
                label={`Reference: ${testInfo.refLow} - ${testInfo.refHigh} ${testInfo.unit}`} 
                size="small" 
                variant="outlined" 
              />
            )}
          </Box>
        </Box>

        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={labData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="displayDate" 
              tickFormatter={formatXAxisDate}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              label={{ 
                value: testInfo?.unit || '', 
                angle: -90, 
                position: 'insideLeft' 
              }}
            />
            <Tooltip content={renderTooltip} />
            
            {/* Reference range lines */}
            {testInfo?.refLow && (
              <ReferenceLine 
                y={testInfo.refLow} 
                stroke="green" 
                strokeDasharray="3 3" 
                label={{ value: "Lower limit", position: "right" }}
              />
            )}
            {testInfo?.refHigh && (
              <ReferenceLine 
                y={testInfo.refHigh} 
                stroke="red" 
                strokeDasharray="3 3" 
                label={{ value: "Upper limit", position: "right" }}
              />
            )}
            
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke="#8884d8" 
              strokeWidth={2}
              dot={<CustomDot />}
              name={testInfo?.name}
            />
          </LineChart>
        </ResponsiveContainer>
      </Box>
    );
  };

  if (!patientId) {
    return (
      <Alert severity="info" sx={sx}>
        Please select a patient to view laboratory trends.
      </Alert>
    );
  }

  if (loading && availableTests.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height={height} sx={sx}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={sx}>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={sx}>
      <Grid container spacing={2} alignItems="center" mb={2}>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Select Lab Test</InputLabel>
            <Select
              value={selectedTest}
              label="Select Lab Test"
              onChange={handleTestChange}
            >
              {availableTests.map((test: LabTest) => (
                <MenuItem key={test.code} value={test.code}>
                  {test.name} ({test.count} results)
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={6}>
          <Box display="flex" justifyContent="flex-end">
            <ToggleButtonGroup
              value={timeRange}
              exclusive
              onChange={handleTimeRangeChange}
              size="small"
            >
              {TIME_RANGE_OPTIONS.map((option) => (
                <ToggleButton key={option.value} value={option.value}>
                  {option.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        </Grid>
      </Grid>
      
      {selectedTest && renderChart()}
    </Box>
  );
};

export default LabTrends;