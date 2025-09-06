import * as React from 'react';
import {
    Typography,
    Box,
    Chip,
    Card,
    CardContent,
    Avatar,
    Stack,
    Divider,
    IconButton,
} from '@mui/material';
import {
    Person,
    Edit,
    PictureAsPdf,
    Description,
    AttachFile,
    Visibility,
} from '@mui/icons-material';
import type { ThesisComment, FileAttachment } from '../types/thesis';
import { parseThesisDate } from '../utils/dateUtils';
import { getThesisRole, getThesisRoleDisplayText, isThesisStudent } from '../utils/roleUtils';
import { 
    getProfile, 
    getDisplayName, 
    getAttachmentFiles,
    getDocumentNameByVersion 
} from '../utils/dbUtils';

interface ChapterCommentProps {
    comments: ThesisComment[];
    chapterId: number; // Add chapterId for getting document names
    groupByVersion?: boolean;
    versionSort?: SortOrder;
    versionSelected?: number;
    commentSort?: SortOrder;
    onVersionSelect?: (version: number) => void;
    currentUserEmail?: string; // Email of the current user for message alignment
    showVersionDividers?: boolean; // Control whether to show version dividers
}

type SortOrder = 'asc' | 'desc';

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

export function ChapterComment({
    comments,
    chapterId,
    groupByVersion = false,
    versionSort = 'asc',
    versionSelected = -1,
    commentSort = 'asc',
    onVersionSelect,
    currentUserEmail,
    showVersionDividers = true
}: ChapterCommentProps) {

    if (comments.length === 0) {
        return null; // Let parent handle the empty state
    }

    // Check if a comment is from the current user
    const isCurrentUserComment = (comment: ThesisComment): boolean => {
        if (!currentUserEmail) return false;

        // Comments now use email directly as the author field
        return comment.author === currentUserEmail;
    };

    const sortComments = (commentsToSort: ThesisComment[]): ThesisComment[] => {
        const sorted = [...commentsToSort].sort((a, b) => {
            const dateA = parseThesisDate(a.date);
            const dateB = parseThesisDate(b.date);

            if (commentSort === 'asc') {
                return dateA.getTime() - dateB.getTime(); // Oldest first, latest at bottom
            } else {
                return dateB.getTime() - dateA.getTime(); // Latest first, oldest at bottom
            }
        });

        return sorted;
    };

    // Comment Card Component
    const CommentCard = ({ comment, index }: { comment: ThesisComment; index: number }) => {
        const isCurrentUser = isCurrentUserComment(comment);
        const authorProfile = getProfile(comment.author);
        const authorDisplayName = getDisplayName(comment.author);
        const userRole = getThesisRole(comment.author);
        const userRoleDisplay = getThesisRoleDisplayText(comment.author);

        // Get attachment files from hashes
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
                        bgcolor: isCurrentUser ? 'primary.50' : 'background.paper'
                    }}
                >
                    <CardContent sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            {!isCurrentUser && (
                                <Avatar sx={{
                                    width: 28,
                                    height: 28,
                                    mr: 1.5,
                                    bgcolor: userRole === 'adviser' ? 'primary.main' : 'secondary.main'
                                }}>
                                    {userRole === 'adviser' ? <Person fontSize="small" /> : <Edit fontSize="small" />}
                                </Avatar>
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
                                <Avatar sx={{
                                    width: 28,
                                    height: 28,
                                    ml: 1.5,
                                    bgcolor: 'primary.main'
                                }}>
                                    <Person fontSize="small" />
                                </Avatar>
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
                    {filteredVersions.map((version, versionIndex) => {
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
