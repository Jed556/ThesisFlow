import * as React from 'react';
import {
  Typography,
  Box,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Card,
  CardContent,
  Avatar,
  Stack,
  Divider,
  IconButton,
} from '@mui/material';
import {
  ExpandMore,
  CheckCircle,
  Pending,
  Cancel,
  Comment,
  Person,
  Schedule,
  Edit,
  AttachFile,
  Visibility,
  PictureAsPdf,
  Description,
  Output,
} from '@mui/icons-material';
import type { StatusColor, FileType, ThesisChapter, ThesisComment, FileAttachment } from '../types/thesis';

interface ChapterSubmissionProps {
  chapter: ThesisChapter;
}

const getStatusColor = (status: string): StatusColor => {
  switch (status) {
    case 'approved':
      return 'success';
    case 'under_review':
      return 'warning';
    case 'revision_required':
      return 'error';
    case 'not_submitted':
      return 'default';
    default:
      return 'default';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'approved':
      return <CheckCircle color="success" />;
    case 'under_review':
      return <Pending color="warning" />;
    case 'revision_required':
      return <Cancel color="error" />;
    case 'not_submitted':
      return <Schedule color="disabled" />;
    default:
      return <Schedule color="disabled" />;
  }
};

const getFileIcon = (fileType: FileType) => {
  switch (fileType.toLowerCase()) {
    case 'pdf':
      return <PictureAsPdf color="error" />;
    case 'docx':
    case 'doc':
      return <Description color="primary" />;
    case 'xlsx':
    case 'xls':
      return <Output color="success" />;
    default:
      return <AttachFile color="action" />;
  }
};

const getStatusDisplayText = (status: string): string => {
  switch (status) {
    case 'approved':
      return 'Approved';
    case 'under_review':
      return 'Under Review';
    case 'revision_required':
      return 'Revision Required';
    case 'not_submitted':
      return 'Not Submitted';
    default:
      return status;
  }
};

// Helper function to sort comments by date (latest first)
const sortCommentsByDate = (comments: ThesisComment[]) => {
  return [...comments].sort((a, b) => {
    // Convert date strings to Date objects for comparison
    // Assuming date format: "2024-02-10 at 3:20 PM"
    const parseDate = (dateStr: string) => {
      const [datePart, , timePart, period] = dateStr.split(' ');
      const [month, day, year] = datePart.split('-').map(Number);
      const [hours, minutes] = timePart.split(':').map(Number);

      let hour24 = hours;
      if (period === 'PM' && hours !== 12) hour24 += 12;
      if (period === 'AM' && hours === 12) hour24 = 0;

      return new Date(year, month - 1, day, hour24, minutes);
    };

    const dateA = parseDate(a.date);
    const dateB = parseDate(b.date);

    return dateB.getTime() - dateA.getTime(); // Latest first
  });
};

export default function ChapterSubmission({ chapter }: ChapterSubmissionProps) {
  return (
    <Accordion sx={{ mb: 2, borderRadius: 2, '&:before': { display: 'none' } }}>
      <AccordionSummary expandIcon={<ExpandMore />}>
        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
          <Box sx={{ mr: 2 }}>
            {getStatusIcon(chapter.status)}
          </Box>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6">
              Chapter {chapter.id}: {chapter.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {chapter.submissionDate ? `Submitted: ${chapter.submissionDate}` : 'Not yet submitted'}
              {chapter.lastModified && ` • Last modified: ${chapter.lastModified}`}
            </Typography>
          </Box>
          <Chip
            label={getStatusDisplayText(chapter.status)}
            color={getStatusColor(chapter.status) as any}
            size="small"
          />
        </Box>
      </AccordionSummary>

      <AccordionDetails>
        <Box>
          {/* Files Section */}
          {chapter.status !== 'not_submitted' && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                <AttachFile sx={{ mr: 1 }} />
                Submitted Files
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Description fontSize="small" color="primary" />
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  Chapter_{chapter.id}_{chapter.title.replace(/\s+/g, '_')}_v1.pdf
                </Typography>
                <Chip
                  label="v1"
                  size="small"
                  color="primary"
                  sx={{ height: 18, fontSize: '0.65rem' }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                  Currently being reviewed by {chapter.status === 'under_review' ? 'Editor' : 'Adviser'}
                </Typography>
              </Box>
            </Box>
          )}

          {/* Comments Section */}
          {chapter.comments.length > 0 && (
            <Box>
              <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                <Comment sx={{ mr: 1 }} />
                Feedback & Comments ({chapter.comments.length})
              </Typography>
              <Stack spacing={2}>
                {sortCommentsByDate(chapter.comments).map((comment: ThesisComment, index: number) => (
                  <Card key={index} variant="outlined">
                    <CardContent sx={{ pb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <Avatar sx={{ width: 32, height: 32, mr: 2, bgcolor: 'primary.main' }}>
                          {comment.role === 'adviser' ? <Person /> : <Edit />}
                        </Avatar>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="subtitle2">
                            {comment.author}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {comment.role === 'adviser' ? 'Adviser' : 'Editor'} • {comment.date}
                          </Typography>
                          {comment.documentVersion && comment.documentName && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                              <Description fontSize="small" color="primary" />
                              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                                {comment.documentName}
                              </Typography>
                              <Chip
                                label={`v${comment.documentVersion}`}
                                size="small"
                                color="primary"
                                sx={{ height: 18, fontSize: '0.65rem' }}
                              />
                            </Box>
                          )}
                        </Box>
                      </Box>
                      <Typography variant="body2">
                        {comment.comment}
                      </Typography>

                      {/* Attachments */}
                      {comment.attachments && comment.attachments.length > 0 && (
                        <Box sx={{ mt: 2 }}>
                          <Divider sx={{ mb: 1 }} />
                          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                            Attachments:
                          </Typography>
                          {comment.attachments.map((attachment: FileAttachment, attachIndex: number) => (
                            <Box key={attachIndex} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                              {getFileIcon(attachment.type)}
                              <Typography variant="body2" color="primary" sx={{ cursor: 'pointer', textDecoration: 'underline' }}>
                                {attachment.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                ({attachment.size})
                              </Typography>
                              <IconButton size="small" color="primary">
                                <Visibility fontSize="small" />
                              </IconButton>
                            </Box>
                          ))}
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </Box>
          )}

          {chapter.comments.length === 0 && chapter.status !== 'not_submitted' && (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              No feedback received yet.
            </Typography>
          )}
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}
