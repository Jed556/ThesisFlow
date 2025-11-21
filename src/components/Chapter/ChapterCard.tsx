import * as React from 'react';
import {
    Box,
    Button,
    Card,
    CardActionArea,
    CardActions,
    CardContent,
    Chip,
    Stack,
    Typography,
} from '@mui/material';
import Skeleton from '@mui/material/Skeleton';
import type { ThesisChapterConfig } from '../../types/chapter';
import { CHAPTER_CARD_PREVIEW_LIMIT, formatChapterLabel } from './constants';

interface ChapterCardProps {
    config: ThesisChapterConfig;
    onClick?: (config: ThesisChapterConfig) => void;
    onEdit?: (config: ThesisChapterConfig) => void;
    onDelete?: (config: ThesisChapterConfig) => void;
}

/**
 * Displays a thesis chapter configuration summary inside a clickable card.
 */
export default function ChapterCard({ config, onClick, onEdit, onDelete }: ChapterCardProps) {
    const handleCardClick = React.useCallback(() => {
        onClick?.(config);
    }, [config, onClick]);

    const handleEdit = React.useCallback(
        (event: React.MouseEvent<HTMLButtonElement>) => {
            event.stopPropagation();
            onEdit?.(config);
        },
        [config, onEdit]
    );

    const handleDelete = React.useCallback(
        (event: React.MouseEvent<HTMLButtonElement>) => {
            event.stopPropagation();
            onDelete?.(config);
        },
        [config, onDelete]
    );

    const previewChapters = React.useMemo(
        () => config.chapters.slice(0, CHAPTER_CARD_PREVIEW_LIMIT),
        [config.chapters]
    );

    const remainingCount = Math.max(config.chapters.length - previewChapters.length, 0);

    return (
        <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardActionArea onClick={handleCardClick} sx={{ flexGrow: 1 }}>
                <CardContent>
                    <Stack spacing={1.5}>
                        <Box>
                            <Typography variant="overline" color="text.secondary">
                                Department
                            </Typography>
                            <Typography variant="h6" noWrap>
                                {config.department || 'Unassigned'}
                            </Typography>
                        </Box>

                        <Box>
                            <Typography variant="caption" color="text.secondary">
                                Course
                            </Typography>
                            <Typography variant="body1" noWrap>
                                {config.course || '—'}
                            </Typography>
                        </Box>

                        <Box>
                            <Typography variant="caption" color="text.secondary">
                                Required Chapters
                            </Typography>
                            <Typography variant="body1">
                                {config.chapters.length}
                            </Typography>
                        </Box>

                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            {previewChapters.map((chapter) => (
                                <Chip
                                    key={chapter.id}
                                    label={formatChapterLabel(chapter)}
                                    size="small"
                                    sx={{ textTransform: 'none', mb: 0.5 }}
                                />
                            ))}
                            {remainingCount > 0 && (
                                <Chip
                                    label={`+${remainingCount} more`}
                                    size="small"
                                    color="default"
                                    sx={{ mb: 0.5 }}
                                />
                            )}
                        </Stack>
                    </Stack>
                </CardContent>
            </CardActionArea>
            {(onEdit || onDelete) && (
                <CardActions sx={{ justifyContent: 'flex-end' }}>
                    {onEdit && (
                        <Button size="small" onClick={handleEdit}>
                            Edit
                        </Button>
                    )}
                    {onDelete && (
                        <Button size="small" color="error" onClick={handleDelete}>
                            Delete
                        </Button>
                    )}
                </CardActions>
            )}
        </Card>
    );
}

ChapterCard.displayName = 'ChapterCard';

/** Skeleton placeholder shown while chapter data is loading. */
export function ChapterCardSkeleton() {
    return (
        <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardActionArea sx={{ flexGrow: 1 }}>
                <CardContent>
                    <Stack spacing={1.5}>
                        <Skeleton variant="text" width="60%" height={28} />
                        <Skeleton variant="text" width="40%" />
                        <Skeleton variant="text" width="30%" />
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                            <Skeleton variant="rectangular" width={80} height={28} />
                            <Skeleton variant="rectangular" width={100} height={28} />
                            <Skeleton variant="rectangular" width={60} height={28} />
                        </Stack>
                    </Stack>
                </CardContent>
            </CardActionArea>
        </Card>
    );
}
