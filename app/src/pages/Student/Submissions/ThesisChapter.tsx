import * as React from 'react';
import {
  Typography,
  Paper,
  Box,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Card,
  CardContent,
  LinearProgress,
  Avatar,
  Stack,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  Article,
  ExpandMore,
  CheckCircle,
  Pending,
  Cancel,
  Schedule,
  Upload,
  CloudUpload,
  PictureAsPdf,
  Description,
  Delete,
  Edit,
  Person,
  History,
  Download,
} from '@mui/icons-material';
import { useNavigate } from 'react-router';
import type { NavigationItem } from '../../../types/navigation';
import type {
  StatusColor,
  FileType,
  ThesisChapter,
  ThesisComment,
} from '../../../types/thesis';
import {
  mockThesisData,
  mockGroupMembers,
  mockChapterFiles,
  calculateProgress,
  getCurrentVersion,
  getVersionHistory as getPreviousVersions
} from '../../../data/mockData';

export const metadata: NavigationItem = {
  group: 'thesis',
  index: 2,
  title: 'Chapters',
  segment: 'thesis-chapters',
  icon: <Article />,
  children: [],
  // path: '/thesis',
  roles: ['student', 'admin'],
  // hidden: false,
};

// Mock data - same as status page but focused on chapter submissions
// All data now imported from centralized mockData.ts

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
    default:
      return <Description color="action" />;
  }
};

// Helper function to convert snake_case to display text
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

