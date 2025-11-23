import * as React from 'react';
import { Typography, Box, Chip, Accordion, AccordionSummary, AccordionDetails, Button } from '@mui/material';
import { ExpandMore, CheckCircle, Pending, Cancel, Schedule, Upload, CloudUpload } from '@mui/icons-material';
import type { StatusColor, ThesisChapter } from '../../types/thesis';
import ChapterItem from './ChapterItem';

/**
 * Props for the ChapterAccordion component
 */
export interface ChapterAccordionUploadLabels {
    empty?: string;
    existing?: string;
}

interface ChapterAccordionProps {
    /** Thesis chapter to display */
    chapter: ThesisChapter;
    /** Callback when the upload button is clicked */
    onUploadClick?: (chapter: ThesisChapter) => void;
    /** Optional override for upload button labels */
    uploadLabels?: ChapterAccordionUploadLabels;
    /** Optional override for the upload button icon */
    uploadIcon?: React.ReactNode;
}

const DEFAULT_UPLOAD_LABELS = {
    empty: 'Upload Document',
    existing: 'Replace Document',
};

/**
 * Get the color for a chapter's status
 * @param status - Chapter status string
 * @returns Color for the chapter status
 */
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

/**
 * Get the icon for a chapter's status
 * @param status - Chapter status string
 * @returns Icon element for the chapter status
 */
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

/**
 * Get the display text for a chapter's status
 * @param status - Chapter status string
 * @returns Display text for the chapter status
 */
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

/**
 * Display chapter details and upload options in an accordion
 * @param chapter - Chapter object
 * @param onUploadClick - Callback function for upload button click
 */
export default function ChapterAccordion({ chapter, onUploadClick, uploadLabels, uploadIcon }: ChapterAccordionProps) {
    const hasSubmissions = (chapter.submissions ?? []).length > 0;
    const uploadLabel = hasSubmissions
        ? uploadLabels?.existing ?? DEFAULT_UPLOAD_LABELS.existing
        : uploadLabels?.empty ?? DEFAULT_UPLOAD_LABELS.empty;
    const uploadDisabled = chapter.status === 'approved' || !onUploadClick;
    const UploadIcon = uploadIcon ?? <Upload />;

    return (
        <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />} sx={{ bgcolor: 'background.paper' }}>
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
                        color={getStatusColor(chapter.status)}
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
                                startIcon={UploadIcon}
                                onClick={() => onUploadClick?.(chapter)}
                                disabled={uploadDisabled}
                            >
                                {uploadLabel}
                            </Button>
                        </Box>

                        <ChapterItem chapterId={chapter.id} comments={chapter.comments} />
                    </Box>
                </Box>
            </AccordionDetails>
        </Accordion>
    );
}
