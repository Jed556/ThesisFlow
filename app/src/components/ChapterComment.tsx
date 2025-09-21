import { Typography, Box, Chip, Card, CardContent, Stack, Divider, IconButton, } from '@mui/material';
import { Person, Edit, PictureAsPdf, Description, AttachFile, Visibility, } from '@mui/icons-material';
import Avatar, { Name } from './Avatar';
import type { ThesisComment } from '../types/thesis';
import { parseThesisDate } from '../utils/dateUtils';
import { getThesisRole, getThesisRoleDisplayText } from '../utils/roleUtils';
import { getDisplayName, getAttachmentFiles, getDocumentNameByVersion } from '../utils/dbUtils';

/**
 * Props for the ChapterComment component
 */
interface ChapterCommentProps {
    /**
     * Array of thesis comments
     */
    comments: ThesisComment[];
    /**
     * ID of the chapter
     */
    chapterId: number;
    /**
     * Whether to group comments by document version
     * @default false
     */
    groupByVersion?: boolean;
    /**
     * Sort order for versions ('asc' or 'desc')
     * @default 'asc' (oldest version first)
     */
    versionSort?: SortOrder;
    /**
     * Currently selected version to filter comments
     * @default -1 (no filtering)
     */
    versionSelected?: number;
    /**
     * Sort order for comments within a version ('asc' or 'desc')
     * @default 'asc' (oldest comment first)
     */
    commentSort?: SortOrder;
    /**
     * Callback when a version is selected
     * @param version - The version number that was selected
     */
    onVersionSelect?: (version: number) => void;
    /**
     * Email of the current user
     */
    currentUserEmail?: string;
    /**
     * Whether to show dividers between versions
     * @default true
     */
    showVersionDividers?: boolean;
}

/**
 * Sort order for comments
 */
type SortOrder = 'asc' | 'desc';

/**
 * Get the attachment icon for a file type
 * @param fileType - The type of the file
 * @returns The icon for the attachment
 */
const getAttachmentIcon = (fileType: string) => {
    switch (fileType.toLowerCase()) {
        case 'pdf':
            return <PictureAsPdf color="error" />;
        case 'docx':
        case 'doc':
            return <Description color="primary" />;
        case 'xlsx':
        case 'xls':
            return <Description color="success" />;
        default:
            return <AttachFile color="action" />;
    }
};

/**
 * Chapter comments section
 * @param comments - Array of thesis comments
 * @param chapterId - ID of the chapter
 * @param groupByVersion - Whether to group comments by document version
 * @param versionSort - Sort order for versions ('asc' or 'desc')
 * @param versionSelected - Currently selected version to filter comments
 * @param commentSort - Sort order for comments within a version ('asc' or 'desc')
 * @param onVersionSelect - Callback when a version is selected
 * @param currentUserEmail - Email of the current user
 * @param showVersionDividers - Whether to show dividers between versions
 */
