/**
 * CDS Learn Mode - Interactive tutorials for learning CDS Hooks
 * 
 * Migrated to TypeScript with comprehensive type safety for CDS tutorials.
 */

import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Alert,
  SxProps,
  Theme,
} from '@mui/material';
import {
  School as LearnIcon,
  PlayArrow as StartIcon,
} from '@mui/icons-material';

/**
 * Type definitions for CDSLearnMode component
 */
export type TutorialLevel = 'Beginner' | 'Intermediate' | 'Advanced';

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  duration: string;
  level: TutorialLevel;
}

export interface CDSLearnModeProps {
  sx?: SxProps<Theme>;
  onTutorialStart?: (tutorialId: string) => void;
}

/**
 * Constants
 */
const TUTORIALS: Tutorial[] = [
  {
    id: 'basics',
    title: 'CDS Hooks Basics',
    description: 'Learn the fundamentals of Clinical Decision Support',
    duration: '15 min',
    level: 'Beginner'
  },
  {
    id: 'conditions',
    title: 'Building Conditions',
    description: 'Master condition logic and triggers',
    duration: '20 min',
    level: 'Intermediate'
  },
  {
    id: 'cards',
    title: 'Designing Effective Cards',
    description: 'Create actionable decision support cards',
    duration: '25 min',
    level: 'Intermediate'
  },
  {
    id: 'advanced',
    title: 'Advanced Techniques',
    description: 'Complex hooks and optimization strategies',
    duration: '30 min',
    level: 'Advanced'
  }
];

/**
 * Helper functions
 */
const getLevelColor = (level: TutorialLevel): 'success' | 'warning' | 'error' => {
  switch (level) {
    case 'Beginner':
      return 'success';
    case 'Intermediate':
      return 'warning';
    case 'Advanced':
      return 'error';
    default:
      return 'success';
  }
};

/**
 * CDSLearnMode Component
 */
const CDSLearnMode: React.FC<CDSLearnModeProps> = ({ sx, onTutorialStart }) => {
  const handleTutorialStart = (tutorialId: string): void => {
    if (onTutorialStart) {
      onTutorialStart(tutorialId);
    } else {
      // Default behavior - could navigate to tutorial or show modal
      console.log(`Starting tutorial: ${tutorialId}`);
    }
  };

  return (
    <Box sx={sx}>
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>
          Welcome to CDS Learn Mode!
        </Typography>
        <Typography variant="body2">
          Choose a tutorial below to start learning about Clinical Decision Support Hooks.
          Each tutorial includes interactive examples and hands-on exercises.
        </Typography>
      </Alert>

      <Grid container spacing={3}>
        {TUTORIALS.map((tutorial: Tutorial) => (
          <Grid item xs={12} md={6} key={tutorial.id}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {tutorial.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  {tutorial.description}
                </Typography>
                <Box display="flex" gap={1}>
                  <Chip label={tutorial.duration} size="small" />
                  <Chip 
                    label={tutorial.level} 
                    size="small"
                    color={getLevelColor(tutorial.level)}
                  />
                </Box>
              </CardContent>
              <CardActions>
                <Button 
                  size="small" 
                  startIcon={<StartIcon />}
                  onClick={() => handleTutorialStart(tutorial.id)}
                >
                  Start Tutorial
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default CDSLearnMode;