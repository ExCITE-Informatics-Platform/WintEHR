/**
 * PharmacyAnalytics Component
 * Analytics dashboard for pharmacy workflow metrics and insights
 * 
 * Migrated to TypeScript with comprehensive type safety for pharmacy analytics.
 */

import React, { useMemo } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Stack,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  useTheme,
  SxProps,
  Theme,
} from '@mui/material';
import {
  Timeline as TrendIcon,
  Speed as PerformanceIcon,
  Assignment as VolumeIcon,
  AccessTime as TimingIcon,
  LocalPharmacy as PharmacyIcon,
  TrendingUp as UpIcon,
  TrendingDown as DownIcon,
  Remove as FlatIcon,
} from '@mui/icons-material';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';
import { MedicationRequest } from '@ahryman40k/ts-fhir-types/lib/R4';

/**
 * Type definitions for PharmacyAnalytics component
 */
export interface QueueStats {
  total: number;
  newOrders: number;
  verification: number;
  dispensing: number;
  ready: number;
  completed: number;
}

export interface TrendDataPoint {
  date: string;
  newOrders: number;
  completed: number;
  pending: number;
  total: number;
}

export interface QueueDistributionItem {
  name: string;
  value: number;
  color: string;
}

export interface MedicationVolumeData {
  name: string;
  count: number;
}

export interface PerformanceMetrics {
  avgProcessingTime: string;
  completionRate: number;
  errorRate: number;
  patientWaitTime: string;
  queueEfficiency: number;
  firstTimeAccuracy: number;
  onTimeCompletion: number;
  patientSatisfaction: number;
}

export interface ActivityItem {
  id: string;
  type: 'completed' | 'alert' | 'inventory' | 'review';
  message: string;
  patient?: string;
  timestamp: string;
  status: string;
  color: 'success' | 'warning' | 'info' | 'error';
}

export interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactElement;
  trend?: number;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'info' | 'error';
}

export interface PharmacyAnalyticsProps {
  queueStats: QueueStats;
  medicationRequests: MedicationRequest[];
  sx?: SxProps<Theme>;
}

/**
 * Helper functions
 */
const generateTrendData = (medicationRequests: MedicationRequest[]): TrendDataPoint[] => {
  const data: TrendDataPoint[] = [];
  
  for (let i = 6; i >= 0; i--) {
    const date = subDays(new Date(), i);
    const dayRequests = medicationRequests.filter(req => {
      if (!req.authoredOn) return false;
      const authoredDate = new Date(req.authoredOn);
      return startOfDay(authoredDate).getTime() === startOfDay(date).getTime();
    });
    
    data.push({
      date: format(date, 'MMM dd'),
      newOrders: Math.floor(Math.random() * 20) + 5, // Mock data
      completed: Math.floor(Math.random() * 15) + 3,
      pending: Math.floor(Math.random() * 8) + 2,
      total: dayRequests.length
    });
  }
  
  return data;
};

const calculateMedicationVolume = (medicationRequests: MedicationRequest[]): MedicationVolumeData[] => {
  const counts: Record<string, number> = {};
  
  medicationRequests.forEach(req => {
    const medName = req.medicationCodeableConcept?.text ||
                   req.medicationCodeableConcept?.coding?.[0]?.display ||
                   'Unknown';
    counts[medName] = (counts[medName] || 0) + 1;
  });
  
  return Object.entries(counts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));
};

const getDefaultPerformanceMetrics = (): PerformanceMetrics => ({
  avgProcessingTime: '18 min',
  completionRate: 94.2,
  errorRate: 0.8,
  patientWaitTime: '12 min',
  queueEfficiency: 92,
  firstTimeAccuracy: 98,
  onTimeCompletion: 89,
  patientSatisfaction: 94
});

const getMockRecentActivity = (): ActivityItem[] => [
  {
    id: '1',
    type: 'completed',
    message: 'Lisinopril 10mg dispensed',
    patient: 'John Smith',
    timestamp: '2 minutes ago',
    status: 'Completed',
    color: 'success'
  },
  {
    id: '2',
    type: 'alert',
    message: 'Metformin 500mg - drug interaction alert',
    patient: 'Mary Johnson',
    timestamp: '5 minutes ago',
    status: 'Needs Review',
    color: 'warning'
  },
  {
    id: '3',
    type: 'inventory',
    message: 'Inventory low: Simvastatin 20mg',
    timestamp: '8 minutes ago',
    status: 'Reorder Needed',
    color: 'info'
  }
];

const formatTrendValue = (trend: number): string => {
  return `${Math.abs(trend)}% vs last week`;
};

const getTrendIcon = (trend: number): React.ReactElement => {
  if (trend > 0) return <UpIcon color="success" fontSize="small" />;
  if (trend < 0) return <DownIcon color="error" fontSize="small" />;
  return <FlatIcon color="action" fontSize="small" />;
};

const getTrendColor = (trend: number): string => {
  if (trend > 0) return 'success.main';
  if (trend < 0) return 'error.main';
  return 'text.secondary';
};

/**
 * MetricCard Component
 */
const MetricCard: React.FC<MetricCardProps> = ({ 
  title, 
  value, 
  subtitle, 
  icon, 
  trend, 
  color = 'primary' 
}) => (
  <Card>
    <CardContent>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography variant="caption" color="text.secondary">
            {title}
          </Typography>
          <Typography variant="h4" fontWeight="bold" color={`${color}.main`}>
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        <Avatar sx={{ bgcolor: `${color}.light` }}>
          {icon}
        </Avatar>
      </Stack>
      {typeof trend === 'number' && (
        <Stack direction="row" alignItems="center" spacing={0.5} mt={1}>
          {getTrendIcon(trend)}
          <Typography 
            variant="caption" 
            color={getTrendColor(trend)}
          >
            {formatTrendValue(trend)}
          </Typography>
        </Stack>
      )}
    </CardContent>
  </Card>
);

