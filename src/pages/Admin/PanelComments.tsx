import * as React from 'react';
import {
    Alert, Autocomplete, Box, Button, Chip, Skeleton, Stack,
    Tab, Tabs, TextField, Typography,
} from '@mui/material';
import CommentBankIcon from '@mui/icons-material/CommentBank';
import { where } from 'firebase/firestore';
import { useSession } from '@toolpad/core';
import type { Session } from '../../types/session';
import type { NavigationItem } from '../../types/navigation';
import type { ThesisGroup } from '../../types/group';
import type { PanelCommentEntry, PanelCommentReleaseMap, PanelCommentStage } from '../../types/panelComment';
import { AnimatedPage } from '../../components/Animate';
import { PanelCommentTable } from '../../components/PanelComments';
import { useSnackbar } from '../../components/Snackbar';
import { getAllGroups } from '../../utils/firebase/firestore/groups';
import { listenTheses, type ThesisRecord } from '../../utils/firebase/firestore/thesis';
import {
    listenPanelCommentEntries,
    listenPanelCommentRelease,
    setPanelCommentReleaseState,
} from '../../utils/firebase/firestore/panelComments';
import { buildStageCompletionMap } from '../../utils/thesisStageUtils';
import {
    PANEL_COMMENT_STAGE_METADATA,
    getPanelCommentStageLabel,
} from '../../utils/panelCommentUtils';
import { createDefaultPanelCommentReleaseMap } from '../../types/panelComment';

export const metadata: NavigationItem = {
    group: 'management',
    index: 12,
    title: 'Panel Releases',
    segment: 'panel-comments-admin',
    icon: <CommentBankIcon />,
    roles: ['admin'],
};

