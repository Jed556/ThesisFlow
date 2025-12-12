import * as React from 'react';
import {
    Alert, Box, Button, CircularProgress, Dialog, DialogContent, DialogTitle, IconButton,
    Paper, Skeleton, Stack, Tab, Tabs, Tooltip, Typography,
} from '@mui/material';
import {
    CommentBank as CommentBankIcon, CloudUpload as CloudUploadIcon,
    RateReview as RequestReviewIcon, Delete as DeleteIcon,
    Close as CloseIcon, Download as DownloadIcon,
} from '@mui/icons-material';
import { useSession } from '@toolpad/core';
import type { Session } from '../../types/session';
import type { NavigationItem } from '../../types/navigation';
import type { ThesisData, ThesisStageName } from '../../types/thesis';
import type { ThesisGroup } from '../../types/group';
import type { TerminalRequirementSubmissionRecord } from '../../types/terminalRequirementSubmission';
import {
    createDefaultPanelCommentReleaseMap, type PanelCommentEntry,
    type PanelCommentManuscript, type PanelCommentReleaseMap, type PanelCommentStage,
} from '../../types/panelComment';
import { AnimatedPage } from '../../components/Animate';
import { PanelCommentTable } from '../../components/PanelComments';
import { UnauthorizedNotice } from '../../layouts/UnauthorizedNotice';
import { useSnackbar } from '../../components/Snackbar';
import {
    listenPanelCommentEntries, listenPanelCommentRelease,
    updatePanelCommentStudentFields, listenPanelManuscript,
    uploadPanelManuscript, requestManuscriptReview, deletePanelManuscript,
    type PanelCommentContext,
} from '../../utils/firebase/firestore/panelComments';
import { findGroupById, getGroupsByLeader, getGroupsByMember } from '../../utils/firebase/firestore/groups';
import { findThesisByGroupId } from '../../utils/firebase/firestore/thesis';
import { findAndListenTerminalRequirements } from '../../utils/firebase/firestore/terminalRequirements';
import { findUsersByIds } from '../../utils/firebase/firestore/user';
import {
    PANEL_COMMENT_STAGE_METADATA, canStudentAccessPanelStage, formatPanelistDisplayName, getPanelCommentStageLabel
} from '../../utils/panelCommentUtils';
import { DEFAULT_YEAR } from '../../config/firestore';
import { formatFileSize } from '../../utils/fileUtils';
import { FileCard, FileViewer } from '../../components/File';
import type { FileAttachment } from '../../types/file';
import { buildAuditContextFromGroup, createAuditEntry } from '../../utils/auditUtils';
import { notifyPanelReviewRequested } from '../../utils/auditNotificationUtils';

export const metadata: NavigationItem = {
    group: 'thesis',
    index: 5,
    title: 'Panel Comments',
    segment: 'panel-comments',
    icon: <CommentBankIcon />,
    roles: ['student'],
};

type ThesisRecord = ThesisData & { id: string };

interface PanelistOption {
    uid: string;
    label: string;
}

