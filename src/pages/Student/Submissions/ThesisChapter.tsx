import { useState } from 'react';
import { Typography, Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, Alert, CircularProgress } from '@mui/material';
import { Article, Upload, CloudUpload } from '@mui/icons-material';
import { useSession } from '@toolpad/core';
import type { NavigationItem } from '../../../types/navigation';
import type { ThesisChapter } from '../../../types/thesis';
import type { Session } from '../../../types/session';
import { mockThesisData } from '../../../data/mockData';
import { AnimatedPage, AnimatedList } from '../../../components/Animate';
import ChapterAccordion from '../../../layouts/ChapterAccordion/ChapterAccordion';
import { uploadThesisFile, validateThesisDocument } from '../../../utils/firebase/storage/thesis';

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

/**
 * Page for managing and uploading thesis chapter submissions and feedback
 */
export default function ThesisChaptersPage() {
    const session = useSession() as Session;
    const [uploadDialog, setUploadDialog] = useState(false);
    const [selectedChapter, setSelectedChapter] = useState<number | null>(null);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [uploadError, setUploadError] = useState<string>('');
    const [uploading, setUploading] = useState(false);
    const [uploadSuccess, setUploadSuccess] = useState(false);
    const [chapterTitle, setChapterTitle] = useState('');

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

        // Use the validation from thesis storage utils
        const validation = validateThesisDocument(file);
        if (!validation.isValid) {
            setUploadError(validation.error || 'Invalid file');
            setUploadedFile(null);
            return;
        }

        setUploadError('');
        setUploadedFile(file);
    };

    const handleUploadSubmit = async () => {
        if (!uploadedFile || !selectedChapter || !session?.user?.uid) {
            setUploadError('Missing required information');
            return;
        }

        setUploading(true);
        setUploadError('');

        try {
            // Upload file to Firebase Storage
            const result = await uploadThesisFile({
                file: uploadedFile,
                userUid: session.user.uid,
                thesisId: 'thesis_001', // TODO: Get from thesis context when available
                chapterId: selectedChapter,
                category: 'submission',
                metadata: {
                    chapterTitle: chapterTitle
                }
            });

            console.log('File uploaded successfully:', result.url);
            setUploadSuccess(true);

            // Close dialog after short delay
            setTimeout(() => {
                setUploadDialog(false);
                setUploadedFile(null);
                setSelectedChapter(null);
                setUploadSuccess(false);
                // TODO: Refresh chapter data
            }, 1500);
        } catch (error) {
            console.error('Upload error:', error);
            setUploadError(error instanceof Error ? error.message : 'Failed to upload file');
        } finally {
            setUploading(false);
        }
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
        <AnimatedPage variant="fade">
            {/* Chapter Submissions */}
            <AnimatedList variant="slideUp" staggerDelay={60}>
                {
                    mockThesisData.chapters.map((chapter: ThesisChapter) => (
                        <ChapterAccordion
                            key={chapter.id}
                            chapter={chapter}
                            onUploadClick={handleUploadClick}
                        />
                    ))
                }
            </AnimatedList>
            <Box sx={{ mb: 2 }}></Box>

            {/* Upload Dialog */}
            <Dialog open={uploadDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
                <DialogTitle>
                    Upload Document for {chapterTitle}
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Upload your chapter document in PDF or DOCX format (max 50MB).
                    </Typography>

                    {uploadError && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {uploadError}
                        </Alert>
                    )}

                    {uploadSuccess && (
                        <Alert severity="success" sx={{ mb: 2 }}>
                            File uploaded successfully!
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
                    <Button onClick={handleCloseDialog} disabled={uploading}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleUploadSubmit}
                        variant="contained"
                        disabled={!uploadedFile || uploading}
                        startIcon={uploading ? <CircularProgress size={20} /> : <Upload />}
                    >
                        {uploading ? 'Uploading...' : 'Upload'}
                    </Button>
                </DialogActions>
            </Dialog>
        </AnimatedPage>
    );
}