export default function ThesisChaptersPage() {
  const progress = calculateProgress();
  const navigate = useNavigate();
  const [uploadDialog, setUploadDialog] = React.useState(false);
  const [selectedChapter, setSelectedChapter] = React.useState<number | null>(null);
  const [uploadedFile, setUploadedFile] = React.useState<File | null>(null);
  const [uploadError, setUploadError] = React.useState<string>('');
  const [chapterTitle, setChapterTitle] = React.useState('');
  const [showVersionHistory, setShowVersionHistory] = React.useState<Record<number, boolean>>({});

  const handleUploadClick = (chapterId: number, chapterTitle: string) => {
    setSelectedChapter(chapterId);
    setChapterTitle(chapterTitle);
    setUploadDialog(true);
    setUploadError('');
    setUploadedFile(null);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type (PDF or DOCX only)
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Only PDF and DOCX files are allowed.');
      setUploadedFile(null);
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setUploadError('File size must be less than 10MB.');
      setUploadedFile(null);
      return;
    }

    setUploadError('');
    setUploadedFile(file);
  };

  const handleUploadSubmit = () => {
    if (!uploadedFile || !selectedChapter) return;

    // Here you would typically upload the file to your backend
    console.log('Uploading file:', uploadedFile.name, 'for chapter:', selectedChapter);

    // Mock success - close dialog
    setUploadDialog(false);
    setUploadedFile(null);
    setSelectedChapter(null);

    // You could show a success message here
  };

  const handleCloseDialog = () => {
    setUploadDialog(false);
    setUploadedFile(null);
    setSelectedChapter(null);
    setUploadError('');
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const toggleVersionHistory = (chapterId: number) => {
    setShowVersionHistory(prev => ({
      ...prev,
      [chapterId]: !prev[chapterId]
    }));
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Thesis Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          {mockThesisData.title}
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 4, mt: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body1">
              <strong>Student:</strong> {mockThesisData.student}
            </Typography>
            <Typography variant="body1">
              <strong>Adviser:</strong> {mockThesisData.adviser}
            </Typography>
            <Typography variant="body1">
              <strong>Editor:</strong> {mockThesisData.editor}
            </Typography>
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body1">
              <strong>Submission Date:</strong> {mockThesisData.submissionDate}
            </Typography>
            <Typography variant="body1">
              <strong>Last Updated:</strong> {mockThesisData.lastUpdated}
            </Typography>
            <Typography variant="body1">
              <strong>Overall Status:</strong>
              <Chip
                label={mockThesisData.overallStatus}
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

        {/* Group Members */}
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            Research Group Members
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {mockGroupMembers.map((member) => (
              <Chip
                key={member.id}
                avatar={<Avatar sx={{ width: 24, height: 24 }}>{member.name.charAt(0)}</Avatar>}
                label={`${member.name} (${member.role})`}
                variant="outlined"
                size="small"
              />
            ))}
          </Stack>
        </Box>
      </Paper>

      {/* Chapter Submissions */}
      <Typography variant="h5" gutterBottom>
        Chapter Document Submissions
      </Typography>

      {mockThesisData.chapters.map((chapter: ThesisChapter) => (
        <Accordion key={chapter.id} sx={{ mb: 2, borderRadius: 2, '&:before': { display: 'none' } }}>
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
              {/* Upload Section */}
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                    <CloudUpload sx={{ mr: 1 }} />
                    Document Upload
                  </Typography>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<Upload />}
                    onClick={() => handleUploadClick(chapter.id, chapter.title)}
                    disabled={chapter.status === 'approved'}
                  >
                    {mockChapterFiles[chapter.id] ? 'Replace Document' : 'Upload Document'}
                  </Button>
                </Box>

                {/* Current uploaded files */}
                {mockChapterFiles[chapter.id] && (
                  <Card variant="outlined" sx={{ mb: 2 }}>
                    <CardContent sx={{ py: 2 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
                        Current Submission:
                      </Typography>
                      {getCurrentVersion(chapter.id).map((file, index) => (
                        <Box key={index}>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              p: 1,
                              border: 1,
                              borderColor: 'divider',
                              borderRadius: 1,
                              bgcolor: 'background.default',
                              mb: 1
                            }}
                          >
                            <Box sx={{ mr: 1 }}>
                              {getFileIcon(file.type)}
                            </Box>
                            <Box sx={{ flexGrow: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {file.name}
                                <Chip
                                  label={`v${file.version}`}
                                  size="small"
                                  color="primary"
                                  sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                                />
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {file.size}
                              </Typography>
                            </Box>
                            <IconButton size="small" color="primary">
                              <Download fontSize="small" />
                            </IconButton>
                            <IconButton size="small" color="error" disabled={chapter.status === 'approved'}>
                              <Delete fontSize="small" />
                            </IconButton>
                          </Box>
                          {/* Submission info */}
                          <Box sx={{ pl: 2, pb: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Avatar sx={{ width: 20, height: 20, fontSize: '0.75rem' }}>
                                {file.submittedBy.charAt(0)}
                              </Avatar>
                              <Typography variant="caption" color="text.secondary">
                                Submitted by <strong>{file.submittedBy}</strong> on {file.submissionDate}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                      ))}

                      {/* Version History Section */}
                      {getPreviousVersions(chapter.id).length > 0 && (
                        <Box sx={{ mt: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Button
                              variant="text"
                              size="small"
                              startIcon={<History />}
                              onClick={() => toggleVersionHistory(chapter.id)}
                              sx={{ textTransform: 'none', fontSize: '0.875rem' }}
                            >
                              {showVersionHistory[chapter.id] ? 'Hide' : 'Show'} Version History
                              ({getPreviousVersions(chapter.id).length} previous versions)
                            </Button>
                          </Box>

                          {showVersionHistory[chapter.id] && (
                            <Box sx={{ mt: 1, pl: 2, borderLeft: 2, borderColor: 'divider' }}>
                              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                                Previous Versions:
                              </Typography>
                              {getPreviousVersions(chapter.id).map((file, index) => (
                                <Box key={index} sx={{ mb: 1 }}>
                                  <Box
                                    sx={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      p: 1,
                                      border: 1,
                                      borderColor: 'divider',
                                      borderRadius: 1,
                                      bgcolor: 'background.default',
                                      opacity: 0.9
                                    }}
                                  >
                                    <Box sx={{ mr: 1 }}>
                                      {getFileIcon(file.type)}
                                    </Box>
                                    <Box sx={{ flexGrow: 1 }}>
                                      <Typography variant="body2" sx={{ fontWeight: 400 }}>
                                        {file.name}
                                        <Chip
                                          label={`v${file.version}`}
                                          size="small"
                                          variant="outlined"
                                          sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                                        />
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        {file.size}
                                      </Typography>
                                    </Box>
                                    <IconButton size="small" color="primary">
                                      <Download fontSize="small" />
                                    </IconButton>
                                  </Box>
                                  {/* Previous version submission info */}
                                  <Box sx={{ pl: 2, pt: 0.5 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <Avatar sx={{ width: 16, height: 16, fontSize: '0.6rem' }}>
                                        {file.submittedBy.charAt(0)}
                                      </Avatar>
                                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                        Submitted by <strong>{file.submittedBy}</strong> on {file.submissionDate}
                                      </Typography>
                                    </Box>
                                  </Box>
                                </Box>
                              ))}
                            </Box>
                          )}
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                )}

                {!mockChapterFiles[chapter.id] && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    No document uploaded yet. Click "Upload Document" to submit your chapter.
                  </Alert>
                )}
              </Box>

              {/* Feedback Section (if any) */}
              {chapter.comments.length > 0 && (
                <Box>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Person sx={{ mr: 1 }} />
                    Recent Feedback
                  </Typography>
                  <Stack spacing={2}>
                    {chapter.comments.slice(0, 2).map((comment, index) => (
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
                        </CardContent>
                      </Card>
                    ))}
                  </Stack>
                </Box>
              )}
            </Box>
          </AccordionDetails>
        </Accordion>
      ))}

      {/* Upload Dialog */}
      <Dialog open={uploadDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          Upload Document for {chapterTitle}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Upload your chapter document in PDF or DOCX format (max 10MB).
          </Typography>

          {uploadError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {uploadError}
            </Alert>
          )}

          <Box
            sx={{
              border: 2,
              borderColor: uploadedFile ? 'success.main' : 'divider',
              borderStyle: 'dashed',
              borderRadius: 2,
              p: 3,
              textAlign: 'center',
              cursor: 'pointer',
              '&:hover': {
                borderColor: 'primary.main',
                bgcolor: 'action.hover'
              }
            }}
            component="label"
          >
            <input
              type="file"
              hidden
              accept=".pdf,.docx"
              onChange={handleFileChange}
            />
            <CloudUpload sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
            <Typography variant="body1" sx={{ mb: 1 }}>
              {uploadedFile ? uploadedFile.name : 'Click to browse or drag and drop'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {uploadedFile ? formatFileSize(uploadedFile.size) : 'PDF or DOCX files only'}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>
            Cancel
          </Button>
          <Button
            onClick={handleUploadSubmit}
            variant="contained"
            disabled={!uploadedFile}
            startIcon={<Upload />}
          >
            Upload
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
