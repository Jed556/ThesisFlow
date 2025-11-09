import * as React from 'react';
import { Typography, Box, Chip, Card, CardContent, IconButton, Alert, Stack, Tooltip, Skeleton } from '@mui/material';
import { PictureAsPdf, Description, Delete, Download } from '@mui/icons-material';
import { Avatar, Name } from '../../components/Avatar';
import type { FileAttachment, FileType } from '../../types/file';
import { getDisplayName } from '../../utils/firebase/firestore/user';
import { getChapterSubmissions } from '../../utils/fileUtils';

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

interface ChapterSubmissionEntry extends FileAttachment {
    displayName: string;
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
    const [submissions, setSubmissions] = React.useState<ChapterSubmissionEntry[]>([]);
    const [isFetching, setIsFetching] = React.useState<boolean>(false);
    const [loadError, setLoadError] = React.useState<string | null>(null);

    React.useEffect(() => {
        let isMounted = true;

        async function loadChapterSubmissions() {
            if (loading) {
                setIsFetching(true);
                setSubmissions([]);
                setLoadError(null);
                return;
            }

            setIsFetching(true);
            setLoadError(null);

            try {
                const files = await getChapterSubmissions(chapterId);
                if (!isMounted) {
                    return;
                }

                const filteredEntries = files
                    .filter((file) => file.category === 'submission')
                    .sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());

                const uniqueAuthors = Array.from(new Set(filteredEntries.map((file) => file.author)));
                const authorEntries = await Promise.all(uniqueAuthors.map(async (author) => {
                    try {
                        const name = await getDisplayName(author);
                        return [author, name] as const;
                    } catch (error) {
                        console.error(`Failed to resolve display name for ${author}`, error);
                        return [author, author] as const;
                    }
                }));

                if (!isMounted) {
                    return;
                }

                const authorMap = Object.fromEntries(authorEntries);
                const enrichedFiles = filteredEntries.map((file) => ({
                    ...file,
                    displayName: authorMap[file.author] ?? file.author,
                }));

                setSubmissions(enrichedFiles);
            } catch (error) {
                console.error('Failed to load chapter submissions:', error);
                if (isMounted) {
                    setSubmissions([]);
                    setLoadError('Failed to load chapter submissions. Please try again later.');
                }
            } finally {
                if (isMounted) {
                    setIsFetching(false);
                }
            }
        }

        void loadChapterSubmissions();

        return () => {
            isMounted = false;
        };
    }, [chapterId, loading]);

    const isLoading = loading || isFetching;
    const transitionBase = React.useMemo(
        () => ['border-color 200ms ease-in-out', 'background-color 200ms ease-in-out', 'opacity 180ms ease-in-out'].join(', '),
        []
    );
    const chipTransition = React.useMemo(
        () => ['background-color 200ms ease-in-out', 'color 200ms ease-in-out'].join(', '),
        []
    );
    const chipTransformTransition = React.useMemo(
        () => ['opacity 200ms ease-in-out', 'transform 180ms ease-in-out', chipTransition].join(', '),
        [chipTransition]
    );

    const skeletonItems = React.useMemo(() => Array.from({ length: 2 }), []);
    const shouldRenderList = isLoading || submissions.length > 0;

    return (
        <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent sx={{ py: 2 }}>
                {loadError && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {loadError}
                    </Alert>
                )}

                {!shouldRenderList && !loadError && (
                    <Alert severity="info" sx={{ mb: 2 }}>
                        No document uploaded yet. Click 'Upload Document' to submit your chapter.
                    </Alert>
                )}

                {shouldRenderList && (
                    <Stack spacing={3}>
                        {isLoading && skeletonItems.map((_, index) => (
                            <Box
                                key={`chapter-file-skeleton-${index}`}
                                sx={{
                                    p: 2,
                                    border: 2,
                                    borderColor: 'divider',
                                    borderRadius: 2,
                                    bgcolor: 'background.paper',
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
                        ))}

                        {!isLoading && submissions.map((file, index) => {
                            const isCurrentVersion = index === 0;
                            const version = submissions.length - index;
                            const isSelected = selectedVersion === version;
                            const clickable = Boolean(onVersionSelect);
                            const uploadDate = new Date(file.uploadDate);
                            const formattedUploadDate = Number.isNaN(uploadDate.getTime())
                                ? file.uploadDate
                                : uploadDate.toLocaleString();

                            const fileBoxStyles = {
                                p: 2,
                                border: 2,
                                borderColor: isSelected ? 'secondary.main' : isCurrentVersion ? 'primary.main' : 'divider',
                                borderRadius: 2,
                                bgcolor: isSelected ? 'secondary.50' : isCurrentVersion ? 'primary.50' : 'background.paper',
                                position: 'relative',
                                cursor: clickable ? 'pointer' : 'default',
                                transition: transitionBase,
                                opacity: isSelected ? 1 : 0.995,
                                ...(clickable ? {
                                    '&:hover': {
                                        borderColor: isSelected ? 'secondary.dark' : 'primary.light',
                                        bgcolor: isSelected ? 'secondary.100' : 'primary.100',
                                    },
                                    '&:hover .chapter-chip-current': {
                                        bgcolor: isSelected ? 'secondary.dark' : 'primary.light',
                                        transition: chipTransition,
                                    },
                                    '&:hover .chapter-chip-selected': {
                                        bgcolor: isSelected ? 'secondary.dark' : 'primary.light',
                                        transition: chipTransition,
                                    },
                                } : {}),
                            } as const;

                            const tooltipTitle = !selectedVersion && clickable
                                ? 'Click to view feedback for this version. Click again to show all feedback.'
                                : '';

                            const fileContent = (
                                <Box sx={fileBoxStyles} onClick={() => onVersionSelect?.(version)}>
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
                                                transition: chipTransformTransition,
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
                                            transition: chipTransformTransition,
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

                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Avatar
                                            uid={file.author}
                                            initials={[Name.FIRST]}
                                            size="small"
                                        />
                                        <Typography variant="body2" color="text.secondary">
                                            Submitted by <strong>{file.displayName}</strong> on {formattedUploadDate}
                                        </Typography>
                                    </Box>
                                </Box>
                            );

                            return (
                                <Box key={file.url}>
                                    <Tooltip
                                        title={tooltipTitle}
                                        placement="top"
                                        arrow
                                        disableHoverListener={!tooltipTitle}
                                    >
                                        {fileContent}
                                    </Tooltip>
                                </Box>
                            );
                        })}
                    </Stack>
                )}
            </CardContent>
        </Card>
    );
}
