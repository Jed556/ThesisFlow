import * as React from 'react';
import { Typography, Paper, Box, Chip, Accordion, AccordionSummary, AccordionDetails, List, ListItem, ListItemText, ListItemIcon, Divider, Card, CardContent, LinearProgress, Avatar, Stack, Button, IconButton, } from '@mui/material';
import { School, } from '@mui/icons-material';
import { useNavigate } from 'react-router';
import type { NavigationItem } from '../../types/navigation';
import type { ThesisChapter } from '../../types/thesis';
import { mockThesisData } from '../../data/mockData';

export const metadata: NavigationItem = {
  group: 'thesis',
  index: 0,
  title: 'My Thesis',
  segment: 'thesis',
  icon: <School />,
  // children: [],
  // path: '/thesis',
  roles: ['student', 'admin'],
  // hidden: false,
};

const calculateProgress = () => {
  const total = mockThesisData.chapters.length;
  const approved = mockThesisData.chapters.filter((ch: ThesisChapter) => ch.status === 'approved').length;
  return (approved / total) * 100;
};

export default function ThesisPage() {
  const progress = calculateProgress();
  const navigate = useNavigate();

  return (
    <Box sx={{ p: 3 }}>
      {/* Thesis Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          {mockThesisData.title}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
          <Typography variant="body2">
            <strong>Student:</strong> {mockThesisData.student}
          </Typography>
          <Typography variant="body2">
            <strong>Adviser:</strong> {mockThesisData.adviser}
          </Typography>
          <Typography variant="body2">
            <strong>Editor:</strong> {mockThesisData.editor}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
          <Typography variant="body2">
            <strong>Submission Date:</strong> {mockThesisData.submissionDate}
          </Typography>
          <Typography variant="body2">
            <strong>Last Updated:</strong> {mockThesisData.lastUpdated}
          </Typography>
          <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <strong>Status:</strong>
            <Chip
              label={mockThesisData.overallStatus}
              color="warning"
              size="small"
            />
          </Typography>
        </Box>

        {/* Progress Overview */}
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>Progress Overview</Typography>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ height: 8, borderRadius: 1, mb: 1 }}
          />
          <Typography variant="body2" color="text.secondary">
            {Math.round(progress)}% Complete
          </Typography>
        </Box>
      </Paper>

      {/* Chapters Overview */}
      <Typography variant="h5" sx={{ mb: 2 }}>Chapters</Typography>

      {mockThesisData.chapters.map((chapter: ThesisChapter) => (
        <Card key={chapter.id} sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="h6">{chapter.title}</Typography>
              <Chip
                label={chapter.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                color={
                  chapter.status === 'approved' ? 'success' :
                    chapter.status === 'under_review' ? 'warning' :
                      chapter.status === 'revision_required' ? 'error' :
                        'default'
                }
                size="small"
              />
            </Box>

            {chapter.submissionDate && (
              <Typography variant="body2" color="text.secondary">
                Last submitted: {chapter.submissionDate}
              </Typography>
            )}

            {chapter.comments.length > 0 && (
              <Typography variant="body2" color="text.secondary">
                {chapter.comments.length} feedback(s) received
              </Typography>
            )}
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}
