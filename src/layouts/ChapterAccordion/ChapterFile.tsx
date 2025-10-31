import { Typography, Box, Chip, Card, CardContent, IconButton, Alert, Stack, Tooltip, Skeleton } from '@mui/material';
import { PictureAsPdf, Description, Delete, Download, } from '@mui/icons-material';
import Avatar, { Name } from '../../components/Avatar/Avatar';
import type { FileType } from '../../types/file';
import { getChapterSubmissions, getDisplayName } from '../../utils/dbUtils';

/**
 * Props for the ChapterFile component
 */
interface ChapterFileProps {
    /**
     * ID of the chapter to display files for
     */
    chapterId: number;
    /**
     * Optional callback when a version is selected
     * @param version - The selected version number
     */
    onVersionSelect?: (version: number) => void;
    /**
     * Currently selected version number
     */
    selectedVersion?: number;
    /**
     * Whether the files are still loading
     * @default false
     */
    loading?: boolean;
}

/**
 * Get the file icon for a specific file type
 * @param fileType - The type of the file
 * @returns The icon for the file type
 */
const getFileIcon = (fileType: FileType) => {
    switch (fileType.toLowerCase()) {
        case 'pdf':
            return <PictureAsPdf sx={{ color: '#d32f2f' }} />; // Constant red for PDF
        case 'docx':
        case 'doc':
            return <Description sx={{ color: '#1976d2' }} />; // Constant blue for Word docs
        default:
            return <Description sx={{ color: '#757575' }} />; // Constant grey for other files
    }
};

/**
 * File versions list for a chapter
 * @param chapterId - ID of the chapter to display files for
 * @param onVersionSelect - Optional callback when a version is selected
 * @param selectedVersion - Currently selected version number
 * @param loading - Whether the files are still loading
 */
