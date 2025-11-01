import { Box, Chip, Stack, Divider } from '@mui/material';
import type { ThesisComment } from '../../types/thesis';
import type { ChatMessage } from '../../types/chat';
import type { FileAttachment, FileCategory } from '../../types/file';
import { getDisplayName, getAttachmentFiles, getDocumentNameByVersion } from '../../utils/dbUtils';
import { getThesisRole, getThesisRoleDisplayText } from '../../utils/roleUtils';
import { thesisCommentToChatMessage } from '../../utils/chatUtils';
import { ChatBox } from '../../components/Chat';

/**
 * Parse size string (e.g., "1.2MB") to bytes
 */
const parseSizeString = (sizeStr: string): number => {
    const match = sizeStr.match(/^([\d.]+)\s*([A-Z]+)$/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();

    const units: Record<string, number> = {
        'B': 1,
        'BYTES': 1,
        'KB': 1024,
        'MB': 1024 * 1024,
        'GB': 1024 * 1024 * 1024
    };

    return Math.round(value * (units[unit] || 0));
};

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
 * Chapter comments section - Now using ChatBox component
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
export default function ChapterComment({
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
        return null;
    }

    // Convert thesis comments to chat messages
    const chatMessages: ChatMessage[] = comments.map((comment, index) => {
        const message = thesisCommentToChatMessage(comment, index);

        // Enrich with attachment details from mockFileRegistry
        const attachmentFiles = getAttachmentFiles(comment.attachments);
        const enrichedAttachments: FileAttachment[] = attachmentFiles.map((file, fileIndex) => {
            const fileCategory: FileCategory = file.category === 'attachment' ? 'document' : 'other';
            return {
                id: comment.attachments[fileIndex] || `att-${index}-${fileIndex}`,
                name: file.name,
                type: file.type,
                size: file.size,
                url: comment.attachments[fileIndex] || file.url,
                mimeType: file.type,
                uploadDate: comment.date,
                author: comment.author,
                category: file.category
            };
        });

        return {
            ...message,
            attachments: enrichedAttachments,
            senderRole: getThesisRole(comment.author)
        };
    });

    // If groupByVersion is true, group messages by their version
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

                        // Convert version comments to chat messages
                        const versionChatMessages: ChatMessage[] = versionComments.map((comment, index) => {
                            const message = thesisCommentToChatMessage(comment, index);

                            // Enrich with attachment details
                            const attachmentFiles = getAttachmentFiles(comment.attachments);
                            const enrichedAttachments: FileAttachment[] = attachmentFiles.map((file, fileIndex) => {
                                const fileCategory: FileCategory = file.category === 'attachment' ? 'document' : 'other';
                                return {
                                    id: comment.attachments[fileIndex] || `att-${version}-${index}-${fileIndex}`,
                                    name: file.name,
                                    type: file.type,
                                    size: file.size,
                                    url: comment.attachments[fileIndex] || file.url,
                                    mimeType: file.type,
                                    uploadDate: comment.date,
                                    author: comment.author,
                                    category: file.category
                                };
                            });

                            return {
                                ...message,
                                attachments: enrichedAttachments,
                                senderRole: getThesisRole(comment.author)
                            };
                        });

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
                                            color={isLatestVersion || isSelectedVersion ? 'primary' : 'default'}
                                            variant={isSelectedVersion ? 'filled' : 'outlined'}
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

                                {/* ChatBox for this version */}
                                <ChatBox
                                    messages={versionChatMessages}
                                    currentUserId={currentUserEmail || ''}
                                    showInput={false}
                                    height="auto"
                                    autoScroll={false}
                                    config={{
                                        showTimestamps: true,
                                        showAvatars: true,
                                        showSenderNames: true,
                                        showSenderRoles: true,
                                        sortOrder: commentSort,
                                        allowAttachments: false
                                    }}
                                    getDisplayName={(senderId) => getDisplayName(senderId)}
                                    getRoleDisplayText={(senderId) => getThesisRoleDisplayText(senderId)}
                                    getAvatarColor={(senderId) => {
                                        const role = getThesisRole(senderId);
                                        return role === 'adviser' ? 'primary.main' : 'secondary.main';
                                    }}
                                    animationStaggerDelay={40}
                                    animationVariant="slideUp"
                                />
                            </Box>
                        );
                    })}
                </Stack>
            </Box>
        );
    }

    // Default behavior: show all comments without grouping using ChatBox
    return (
        <ChatBox
            messages={chatMessages}
            currentUserId={currentUserEmail || ''}
            showInput={false}
            height="auto"
            autoScroll={false}
            config={{
                showTimestamps: true,
                showAvatars: true,
                showSenderNames: true,
                showSenderRoles: true,
                sortOrder: commentSort,
                allowAttachments: false
            }}
            getDisplayName={(senderId) => getDisplayName(senderId)}
            getRoleDisplayText={(senderId) => getThesisRoleDisplayText(senderId)}
            getAvatarColor={(senderId) => {
                const role = getThesisRole(senderId);
                return role === 'adviser' ? 'primary.main' : 'secondary.main';
            }}
            animationStaggerDelay={40}
            animationVariant="slideUp"
        />
    );
}
