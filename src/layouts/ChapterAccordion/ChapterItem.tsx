import * as React from 'react';
import { Typography, Box, Card, CardContent, } from '@mui/material';
import type { ThesisComment } from '../../types/thesis';
import ChapterFile from './ChapterFile';
import ChapterComment from './ChapterComment';
import { SortButton } from '../../components/SortButton';

/**
 * Props for the ChapterItem component
 */
interface ChapterItemProps {
    /**
     * ID of the chapter
     */
    chapterId: number;
    /**
     * Array of comments related to the chapter
     */
    comments: ThesisComment[];
}

/**
 * Chapter item with file versions and comments
 * @param chapterId - ID of the chapter
 * @param comments - Array of comments related to the chapter
 */
export default function ChapterItem({ chapterId, comments }: ChapterItemProps) {
    const [selectedVersion, setSelectedVersion] = React.useState<number | undefined>();
    const [commentSortOrder, setCommentSortOrder] = React.useState<'asc' | 'desc'>('asc'); // Default: latest at bottom

    // Mock current user - in real app this would come from session/auth context
    const currentUserEmail = 'john.doe@university.edu'; // Student email

    /**
     * Get comments for a specific version
     * @param version - Version number
     * @returns Array of comments for the specified version
     */
    const getCommentsForVersion = (version: number) => {
        return comments.filter(comment => comment.version === version);
    };

    /**
     * Handle version selection/deselection
     * @param version - Version number to select/deselect
     */
    const handleVersionSelect = (version: number) => {
        if (selectedVersion === version) {
            // If clicking on the already selected version, deselect it
            setSelectedVersion(undefined);
        } else {
            // Otherwise, select the new version
            setSelectedVersion(version);
        }
    };

    /**
     * Handle comment sort toggle
     * Toggles between ascending and descending order
     */
    const toggleCommentSortOrder = () => {
        setCommentSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    };

    // If no version is selected, show all comments
    const displayComments = selectedVersion ? getCommentsForVersion(selectedVersion) : comments;

    return (
        <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: 3 }}>
                {/* File Versions Column */}
                <Box sx={{ flex: 1 }}>
                    <Card variant="outlined">
                        <CardContent>
                            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                                Document Versions
                            </Typography>
                            <ChapterFile
                                chapterId={chapterId}
                                onVersionSelect={handleVersionSelect}
                                selectedVersion={selectedVersion}
                            />
                        </CardContent>
                    </Card>
                </Box>

                {/* Comments Column */}
                <Box sx={{ flex: 1 }}>
                    <Card variant="outlined">
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
                                    Feedback & Comments
                                    {selectedVersion && (
                                        <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                                            (for version {selectedVersion})
                                        </Typography>
                                    )}
                                </Typography>

                                {/* Sort Control */}
                                {displayComments.length > 0 && (
                                    <SortButton
                                        sortOrder={commentSortOrder}
                                        onToggle={toggleCommentSortOrder}
                                        ascText="Oldest First"
                                        descText="Latest First"
                                        ascTooltip="Sort by date: Latest at bottom"
                                        descTooltip="Sort by date: Latest at top"
                                    />
                                )}
                            </Box>

                            {selectedVersion && displayComments.length === 0 && (
                                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                    No feedback provided for version {selectedVersion}.
                                </Typography>
                            )}

                            {displayComments.length > 0 && (
                                <ChapterComment
                                    comments={displayComments}
                                    chapterId={chapterId}
                                    groupByVersion={!selectedVersion}
                                    onVersionSelect={handleVersionSelect}
                                    versionSort='desc'
                                    commentSort={commentSortOrder}
                                    currentUserEmail={currentUserEmail}
                                    showVersionDividers={!selectedVersion}
                                />
                            )}

                            {!selectedVersion && comments.length === 0 && (
                                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                    No feedback received yet.
                                </Typography>
                            )}
                        </CardContent>
                    </Card>
                </Box>
            </Box>
        </Box>
    );
}
