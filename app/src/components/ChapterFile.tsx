import * as React from 'react';
import {
    Typography,
    Box,
    Chip,
    Card,
    CardContent,
    IconButton,
    Avatar,
    Alert,
    Stack,
} from '@mui/material';
import {
    PictureAsPdf,
    Description,
    Delete,
    Download,
} from '@mui/icons-material';
import type { FileType } from '../types/thesis';
import {
    getChapterSubmissions,
    getCurrentVersion,
    getVersionHistory as getPreviousVersions
} from '../utils/dbUtils';

interface ChapterFileProps {
    chapterId: number;
    onVersionSelect?: (version: number) => void;
    selectedVersion?: number;
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

export function ChapterFile({ chapterId, onVersionSelect, selectedVersion }: ChapterFileProps) {
    // Get all submission files for this chapter
    const submissionFiles = getChapterSubmissions(chapterId);

    if (submissionFiles.length === 0) {
        return (
            <Alert severity="info" sx={{ mb: 2 }}>
                No document uploaded yet. Click "Upload Document" to submit your chapter.
            </Alert>
        );
    }

    // Sort files by submission date (newest first)
    const sortedFiles = submissionFiles
        .filter(file => file.category === 'submission')
        .sort((a, b) => new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime());

    return (
        <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent sx={{ py: 2 }}>
                <Stack spacing={3}>
                    {sortedFiles.map((file, index) => {
                        const isCurrentVersion = index === 0; // Most recent file is current
                        const version = sortedFiles.length - index; // Calculate version number
                        const isSelected = selectedVersion === version;

                        return (
                            <Box key={file.url}>
                                {/* Version Header */}
                                <Box sx={{
                                    p: 2,
                                    border: 2,
                                    borderColor: isSelected ? 'secondary.main' : isCurrentVersion ? 'primary.main' : 'divider',
                                    borderRadius: 2,
                                    bgcolor: isSelected ? 'secondary.50' : isCurrentVersion ? 'primary.50' : 'background.paper',
                                    position: 'relative',
                                    cursor: onVersionSelect ? 'pointer' : 'default',
                                    '&:hover': onVersionSelect ? {
                                        borderColor: isSelected ? 'secondary.dark' : 'primary.light',
                                        bgcolor: isSelected ? 'secondary.100' : 'primary.100'
                                    } : {}
                                }}
                                    onClick={() => onVersionSelect?.(version)}
                                >
                                    {isCurrentVersion && (
                                        <Chip
                                            label="Current Version"
                                            color="primary"
                                            size="small"
                                            sx={{ position: 'absolute', top: -8, right: 16, fontSize: '0.7rem' }}
                                        />
                                    )}

                                    {isSelected && (
                                        <Chip
                                            label="Selected"
                                            color="secondary"
                                            size="small"
                                            sx={{ position: 'absolute', top: -8, left: 16, fontSize: '0.7rem' }}
                                        />
                                    )}

                                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                        <Box sx={{ mr: 2 }}>
                                            {getFileIcon(file.type)}
                                        </Box>
                                        <Box sx={{ flexGrow: 1 }}>
                                            <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                                {file.name}
                                                <Chip
                                                    label={`v${version}`}
                                                    size="small"
                                                    color={isSelected ? "secondary" : isCurrentVersion ? "primary" : "default"}
                                                    sx={{ ml: 1, height: 20, fontSize: '0.7rem' }}
                                                />
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {file.size}
                                            </Typography>
                                        </Box>
                                        <IconButton size="small" color="primary" aria-label="Download">
                                            <Download fontSize="small" />
                                        </IconButton>
                                        {isCurrentVersion && (
                                            <IconButton size="small" color="error" aria-label="Delete">
                                                <Delete fontSize="small" />
                                            </IconButton>
                                        )}
                                    </Box>

                                    {/* Submission info */}
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
                                            {file.submittedBy.charAt(0)}
                                        </Avatar>
                                        <Typography variant="body2" color="text.secondary">
                                            Submitted by <strong>{file.submittedBy}</strong> on {file.submissionDate}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Box>
                        );
                    })}
                </Stack>
            </CardContent>
        </Card>
    );
}
