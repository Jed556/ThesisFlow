import * as React from 'react';
import {
    Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent, DialogContentText,
    DialogTitle, Divider, MenuItem, Skeleton, Stack, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import type {
    WorkspaceFilterConfig, WorkspaceCommentPayload, WorkspaceEditPayload,
    WorkspaceUploadPayload, ChapterVersionMap, WorkspaceChapterDecisionPayload, WorkspaceChapterDecision,
} from '../../types/workspace';
import type { ChapterSubmissionEntry, ExpertRole, ThesisChapter, ThesisData, ThesisStageName } from '../../types/thesis';
import type { FileAttachment } from '../../types/file';
import type { ChatMessage } from '../../types/chat';
import { ConversationPanel, type ConversationParticipant } from '../Conversation';
import { FileViewer } from '../File';
import { thesisCommentToChatMessage } from '../../utils/chatUtils';
import { listenFilesForChapter, type FileQueryContext } from '../../utils/firebase/firestore/file';
import { listenSubmissionsForChapter, type SubmissionContext } from '../../utils/firebase/firestore/submissions';
import { listenChatsForSubmission, type ChatContext } from '../../utils/firebase/firestore/chat';
import { listenThesisDocument, type ThesisDocumentContext } from '../../utils/firebase/firestore/thesis';
import {
    listenAllChaptersForThesis, type ThesisChaptersContext,
} from '../../utils/firebase/firestore/chapters';
import { UnauthorizedNotice } from '../../layouts/UnauthorizedNotice';
import { getAssignedExpertRoles } from '../../utils/expertUtils';
import { normalizeChapterSubmissions, normalizeSubmissionEntry } from '../../utils/chapterSubmissionUtils';
import ChapterRail, { buildVersionOptions, formatChapterLabel, deriveChapterStatus } from './ChapterRail';
import SubmissionsRail from './SubmissionsRail';
import {
    buildSequentialStageLockMap,
    buildStageCompletionMap,
    buildInterleavedStageLockMap,
    chapterHasStage,
    describeStageSequenceStep,
    getPreviousSequenceStep,
    getCurrentInProgressStage,
    THESIS_STAGE_METADATA,
    type StageGateOverrides,
} from '../../utils/thesisStageUtils';

interface ThesisWorkspaceProps {
    thesisId?: string;
    groupId?: string;
    /** Academic year for hierarchical storage path */
    year?: string;
    /** Department for hierarchical storage path */
    department?: string;
    /** Course for hierarchical storage path */
    course?: string;
    thesis?: ThesisData | null;
    participants?: Record<string, ConversationParticipant>;
    currentUserId?: string;
    expertRole?: ExpertRole;
    filters?: WorkspaceFilterConfig[];
    isLoading?: boolean;
    allowCommenting?: boolean;
    emptyStateMessage?: string;
    onCreateComment?: (payload: WorkspaceCommentPayload) => Promise<void> | void;
    onEditComment?: (payload: WorkspaceEditPayload) => Promise<void> | void;
    onUploadChapter?: (payload: WorkspaceUploadPayload) => Promise<void> | void;
    onChapterDecision?: (payload: WorkspaceChapterDecisionPayload) => Promise<void> | void;
    /** Called when a student submits a draft for review */
    onSubmitDraft?: (payload: {
        thesisId: string; chapterId: number; stage: ThesisStageName; submissionId: string;
    }) => Promise<void> | void;
    /** Called when a student deletes a draft submission */
    onDeleteDraft?: (payload: {
        thesisId: string; chapterId: number; stage: ThesisStageName; submissionId: string;
    }) => Promise<void> | void;
    terminalRequirementCompletionMap?: Partial<Record<ThesisStageName, boolean>>;
    /** Panel comment completion map for stages that have panel comments (pre-proposal, pre-defense) */
    panelCommentCompletionMap?: Partial<Record<ThesisStageName, boolean>>;
    enforceTerminalRequirementSequence?: boolean;
    stageGateOverrides?: StageGateOverrides;
}

const WorkspaceFilters = ({ filters }: { filters?: WorkspaceFilterConfig[]; }) => {
    if (!filters || filters.length === 0) {
        return null;
    }

    return (
        <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            sx={{ mb: 3 }}
        >
            {filters.map((filter) => (
                <TextField
                    key={filter.id}
                    select
                    fullWidth
                    size="small"
                    label={filter.label}
                    value={filter.value ?? ''}
                    placeholder={filter.placeholder}
                    helperText={filter.helperText}
                    disabled={filter.disabled || filter.loading}
                    required={filter.required}
                    onChange={(event) => filter.onChange(event.target.value)}
                >
                    {filter.options.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                            <Stack spacing={0.5}>
                                <Typography variant="body2">{option.label}</Typography>
                                {option.description && (
                                    <Typography variant="caption" color="text.secondary">
                                        {option.description}
                                    </Typography>
                                )}
                            </Stack>
                        </MenuItem>
                    ))}
                </TextField>
            ))}
        </Stack>
    );
};