/**
 * PharmacyAnalytics Component
 */
const PharmacyAnalytics: React.FC<PharmacyAnalyticsProps> = ({ 
  queueStats, 
  medicationRequests,
  sx 
}) => {
  const theme = useTheme();

  // Generate trend data for the last 7 days
  const trendData = useMemo(() => 
    generateTrendData(medicationRequests), 
    [medicationRequests]
  );

  // Queue distribution data
  const queueDistribution: QueueDistributionItem[] = useMemo(() => [
    { name: 'New Orders', value: queueStats.newOrders, color: theme.palette.warning.main },
    { name: 'Verification', value: queueStats.verification, color: theme.palette.info.main },
    { name: 'Dispensing', value: queueStats.dispensing, color: theme.palette.primary.main },
    { name: 'Ready', value: queueStats.ready, color: theme.palette.success.main }
  ], [queueStats, theme.palette]);

  // Top medications by volume
  const medicationVolume = useMemo(() => 
    calculateMedicationVolume(medicationRequests), 
    [medicationRequests]
  );

  // Performance metrics
  const performanceMetrics = useMemo(() => 
    getDefaultPerformanceMetrics(), 
    []
  );

  // Recent activity data
  const recentActivity = useMemo(() => 
    getMockRecentActivity(), 
    []
  );

  return (
    <Box sx={sx}>
      {/* Key Metrics */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Total Prescriptions"
            value={queueStats.total}
            subtitle="Today"
            icon={<VolumeIcon />}
            trend={8.2}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Avg Processing Time"
            value={performanceMetrics.avgProcessingTime}
            subtitle="Per prescription"
            icon={<TimingIcon />}
            trend={-5.3}
            color="info"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Completion Rate"
            value={`${performanceMetrics.completionRate}%`}
            subtitle="Successfully dispensed"
            icon={<PerformanceIcon />}
            trend={2.1}
            color="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            title="Error Rate"
            value={`${performanceMetrics.errorRate}%`}
            subtitle="Requiring correction"
            icon={<TrendIcon />}
            trend={-1.2}
            color="warning"
          />
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={3}>
        {/* Queue Trends */}
        <Grid item xs={12} lg={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Queue Volume Trends (Last 7 Days)
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="newOrders" 
                  stackId="1"
                  stroke={theme.palette.warning.main}
                  fill={theme.palette.warning.light}
                  name="New Orders"
                />
                <Area 
                  type="monotone" 
                  dataKey="completed" 
                  stackId="1"
                  stroke={theme.palette.success.main}
                  fill={theme.palette.success.light}
                  name="Completed"
                />
                <Area 
                  type="monotone" 
                  dataKey="pending" 
                  stackId="1"
                  stroke={theme.palette.info.main}
                  fill={theme.palette.info.light}
                  name="Pending"
                />
              </AreaChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Current Queue Distribution */}
        <Grid item xs={12} lg={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Current Queue Distribution
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={queueDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={120}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {queueDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <Box mt={2}>
              {queueDistribution.map((item, index) => (
                <Stack key={index} direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        bgcolor: item.color,
                        borderRadius: '50%'
                      }}
                    />
                    <Typography variant="body2">{item.name}</Typography>
                  </Stack>
                  <Typography variant="body2" fontWeight="bold">
                    {item.value}
                  </Typography>
                </Stack>
              ))}
            </Box>
          </Paper>
        </Grid>

        {/* Top Medications */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Top Medications by Volume
            </Typography>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={medicationVolume} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="count" fill={theme.palette.primary.main} />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Performance Indicators */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Performance Indicators
            </Typography>
            <Stack spacing={3}>
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="body2">Queue Efficiency</Typography>
                  <Typography variant="body2" fontWeight="bold">{performanceMetrics.queueEfficiency}%</Typography>
                </Stack>
                <LinearProgress 
                  variant="determinate" 
                  value={performanceMetrics.queueEfficiency} 
                  color="success"
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
              
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="body2">First-Time Accuracy</Typography>
                  <Typography variant="body2" fontWeight="bold">{performanceMetrics.firstTimeAccuracy}%</Typography>
                </Stack>
                <LinearProgress 
                  variant="determinate" 
                  value={performanceMetrics.firstTimeAccuracy} 
                  color="success"
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
              
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="body2">On-Time Completion</Typography>
                  <Typography variant="body2" fontWeight="bold">{performanceMetrics.onTimeCompletion}%</Typography>
                </Stack>
                <LinearProgress 
                  variant="determinate" 
                  value={performanceMetrics.onTimeCompletion} 
                  color="warning"
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
              
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="body2">Patient Satisfaction</Typography>
                  <Typography variant="body2" fontWeight="bold">{performanceMetrics.patientSatisfaction}%</Typography>
                </Stack>
                <LinearProgress 
                  variant="determinate" 
                  value={performanceMetrics.patientSatisfaction} 
                  color="success"
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
            </Stack>
          </Paper>
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Recent Activity
            </Typography>
            <List>
              {recentActivity.map((activity) => (
                <ListItem key={activity.id}>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: `${activity.color}.light` }}>
                      <PharmacyIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={activity.message}
                    secondary={activity.patient ? 
                      `Patient: ${activity.patient} - ${activity.timestamp}` : 
                      `Current stock: 15 units - ${activity.timestamp}`
                    }
                  />
                  <Chip label={activity.status} color={activity.color} size="small" />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default PharmacyAnalytics;