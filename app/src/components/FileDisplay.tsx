import * as React from 'react';
import {
    Typography,
    Box,
    Chip,
    Card,
    CardContent,
    IconButton,
    Avatar,
    Button,
    Alert,
} from '@mui/material';
import {
    PictureAsPdf,
    Description,
    Delete,
    Download,
    History,
} from '@mui/icons-material';
import type { FileType } from '../types/thesis';
import {
    mockChapterFiles,
    getCurrentVersion,
    getVersionHistory as getPreviousVersions
} from '../data/mockData';

interface FileDisplayProps {
    chapterId: number;
}

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

export function FileDisplay({ chapterId }: FileDisplayProps) {
    const [showVersionHistory, setShowVersionHistory] = React.useState(false);

    const toggleVersionHistory = () => {
        setShowVersionHistory(prev => !prev);
    };

    if (!mockChapterFiles[chapterId]) {
        return (
            <Alert severity="info" sx={{ mb: 2 }}>
                No document uploaded yet. Click "Upload Document" to submit your chapter.
            </Alert>
        );
    }

    return (
        <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent sx={{ py: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
                    Current Submission:
                </Typography>
                {getCurrentVersion(chapterId).map((file, index) => (
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
                            <IconButton size="small" color="error">
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
                {getPreviousVersions(chapterId).length > 0 && (
                    <Box sx={{ mt: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Button
                                variant="text"
                                size="small"
                                startIcon={<History />}
                                onClick={toggleVersionHistory}
                                sx={{ textTransform: 'none', fontSize: '0.875rem' }}
                            >
                                {showVersionHistory ? 'Hide' : 'Show'} Version History
                                ({getPreviousVersions(chapterId).length} previous versions)
                            </Button>
                        </Box>

                        {showVersionHistory && (
                            <Box sx={{ mt: 1, pl: 2, borderLeft: 2, borderColor: 'divider' }}>
                                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                                    Previous Versions:
                                </Typography>
                                {getPreviousVersions(chapterId).map((file, index) => (
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
    );
}