export default function ThesisWorkspace({
    thesisId, groupId, year, department, course, thesis, participants, currentUserId, expertRole, filters, isLoading,
    allowCommenting = true,
    emptyStateMessage = 'Select a group to inspect its thesis.',
    onCreateComment, onEditComment, onUploadChapter, onChapterDecision, onSubmitDraft, onDeleteDraft,
    terminalRequirementCompletionMap,
    panelCommentCompletionMap,
    enforceTerminalRequirementSequence = false,
    stageGateOverrides,
}: ThesisWorkspaceProps) {
    const [activeChapterId, setActiveChapterId] = React.useState<number | null>(null);
    const [activeVersionIndex, setActiveVersionIndex] = React.useState<number | null>(null);
    const [uploadingChapterId, setUploadingChapterId] = React.useState<number | null>(null);
    const [uploadError, setUploadError] = React.useState<string | null>(null);
    const [chapterFiles, setChapterFiles] = React.useState<Record<number, FileAttachment[]>>({});
    const [isFetchingChapterFiles, setIsFetchingChapterFiles] = React.useState(false);
    const [, setChapterFilesError] = React.useState<string | null>(null);
    const [chapterSubmissionEntries, setChapterSubmissionEntries] = React.useState<Record<number, ChapterSubmissionEntry[]>>({});
    const [pendingDecision, setPendingDecision] = React.useState<{
        chapterId: number;
        decision: WorkspaceChapterDecision;
    } | null>(null);
    const [decisionError, setDecisionError] = React.useState<string | null>(null);
    const [isSubmittingDecision, setIsSubmittingDecision] = React.useState(false);
    const [activeStage, setActiveStage] = React.useState<ThesisStageName>(THESIS_STAGE_METADATA[0].value);
    const [liveThesis, setLiveThesis] = React.useState<ThesisData | null>(null);
    /** All chapters fetched from subcollection across all stages (new hierarchical structure) */
    const [allChaptersFromSub, setAllChaptersFromSub] = React.useState<ThesisChapter[]>([]);
    /** Currently viewed file in the file viewer panel */
    const [viewingFile, setViewingFile] = React.useState<FileAttachment | null>(null);
    /** Width of the conversation panel as a percentage (when viewing file) */
    const [conversationWidth, setConversationWidth] = React.useState(50);
    /** Whether the user is currently dragging the resize handle */
    const [isResizing, setIsResizing] = React.useState(false);
    /** Reference to the file viewer container for calculating resize */
    const fileViewerContainerRef = React.useRef<HTMLDivElement>(null);
    /** Chat messages for the currently selected submission (loaded from Firestore subcollection) */
    const [submissionChats, setSubmissionChats] = React.useState<ChatMessage[]>([]);
    /** Whether chats are currently loading (reserved for future loading states) */
    const [_isLoadingChats, setIsLoadingChats] = React.useState(false);

    React.useEffect(() => {
        setChapterFiles({});
        setChapterFilesError(null);
        setIsFetchingChapterFiles(false);
        setChapterSubmissionEntries({});
        setLiveThesis(null);
        setAllChaptersFromSub([]);
        setViewingFile(null);
        setSubmissionChats([]);
    }, [thesisId]);

    React.useEffect(() => {
        if (!thesisId || !groupId || !year || !department || !course) {
            setLiveThesis(null);
            return;
        }

        const docCtx: ThesisDocumentContext = {
            year,
            department,
            course,
            groupId,
            thesisId,
        };

        const unsubscribe = listenThesisDocument(docCtx, {
            onData: (next) => {
                setLiveThesis(next);
            },
            onError: (error) => {
                console.error('Unable to stream thesis updates:', error);
            },
        });

        return () => {
            unsubscribe();
        };
    }, [thesisId, groupId, year, department, course]);

    // Listen to all chapters from subcollection across all stages
    React.useEffect(() => {
        if (!thesisId || !groupId || !year || !department || !course) {
            setAllChaptersFromSub([]);
            return;
        }

        const chaptersCtx: ThesisChaptersContext = {
            year,
            department,
            course,
            groupId,
            thesisId,
        };

        const unsubscribe = listenAllChaptersForThesis(chaptersCtx, {
            onData: (chapters) => {
                setAllChaptersFromSub(chapters);
            },
            onError: (listenerError) => {
                console.error('Failed to load chapters from subcollection:', listenerError);
                setAllChaptersFromSub([]);
            },
        });

        return () => {
            unsubscribe();
        };
    }, [thesisId, groupId, year, department, course]);

    const thesisSource = liveThesis ?? thesis ?? null;

    // Use chapters from subcollection (new hierarchical structure)
    const allChapters = React.useMemo(() => {
        // Use subcollection chapters only - deprecated thesis.chapters field is no longer used
        return allChaptersFromSub.map((chapter: ThesisChapter) => ({
            ...chapter,
            submissions: chapterSubmissionEntries[chapter.id]
                ?? normalizeChapterSubmissions(chapter.submissions),
        } satisfies ThesisChapter));
    }, [allChaptersFromSub, chapterSubmissionEntries]);

    // Filter chapters for the active stage
    const stageChapters = React.useMemo(
        () => allChapters.filter((chapter) => chapterHasStage(chapter, activeStage)),
        [allChapters, activeStage],
    );

    const stageCompletionMap = React.useMemo(
        () => buildStageCompletionMap(allChapters, { treatEmptyAsComplete: false }),
        [allChapters],
    );

    const stageLockMap = React.useMemo(() => {
        if (!enforceTerminalRequirementSequence) {
            return buildSequentialStageLockMap(stageCompletionMap);
        }
        const interleavedLocks = buildInterleavedStageLockMap({
            chapters: stageCompletionMap,
            terminalRequirements: terminalRequirementCompletionMap,
            panelComments: panelCommentCompletionMap,
        }, stageGateOverrides);
        return interleavedLocks.chapters;
    }, [
        enforceTerminalRequirementSequence,
        stageCompletionMap,
        terminalRequirementCompletionMap,
        panelCommentCompletionMap,
        stageGateOverrides,
    ]);

    // Auto-select the in-progress stage tab for user convenience
    // Select the first unlocked stage that is not yet complete
    const hasAutoSelectedStage = React.useRef(false);
    React.useEffect(() => {
        // Only auto-select once when completion data first becomes available
        if (hasAutoSelectedStage.current) return;
        const hasData = Object.keys(stageCompletionMap).length > 0;
        if (!hasData) return;

        hasAutoSelectedStage.current = true;
        // Pass both completion map and lock map to find the first unlocked, incomplete stage
        const inProgressStage = getCurrentInProgressStage(stageCompletionMap, stageLockMap);
        setActiveStage(inProgressStage);
    }, [stageCompletionMap, stageLockMap]);

    // Note: thesis may be ThesisWithGroupContext which includes expert fields from the group
    const thesisWithContext = thesisSource as unknown as Record<string, unknown> | null | undefined;
    const expertRoles = React.useMemo(() => getAssignedExpertRoles(thesisSource as Parameters<typeof getAssignedExpertRoles>[0]), [
        thesisWithContext?.adviser,
        thesisWithContext?.editor,
        thesisWithContext?.statistician,
    ]);

    const isStageLocked = stageLockMap[activeStage] ?? false;
    const previousStageMeta = React.useMemo(() => {
        const currentIndex = THESIS_STAGE_METADATA.findIndex((stage) => stage.value === activeStage);
        if (currentIndex <= 0) {
            return null;
        }
        return THESIS_STAGE_METADATA[currentIndex - 1];
    }, [activeStage]);
    const activeStageMeta = React.useMemo(
        () => THESIS_STAGE_METADATA.find((stage) => stage.value === activeStage) ?? THESIS_STAGE_METADATA[0],
        [activeStage],
    );
    const stageLockedDescription = React.useMemo(() => {
        if (!isStageLocked) {
            return undefined;
        }
        if (enforceTerminalRequirementSequence) {
            const previousStep = getPreviousSequenceStep(activeStage, 'chapters');
            if (previousStep) {
                return `Complete ${describeStageSequenceStep(previousStep)} to unlock ${activeStageMeta.label} chapters.`;
            }
        } else if (previousStageMeta) {
            return `Complete all ${previousStageMeta.label} chapters to unlock ${activeStageMeta.label}.`;
        }
        return 'This stage will unlock once prerequisites are satisfied.';
    }, [
        isStageLocked,
        enforceTerminalRequirementSequence,
        activeStage,
        activeStageMeta,
        previousStageMeta,
    ]);

    const handleStageChange = React.useCallback((_: React.SyntheticEvent, nextStage: ThesisStageName) => {
        setActiveStage(nextStage);
        setViewingFile(null); // Close file viewer when changing stages
    }, []);

    const handleChapterSelect = React.useCallback((chapterId: number) => {
        setActiveChapterId(chapterId);
        setActiveVersionIndex(null);
        setChapterFilesError(null);
    }, []);

    const handleVersionSelect = React.useCallback((versionIndex: number) => {
        setActiveVersionIndex((previous) => (previous === versionIndex ? null : versionIndex));
    }, []);

    /** Open the file viewer panel for a specific file */
    const handleViewFile = React.useCallback((file: FileAttachment) => {
        setViewingFile(file);
    }, []);

    /** Close the file viewer panel and return to chapters view */
    const handleCloseFileViewer = React.useCallback(() => {
        setViewingFile(null);
    }, []);

    /**
     * Minimum width for each panel (33.33% of container)
     * This ensures both file viewer and conversation take at least 1/3 of the space
     */
    const MIN_PANEL_WIDTH = 33.33;
    const MAX_CONVERSATION_WIDTH = 100 - MIN_PANEL_WIDTH; // ~66.67%
    const MIN_CONVERSATION_WIDTH = MIN_PANEL_WIDTH; // ~33.33%

    /** Handle resize start */
    const handleResizeStart = React.useCallback((e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        setIsResizing(true);
    }, []);

    /** Handle resize movement */
    React.useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e: MouseEvent | TouchEvent) => {
            if (!fileViewerContainerRef.current) return;

            const container = fileViewerContainerRef.current;
            const containerRect = container.getBoundingClientRect();
            const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;

            // Calculate the position relative to container right edge
            const distanceFromRight = containerRect.right - clientX;
            const newConversationWidth = (distanceFromRight / containerRect.width) * 100;

            // Clamp to min/max values
            const clampedWidth = Math.min(
                MAX_CONVERSATION_WIDTH,
                Math.max(MIN_CONVERSATION_WIDTH, newConversationWidth)
            );

            setConversationWidth(clampedWidth);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('touchmove', handleMouseMove);
        document.addEventListener('touchend', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('touchmove', handleMouseMove);
            document.removeEventListener('touchend', handleMouseUp);
        };
    }, [isResizing, MAX_CONVERSATION_WIDTH, MIN_CONVERSATION_WIDTH]);

    const handleChapterUpload = React.useCallback((chapterId: number, file: File) => {
        if (!onUploadChapter || !thesisId) {
            return;
        }
        // Use the currently active stage tab, not the chapter's default stage
        // This ensures uploads go to the correct stage when viewing a chapter in multiple stages
        const chapterStage = activeStage;
        setUploadError(null);
        setUploadingChapterId(chapterId);
        setActiveChapterId(chapterId);
        setActiveVersionIndex(null);

        void (async () => {
            try {
                await onUploadChapter({
                    thesisId, chapterId, chapterStage, file,
                    groupId: groupId ?? '',
                    year,
                    department,
                    course,
                });
                setChapterFiles((current) => {
                    const next = { ...current };
                    delete next[chapterId];
                    return next;
                });
            } catch (error) {
                const message = error instanceof Error
                    ? error.message
                    : 'Failed to upload chapter version.';
                setUploadError(message);
            } finally {
                setUploadingChapterId((current) => (current === chapterId ? null : current));
            }
        })();
    }, [onUploadChapter, thesisId, groupId, year, department, course, activeStage]);

    React.useEffect(() => {
        if (isStageLocked || stageChapters.length === 0) {
            setActiveChapterId(null);
            setActiveVersionIndex(null);
            return;
        }

        setActiveChapterId((previous) => {
            const stillExists = typeof previous === 'number'
                ? stageChapters.some((chapter) => chapter.id === previous)
                : false;
            if (stillExists) {
                return previous;
            }
            const firstChapterId = stageChapters[0]?.id ?? null;
            if (firstChapterId !== previous) {
                setActiveVersionIndex(null);
            }
            return firstChapterId;
        });
    }, [isStageLocked, stageChapters]);

    const activeChapter = React.useMemo(() => allChapters.find((chapter: ThesisChapter) => chapter.id === activeChapterId), [
        allChapters,
        activeChapterId,
    ]);

    // Derive chapter status from its file submissions
    const activeChapterFiles = activeChapterId ? chapterFiles[activeChapterId] : undefined;
    const activeChapterStatus = deriveChapterStatus(activeChapterFiles);
    const isConversationReadOnly = activeChapterStatus === 'approved';

    // Listen to submission files for ALL chapters in the current stage
    // This ensures version counts and statuses are accurate before selection
    React.useEffect(() => {
        if (!thesisId || !groupId || !year || !department || !course || stageChapters.length === 0) {
            setIsFetchingChapterFiles(false);
            setChapterFilesError(null);
            return;
        }

        setIsFetchingChapterFiles(true);
        setChapterFilesError(null);

        // Create listeners for all chapters in the stage
        const unsubscribers: (() => void)[] = [];

        stageChapters.forEach((chapter) => {
            const fileCtx: FileQueryContext = {
                year,
                department,
                course,
                groupId,
                thesisId,
                stage: activeStage,
                chapterId: String(chapter.id),
            };

            const unsubscribe = listenFilesForChapter(fileCtx, {
                onData: (files) => {
                    setChapterFiles((prev) => ({ ...prev, [chapter.id]: files }));
                    // Only clear loading state after all chapters have been processed
                    // This is a simple approach - in practice, the last callback will set it to false
                    setIsFetchingChapterFiles(false);
                },
                onError: (error) => {
                    const message = error instanceof Error ? error.message : 'Unable to load uploaded files.';
                    console.error(`Error loading files for chapter ${chapter.id}:`, message);
                    setChapterFilesError(message);
                    setIsFetchingChapterFiles(false);
                },
            });

            unsubscribers.push(unsubscribe);
        });

        return () => {
            unsubscribers.forEach((unsubscribe) => unsubscribe());
        };
    }, [thesisId, groupId, year, department, course, activeStage, stageChapters]);

    // Listen to submission metadata for the active chapter in real-time
    React.useEffect(() => {
        if (!thesisId || !groupId || !year || !department || !course || !activeChapter) {
            return;
        }

        const submissionCtx: SubmissionContext = {
            year,
            department,
            course,
            groupId,
            thesisId,
            stage: activeStage,
            chapterId: String(activeChapter.id),
        };

        const unsubscribe = listenSubmissionsForChapter(submissionCtx, {
            onData: (submissions) => {
                const entries = submissions.map((submission) => normalizeSubmissionEntry(submission));
                setChapterSubmissionEntries((prev) => ({
                    ...prev,
                    [activeChapter.id]: entries,
                }));
            },
            onError: (error) => {
                console.error('Unable to load submissions for chapter:', error);
            },
        });

        return () => {
            unsubscribe();
        };
    }, [thesisId, groupId, year, department, course, activeStage, activeChapter?.id]);

    const versionOptionsByChapter = React.useMemo<ChapterVersionMap>(() => {
        const map: ChapterVersionMap = {};
        allChapters.forEach((chapter) => {
            map[chapter.id] = buildVersionOptions(chapter, chapterFiles[chapter.id], activeStage);
        });
        return map;
    }, [allChapters, chapterFiles, activeStage]);

    const versionOptions = activeChapterId ? (versionOptionsByChapter[activeChapterId] ?? []) : [];

    // Get the active submission ID from version options
    const activeSubmissionId = React.useMemo(() => {
        if (activeVersionIndex === null) return null;
        const activeVersion = versionOptions.find((opt) => opt.versionIndex === activeVersionIndex);
        return activeVersion?.id ?? null;
    }, [versionOptions, activeVersionIndex]);

    // Listen to chats for the active submission in real-time
    React.useEffect(() => {
        if (!thesisId || !groupId || !year || !department || !course ||
            !activeChapter || !activeSubmissionId) {
            setSubmissionChats([]);
            return;
        }

        setIsLoadingChats(true);

        const chatCtx: ChatContext = {
            year,
            department,
            course,
            groupId,
            thesisId,
            stage: activeStage,
            chapterId: String(activeChapter.id),
            submissionId: activeSubmissionId,
        };

        const unsubscribe = listenChatsForSubmission(chatCtx, {
            onData: (chats) => {
                // Convert ThesisComment to ChatMessage format
                const messages = chats.map((chat, index) => thesisCommentToChatMessage(chat, index));
                setSubmissionChats(messages);
                setIsLoadingChats(false);
            },
            onError: (error) => {
                console.error('Unable to load chats for submission:', error);
                setSubmissionChats([]);
                setIsLoadingChats(false);
            },
        });

        return () => {
            unsubscribe();
        };
    }, [thesisId, groupId, year, department, course, activeStage, activeChapter?.id, activeSubmissionId]);

    // Use chat messages from Firestore subcollection (real-time listener)
    const chapterMessages = submissionChats;
    const selectedVersionLabel = React.useMemo(() => {
        if (activeVersionIndex === null) {
            return null;
        }
        return versionOptions.find((option) => option.versionIndex === activeVersionIndex)?.label
            ?? `Version ${activeVersionIndex + 1}`;
    }, [versionOptions, activeVersionIndex]);
    const hasChapterSelection = Boolean(activeChapter);
    const hasVersionSelection = typeof activeVersionIndex === 'number';
    const hasAvailableVersions = versionOptions.length > 0;
    const enableUploads = Boolean(onUploadChapter && thesisId && !isStageLocked);
    const activeChapterUploadsLocked = Boolean(
        activeChapter && (activeChapterStatus === 'approved' || activeChapterStatus === 'under_review')
    );
    const canUploadActiveChapter = Boolean(enableUploads && activeChapter && !activeChapterUploadsLocked);
    const enableChapterDecisions = Boolean(onChapterDecision && thesisId && expertRole);
    const composerDisabled = !hasChapterSelection
        || !hasVersionSelection
        || !hasAvailableVersions
        || !allowCommenting
        || !onCreateComment
        || !thesisId
        || isConversationReadOnly;

    // Unused for now, but kept for potential future expert review integration
    const _chapterDecisionHelperText = React.useMemo(() => {
        if (!enableChapterDecisions) {
            return undefined;
        }
        if (!activeChapter) {
            return 'Select a chapter to enable decisions.';
        }
        if (activeChapterStatus === 'approved') {
            return 'This chapter is already approved.';
        }
        if (!hasAvailableVersions) {
            return 'Awaiting a submission before you can decide on this chapter.';
        }
        if (!hasVersionSelection) {
            return 'Select a version to approve or request revisions.';
        }
        return undefined;
    }, [enableChapterDecisions, activeChapter, hasAvailableVersions, hasVersionSelection]);

    // Reserved for expert review flow - currently unused after layout simplification
    void _chapterDecisionHelperText;

    React.useEffect(() => {
        if (!hasAvailableVersions && activeVersionIndex !== null) {
            setActiveVersionIndex(null);
        }
    }, [hasAvailableVersions, activeVersionIndex]);

    const conversationHeaderStatus = React.useMemo(() => {
        if (!activeChapter) {
            return 'Select a chapter to view its versions.';
        }
        if (!hasAvailableVersions) {
            return `${formatChapterLabel(activeChapter)} · No uploads yet`;
        }
        if (!hasVersionSelection || activeVersionIndex === null) {
            return `${formatChapterLabel(activeChapter)} · Select a version to continue`;
        }
        if (isConversationReadOnly && selectedVersionLabel) {
            return `${formatChapterLabel(activeChapter)} · ${selectedVersionLabel} · Approved (read-only)`;
        }
        return `${formatChapterLabel(activeChapter)} · ${selectedVersionLabel}`;
    }, [
        activeChapter,
        hasAvailableVersions,
        hasVersionSelection,
        selectedVersionLabel,
        isConversationReadOnly,
        activeVersionIndex,
    ]);

    const conversationEmptyState = React.useMemo(() => {
        if (!activeChapter) {
            return 'Select a chapter to view its conversation.';
        }
        if (!hasAvailableVersions) {
            if (canUploadActiveChapter) {
                return 'Upload a version of this chapter to start a discussion.';
            }
            if (activeChapterUploadsLocked) {
                return activeChapterStatus === 'approved'
                    ? 'This chapter is approved. Uploads are disabled unless your adviser reopens it.'
                    : 'A submission is currently under review. Wait for feedback before uploading another version.';
            }
            return 'Waiting for a submission to unlock this conversation.';
        }
        if (!hasVersionSelection) {
            return 'Choose a specific version to review its discussion.';
        }
        if (isConversationReadOnly) {
            return 'This chapter was approved. Conversation is locked for further replies.';
        }
        return 'No discussion yet for this version.';
    }, [
        activeChapter,
        activeChapterStatus,
        hasAvailableVersions,
        hasVersionSelection,
        canUploadActiveChapter,
        activeChapterUploadsLocked,
        isConversationReadOnly,
    ]);

    const composerPlaceholder = React.useMemo(() => {
        if (!activeChapter) {
            return 'Select a chapter to start a conversation.';
        }
        if (!hasAvailableVersions) {
            if (canUploadActiveChapter) {
                return 'Upload a chapter version to start a conversation.';
            }
            if (activeChapterUploadsLocked) {
                return activeChapterStatus === 'approved'
                    ? `${formatChapterLabel(activeChapter)} is approved. Uploads are disabled until it is reopened.`
                    : 'Uploads are disabled while this chapter is under review.';
            }
            return 'Waiting for a submission to start a conversation.';
        }
        if (!hasVersionSelection || activeVersionIndex === null) {
            return 'Select a version to start a conversation.';
        }
        if (isConversationReadOnly && selectedVersionLabel) {
            return `${formatChapterLabel(activeChapter)} · ${selectedVersionLabel} is approved. Conversation is read-only.`;
        }
        return `Discuss ${formatChapterLabel(activeChapter)} · ${selectedVersionLabel}…`;
    }, [
        activeChapter,
        activeChapterStatus,
        hasAvailableVersions,
        hasVersionSelection,
        selectedVersionLabel,
        activeVersionIndex,
        canUploadActiveChapter,
        activeChapterUploadsLocked,
        isConversationReadOnly,
    ]);

    const handleCreateMessage = React.useCallback(async (payload: { content: string; files: File[]; replyToId?: string; }) => {
        if (!allowCommenting || !onCreateComment || !thesisId || !activeChapter || activeVersionIndex === null) {
            return;
        }
        // Get submissionId from the active version option
        const activeVersionOption = versionOptions.find((opt) => opt.versionIndex === activeVersionIndex);
        const request: WorkspaceCommentPayload = {
            thesisId,
            chapterId: activeChapter.id,
            chapterStage: activeStage,
            submissionId: activeVersionOption?.id,
            versionIndex: activeVersionIndex,
            content: payload.content,
            files: payload.files,
            replyToId: payload.replyToId,
        };
        await onCreateComment(request);
    }, [allowCommenting, onCreateComment, thesisId, activeChapter, activeVersionIndex, versionOptions, activeStage]);

    const handleEditMessage = React.useCallback(async (payload: {
        content: string;
        files: File[];
        replyToId?: string;
        messageId: string;
    }) => {
        if (!onEditComment || !thesisId || !activeChapter || activeVersionIndex === null) {
            return;
        }
        await onEditComment({
            thesisId,
            chapterId: activeChapter.id,
            chapterStage: activeStage,
            versionIndex: activeVersionIndex,
            content: payload.content,
            files: payload.files,
            replyToId: payload.replyToId,
            commentId: payload.messageId,
        });
    }, [onEditComment, thesisId, activeChapter, activeVersionIndex, activeStage]);

    // Expert review flow - used in SubmissionsRail onApprove/onReject
    const handleRequestDecision = React.useCallback((chapterId: number, decision: WorkspaceChapterDecision) => {
        // Only check core conditions - don't check _chapterDecisionHelperText here
        // because the version may have just been set in the same click handler
        if (!enableChapterDecisions || !expertRole || pendingDecision || isSubmittingDecision) {
            return;
        }
        setPendingDecision({ chapterId, decision });
        setDecisionError(null);
    }, [enableChapterDecisions, expertRole, pendingDecision, isSubmittingDecision]);

    /**
     * Handler for approving a submission from SubmissionsRail
     */
    const handleApproveSubmission = React.useCallback((_versionId: string, file?: FileAttachment) => {
        if (!activeChapter) return;
        // Set the version index based on the file being approved
        if (file) {
            const versionIdx = versionOptions.findIndex((v) => v.file?.id === file.id);
            if (versionIdx >= 0) {
                setActiveVersionIndex(versionIdx);
            }
        }
        handleRequestDecision(activeChapter.id, 'approved');
    }, [activeChapter, versionOptions, handleRequestDecision]);

    /**
     * Handler for rejecting (requesting revision) a submission from SubmissionsRail
     */
    const handleRejectSubmission = React.useCallback((_versionId: string, file?: FileAttachment) => {
        if (!activeChapter) return;
        // Set the version index based on the file being rejected
        if (file) {
            const versionIdx = versionOptions.findIndex((v) => v.file?.id === file.id);
            if (versionIdx >= 0) {
                setActiveVersionIndex(versionIdx);
            }
        }
        handleRequestDecision(activeChapter.id, 'revision_required');
    }, [activeChapter, versionOptions, handleRequestDecision]);

    /**
     * Handler for submitting a draft for review (student action)
     */
    const handleSubmitDraft = React.useCallback((versionId: string, file?: FileAttachment) => {
        if (!thesisId || !activeChapter || !onSubmitDraft) return;
        const submissionId = file?.id ?? versionId;
        if (!submissionId) return;

        void onSubmitDraft({
            thesisId,
            chapterId: activeChapter.id,
            stage: activeStage,
            submissionId,
        });
    }, [thesisId, activeChapter, activeStage, onSubmitDraft]);

    /**
     * Handler for deleting a draft submission (student action)
     */
    const handleDeleteDraft = React.useCallback((versionId: string, file?: FileAttachment) => {
        if (!thesisId || !activeChapter || !onDeleteDraft) return;
        const submissionId = file?.id ?? versionId;
        if (!submissionId) return;

        void onDeleteDraft({
            thesisId,
            chapterId: activeChapter.id,
            stage: activeStage,
            submissionId,
        });
    }, [thesisId, activeChapter, activeStage, onDeleteDraft]);

    const handleCloseDecisionDialog = React.useCallback(() => {
        if (isSubmittingDecision) {
            return;
        }
        setPendingDecision(null);
        setDecisionError(null);
    }, [isSubmittingDecision]);

    const handleConfirmDecision = React.useCallback(async () => {
        if (!pendingDecision || !onChapterDecision || !thesisId || !expertRole) {
            return;
        }

        setIsSubmittingDecision(true);
        setDecisionError(null);

        try {
            // Find the active version to get the submissionId
            const chapterVersions = versionOptionsByChapter[pendingDecision.chapterId] ?? [];
            const targetVersionIndex = pendingDecision.chapterId === activeChapter?.id
                ? activeVersionIndex
                : null;
            const targetVersion = targetVersionIndex !== null
                ? chapterVersions.find((v) => v.versionIndex === targetVersionIndex)
                : chapterVersions[0]; // Default to first/latest version

            await onChapterDecision({
                thesisId,
                chapterId: pendingDecision.chapterId,
                stage: activeStage,
                submissionId: targetVersion?.id,
                decision: pendingDecision.decision,
                role: expertRole,
                versionIndex: targetVersionIndex ?? undefined,
                requiredRoles: expertRoles,
            });
            setPendingDecision(null);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update chapter status.';
            setDecisionError(message);
        } finally {
            setIsSubmittingDecision(false);
        }
    }, [
        pendingDecision, onChapterDecision, thesisId, expertRole, expertRoles,
        activeChapter?.id, activeVersionIndex, activeStage, versionOptionsByChapter,
    ]);

    const uploadErrorBanner = uploadError ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setUploadError(null)}>
            {uploadError}
        </Alert>
    ) : null;

    if (isLoading) {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                <WorkspaceFilters filters={filters} />
                {uploadErrorBanner}
                <Box sx={{ display: 'flex', gap: 3, flexGrow: 1, minHeight: 0 }}>
                    <Card sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                        <CardContent sx={{ flexGrow: 1, overflow: 'auto' }}>
                            <Stack spacing={2}>
                                {Array.from({ length: 3 }).map((_, index) => (
                                    <Skeleton key={index} variant="rounded" height={100} />
                                ))}
                            </Stack>
                        </CardContent>
                    </Card>
                    <Card sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                        <CardContent sx={{ flexGrow: 1, overflow: 'auto' }}>
                            <Skeleton variant="rounded" height={300} />
                        </CardContent>
                    </Card>
                </Box>
            </Box>
        );
    }

    if (!thesisSource || allChapters.length === 0) {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '90%', minHeight: 0 }}>
                <WorkspaceFilters filters={filters} />
                {uploadErrorBanner}
                <UnauthorizedNotice
                    title="No chapters available"
                    description={emptyStateMessage}
                    variant='box'
                />
            </Box>
        );
    }

    const pendingChapter = pendingDecision
        ? allChapters.find((chapter) => chapter.id === pendingDecision.chapterId)
        : undefined;
    const pendingDecisionVersionLabel = pendingDecision && pendingDecision.chapterId === activeChapter?.id
        ? selectedVersionLabel
        : undefined;
    const decisionDialogTitle = pendingDecision?.decision === 'approved'
        ? 'Approve chapter'
        : 'Request revisions';
    const pendingDecisionStatus = pendingDecision?.decision === 'approved' ? 'approved' : 'needing revision';
    const decisionVersionSuffix = pendingDecisionVersionLabel ? ` for ${pendingDecisionVersionLabel}` : '';
    const decisionDialogDescription = pendingDecision && pendingChapter
        ? `${formatChapterLabel(pendingChapter)} will be marked as ${pendingDecisionStatus}${decisionVersionSuffix}.`
        : 'Apply your decision to this chapter.';
    const decisionConfirmLabel = pendingDecision?.decision === 'approved'
        ? 'Approve chapter'
        : 'Request revisions';

    return (
        <>
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, pb: 2 }}>
                <WorkspaceFilters filters={filters} />
                {uploadErrorBanner}
                <Card variant="outlined" sx={{ mb: 2, flexShrink: 0 }}>
                    <Tabs
                        value={activeStage}
                        onChange={handleStageChange}
                        variant="scrollable"
                        scrollButtons="auto"
                    >
                        {THESIS_STAGE_METADATA.map((stage) => {
                            const stageLocked = stageLockMap[stage.value];
                            const stageCompleted = stageCompletionMap[stage.value];
                            const chipLabel = stageLocked ? 'Locked' : stageCompleted ? 'Completed' : 'In progress';
                            const chipColor = stageLocked ? 'default' : stageCompleted ? 'success' : 'info';
                            const chipVariant = stageLocked ? 'outlined' : 'filled';
                            return (
                                <Tab
                                    key={stage.value}
                                    value={stage.value}
                                    label={(
                                        <Stack spacing={0.5} alignItems="center">
                                            <Typography variant="body2" fontWeight={600}>{stage.label}</Typography>
                                            <Chip
                                                label={chipLabel}
                                                size="small"
                                                color={chipColor}
                                                variant={chipVariant}
                                            />
                                        </Stack>
                                    )}
                                />
                            );
                        })}
                    </Tabs>
                </Card>

                {isStageLocked ? (
                    <UnauthorizedNotice
                        title={`${activeStageMeta.label} locked`}
                        description={stageLockedDescription}
                        variant="box"
                        sx={{ mt: 2 }}
                    />
                ) : (
                    <Box
                        sx={{
                            flexGrow: 1,
                            minHeight: 0,
                            position: 'relative',
                            overflow: 'hidden',
                            // Prevent text selection while resizing
                            ...(isResizing && {
                                userSelect: 'none',
                                cursor: 'col-resize',
                            }),
                        }}
                    >
                        {/* Sliding container - holds both views side by side on desktop */}
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: { xs: 'column', md: 'row' },
                                height: '100%',
                                width: { xs: '100%', md: '200%' },
                                transition: (theme) => theme.transitions.create('transform', {
                                    duration: theme.transitions.duration.standard,
                                    easing: theme.transitions.easing.easeInOut,
                                }),
                                transform: {
                                    xs: 'none', // No transform on mobile - uses natural column flow
                                    md: viewingFile ? 'translateX(-50%)' : 'translateX(0)',
                                },
                            }}
                        >
                            {/* Default View: ChapterRail + SubmissionsRail */}
                            <Box
                                sx={{
                                    width: { xs: '100%', md: '50%' },
                                    flexShrink: 0,
                                    display: { xs: viewingFile ? 'none' : 'flex', md: 'flex' },
                                    flexDirection: { xs: 'column', md: 'row' },
                                    gap: 3,
                                    height: { xs: 'auto', md: '100%' },
                                    minHeight: { xs: viewingFile ? 0 : 'auto', md: 0 },
                                }}
                            >
                                {/* Chapter Rail */}
                                <Card sx={{
                                    flex: 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    minHeight: { xs: 280, md: 500 },
                                    maxHeight: { xs: '45vh', md: 'calc(100vh - 200px)' },
                                    height: { xs: 'auto', md: 'calc(100vh - 200px)' },
                                    overflow: 'hidden',
                                }}>
                                    <CardContent sx={{
                                        flexGrow: 1,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        minHeight: 0,
                                        overflow: 'hidden',
                                    }}>
                                        <Box sx={{ mb: 2, flexShrink: 0 }}>
                                            <Typography variant="h6">Chapters</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Select a chapter to view its submissions.
                                            </Typography>
                                        </Box>
                                        <Box sx={{ flexGrow: 1, minHeight: 0, overflowY: 'auto', pr: 1 }}>
                                            <ChapterRail
                                                chapters={stageChapters}
                                                selectedChapterId={activeChapterId}
                                                onSelectChapter={handleChapterSelect}
                                                versionCounts={Object.fromEntries(
                                                    stageChapters.map((chapter: ThesisChapter) => [
                                                        chapter.id,
                                                        versionOptionsByChapter[chapter.id]?.length ?? 0,
                                                    ])
                                                )}
                                                chapterFiles={chapterFiles}
                                                isLoading={isFetchingChapterFiles}
                                            />
                                        </Box>
                                    </CardContent>
                                </Card>

                                {/* Submissions Rail */}
                                <Card sx={{
                                    flex: 1,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    minHeight: { xs: 280, md: 500 },
                                    maxHeight: { xs: '45vh', md: 'calc(100vh - 200px)' },
                                    height: { xs: 'auto', md: 'calc(100vh - 200px)' },
                                    overflow: 'hidden',
                                }}>
                                    <CardContent sx={{
                                        flexGrow: 1,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        minHeight: 0,
                                        overflow: 'hidden',
                                    }}>
                                        <Box sx={{ flexGrow: 1, minHeight: 0, overflowY: 'auto', pr: 1 }}>
                                            <SubmissionsRail
                                                chapter={activeChapter ?? null}
                                                versions={versionOptions}
                                                selectedVersionIndex={activeVersionIndex}
                                                onSelectVersion={handleVersionSelect}
                                                onViewFile={handleViewFile}
                                                onUploadVersion={enableUploads && activeChapter
                                                    ? (file: File) => handleChapterUpload(activeChapter.id, file)
                                                    : undefined
                                                }
                                                onSubmit={enableUploads ? handleSubmitDraft : undefined}
                                                onApprove={enableChapterDecisions ? handleApproveSubmission : undefined}
                                                onReject={enableChapterDecisions ? handleRejectSubmission : undefined}
                                                onDelete={enableUploads ? handleDeleteDraft : undefined}
                                                isStudent={enableUploads}
                                                currentExpertRole={expertRole}
                                                hasStatistician={expertRoles.includes('statistician')}
                                                participants={participants}
                                                isUploading={uploadingChapterId === activeChapterId}
                                                processingVersionId={
                                                    isSubmittingDecision
                                                        ? versionOptions[activeVersionIndex ?? 0]?.id
                                                        : null
                                                }
                                                isLoading={isFetchingChapterFiles}
                                                loadingMessage="Fetching submissions…"
                                                activeStage={activeStage}
                                            />
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Box>

                            {/* File Viewer View: FileViewer + Conversation */}
                            <Box
                                ref={fileViewerContainerRef}
                                sx={{
                                    width: { xs: '100%', md: '50%' },
                                    flexShrink: 0,
                                    display: { xs: viewingFile ? 'flex' : 'none', md: 'flex' },
                                    flexDirection: { xs: 'column', md: 'row' },
                                    gap: { xs: 2, md: 0 },
                                    height: { xs: 'auto', md: '100%' },
                                    minHeight: { xs: viewingFile ? 'auto' : 0, md: 0 },
                                }}
                            >
                                {/* File Viewer Panel */}
                                <Card
                                    sx={{
                                        width: { xs: '100%', md: `calc(${100 - conversationWidth}% - 6px)` },
                                        display: 'flex',
                                        flexDirection: 'column',
                                        flexShrink: 0,
                                        minHeight: { xs: 350, md: 500 },
                                        maxHeight: { xs: '55vh', md: 'none' },
                                        height: { xs: 'auto', md: 'calc(100vh - 200px)' },
                                        overflow: 'hidden',
                                    }}
                                >
                                    <CardContent sx={{
                                        flexGrow: 1,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        minHeight: 0,
                                        p: 0,
                                        '&:last-child': { pb: 0 },
                                    }}>
                                        <FileViewer
                                            file={viewingFile}
                                            onBack={handleCloseFileViewer}
                                            height="100%"
                                            width="100%"
                                            showToolbar
                                        />
                                    </CardContent>
                                </Card>

                                {/* Resize Handle - Only visible on desktop */}
                                <Box
                                    onMouseDown={handleResizeStart}
                                    onTouchStart={handleResizeStart}
                                    sx={{
                                        display: { xs: 'none', md: 'flex' },
                                        width: 12,
                                        flexShrink: 0,
                                        cursor: 'col-resize',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        position: 'relative',
                                        zIndex: 1,
                                        '&:hover, &:active': {
                                            '& > div': {
                                                bgcolor: 'primary.main',
                                                opacity: 1,
                                            },
                                        },
                                        ...(isResizing && {
                                            '& > div': {
                                                bgcolor: 'primary.main',
                                                opacity: 1,
                                            },
                                        }),
                                    }}
                                >
                                    <Box
                                        sx={{
                                            width: 4,
                                            height: 48,
                                            borderRadius: 2,
                                            bgcolor: 'divider',
                                            opacity: 0.6,
                                            transition: (theme) => theme.transitions.create(
                                                ['background-color', 'opacity'],
                                                { duration: theme.transitions.duration.short }
                                            ),
                                        }}
                                    />
                                </Box>

                                {/* Conversation Panel */}
                                <Card
                                    sx={{
                                        width: { xs: '100%', md: `calc(${conversationWidth}% - 6px)` },
                                        display: 'flex',
                                        flexDirection: 'column',
                                        flexShrink: 0,
                                        minHeight: { xs: 350, md: 500 },
                                        flex: { xs: 1, md: 'none' },
                                        height: { xs: 'auto', md: 'calc(100vh - 200px)' },
                                        overflow: 'hidden',
                                    }}
                                >
                                    <CardContent sx={{
                                        flexGrow: 1,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        minHeight: 0,
                                        overflow: 'hidden',
                                        p: { xs: 1, md: 2 },
                                        '&:last-child': { pb: { xs: 1, md: 2 } },
                                    }}>
                                        <Box sx={{ mb: 1, flexShrink: 0 }}>
                                            <Typography variant="h6" noWrap>Conversation</Typography>
                                            <Typography variant="caption" color="text.secondary" noWrap>
                                                {conversationHeaderStatus}
                                            </Typography>
                                        </Box>
                                        <Divider sx={{ mb: 1, flexShrink: 0 }} />
                                        <Box sx={{ flexGrow: 1, minHeight: 0, overflow: 'hidden' }}>
                                            <ConversationPanel
                                                messages={chapterMessages}
                                                currentUserId={currentUserId}
                                                participants={participants}
                                                height="100%"
                                                emptyStateMessage={conversationEmptyState}
                                                composerPlaceholder={composerPlaceholder}
                                                disableComposer={composerDisabled}
                                                allowAttachments
                                                onSendMessage={handleCreateMessage}
                                                onEditMessage={onEditComment ? handleEditMessage : undefined}
                                                composerMetadata={{
                                                    chapterId: activeChapter?.id,
                                                    versionIndex: activeVersionIndex ?? undefined,
                                                    thesisId,
                                                }}
                                            />
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Box>
                        </Box>
                    </Box>
                )}
            </Box>

            <Dialog
                open={Boolean(pendingDecision)}
                onClose={handleCloseDecisionDialog}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle>{decisionDialogTitle}</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {decisionDialogDescription}
                    </DialogContentText>
                    {decisionError && (
                        <Alert severity="error" sx={{ mt: 2 }}>
                            {decisionError}
                        </Alert>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDecisionDialog} disabled={isSubmittingDecision}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        color={pendingDecision?.decision === 'approved' ? 'success' : 'warning'}
                        onClick={() => void handleConfirmDecision()}
                        disabled={isSubmittingDecision}
                    >
                        {isSubmittingDecision ? 'Saving…' : decisionConfirmLabel}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
