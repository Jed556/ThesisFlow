import * as React from 'react';
import {
  Typography,
  Paper,
  Box,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Card,
  CardContent,
  LinearProgress,
  Avatar,
  Stack,
  Button,
  IconButton,
} from '@mui/material';
import {
  School,
} from '@mui/icons-material';
import { useNavigate } from 'react-router';
import type { NavigationItem } from '../../types/navigation';
import type {
  ThesisData,
  StatusColor,
  FileType,
  ThesisChapter,
  ThesisComment,
  FileAttachment
} from '../../types/thesis';

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

// Mock data - replace with actual data from your backend
const thesisData: ThesisData = {
  title: "Machine Learning Applications in Educational Technology: A Comprehensive Study",
  student: "John Doe",
  adviser: "Dr. Jane Smith",
  editor: "Prof. Michael Johnson",
  submissionDate: "2024-01-15",
  lastUpdated: "2024-08-20",
  overallStatus: "In Progress",
  chapters: [
    {
      id: 1,
      title: "Introduction",
      status: "approved",
      submissionDate: "2024-02-01",
      lastModified: "2024-02-15",
      comments: [
        {
          author: "Dr. Jane Smith",
          role: "adviser",
          date: "2024-02-10",
          comment: "Excellent introduction. Clear problem statement and well-defined objectives.",
          attachments: [
            {
              name: "introduction_feedback.pdf",
              type: "pdf",
              size: "245 KB",
              url: "/files/introduction_feedback.pdf"
            }
          ]
        },
        {
          author: "Prof. Michael Johnson",
          role: "editor",
          date: "2024-02-12",
          comment: "Minor grammatical corrections needed. Overall structure is good.",
          attachments: [
            {
              name: "grammar_corrections.docx",
              type: "docx",
              size: "128 KB",
              url: "/files/grammar_corrections.docx"
            }
          ]
        }
      ]
    },
    {
      id: 2,
      title: "Literature Review",
      status: "under_review",
      submissionDate: "2024-03-01",
      lastModified: "2024-03-15",
      comments: [
        {
          author: "Dr. Jane Smith",
          role: "adviser",
          date: "2024-03-10",
          comment: "Good coverage of existing research. Consider adding more recent studies from 2023-2024.",
          attachments: []
        }
      ]
    },
    {
      id: 3,
      title: "Methodology",
      status: "revision_required",
      submissionDate: "2024-04-01",
      lastModified: "2024-04-20",
      comments: [
        {
          author: "Dr. Jane Smith",
          role: "adviser",
          date: "2024-04-15",
          comment: "The research design needs clarification. Please provide more details on data collection methods.",
          attachments: [
            {
              name: "methodology_suggestions.pdf",
              type: "pdf",
              size: "512 KB",
              url: "/files/methodology_suggestions.pdf"
            },
            {
              name: "data_collection_template.xlsx",
              type: "xlsx",
              size: "89 KB",
              url: "/files/data_collection_template.xlsx"
            }
          ]
        },
        {
          author: "Prof. Michael Johnson",
          role: "editor",
          date: "2024-04-18",
          comment: "Statistical analysis section requires more explanation of chosen methods.",
          attachments: [
            {
              name: "statistical_analysis_guide.pdf",
              type: "pdf",
              size: "1.2 MB",
              url: "/files/statistical_analysis_guide.pdf"
            }
          ]
        }
      ]
    },
    {
      id: 4,
      title: "Results and Analysis",
      status: "not_submitted",
      submissionDate: null,
      lastModified: null,
      comments: []
    },
    {
      id: 5,
      title: "Conclusion",
      status: "not_submitted",
      submissionDate: null,
      lastModified: null,
      comments: []
    }
  ]
};

const calculateProgress = () => {
  const total = thesisData.chapters.length;
  const approved = thesisData.chapters.filter(ch => ch.status === 'approved').length;
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
          {thesisData.title}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 4, mt: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body1">
              <strong>Student:</strong> {thesisData.student}
            </Typography>
            <Typography variant="body1">
              <strong>Adviser:</strong> {thesisData.adviser}
            </Typography>
            <Typography variant="body1">
              <strong>Editor:</strong> {thesisData.editor}
            </Typography>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body1">
              <strong>Submission Date:</strong> {thesisData.submissionDate}
            </Typography>
            <Typography variant="body1">
              <strong>Last Updated:</strong> {thesisData.lastUpdated}
            </Typography>
            <Typography variant="body1">
              <strong>Overall Status:</strong>
              <Chip
                label={thesisData.overallStatus}
                color="primary"
                size="small"
                sx={{ ml: 1 }}
              />
            </Typography>
          </Box>
        </Box>

        {/* Progress Bar */}
        <Box sx={{ mt: 3 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Overall Progress: {Math.round(progress)}% Complete
          </Typography>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>
      </Paper>
    </Box>
  );
}
