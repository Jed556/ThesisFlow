import * as React from 'react';
import {
  Typography,
  Paper,
  Box,
  Chip,
  LinearProgress,
  Avatar,
  Stack,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
} from '@mui/material';
import {
  Article,
  Upload,
  CloudUpload,
} from '@mui/icons-material';
import { useNavigate } from 'react-router';
import type { NavigationItem } from '../../../types/navigation';
import type { ThesisChapter } from '../../../types/thesis';
import {
  mockThesisData,
} from '../../../data/mockData';
import { calculateProgress } from '../../../utils/dbUtils';
import { ChapterAccordion } from '../../../components';

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

// Mock data - all data now imported from centralized mockData.ts

export default function ThesisChaptersPage() {
  const progress = calculateProgress();
  const navigate = useNavigate();
  const [uploadDialog, setUploadDialog] = React.useState(false);
  const [selectedChapter, setSelectedChapter] = React.useState<number | null>(null);
  const [uploadedFile, setUploadedFile] = React.useState<File | null>(null);
  const [uploadError, setUploadError] = React.useState<string>('');
  const [chapterTitle, setChapterTitle] = React.useState('');

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

  return (
    <>
      {/* Chapter Submissions */}
      {mockThesisData.chapters.map((chapter: ThesisChapter) => (
        <ChapterAccordion
          key={chapter.id}
          chapter={chapter}
          onUploadClick={handleUploadClick}
        />
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
    </>
  );
}
