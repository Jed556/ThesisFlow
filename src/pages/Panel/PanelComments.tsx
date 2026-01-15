import * as React from 'react';
import {
    Alert, Autocomplete, Box, Button, Dialog, DialogContent, DialogTitle, IconButton,
    Paper, Skeleton, Stack, Tab, Tabs, TextField, Tooltip, Typography,
} from '@mui/material';
import {
    Send as SendIcon, Close as CloseIcon, Download as DownloadIcon, Link as LinkIcon,
} from '@mui/icons-material';
import CommentBankIcon from '@mui/icons-material/CommentBank';
import { useSession } from '@toolpad/core';
import type { Session } from '../../types/session';
import type { NavigationItem } from '../../types/navigation';
import type { ThesisGroup } from '../../types/group';
import type {
    PanelCommentApprovalStatus, PanelCommentEntry,
    PanelCommentManuscript, PanelCommentStage,
} from '../../types/panelComment';
import { AnimatedPage } from '../../components/Animate';
import { PanelCommentTable, PanelCommentEditorDialog } from '../../components/PanelComments';
import { useSnackbar } from '../../components/Snackbar';
import { listenGroupsByPanelist } from '../../utils/firebase/firestore/groups';
import {
    addPanelCommentEntry, deletePanelCommentEntry, listenPanelCommentEntries,
    updatePanelCommentEntry, listenPanelCommentRelease, isPanelTableReleased,
    isPanelTableReadyForReview, setPanelCommentTableReadyState,
    updatePanelCommentApprovalStatus, listenPanelManuscript,
    type PanelCommentContext,
} from '../../utils/firebase/firestore/panelComments';
import { createDefaultPanelCommentReleaseMap, type PanelCommentReleaseMap } from '../../types/panelComment';
import { PANEL_COMMENT_STAGE_METADATA, getPanelCommentStageLabel } from '../../utils/panelCommentUtils';
import { DEFAULT_YEAR } from '../../config/firestore';
import {
    auditAndNotify, auditPanelCommentCreated, notifyPanelCommentsReadyForRelease,
    notifyPanelCommentApproved, notifyAllPanelCommentsApproved
} from '../../utils/auditNotificationUtils';
import { findUsersByFilter } from '../../utils/firebase/firestore/user';
import { formatFileSize } from '../../utils/fileUtils';
import { FileCard, FileViewer } from '../../components/File';
import type { FileAttachment } from '../../types/file';
import { useSegmentViewed } from '../../hooks';

export const metadata: NavigationItem = {
    group: 'thesis',
    index: 4,
    title: 'Panel Comment Sheets',
    segment: 'panel-feedback',
    icon: <CommentBankIcon />,
    roles: ['panel'],
};

type EditorMode = 'create' | 'edit';

