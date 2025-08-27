import * as React from 'react';
import {
    Typography,
    Box,
    Chip,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Button,
} from '@mui/material';
import {
    ExpandMore,
    CheckCircle,
    Pending,
    Cancel,
    Schedule,
    Upload,
    CloudUpload,
} from '@mui/icons-material';
import type { StatusColor, ThesisChapter } from '../types/thesis';
import { mockChapterFiles } from '../data/mockData';
import { FileDisplay } from './FileDisplay';
import { FeedbackSection } from './FeedbackSection';

interface ChapterAccordionProps {
    chapter: ThesisChapter;
    onUploadClick: (chapterId: number, chapterTitle: string) => void;
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

export function ChapterAccordion({ chapter, onUploadClick }: ChapterAccordionProps) {
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
                                onClick={() => onUploadClick(chapter.id, chapter.title)}
                                disabled={chapter.status === 'approved'}
                            >
                                {mockChapterFiles[chapter.id] ? 'Replace Document' : 'Upload Document'}
                            </Button>
                        </Box>

                        {/* File Display Component */}
                        <FileDisplay chapterId={chapter.id} />
                    </Box>

                    {/* Feedback Section Component */}
                    <FeedbackSection comments={chapter.comments} />
                </Box>
            </AccordionDetails>
        </Accordion>
    );
}
