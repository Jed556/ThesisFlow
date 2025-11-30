import * as React from 'react';
import { Alert, Autocomplete, Box, Skeleton, Stack, Tab, Tabs, TextField, Typography, } from '@mui/material';
import CommentBankIcon from '@mui/icons-material/CommentBank';
import { useSession } from '@toolpad/core';
import type { Session } from '../../types/session';
import type { NavigationItem } from '../../types/navigation';
import type { ThesisGroup } from '../../types/group';
import type { PanelCommentEntry, PanelCommentStage } from '../../types/panelComment';
import { AnimatedPage } from '../../components/Animate';
import { PanelCommentTable, PanelCommentEditorDialog } from '../../components/PanelComments';
import { useSnackbar } from '../../components/Snackbar';
import { listenGroupsByPanelist } from '../../utils/firebase/firestore/groups';
import {
    addPanelCommentEntry, deletePanelCommentEntry, listenPanelCommentEntries,
    updatePanelCommentEntry, type PanelCommentContext,
} from '../../utils/firebase/firestore/panelComments';
import { PANEL_COMMENT_STAGE_METADATA, getPanelCommentStageLabel } from '../../utils/panelCommentUtils';
import { DEFAULT_YEAR } from '../../config/firestore';

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
    const session = useSession<Session>();
    const userUid = session?.user?.uid ?? null;
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
        if (!panelCommentCtx || !userUid) {
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
        if (!panelCommentCtx) return;
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
    }, [panelCommentCtx, showNotification]);

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
                        <Alert severity="info">
                            Students will provide their page references and status separately. Focus on the concrete comments here.
                            {' '}Each panelist works on a dedicated sheet, so you will only see entries that belong to you.
                        </Alert>
                        {entriesError && (
                            <Alert severity="error">{entriesError}</Alert>
                        )}
                        <PanelCommentTable
                            title={`${selectedGroup?.name ?? 'Selected group'} · ${getPanelCommentStageLabel(activeStage)}`}
                            entries={entries}
                            variant="panel"
                            loading={entriesLoading}
                            disabled={saving}
                            onAddEntry={() => handleOpenEditor('create')}
                            onEditEntry={(entry) => handleOpenEditor('edit', entry)}
                            onDeleteEntry={handleDeleteEntry}
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
        </AnimatedPage>
    );
}