export default function StudentPanelCommentsPage() {
    const session = useSession<Session>();
    const userUid = session?.user?.uid ?? null;
    const { showNotification } = useSnackbar();

    const [thesis, setThesis] = React.useState<ThesisRecord | null>(null);
    const [thesisLoading, setThesisLoading] = React.useState(true);
    const [thesisError, setThesisError] = React.useState<string | null>(null);
    const [group, setGroup] = React.useState<ThesisGroup | null>(null);
    const [activeStage, setActiveStage] = React.useState<PanelCommentStage>('proposal');
    const [entries, setEntries] = React.useState<PanelCommentEntry[]>([]);
    const [entriesLoading, setEntriesLoading] = React.useState(true);
    const [entriesError, setEntriesError] = React.useState<string | null>(null);
    const [releaseMap, setReleaseMap] = React.useState<PanelCommentReleaseMap>(createDefaultPanelCommentReleaseMap());
    const [studentSavingIds, setStudentSavingIds] = React.useState<Set<string>>(new Set());
    const [panelists, setPanelists] = React.useState<PanelistOption[]>([]);
    const [panelistsLoading, setPanelistsLoading] = React.useState(false);
    const [panelistsError, setPanelistsError] = React.useState<string | null>(null);
    const [activePanelUid, setActivePanelUid] = React.useState<string | null>(null);
    /** Terminal requirement submission records by stage for unlock logic */
    const [terminalSubmissionsByStage, setTerminalSubmissionsByStage] = React.useState<
        Partial<Record<ThesisStageName, TerminalRequirementSubmissionRecord[]>>
    >({});
    /** Manuscript state */
    const [manuscript, setManuscript] = React.useState<PanelCommentManuscript | null>(null);
    const [manuscriptLoading, setManuscriptLoading] = React.useState(false);
    const [uploadingManuscript, setUploadingManuscript] = React.useState(false);
    const [requestingReview, setRequestingReview] = React.useState(false);
    const [fileViewerOpen, setFileViewerOpen] = React.useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    /** Build panel comment context from group */
    const panelCommentCtx: PanelCommentContext | null = React.useMemo(() => {
        if (!group) return null;
        return {
            year: DEFAULT_YEAR,
            department: group.department ?? '',
            course: group.course ?? '',
            groupId: group.id,
        };
    }, [group]);

    React.useEffect(() => {
        if (!userUid) {
            setThesis(null);
            setGroup(null);
            setThesisLoading(false);
            setThesisError(null);
            return;
        }

        setThesisLoading(true);
        setThesisError(null);

        // Load group first, then fetch thesis from subcollection
        (async () => {
            try {
                // Try to find group where user is leader first, then as member
                const leaderGroups = await getGroupsByLeader(userUid);
                const memberGroups = await getGroupsByMember(userUid);
                const allGroups = [...leaderGroups, ...memberGroups];
                // Prefer group where user is leader
                const preferredGroup = allGroups.find((g) => g.members.leader === userUid) ?? allGroups[0] ?? null;
                setGroup(preferredGroup);

                // Thesis is stored in a subcollection, fetch it using findThesisByGroupId
                if (preferredGroup) {
                    const thesisData = await findThesisByGroupId(preferredGroup.id);
                    if (thesisData) {
                        setThesis({ ...thesisData, id: thesisData.id ?? preferredGroup.id });
                    } else {
                        setThesis(null);
                    }
                } else {
                    setThesis(null);
                }
                setThesisLoading(false);
            } catch (error) {
                console.error('Failed to fetch thesis for panel comments:', error);
                setThesis(null);
                setGroup(null);
                setThesisLoading(false);
                setThesisError('Unable to load your thesis record right now.');
            }
        })();
    }, [userUid]);

    const groupId = group?.id ?? null;

    // Listen for terminal requirement submissions to determine unlock status
    React.useEffect(() => {
        if (!thesis?.id) {
            setTerminalSubmissionsByStage({});
            return;
        }

        // Listen to terminal requirements for each panel comment stage's unlock stage
        const unsubscribers = PANEL_COMMENT_STAGE_METADATA.map((stageMeta) => {
            const unlockStage = stageMeta.terminalUnlockStage;
            return findAndListenTerminalRequirements(thesis.id, unlockStage, {
                onData: (records) => {
                    setTerminalSubmissionsByStage((prev) => ({
                        ...prev,
                        [unlockStage]: records,
                    }));
                },
                onError: (listenerError) => {
                    console.error(`Terminal requirement listener error for ${unlockStage}:`, listenerError);
                },
            });
        });

        return () => {
            unsubscribers.forEach((unsubscribe) => unsubscribe());
        };
    }, [thesis?.id]);

    React.useEffect(() => {
        if (!panelCommentCtx) {
            setReleaseMap(createDefaultPanelCommentReleaseMap());
            return;
        }
        const unsubscribe = listenPanelCommentRelease(panelCommentCtx, {
            onData: (next) => setReleaseMap(next),
            onError: (error) => console.error('Panel comment release listener error:', error),
        });
        return () => unsubscribe();
    }, [panelCommentCtx]);

    React.useEffect(() => {
        if (!panelCommentCtx || !activePanelUid) {
            setEntries([]);
            setEntriesLoading(false);
            return;
        }
        setEntriesLoading(true);
        setEntriesError(null);
        const unsubscribe = listenPanelCommentEntries(panelCommentCtx, activeStage, {
            onData: (next) => {
                setEntries(next);
                setEntriesLoading(false);
            },
            onError: (error) => {
                console.error('Panel comment entries listener error:', error);
                setEntries([]);
                setEntriesLoading(false);
                setEntriesError('Unable to load comments for this tab.');
            },
        }, activePanelUid);
        return () => unsubscribe();
    }, [panelCommentCtx, activeStage, activePanelUid]);

    // Listen for manuscript changes for the active stage
    React.useEffect(() => {
        if (!panelCommentCtx) {
            setManuscript(null);
            setManuscriptLoading(false);
            return;
        }
        setManuscriptLoading(true);
        const unsubscribe = listenPanelManuscript(panelCommentCtx, activeStage, {
            onData: (next) => {
                setManuscript(next);
                setManuscriptLoading(false);
            },
            onError: (error) => {
                console.error('Manuscript listener error:', error);
                setManuscript(null);
                setManuscriptLoading(false);
            },
        });
        return () => unsubscribe();
    }, [panelCommentCtx, activeStage]);

    React.useEffect(() => {
        let isMounted = true;
        async function loadPanelists() {
            if (!groupId) {
                if (isMounted) {
                    setGroup(null);
                    setPanelists([]);
                    setActivePanelUid(null);
                    setPanelistsLoading(false);
                    setPanelistsError(null);
                }
                return;
            }

            setPanelistsLoading(true);
            setPanelistsError(null);

            try {
                const fetchedGroup = await findGroupById(groupId);
                if (!isMounted) return;

                // Store group for context
                setGroup(fetchedGroup);

                const panelUids = fetchedGroup?.members?.panels ?? [];

                if (panelUids.length === 0) {
                    setPanelists([]);
                    setActivePanelUid(null);
                    setPanelistsLoading(false);
                    return;
                }

                const profiles = await findUsersByIds(panelUids);
                if (!isMounted) {
                    return;
                }

                const options = panelUids.map((uid) => {
                    const profile = profiles.find((record) => record.uid === uid) ?? null;
                    return {
                        uid,
                        label: formatPanelistDisplayName(profile),
                    };
                });

                setPanelists(options);
                setActivePanelUid((previous) => {
                    if (previous && panelUids.includes(previous)) {
                        return previous;
                    }
                    return options[0]?.uid ?? null;
                });
            } catch (error) {
                console.error('Failed to load panel assignments for student panel comments:', error);
                if (isMounted) {
                    setPanelists([]);
                    setActivePanelUid(null);
                    setPanelistsError('Unable to load your panel assignments right now.');
                }
            } finally {
                if (isMounted) {
                    setPanelistsLoading(false);
                }
            }
        }

        void loadPanelists();
        return () => {
            isMounted = false;
        };
    }, [groupId]);

    /**
     * Build a map of terminal requirement approval status for each unlock stage.
     * A stage is considered unlocked when ALL terminal requirements for that stage are approved.
     */
    const terminalApprovalMap = React.useMemo(() => {
        const result: Partial<Record<ThesisStageName, boolean>> = {};
        for (const stageMeta of PANEL_COMMENT_STAGE_METADATA) {
            const unlockStage = stageMeta.terminalUnlockStage;
            const submissions = terminalSubmissionsByStage[unlockStage] ?? [];
            // Stage is approved if there are submissions and ALL are approved
            const allApproved = submissions.length > 0 &&
                submissions.every((sub) => sub.status === 'approved');
            result[unlockStage] = allApproved;
        }
        return result;
    }, [terminalSubmissionsByStage]);

    const stageAccessible = canStudentAccessPanelStage(activeStage, releaseMap, activePanelUid);
    const activePanelist = React.useMemo(
        () => panelists.find((panel) => panel.uid === activePanelUid) ?? null,
        [panelists, activePanelUid]
    );
    const stageMeta = PANEL_COMMENT_STAGE_METADATA.find((item) => item.id === activeStage);
    const lockedDescription = React.useMemo(() => {
        // Check per-table release for the active panelist
        const tableReleased = activePanelUid
            ? (releaseMap[activeStage]?.tables?.[activePanelUid]?.sent ?? false)
            : false;
        // Fall back to stage-level release (legacy)
        const stageReleased = releaseMap[activeStage]?.sent ?? false;
        const isReleased = tableReleased || stageReleased;

        if (!isReleased) {
            if (!stageMeta) {
                return 'Waiting for the admin to release the panel comments.';
            }
            const terminalApproved = terminalApprovalMap[stageMeta.terminalUnlockStage] ?? false;
            if (!terminalApproved) {
                return `Complete ${stageMeta.releaseStageLabel} terminal requirements first.`;
            }
            return 'Waiting for the admin to release the panel comments for viewing.';
        }
        return 'Panel comments are not available yet.';
    }, [activeStage, releaseMap, activePanelUid, terminalApprovalMap, stageMeta]);

    const handleStageChange = React.useCallback((_: React.SyntheticEvent, value: PanelCommentStage) => {
        setActiveStage(value);
    }, []);

    const handlePanelChange = React.useCallback((_: React.SyntheticEvent, value: string) => {
        setActivePanelUid(value);
    }, []);

    const handleStudentFieldChange = React.useCallback(async (
        entry: PanelCommentEntry,
        field: 'studentPage' | 'studentStatus',
        value: string,
    ) => {
        if (!panelCommentCtx || !userUid) {
            showNotification('Sign in to update your notes.', 'error');
            return;
        }
        setStudentSavingIds((prev) => new Set(prev).add(entry.id));
        try {
            await updatePanelCommentStudentFields(panelCommentCtx, entry.id, {
                [field]: value,
                studentUpdatedBy: userUid,
            });
        } catch (error) {
            console.error('Failed to update student fields for panel comment:', error);
            showNotification('Unable to save your changes. Please try again.', 'error');
        } finally {
            setStudentSavingIds((prev) => {
                const next = new Set(prev);
                next.delete(entry.id);
                return next;
            });
        }
    }, [panelCommentCtx, userUid, showNotification]);

    /**
     * Handle manuscript file selection and upload.
     */
    const handleFileSelect = React.useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!panelCommentCtx || !userUid) {
            showNotification('Sign in to upload a manuscript.', 'error');
            return;
        }

        // Validate file type (allow PDF and DOCX)
        const allowedTypes = [
            'application/pdf',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/msword',
        ];
        if (!allowedTypes.includes(file.type)) {
            showNotification('Only PDF and DOCX files are allowed.', 'error');
            return;
        }

        // Validate file size (50MB max)
        const maxSize = 50 * 1024 * 1024;
        if (file.size > maxSize) {
            showNotification('File size must be less than 50MB.', 'error');
            return;
        }

        setUploadingManuscript(true);
        try {
            await uploadPanelManuscript(panelCommentCtx, activeStage, file, userUid);

            // Create group audit entry
            if (group) {
                const auditCtx = buildAuditContextFromGroup(group);
                await createAuditEntry(auditCtx, {
                    name: 'Manuscript Uploaded',
                    description: `Manuscript "${file.name}" uploaded for ${getPanelCommentStageLabel(activeStage)} panel review`,
                    userId: userUid,
                    category: 'thesis',
                    action: 'file_uploaded',
                    details: {
                        fileName: file.name,
                        fileSize: file.size,
                        stage: activeStage,
                    },
                });
            }

            showNotification('Manuscript uploaded successfully.', 'success');
        } catch (error) {
            console.error('Failed to upload manuscript:', error);
            showNotification('Unable to upload manuscript. Please try again.', 'error');
        } finally {
            setUploadingManuscript(false);
            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    }, [panelCommentCtx, userUid, activeStage, group, showNotification]);

    /**
     * Handle delete manuscript.
     */
    const handleDeleteManuscript = React.useCallback(async () => {
        if (!panelCommentCtx || !userUid || !manuscript) {
            return;
        }

        setUploadingManuscript(true);
        try {
            await deletePanelManuscript(panelCommentCtx, activeStage);

            // Create group audit entry
            if (group) {
                const auditCtx = buildAuditContextFromGroup(group);
                await createAuditEntry(auditCtx, {
                    name: 'Manuscript Deleted',
                    description: `Manuscript "${manuscript.fileName}" deleted for ${getPanelCommentStageLabel(activeStage)} panel review`,
                    userId: userUid,
                    category: 'thesis',
                    action: 'file_deleted',
                    details: {
                        fileName: manuscript.fileName,
                        stage: activeStage,
                    },
                });
            }

            showNotification('Manuscript deleted.', 'success');
        } catch (error) {
            console.error('Failed to delete manuscript:', error);
            showNotification('Unable to delete manuscript. Please try again.', 'error');
        } finally {
            setUploadingManuscript(false);
        }
    }, [panelCommentCtx, userUid, manuscript, activeStage, group, showNotification]);

    /**
     * Handle requesting panel review for the uploaded manuscript.
     * This notifies all panels via email and creates audit entries.
     */
    const handleRequestReview = React.useCallback(async () => {
        if (!panelCommentCtx || !userUid || !manuscript || !group) {
            showNotification('Upload a manuscript first before requesting review.', 'error');
            return;
        }

        if (manuscript.reviewRequested) {
            showNotification('Review has already been requested.', 'info');
            return;
        }

        setRequestingReview(true);
        try {
            await requestManuscriptReview(panelCommentCtx, activeStage, userUid);

            const stageLabel = getPanelCommentStageLabel(activeStage);

            // Create group audit entry for tracking
            const auditCtx = buildAuditContextFromGroup(group);
            await createAuditEntry(auditCtx, {
                name: 'Panel Review Requested',
                description: `Panel review requested for ${stageLabel} manuscript`,
                userId: userUid,
                category: 'panel',
                action: 'panel_review_requested',
                details: {
                    fileName: manuscript.fileName,
                    stage: activeStage,
                    course: group.course,
                },
            });

            // Notify all panel members with email
            void notifyPanelReviewRequested({
                group,
                studentId: userUid,
                stageName: stageLabel,
                fileName: manuscript.fileName,
                details: { stage: activeStage },
            });

            showNotification('Review requested. All panel members have been notified.', 'success');
        } catch (error) {
            console.error('Failed to request review:', error);
            showNotification('Unable to request review. Please try again.', 'error');
        } finally {
            setRequestingReview(false);
        }
    }, [panelCommentCtx, userUid, manuscript, activeStage, group, showNotification]);

    const renderTabs = () => (
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs
                value={activeStage}
                onChange={handleStageChange}
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
            >
                {PANEL_COMMENT_STAGE_METADATA.map((stage) => (
                    <Tab
                        key={stage.id}
                        value={stage.id}
                        label={stage.adminLabel}
                    />
                ))}
            </Tabs>
        </Box>
    );

    if (session?.loading) {
        return (
            <AnimatedPage variant="slideUp">
                <Skeleton variant="text" height={48} width="40%" sx={{ mb: 2 }} />
                <Skeleton variant="rectangular" height={96} />
            </AnimatedPage>
        );
    }

    if (!userUid) {
        return (
            <AnimatedPage variant="slideUp">
                <Alert severity="info">Sign in to view panel comments shared with your group.</Alert>
            </AnimatedPage>
        );
    }

    if (thesisError) {
        return (
            <AnimatedPage variant="slideUp">
                <Alert severity="error">{thesisError}</Alert>
            </AnimatedPage>
        );
    }

    if (thesisLoading) {
        return (
            <AnimatedPage variant="slideUp">
                <Stack spacing={3}>
                    <Skeleton variant="text" width="60%" height={48} />
                    <Skeleton variant="rectangular" height={64} />
                    <Skeleton variant="rectangular" height={320} />
                </Stack>
            </AnimatedPage>
        );
    }

    if (!thesis || !groupId) {
        return (
            <AnimatedPage variant="slideUp">
                <UnauthorizedNotice
                    title="Thesis record unavailable"
                    description="Panel comment sheets will appear here once your thesis record and group are active."
                    variant="box"
                />
            </AnimatedPage>
        );
    }

    if (!panelistsLoading && panelists.length === 0) {
        return (
            <AnimatedPage variant="slideUp">
                <UnauthorizedNotice
                    title="No panel assigned yet"
                    description="Panel sheets will appear here once a panel is assigned to your group."
                    variant="box"
                />
            </AnimatedPage>
        );
    }

    return (
        <AnimatedPage variant="slideUp">
            <Stack spacing={3}>
                <Box>
                    <Typography variant="body1" color="text.secondary">
                        Track every remark from your proposal and defense hearings, then document the page and status once addressed.
                    </Typography>
                </Box>

                {renderTabs()}

                {/* Manuscript Upload Section - shared across all panels */}
                {stageAccessible && (
                    <Paper variant="outlined" sx={{ p: 2 }}>
                        <Stack spacing={2}>
                            <Typography variant="subtitle1" fontWeight="medium">
                                Manuscript for Panel Review
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Upload your revised manuscript for the panel to review.
                                You must upload a file before requesting a review.
                            </Typography>

                            {manuscriptLoading ? (
                                <Skeleton variant="rectangular" height={56} />
                            ) : manuscript ? (
                                <Stack spacing={2}>
                                    <FileCard
                                        file={{
                                            name: manuscript.fileName,
                                            size: manuscript.fileSize,
                                            mimeType: manuscript.mimeType,
                                            url: manuscript.url,
                                        } as FileAttachment}
                                        title={manuscript.fileName}
                                        sizeLabel={formatFileSize(manuscript.fileSize)}
                                        metaLabel={`Uploaded ${new Date(manuscript.uploadedAt).toLocaleDateString()}`}
                                        onClick={() => setFileViewerOpen(true)}
                                        onDownload={() => window.open(manuscript.url, '_blank', 'noopener,noreferrer')}
                                        onDelete={!manuscript.reviewRequested ? handleDeleteManuscript : undefined}
                                        showDownloadButton
                                        showDeleteButton={!manuscript.reviewRequested}
                                        disabled={uploadingManuscript}
                                    />

                                    <Stack direction="row" spacing={2} alignItems="center">
                                        <Button
                                            variant="contained"
                                            color="primary"
                                            startIcon={requestingReview ? <CircularProgress size={16} /> : <RequestReviewIcon />}
                                            onClick={handleRequestReview}
                                            disabled={requestingReview || manuscript.reviewRequested}
                                        >
                                            {manuscript.reviewRequested
                                                ? 'Review Requested'
                                                : 'Request Panel Review'}
                                        </Button>
                                        {manuscript.reviewRequested && (
                                            <Typography variant="body2" color="success.main">
                                                ✓ Review requested on{' '}
                                                {new Date(manuscript.reviewRequestedAt || '').toLocaleDateString()}
                                            </Typography>
                                        )}
                                    </Stack>
                                </Stack>
                            ) : (
                                <Stack direction="row" spacing={2} alignItems="center">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                        style={{ display: 'none' }}
                                        onChange={handleFileSelect}
                                    />
                                    <Button
                                        variant="outlined"
                                        startIcon={uploadingManuscript ? <CircularProgress size={16} /> : <CloudUploadIcon />}
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={uploadingManuscript}
                                    >
                                        {uploadingManuscript ? 'Uploading...' : 'Upload Manuscript'}
                                    </Button>
                                    <Typography variant="caption" color="text.secondary">
                                        PDF or DOCX, max 50MB
                                    </Typography>
                                </Stack>
                            )}
                        </Stack>
                    </Paper>
                )}

                <Stack spacing={1.5}>
                    <Typography variant="subtitle2" color="text.secondary">
                        Panel sheets
                    </Typography>
                    {panelistsLoading ? (
                        <Skeleton variant="rectangular" height={48} />
                    ) : panelistsError ? (
                        <Alert severity="error">{panelistsError}</Alert>
                    ) : (
                        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                            <Tabs
                                value={activePanelUid ?? panelists[0]?.uid}
                                onChange={handlePanelChange}
                                variant="scrollable"
                                scrollButtons="auto"
                                allowScrollButtonsMobile
                            >
                                {panelists.map((panel) => (
                                    <Tab key={panel.uid} value={panel.uid} label={panel.label} />
                                ))}
                            </Tabs>
                        </Box>
                    )}
                </Stack>

                {!stageAccessible ? (
                    <Box sx={{ display: 'flex', flexGrow: 1, alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
                        <UnauthorizedNotice
                            title={`${getPanelCommentStageLabel(activeStage)} tab locked`}
                            description={lockedDescription}
                            variant="box"
                            sx={{ minHeight: 'auto' }}
                        />
                    </Box>
                ) : !activePanelUid ? (
                    <UnauthorizedNotice
                        title="No panel sheet selected"
                        description="Select a panel sheet above to review comments."
                        variant="box"
                        sx={{ minHeight: 'auto' }}
                    />
                ) : (
                    <Stack spacing={2}>
                        <Alert severity="info">
                            Update the <strong>Page</strong> column with the exact location of your revision
                            and describe the action taken under <strong>Status</strong>.
                        </Alert>
                        {entriesError && (
                            <Alert severity="error">{entriesError}</Alert>
                        )}
                        <PanelCommentTable
                            title={`${activePanelist?.label ?? 'Panel'} · Comment sheet`}
                            entries={entries}
                            variant="student"
                            loading={entriesLoading}
                            busyEntryIds={studentSavingIds}
                            onStudentFieldChange={(entry, field, value) => handleStudentFieldChange(entry, field, value)}
                        />
                    </Stack>
                )}
            </Stack>

            {/* File Viewer Dialog */}
            <Dialog
                open={fileViewerOpen}
                onClose={() => setFileViewerOpen(false)}
                maxWidth="lg"
                fullWidth
                PaperProps={{ sx: { height: '80vh' } }}
            >
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
                    <Typography variant="h6" component="span" noWrap sx={{ flex: 1 }}>
                        {manuscript?.fileName ?? 'Manuscript'}
                    </Typography>
                    <Stack direction="row" spacing={0.5}>
                        <Tooltip title="Download file">
                            <IconButton
                                size="small"
                                onClick={() => manuscript?.url && window.open(manuscript.url, '_blank', 'noopener,noreferrer')}
                            >
                                <DownloadIcon />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Close">
                            <IconButton size="small" onClick={() => setFileViewerOpen(false)}>
                                <CloseIcon />
                            </IconButton>
                        </Tooltip>
                    </Stack>
                </DialogTitle>
                <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
                    {manuscript && (
                        <FileViewer
                            file={{
                                name: manuscript.fileName,
                                size: manuscript.fileSize,
                                mimeType: manuscript.mimeType,
                                url: manuscript.url,
                            } as FileAttachment}
                            showToolbar={false}
                            height="100%"
                        />
                    )}
                </DialogContent>
            </Dialog>
        </AnimatedPage>
    );
}