export default function AdminPanelCommentsPage() {
    const session = useSession<Session>();
    const userUid = session?.user?.uid ?? null;
    const { showNotification } = useSnackbar();

    const [groups, setGroups] = React.useState<ThesisGroup[]>([]);
    const [groupsLoading, setGroupsLoading] = React.useState(true);
    const [selectedGroupId, setSelectedGroupId] = React.useState<string>('');
    const selectedGroup = React.useMemo(
        () => groups.find((group) => group.id === selectedGroupId) ?? null,
        [groups, selectedGroupId]
    );
    const [thesis, setThesis] = React.useState<ThesisRecord | null>(null);
    const [thesisLoading, setThesisLoading] = React.useState(false);
    const [releaseMap, setReleaseMap] = React.useState<PanelCommentReleaseMap>(createDefaultPanelCommentReleaseMap());
    const [entries, setEntries] = React.useState<PanelCommentEntry[]>([]);
    const [entriesLoading, setEntriesLoading] = React.useState(false);
    const [entriesError, setEntriesError] = React.useState<string | null>(null);
    const [activeStage, setActiveStage] = React.useState<PanelCommentStage>('proposal');
    const [releaseSaving, setReleaseSaving] = React.useState(false);

    React.useEffect(() => {
        let cancelled = false;
        setGroupsLoading(true);
        void getAllGroups()
            .then((result) => {
                if (cancelled) return;
                setGroups(result);
                setGroupsLoading(false);
                setSelectedGroupId((prev) => (prev ? prev : (result[0]?.id ?? '')));
            })
            .catch((error) => {
                console.error('Failed to load groups for admin panel comments:', error);
                if (!cancelled) {
                    setGroups([]);
                    setGroupsLoading(false);
                }
            });
        return () => {
            cancelled = true;
        };
    }, []);

    React.useEffect(() => {
        if (!selectedGroupId) {
            setThesis(null);
            setThesisLoading(false);
            return;
        }
        setThesisLoading(true);
        const unsubscribe = listenTheses([
            where('groupId', '==', selectedGroupId),
        ], {
            onData: (records) => {
                setThesis(records[0] ?? null);
                setThesisLoading(false);
            },
            onError: (error) => {
                console.error('Failed to load thesis for admin panel page:', error);
                setThesis(null);
                setThesisLoading(false);
            },
        });
        return () => unsubscribe();
    }, [selectedGroupId]);

    React.useEffect(() => {
        if (!selectedGroupId) {
            setReleaseMap(createDefaultPanelCommentReleaseMap());
            return;
        }
        const unsubscribe = listenPanelCommentRelease(selectedGroupId, {
            onData: (next) => setReleaseMap(next),
            onError: (error) => console.error('Panel release listener error (admin view):', error),
        });
        return () => unsubscribe();
    }, [selectedGroupId]);

    React.useEffect(() => {
        if (!selectedGroupId) {
            setEntries([]);
            setEntriesLoading(false);
            return;
        }
        setEntriesLoading(true);
        setEntriesError(null);
        const unsubscribe = listenPanelCommentEntries(selectedGroupId, activeStage, {
            onData: (next) => {
                setEntries(next);
                setEntriesLoading(false);
            },
            onError: (error) => {
                console.error('Failed to load panel comments for admin view:', error);
                setEntries([]);
                setEntriesLoading(false);
                setEntriesError('Unable to load comments for this stage.');
            },
        });
        return () => unsubscribe();
    }, [selectedGroupId, activeStage]);

    const stageCompletionMap = React.useMemo(() => (
        buildStageCompletionMap(thesis?.chapters ?? [], { treatEmptyAsComplete: false })
    ), [thesis?.chapters]);

    const activeStageMeta = React.useMemo(
        () => PANEL_COMMENT_STAGE_METADATA.find((meta) => meta.id === activeStage),
        [activeStage]
    );
    const canRelease = activeStageMeta ? (stageCompletionMap[activeStageMeta.unlockStage] ?? false) : false;

    const handleStageChange = React.useCallback((_: React.SyntheticEvent, value: PanelCommentStage) => {
        setActiveStage(value);
    }, []);

    const handleSelectGroup = (_: unknown, value: ThesisGroup | null) => {
        setSelectedGroupId(value?.id ?? '');
    };

    const handleToggleRelease = React.useCallback(async () => {
        if (!selectedGroupId || !userUid) {
            showNotification('Select a group first.', 'error');
            return;
        }
        const currentState = releaseMap[activeStage]?.sent ?? false;
        if (!currentState && !canRelease) {
            showNotification('All prerequisite chapters must be approved before releasing.', 'warning');
            return;
        }
        setReleaseSaving(true);
        try {
            await setPanelCommentReleaseState(selectedGroupId, activeStage, !currentState, userUid);
            showNotification(!currentState ? 'Comments sent to students.' : 'Student access revoked.', 'success');
        } catch (error) {
            console.error('Failed to update panel release state:', error);
            showNotification('Unable to update release state right now.', 'error');
        } finally {
            setReleaseSaving(false);
        }
    }, [selectedGroupId, userUid, releaseMap, activeStage, canRelease, showNotification]);

    if (session?.loading) {
        return (
            <AnimatedPage variant="slideUp">
                <Skeleton variant="text" width="50%" height={48} sx={{ mb: 2 }} />
                <Skeleton variant="rectangular" height={120} />
            </AnimatedPage>
        );
    }

    if (!userUid) {
        return (
            <AnimatedPage variant="slideUp">
                <Alert severity="info">Sign in as an admin to manage panel releases.</Alert>
            </AnimatedPage>
        );
    }

    return (
        <AnimatedPage variant="slideUp">
            <Stack spacing={3}>
                <Box>
                    <Typography variant="h4" gutterBottom>
                        Panel Releases
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Monitor panel feedback for every group and control when students can view each stage.
                    </Typography>
                </Box>

                <Autocomplete
                    options={groups}
                    value={selectedGroup}
                    onChange={handleSelectGroup}
                    loading={groupsLoading}
                    getOptionLabel={(option) => option.name || option.id}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label="Thesis groups"
                            placeholder={groupsLoading ? 'Loading groups…' : 'Select group'}
                        />
                    )}
                />

                {!selectedGroup && !groupsLoading && (
                    <Alert severity="info">
                        Pick a group to view its panel comment sheets.
                    </Alert>
                )}

                {selectedGroup && (
                    <>
                        <Tabs value={activeStage} onChange={handleStageChange}>
                            {PANEL_COMMENT_STAGE_METADATA.map((stage) => (
                                <Tab key={stage.id} value={stage.id} label={stage.adminLabel} />
                            ))}
                        </Tabs>

                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center" justifyContent="space-between"
                            sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}>
                            <Stack spacing={0.5}>
                                <Typography variant="subtitle1">
                                    {getPanelCommentStageLabel(activeStage, 'admin')} release
                                </Typography>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Chip
                                        label={releaseMap[activeStage]?.sent ? 'Released to students' : 'Hidden from students'}
                                        color={releaseMap[activeStage]?.sent ? 'success' : 'default'}
                                    />
                                    {!canRelease && !releaseMap[activeStage]?.sent && (
                                        <Typography variant="body2" color="text.secondary">
                                            Waiting for chapter approvals.
                                        </Typography>
                                    )}
                                </Stack>
                            </Stack>
                            <Button
                                variant={releaseMap[activeStage]?.sent ? 'outlined' : 'contained'}
                                color={releaseMap[activeStage]?.sent ? 'warning' : 'primary'}
                                onClick={handleToggleRelease}
                                disabled={releaseSaving || (!releaseMap[activeStage]?.sent && !canRelease)}
                            >
                                {releaseMap[activeStage]?.sent ? 'Revoke student access' : 'Send to students'}
                            </Button>
                        </Stack>

                        {entriesError && (
                            <Alert severity="error">{entriesError}</Alert>
                        )}

                        <PanelCommentTable
                            entries={entries}
                            variant="admin"
                            loading={entriesLoading || thesisLoading}
                        />
                    </>
                )}
            </Stack>
        </AnimatedPage>
    );
}