export default function PanelPanelCommentsPage() {
    useSegmentViewed({ segment: 'panel-feedback' });
    const session = useSession<Session>();
    const userUid = session?.user?.uid ?? null;
    const userName = session?.user?.name ?? 'Panel member';
    const { showNotification } = useSnackbar();

    const [groups, setGroups] = React.useState<ThesisGroup[]>([]);
    const [groupsLoading, setGroupsLoading] = React.useState(true);
    const [selectedGroupId, setSelectedGroupId] = React.useState<string>('');
    const [activeStage, setActiveStage] = React.useState<PanelCommentStage>('proposal');
    const [entries, setEntries] = React.useState<PanelCommentEntry[]>([]);
    const [entriesLoading, setEntriesLoading] = React.useState(false);
    const [entriesError, setEntriesError] = React.useState<string | null>(null);
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [dialogMode, setDialogMode] = React.useState<EditorMode>('create');
    const [editingEntry, setEditingEntry] = React.useState<PanelCommentEntry | null>(null);
    const [saving, setSaving] = React.useState(false);
    const [releaseMap, setReleaseMap] = React.useState<PanelCommentReleaseMap>(
        createDefaultPanelCommentReleaseMap()
    );
    /** Manuscript state */
    const [manuscript, setManuscript] = React.useState<PanelCommentManuscript | null>(null);
    const [manuscriptLoading, setManuscriptLoading] = React.useState(false);
    /** File viewer dialog state */
    const [fileViewerOpen, setFileViewerOpen] = React.useState(false);

    const selectedGroup = React.useMemo(
        () => groups.find((group) => group.id === selectedGroupId) ?? null,
        [groups, selectedGroupId]
    );

    /** Build panel comment context from selected group */
    const panelCommentCtx: PanelCommentContext | null = React.useMemo(() => {
        if (!selectedGroup) return null;
        return {
            year: DEFAULT_YEAR,
            department: selectedGroup.department ?? '',
            course: selectedGroup.course ?? '',
            groupId: selectedGroup.id,
        };
    }, [selectedGroup]);

    React.useEffect(() => {
        if (!userUid) {
            setGroups([]);
            setGroupsLoading(false);
            setSelectedGroupId('');
            return;
        }
        setGroupsLoading(true);
        const unsubscribe = listenGroupsByPanelist(userUid, {
            onData: (next) => {
                setGroups(next);
                setGroupsLoading(false);
                if (next.length > 0 && !next.find((group) => group.id === selectedGroupId)) {
                    setSelectedGroupId(next[0].id);
                }
            },
            onError: (error) => {
                console.error('Failed to load panel groups:', error);
                setGroups([]);
                setGroupsLoading(false);
            },
        });
        return () => unsubscribe();
    }, [userUid, selectedGroupId]);

    // Listen for release status
    React.useEffect(() => {
        if (!panelCommentCtx) {
            setReleaseMap(createDefaultPanelCommentReleaseMap());
            return;
        }
        const unsubscribe = listenPanelCommentRelease(panelCommentCtx, {
            onData: (next) => setReleaseMap(next),
            onError: (error) => console.error('Panel release listener error:', error),
        });
        return () => unsubscribe();
    }, [panelCommentCtx]);

    // Check if current user's table is released for the active stage
    const isTableReleased = React.useMemo(() => {
        if (!userUid) return false;
        return isPanelTableReleased(releaseMap, activeStage, userUid);
    }, [releaseMap, activeStage, userUid]);

    // Check if current user's table is marked as ready for review
    const isTableReadyForReview = React.useMemo(() => {
        if (!userUid) return false;
        return isPanelTableReadyForReview(releaseMap, activeStage, userUid);
    }, [releaseMap, activeStage, userUid]);

    // State for saving ready status
    const [readySaving, setReadySaving] = React.useState(false);

    React.useEffect(() => {
        if (!panelCommentCtx || !userUid) {
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
                console.error('Failed to load panel comments for panel page:', error);
                setEntries([]);
                setEntriesLoading(false);
                setEntriesError('Unable to load comments right now.');
            },
        }, userUid);
        return () => unsubscribe();
    }, [panelCommentCtx, activeStage, userUid]);

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

    const handleStageChange = React.useCallback((_: React.SyntheticEvent, value: PanelCommentStage) => {
        setActiveStage(value);
    }, []);

    const handleSelectGroup = React.useCallback((_: unknown, value: ThesisGroup | null) => {
        setSelectedGroupId(value?.id ?? '');
    }, []);

    const handleOpenEditor = React.useCallback((mode: EditorMode, entry?: PanelCommentEntry) => {
        setDialogMode(mode);
        setEditingEntry(entry ?? null);
        setDialogOpen(true);
    }, []);

    const handleCloseEditor = React.useCallback(() => {
        if (saving) return;
        setDialogOpen(false);
    }, [saving]);

    const handleSubmitEditor = React.useCallback(async (values: { comment: string; reference?: string }) => {
        if (!panelCommentCtx || !userUid || !selectedGroup) {
            showNotification('Select a group before adding comments.', 'error');
            return;
        }
        setSaving(true);
        try {
            if (dialogMode === 'create') {
                await addPanelCommentEntry(panelCommentCtx, {
                    stage: activeStage,
                    comment: values.comment,
                    reference: values.reference,
                    createdBy: userUid,
                    panelUid: userUid,
                });

                // Audit only for panel comment creation (no notifications/emails)
                try {
                    const stageLabel = getPanelCommentStageLabel(activeStage);
                    void auditPanelCommentCreated({
                        group: selectedGroup,
                        panelId: userUid,
                        stageName: stageLabel,
                        commentPreview: values.comment.slice(0, 100),
                        details: { stage: activeStage },
                    });
                } catch (auditError) {
                    console.error('Failed to create audit entry:', auditError);
                }

                showNotification('Comment added.', 'success');
            } else if (editingEntry) {
                await updatePanelCommentEntry(panelCommentCtx, editingEntry.id, {
                    comment: values.comment,
                    reference: values.reference,
                    updatedBy: userUid,
                });
                showNotification('Comment updated.', 'success');
            }
            setDialogOpen(false);
        } catch (error) {
            console.error('Failed to save panel comment entry:', error);
            showNotification('Unable to save the comment. Please try again.', 'error');
        } finally {
            setSaving(false);
        }
    }, [panelCommentCtx, userUid, dialogMode, editingEntry, activeStage, showNotification]);

    const handleDeleteEntry = React.useCallback(async (entry: PanelCommentEntry) => {
        if (!panelCommentCtx || isTableReleased) return;
        const confirmed = window.confirm('Delete this comment? This action cannot be undone.');
        if (!confirmed) {
            return;
        }
        try {
            await deletePanelCommentEntry(panelCommentCtx, entry.id);
            showNotification('Comment removed.', 'success');
        } catch (error) {
            console.error('Failed to delete panel comment:', error);
            showNotification('Unable to delete the comment. Please try again.', 'error');
        }
    }, [panelCommentCtx, isTableReleased, showNotification]);

    const handleApprovalChange = React.useCallback(async (
        entry: PanelCommentEntry,
        status: PanelCommentApprovalStatus
    ) => {
        // Only allow approval changes when table is released AND manuscript review is requested
        if (!panelCommentCtx || !userUid || !isTableReleased || !selectedGroup || !manuscript?.reviewRequested) {
            showNotification('Cannot update approval status. Student must request review first.', 'warning');
            return;
        }
        try {
            await updatePanelCommentApprovalStatus(panelCommentCtx, entry.id, status, userUid);

            const stageLabel = getPanelCommentStageLabel(activeStage);

            if (status === 'approved') {
                // Find the comment number (1-based index)
                const commentNumber = entries.findIndex(e => e.id === entry.id) + 1;
                // Truncate comment preview
                const commentPreview = entry.comment?.length > 50
                    ? `${entry.comment.substring(0, 50)}...`
                    : entry.comment;

                // Notify student that comment was approved (with toast)
                try {
                    await notifyPanelCommentApproved({
                        group: selectedGroup,
                        panelId: userUid,
                        stageName: stageLabel,
                        commentNumber,
                        commentPreview,
                        details: { stage: activeStage, entryId: entry.id },
                    });
                } catch (auditError) {
                    console.error('Failed to create audit notification:', auditError);
                }

                // Check if all comments are now approved
                const updatedEntries = entries.map(e =>
                    e.id === entry.id ? { ...e, approvalStatus: 'approved' as PanelCommentApprovalStatus } : e
                );
                const allApproved = updatedEntries.every(e => e.approvalStatus === 'approved');

                if (allApproved && entries.length > 0) {
                    try {
                        await notifyAllPanelCommentsApproved({
                            group: selectedGroup,
                            panelId: userUid,
                            panelName: userName,
                            stageName: stageLabel,
                            totalComments: entries.length,
                            details: { stage: activeStage },
                        });
                    } catch (auditError) {
                        console.error('Failed to send all comments approved notification:', auditError);
                    }
                }
            } else {
                // Revision requested - create audit
                try {
                    await auditAndNotify({
                        group: selectedGroup,
                        userId: userUid,
                        name: 'Panel Comment Revision Requested',
                        description: `A panel comment for ${stageLabel} stage needs revision.`,
                        category: 'panel',
                        action: 'submission_revision_requested',
                        targets: {
                            groupMembers: true,
                            excludeUserId: userUid,
                        },
                        details: { stage: activeStage, entryId: entry.id, newStatus: status },
                        sendEmail: true,
                    });
                } catch (auditError) {
                    console.error('Failed to create audit notification:', auditError);
                }
            }

            showNotification(
                status === 'approved' ? 'Comment marked as approved.' : 'Revision requested.',
                'success'
            );
        } catch (error) {
            console.error('Failed to update approval status:', error);
            showNotification('Unable to update approval status. Please try again.', 'error');
        }
    }, [
        panelCommentCtx, userUid, userName, isTableReleased, selectedGroup,
        activeStage, manuscript, entries, showNotification
    ]);

    /** Mark comments as ready for admin to release to students */
    const handleMarkAsReady = React.useCallback(async () => {
        if (!panelCommentCtx || !userUid || !selectedGroup) {
            showNotification('Select a group first.', 'error');
            return;
        }
        if (entries.length === 0) {
            showNotification('Add at least one comment before marking as ready.', 'warning');
            return;
        }
        setReadySaving(true);
        try {
            await setPanelCommentTableReadyState(panelCommentCtx, activeStage, userUid, true, userUid);

            // Notify admins that panel comments are ready for release (with email)
            try {
                const stageLabel = getPanelCommentStageLabel(activeStage);
                // Fetch admin user IDs for notifications
                const adminUsers = await findUsersByFilter({ role: 'admin' });
                const adminUserIds = adminUsers.map(u => u.uid);

                void notifyPanelCommentsReadyForRelease({
                    group: selectedGroup,
                    panelId: userUid,
                    panelName: userName,
                    stageName: stageLabel,
                    commentCount: entries.length,
                    adminUserIds,
                    details: { stage: activeStage },
                });
            } catch (auditError) {
                console.error('Failed to create audit notification:', auditError);
            }

            showNotification('Comments marked as ready. Admin will be notified.', 'success');
        } catch (error) {
            console.error('Failed to mark comments as ready:', error);
            showNotification('Unable to mark comments as ready. Please try again.', 'error');
        } finally {
            setReadySaving(false);
        }
    }, [panelCommentCtx, userUid, selectedGroup, activeStage, entries.length, showNotification]);

    if (session?.loading) {
        return (
            <AnimatedPage variant="slideUp">
                <Skeleton variant="text" width="40%" height={48} sx={{ mb: 2 }} />
                <Skeleton variant="rectangular" height={160} />
            </AnimatedPage>
        );
    }

    if (!userUid) {
        return (
            <AnimatedPage variant="slideUp">
                <Alert severity="info">Sign in with your panel account to manage comment sheets.</Alert>
            </AnimatedPage>
        );
    }

    return (
        <AnimatedPage variant="slideUp">
            <Stack spacing={3}>
                <Box>
                    <Typography variant="body1" color="text.secondary">
                        Select an assigned research group, pick the stage, and log your consolidated feedback.
                    </Typography>
                </Box>

                <Autocomplete
                    options={groups}
                    value={selectedGroup}
                    onChange={handleSelectGroup}
                    getOptionLabel={(option) => option.name || option.id}
                    loading={groupsLoading}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label="Assigned groups"
                            placeholder={groupsLoading ? 'Loading groups…' : 'Search group'}
                        />
                    )}
                />

                {groups.length === 0 && !groupsLoading && (
                    <Alert severity="info">
                        No thesis groups are currently assigned to you as a panel member.
                    </Alert>
                )}

                {selectedGroupId && (
                    <>
                        <Tabs value={activeStage} onChange={handleStageChange}>
                            {PANEL_COMMENT_STAGE_METADATA.map((stage) => (
                                <Tab key={stage.id} value={stage.id} label={stage.studentLabel} />
                            ))}
                        </Tabs>
                        {isTableReleased ? (
                            <Alert severity="success">
                                Your comment sheet has been released to students.
                                You can now review their responses and approve or request revisions.
                            </Alert>
                        ) : isTableReadyForReview ? (
                            <Alert severity="info">
                                Your comments are marked as ready for release.
                                An admin will review and release them to students soon.
                            </Alert>
                        ) : (
                            <Stack spacing={2}>
                                <Alert severity="info">
                                    Students will provide their page references and status separately.
                                    Focus on the concrete comments here.
                                    {' '}Each panelist works on a dedicated sheet, so you will only see entries
                                    that belong to you.
                                </Alert>
                                {entries.length > 0 && (
                                    <Box>
                                        <Button
                                            variant="contained"
                                            color="primary"
                                            startIcon={<SendIcon />}
                                            onClick={handleMarkAsReady}
                                            disabled={readySaving || saving}
                                        >
                                            {readySaving ? 'Marking as Ready...' : 'Mark as Ready for Release'}
                                        </Button>
                                        <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                                            This will notify the admin that your comments are ready to be sent to students.
                                        </Typography>
                                    </Box>
                                )}
                            </Stack>
                        )}

                        {/* Manuscript Viewer - Show when manuscript exists */}
                        {manuscriptLoading ? (
                            <Skeleton variant="rectangular" height={80} />
                        ) : manuscript && (
                            <Paper variant="outlined" sx={{ p: 2 }}>
                                <Stack spacing={1.5}>
                                    <Typography variant="subtitle1" fontWeight="medium">
                                        {manuscript.reviewRequested ? 'Manuscript for Review' : 'Manuscript Uploaded'}
                                    </Typography>
                                    {!manuscript.reviewRequested && (
                                        <Alert severity="info" sx={{ py: 0.5 }}>
                                            Waiting for student to request review. You can view the{' '}
                                            {manuscript.type === 'link' ? 'link' : 'file'} but cannot
                                            approve/request revisions yet.
                                        </Alert>
                                    )}
                                    {manuscript.type === 'link' ? (
                                        /* Link mode - display link info */
                                        <Stack
                                            direction="row"
                                            spacing={2}
                                            alignItems="center"
                                            sx={{
                                                p: 2,
                                                bgcolor: 'action.hover',
                                                borderRadius: 1,
                                            }}
                                        >
                                            <LinkIcon color="primary" />
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Typography variant="body2" fontWeight="medium" noWrap>
                                                    {manuscript.linkLabel || 'Manuscript Link'}
                                                </Typography>
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                    noWrap
                                                    sx={{ display: 'block' }}
                                                >
                                                    Submitted{' '}
                                                    {new Date(manuscript.uploadedAt).toLocaleDateString()}
                                                    {manuscript.reviewRequestedAt && (
                                                        <> · Review requested{' '}
                                                            {new Date(manuscript.reviewRequestedAt).toLocaleDateString()}
                                                        </>
                                                    )}
                                                </Typography>
                                            </Box>
                                            <Button
                                                variant="outlined"
                                                size="small"
                                                startIcon={<LinkIcon />}
                                                onClick={() => window.open(manuscript.link, '_blank', 'noopener,noreferrer')}
                                            >
                                                Open Link
                                            </Button>
                                        </Stack>
                                    ) : (
                                        /* File mode - display FileCard */
                                        <FileCard
                                            file={{
                                                name: manuscript.fileName ?? 'Manuscript',
                                                size: formatFileSize(manuscript.fileSize ?? 0),
                                                mimeType: manuscript.mimeType ?? 'application/pdf',
                                                url: manuscript.url ?? '',
                                                type: manuscript.mimeType ?? 'application/pdf',
                                                uploadDate: manuscript.uploadedAt,
                                                author: manuscript.uploadedBy ?? '',
                                            } as FileAttachment}
                                            title={manuscript.fileName ?? 'Manuscript'}
                                            sizeLabel={formatFileSize(manuscript.fileSize ?? 0)}
                                            metaLabel={
                                                `Uploaded ${new Date(manuscript.uploadedAt).toLocaleDateString()}` +
                                                (manuscript.reviewRequestedAt
                                                    ? ` · Review requested ${new Date(manuscript.reviewRequestedAt).toLocaleDateString()}`
                                                    : '')
                                            }
                                            onClick={() => setFileViewerOpen(true)}
                                            onDownload={() => window.open(manuscript.url, '_blank', 'noopener,noreferrer')}
                                            showDownloadButton
                                            showDeleteButton={false}
                                        />
                                    )}
                                </Stack>
                            </Paper>
                        )}

                        {entriesError && (
                            <Alert severity="error">{entriesError}</Alert>
                        )}
                        <PanelCommentTable
                            title={`${selectedGroup?.name ?? 'Selected group'} · ${getPanelCommentStageLabel(activeStage)}`}
                            entries={entries}
                            variant="panel"
                            loading={entriesLoading}
                            disabled={saving}
                            released={isTableReleased}
                            onAddEntry={() => handleOpenEditor('create')}
                            onEditEntry={(entry) => handleOpenEditor('edit', entry)}
                            onDeleteEntry={handleDeleteEntry}
                            onApprovalChange={manuscript?.reviewRequested ? handleApprovalChange : undefined}
                        />
                    </>
                )}
            </Stack>

            <PanelCommentEditorDialog
                open={dialogOpen}
                mode={dialogMode}
                initialValue={editingEntry ?? undefined}
                onClose={handleCloseEditor}
                onSubmit={handleSubmitEditor}
                submitting={saving}
            />

            {/* File Viewer Dialog - Only show for file type manuscripts */}
            {manuscript?.type !== 'link' && (
                <Dialog
                    open={fileViewerOpen}
                    onClose={() => setFileViewerOpen(false)}
                    maxWidth="lg"
                    fullWidth
                    slotProps={{ paper: { sx: { height: '80vh' } } }}
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
                                    name: manuscript.fileName ?? 'Manuscript',
                                    size: formatFileSize(manuscript.fileSize ?? 0),
                                    mimeType: manuscript.mimeType ?? 'application/pdf',
                                    url: manuscript.url ?? '',
                                    type: manuscript.mimeType ?? 'application/pdf',
                                    uploadDate: manuscript.uploadedAt,
                                    author: manuscript.uploadedBy ?? '',
                                } as FileAttachment}
                                showToolbar={false}
                                height="100%"
                            />
                        )}
                    </DialogContent>
                </Dialog>
            )}
        </AnimatedPage>
    );
}