export function ChapterComment({ comments, chapterId, groupByVersion = false, versionSort = 'asc', versionSelected = -1,
    commentSort = 'asc', onVersionSelect, currentUserEmail, showVersionDividers = true }: ChapterCommentProps) {

    if (comments.length === 0) {
        return null;
    }

    const isCurrentUserComment = (comment: ThesisComment): boolean => {
        if (!currentUserEmail) return false;
        return comment.author === currentUserEmail;
    };

    const sortComments = (commentsToSort: ThesisComment[]): ThesisComment[] => {
        const sorted = [...commentsToSort].sort((a, b) => {
            const dateA = parseThesisDate(a.date);
            const dateB = parseThesisDate(b.date);

            if (commentSort === 'asc') {
                return dateA.getTime() - dateB.getTime();
            } else {
                return dateB.getTime() - dateA.getTime();
            }
        });

        return sorted;
    };

    /**
     * Comment Card Component
     * @param comment - The thesis comment to display
     * @param index - Index of the comment in the list
     */
    const CommentCard = ({ comment, index }: { comment: ThesisComment; index: number }) => {
        const isCurrentUser = isCurrentUserComment(comment);
        const authorDisplayName = getDisplayName(comment.author);
        const userRole = getThesisRole(comment.author);
        const userRoleDisplay = getThesisRoleDisplayText(comment.author);

        const attachmentFiles = getAttachmentFiles(comment.attachments);

        return (
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: isCurrentUser ? 'flex-end' : 'flex-start',
                    mb: 2
                }}
            >
                <Card
                    key={`${comment.author}-${comment.date}-${index}`}
                    variant="outlined"
                    sx={{
                        maxWidth: '80%',
                        ml: isCurrentUser ? 2 : 1,
                        mr: isCurrentUser ? 1 : 2,
                        bgcolor: isCurrentUser ? 'primary' : 'background.paper'
                    }}
                >
                    <CardContent sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            {!isCurrentUser && (
                                <Avatar
                                    email={comment.author}
                                    initials={[Name.FIRST]}
                                    size="small"
                                    sx={{
                                        width: 28,
                                        height: 28,
                                        mr: 1.5,
                                        bgcolor: userRole === 'adviser' ? 'primary.main' : 'secondary.main'
                                    }}
                                />
                            )}
                            <Box sx={{ flexGrow: 1, textAlign: isCurrentUser ? 'right' : 'left' }}>
                                <Typography variant="subtitle2" sx={{ fontSize: '0.875rem' }}>
                                    {isCurrentUser ? 'You' : authorDisplayName}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {userRoleDisplay} • {comment.date}
                                </Typography>
                            </Box>
                            {isCurrentUser && (
                                <Avatar
                                    email={comment.author}
                                    size="small"
                                    sx={{
                                        width: 28,
                                        height: 28,
                                        ml: 1.5,
                                        bgcolor: 'primary.main'
                                    }}
                                />
                            )}
                        </Box>

                        <Typography variant="body2" sx={{
                            ml: isCurrentUser ? 0 : 5,
                            mr: isCurrentUser ? 5 : 0,
                            mb: 1,
                            textAlign: isCurrentUser ? 'right' : 'left'
                        }}>
                            {comment.comment}
                        </Typography>

                        {/* Attachments */}
                        {attachmentFiles && attachmentFiles.length > 0 && (
                            <Box sx={{
                                ml: isCurrentUser ? 0 : 5,
                                mr: isCurrentUser ? 5 : 0,
                                mt: 1
                            }}>
                                <Divider sx={{ mb: 1 }} />
                                <Typography variant="caption" color="text.secondary" sx={{
                                    mb: 1,
                                    display: 'block',
                                    textAlign: isCurrentUser ? 'right' : 'left'
                                }}>
                                    Attachments:
                                </Typography>
                                {attachmentFiles.map((attachment, attachIndex: number) => (
                                    <Box key={attachIndex} sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1,
                                        mb: 0.5,
                                        justifyContent: isCurrentUser ? 'flex-end' : 'flex-start'
                                    }}>
                                        {!isCurrentUser && getAttachmentIcon(attachment.type)}
                                        <Typography variant="body2" color="primary" sx={{ cursor: 'pointer', textDecoration: 'underline', fontSize: '0.8rem' }}>
                                            {attachment.name}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            ({attachment.size})
                                        </Typography>
                                        <IconButton size="small" color="primary">
                                            <Visibility fontSize="small" />
                                        </IconButton>
                                        {isCurrentUser && getAttachmentIcon(attachment.type)}
                                    </Box>
                                ))}
                            </Box>
                        )}
                    </CardContent>
                </Card>
            </Box>
        );
    };

    // If groupByVersion is true, group comments by their document version
    if (groupByVersion) {
        // Group comments by version
        const groupedComments = comments.reduce((acc, comment) => {
            const version = comment.version;
            if (version !== undefined) {
                if (!acc[version]) {
                    acc[version] = [];
                }
                acc[version].push(comment);
            }
            return acc;
        }, {} as Record<number, ThesisComment[]>);

        // Sort versions based on versionSort prop
        const sortedVersions = Object.keys(groupedComments)
            .map(Number)
            .sort((a, b) => {
                if (versionSort === 'asc') {
                    return a - b; // Oldest version first
                } else {
                    return b - a; // Newest version first (default)
                }
            });

        // Filter versions if a specific version is selected
        const filteredVersions = versionSelected && versionSelected !== -1
            ? sortedVersions.filter(version => version === versionSelected)
            : sortedVersions;

        return (
            <Box>
                <Stack spacing={3}>
                    {filteredVersions.map((version) => {
                        const versionComments = groupedComments[version];
                        const documentName = getDocumentNameByVersion(chapterId, version);

                        // Find the actual latest version (highest version number)
                        const allVersions = Object.keys(groupedComments).map(Number);
                        const actualLatestVersion = Math.max(...allVersions);
                        const isLatestVersion = version === actualLatestVersion;
                        const isSelectedVersion = versionSelected === version;

                        return (
                            <Box key={version}>
                                {/* Version Divider with Chip - Clickable */}
                                {showVersionDividers && (
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            my: 2,
                                            cursor: onVersionSelect ? 'pointer' : 'default',
                                            '&:hover': onVersionSelect ? {
                                                '& .version-chip': {
                                                    bgcolor: 'action.hover'
                                                },
                                                '& .MuiDivider-root': {
                                                    borderColor: 'action.disabled',
                                                    opacity: 0.6
                                                }
                                            } : {}
                                        }}
                                        onClick={() => onVersionSelect?.(version)}
                                    >
                                        <Divider sx={{ flexGrow: 1 }} />
                                        <Chip
                                            className="version-chip"
                                            label={`v${version} • ${documentName}`}
                                            color={isLatestVersion || isSelectedVersion ? "primary" : "default"}
                                            variant={isSelectedVersion ? "filled" : "outlined"}
                                            size="small"
                                            sx={{
                                                mx: 2,
                                                fontWeight: 500,
                                                transition: 'all 0.2s ease',
                                                ...(isLatestVersion && !isSelectedVersion ? {} : {
                                                    color: isSelectedVersion ? 'primary.contrastText' : 'text.secondary',
                                                    borderColor: isSelectedVersion ? 'primary.main' : 'divider'
                                                }),
                                            }}
                                        />
                                        <Divider sx={{ flexGrow: 1 }} />
                                    </Box>
                                )}

                                {/* Comments for this version */}
                                <Stack spacing={2}>
                                    {sortComments(versionComments).map((comment, commentIndex) => (
                                        <CommentCard key={`${version}-${commentIndex}`} comment={comment} index={commentIndex} />
                                    ))}
                                </Stack>
                            </Box>
                        );
                    })}
                </Stack>
            </Box>
        );
    }

    // Default behavior: show comments without grouping
    return (
        <Box>
            <Stack spacing={2}>
                {sortComments(comments).map((comment, commentIndex) => (
                    <CommentCard key={commentIndex} comment={comment} index={commentIndex} />
                ))}
            </Stack>
        </Box>
    );
}