export default function ChapterFile({ chapterId, onVersionSelect, selectedVersion, loading = false }: ChapterFileProps) {
    // Get all submission files for this chapter
    const submissionFiles = loading ? [] : getChapterSubmissions(chapterId);

    // If not loading and no files, show info alert
    if (!loading && submissionFiles.length === 0) {
        return (
            <Alert severity="info" sx={{ mb: 2 }}>
                No document uploaded yet. Click "Upload Document" to submit your chapter.
            </Alert>
        );
    }

    // Sort files by submission date (newest first)
    const sortedFiles = loading ? [] : submissionFiles
        .filter(file => file.category === 'submission')
        .sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());

    // Show skeleton cards while loading
    const filesToRender = loading ? [1, 2] : sortedFiles;

    return (
        <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent sx={{ py: 2 }}>
                <Stack spacing={3}>
                    {filesToRender.map((fileOrIndex, index) => {
                        if (loading) {
                            // Render skeleton
                            return (
                                <Box
                                    key={`skeleton-${index}`}
                                    sx={{
                                        p: 2,
                                        border: 2,
                                        borderColor: 'divider',
                                        borderRadius: 2,
                                        bgcolor: 'background.paper'
                                    }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                                        <Skeleton variant="circular" width={24} height={24} />
                                        <Box sx={{ flexGrow: 1 }}>
                                            <Skeleton variant="text" width="60%" height={24} />
                                            <Skeleton variant="text" width="40%" height={20} />
                                        </Box>
                                        <Skeleton variant="rectangular" width={60} height={24} />
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                                        <Skeleton variant="circular" width={28} height={28} />
                                        <Box sx={{ flexGrow: 1 }}>
                                            <Skeleton variant="text" width="30%" height={20} />
                                            <Skeleton variant="text" width="50%" height={16} />
                                        </Box>
                                    </Box>
                                </Box>
                            );
                        }

                        // Render actual file
                        const file = fileOrIndex as any;
                        const isCurrentVersion = index === 0; // Most recent file is current
                        const version = sortedFiles.length - index; // Calculate version number
                        const isSelected = selectedVersion === version;

                        const authorName = getDisplayName(file.author);
                        const clickable = Boolean(onVersionSelect);

                        const fileBoxSx = (theme: any) => ({
                            p: 2,
                            border: 2,
                            borderColor: isSelected ? 'secondary.main' : isCurrentVersion ? 'primary.main' : 'divider',
                            borderRadius: 2,
                            bgcolor: isSelected ? 'secondary.50' : isCurrentVersion ? 'primary.50' : 'background.paper',
                            position: 'relative',
                            cursor: clickable ? 'pointer' : 'default',
                            // Smooth transition for border, background, and opacity changes
                            transition: 'border-color short easeInOut, background-color short easeInOut, opacity calc(short * 0.9) easeInOut',
                            opacity: isSelected ? 1 : 0.995,
                            '&:hover': clickable
                                ? {
                                    borderColor: isSelected ? 'secondary.dark' : 'primary.light',
                                    bgcolor: isSelected ? 'secondary.100' : 'primary.100',
                                }
                                : {},

                            // Animate chips to follow the same background/color on parent hover
                            '&:hover .chapter-chip-current': {
                                bgcolor: isSelected ? 'secondary.dark' : 'primary.light',
                                transition: 'background-color short easeInOut, color short easeInOut',
                            },
                            '&:hover .chapter-chip-selected': {
                                bgcolor: isSelected ? 'secondary.dark' : 'primary.light',
                                transition: 'background-color short easeInOut, color short easeInOut',
                            },
                        });

                        const fileContent = (
                            <Box sx={fileBoxSx} onClick={() => onVersionSelect?.(version)}>
                                {isCurrentVersion && (
                                    <Chip
                                        className="chapter-chip-current"
                                        label="Current Version"
                                        size="small"
                                        color={isSelected ? 'secondary' : 'primary'}
                                        sx={(theme) => ({
                                            position: 'absolute',
                                            top: 0,
                                            right: 12,
                                            transform: 'translateY(-50%)',
                                            fontSize: '0.7rem',
                                            zIndex: 1,
                                            transition: 'background-color short easeInOut, color short easeInOut, transform calc(short * 0.9) easeInOut',
                                            '& .MuiChip-label': {
                                                paddingLeft: theme.spacing(1),
                                                paddingRight: theme.spacing(1),
                                            },
                                        })}
                                    />
                                )}

                                <Chip
                                    className="chapter-chip-selected"
                                    label="Selected"
                                    size="small"
                                    color={isSelected ? 'secondary' : undefined}
                                    variant={isSelected ? 'filled' : 'outlined'}
                                    sx={(theme) => ({
                                        position: 'absolute',
                                        top: 0,
                                        left: 12,
                                        transform: isSelected ? 'translateY(-50%) scale(1)' : 'translateY(-50%) scale(0.92)',
                                        fontSize: '0.7rem',
                                        zIndex: 1,
                                        opacity: isSelected ? 1 : 0,
                                        pointerEvents: isSelected ? 'auto' : 'none',
                                        transition: 'opacity short easeInOut, transform calc(short * 0.9) easeInOut, background-color short easeInOut, color short easeInOut',
                                        '& .MuiChip-label': {
                                            paddingLeft: theme.spacing(1),
                                            paddingRight: theme.spacing(1),
                                        },
                                    })}
                                />

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
                                                color={isSelected ? 'secondary' : isCurrentVersion ? 'primary' : 'default'}
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
                                    <Avatar
                                        email={file.author}
                                        initials={[Name.FIRST]}
                                        size="small"
                                    />
                                    <Typography variant="body2" color="text.secondary">
                                        Submitted by <strong>{authorName}</strong> on {file.uploadDate}
                                    </Typography>
                                </Box>
                            </Box>
                        );

                        return (
                            <Box key={file.url}>
                                <Tooltip
                                    title={(!selectedVersion && clickable) ? "Click on this document version to view feedback for that version. Click again to deselect and view all feedback." : ''}
                                    placement="top"
                                    arrow
                                    // Keep the tooltip wrapper mounted but disable hover when not applicable.
                                    disableHoverListener={!(!selectedVersion && clickable)}
                                >
                                    {fileContent}
                                </Tooltip>
                            </Box>
                        );
                    })}
                </Stack>
            </CardContent>
        </Card>
    );
}
