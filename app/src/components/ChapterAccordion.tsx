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
import { getChapterSubmissions } from '../utils/dbUtils';
import { ChapterItem } from './ChapterItem';

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
    // Check if chapter has any submissions
    const hasSubmissions = getChapterSubmissions(chapter.id).length > 0;
    
    return (
        <Accordion sx={{ my: 2, borderRadius: 2, '&:before, &:after': { display: 'none' }, boxShadow: 3 }}>
            <AccordionSummary expandIcon={<ExpandMore />} sx={{ position: 'sticky', top: 0, zIndex: 1, borderTopLeftRadius: 8, borderTopRightRadius: 8 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', cursor: 'pointer' }}>
                    <Box sx={{ mr: 2 }}>
                        {getStatusIcon(chapter.status)}
                    </Box>
                    <Box sx={{ flexGrow: 1, cursor: 'pointer' }}>
                        <Typography variant="h6">
                            Chapter {chapter.id}: {chapter.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {chapter.submissionDate ? `Submitted: ${chapter.submissionDate}` : 'Not yet submitted'}
                            {chapter.lastModified && ` • Last modified: ${chapter.lastModified}`}
                        </Typography>
                    </Box>
                    <Chip
                        sx={{ m: 2 }}
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
                                {hasSubmissions ? 'Replace Document' : 'Upload Document'}
                            </Button>
                        </Box>

                        <ChapterItem chapterId={chapter.id} comments={chapter.comments} />
                    </Box>
                </Box>
            </AccordionDetails>
        </Accordion>
    );
}
