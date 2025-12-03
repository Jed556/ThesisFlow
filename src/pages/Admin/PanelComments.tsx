import * as React from 'react';
import {
    Alert, Autocomplete, Box, Button, Chip, Skeleton, Stack,
    Tab, Tabs, TextField, Typography,
} from '@mui/material';
import CommentBankIcon from '@mui/icons-material/CommentBank';
import { useSession } from '@toolpad/core';
import type { Session } from '../../types/session';
import type { NavigationItem } from '../../types/navigation';
import type { ThesisGroup } from '../../types/group';
import type { ThesisChapter } from '../../types/thesis';
import type { PanelCommentEntry, PanelCommentReleaseMap, PanelCommentStage } from '../../types/panelComment';
import { AnimatedPage } from '../../components/Animate';
import { PanelCommentTable } from '../../components/PanelComments';
import { useSnackbar } from '../../components/Snackbar';
import { getAllGroups } from '../../utils/firebase/firestore/groups';
import { listenThesisByGroupId, type ThesisRecord } from '../../utils/firebase/firestore/thesis';
import { listenAllChaptersForThesis, type ThesisChaptersContext } from '../../utils/firebase/firestore/chapters';
import {
    listenPanelCommentEntries,
    listenPanelCommentRelease,
    setPanelCommentReleaseState,
    type PanelCommentContext,
} from '../../utils/firebase/firestore/panelComments';
import { findUsersByIds } from '../../utils/firebase/firestore/user';
import { buildStageCompletionMap } from '../../utils/thesisStageUtils';
import {
    PANEL_COMMENT_STAGE_METADATA,
    getPanelCommentStageLabel,
    formatPanelistDisplayName,
} from '../../utils/panelCommentUtils';
import { createDefaultPanelCommentReleaseMap } from '../../types/panelComment';
import { DEFAULT_YEAR } from '../../config/firestore';

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

    const [thesis, setThesis] = React.useState<ThesisRecord | null>(null);
    const [thesisLoading, setThesisLoading] = React.useState(false);
    const [releaseMap, setReleaseMap] = React.useState<PanelCommentReleaseMap>(createDefaultPanelCommentReleaseMap());
    const [entries, setEntries] = React.useState<PanelCommentEntry[]>([]);
    const [entriesLoading, setEntriesLoading] = React.useState(false);
    const [entriesError, setEntriesError] = React.useState<string | null>(null);
    const [activeStage, setActiveStage] = React.useState<PanelCommentStage>('proposal');
    const [releaseSaving, setReleaseSaving] = React.useState(false);
    const [panelists, setPanelists] = React.useState<{ uid: string; label: string }[]>([]);
    const [panelistsLoading, setPanelistsLoading] = React.useState(false);
    const [panelistsError, setPanelistsError] = React.useState<string | null>(null);
    const [activePanelUid, setActivePanelUid] = React.useState<string | null>(null);
    /** Chapters fetched from subcollection (new hierarchical structure) */
    const [chapters, setChapters] = React.useState<ThesisChapter[]>([]);

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
        const unsubscribe = listenThesisByGroupId(selectedGroupId, {
            onData: (records: ThesisRecord[]) => {
                setThesis(records[0] ?? null);
                setThesisLoading(false);
            },
            onError: (error: Error) => {
                console.error('Failed to load thesis for admin panel page:', error);
                setThesis(null);
                setThesisLoading(false);
            },
        });
        return () => unsubscribe();
    }, [selectedGroupId]);

    // Fetch chapters from subcollection (new hierarchical structure)
    React.useEffect(() => {
        if (!thesis?.id || !selectedGroup?.id || !selectedGroup?.department || !selectedGroup?.course) {
            setChapters([]);
            return;
        }

        const chaptersCtx: ThesisChaptersContext = {
            year: selectedGroup.year ?? DEFAULT_YEAR,
            department: selectedGroup.department,
            course: selectedGroup.course,
            groupId: selectedGroup.id,
            thesisId: thesis.id,
        };

        const unsubscribe = listenAllChaptersForThesis(chaptersCtx, {
            onData: (allChapters) => {
                setChapters(allChapters);
            },
            onError: (listenerError) => {
                console.error('Failed to load chapters:', listenerError);
                setChapters([]);
            },
        });

        return () => {
            unsubscribe();
        };
    }, [thesis?.id, selectedGroup?.id, selectedGroup?.department, selectedGroup?.course, selectedGroup?.year]);

    React.useEffect(() => {
        if (!panelCommentCtx) {
            setReleaseMap(createDefaultPanelCommentReleaseMap());
            return;
        }
        const unsubscribe = listenPanelCommentRelease(panelCommentCtx, {
            onData: (next) => setReleaseMap(next),
            onError: (error) => console.error('Panel release listener error (admin view):', error),
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
                console.error('Failed to load panel comments for admin view:', error);
                setEntries([]);
                setEntriesLoading(false);
                setEntriesError('Unable to load comments for this stage.');
            },
        }, activePanelUid);
        return () => unsubscribe();
    }, [panelCommentCtx, activeStage, activePanelUid]);

    React.useEffect(() => {
        let isMounted = true;
        async function loadPanelists() {
            if (!selectedGroup) {
                if (isMounted) {
                    setPanelists([]);
                    setActivePanelUid(null);
                    setPanelistsError(null);
                    setPanelistsLoading(false);
                }
                return;
            }

            const panelUids = selectedGroup.members?.panels ?? [];
            if (panelUids.length === 0) {
                if (isMounted) {
                    setPanelists([]);
                    setActivePanelUid(null);
                    setPanelistsError(null);
                    setPanelistsLoading(false);
                }
                return;
            }

            setPanelistsLoading(true);
            setPanelistsError(null);
            try {
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
                setActivePanelUid((prev) => {
                    if (prev && panelUids.includes(prev)) {
                        return prev;
                    }
                    return options[0]?.uid ?? null;
                });
            } catch (error) {
                console.error('Failed to fetch panel members for admin panel comments:', error);
                if (isMounted) {
                    setPanelists([]);
                    setActivePanelUid(null);
                    setPanelistsError('Unable to load panel member list.');
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
    }, [selectedGroup]);

    const stageCompletionMap = React.useMemo(() => (
        buildStageCompletionMap(chapters, { treatEmptyAsComplete: false })
    ), [chapters]);

    const activeStageMeta = React.useMemo(
        () => PANEL_COMMENT_STAGE_METADATA.find((meta) => meta.id === activeStage),
        [activeStage]
    );
    const activePanelist = React.useMemo(
        () => panelists.find((panel) => panel.uid === activePanelUid) ?? null,
        [panelists, activePanelUid]
    );
    const canRelease = activeStageMeta ? (stageCompletionMap[activeStageMeta.unlockStage] ?? false) : false;

    const handleStageChange = React.useCallback((_: React.SyntheticEvent, value: PanelCommentStage) => {
        setActiveStage(value);
    }, []);

    const handlePanelTabChange = React.useCallback((_: React.SyntheticEvent, value: string) => {
        setActivePanelUid(value);
    }, []);

    const handleSelectGroup = (_: unknown, value: ThesisGroup | null) => {
        setSelectedGroupId(value?.id ?? '');
    };

    const handleToggleRelease = React.useCallback(async () => {
        if (!panelCommentCtx || !userUid) {
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
            await setPanelCommentReleaseState(panelCommentCtx, activeStage, !currentState, userUid);
            showNotification(!currentState ? 'Comments sent to students.' : 'Student access revoked.', 'success');
        } catch (error) {
            console.error('Failed to update panel release state:', error);
            showNotification('Unable to update release state right now.', 'error');
        } finally {
            setReleaseSaving(false);
        }
    }, [panelCommentCtx, userUid, releaseMap, activeStage, canRelease, showNotification]);

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

                        <Stack spacing={1.5}>
                            <Typography variant="subtitle2" color="text.secondary">
                                Panel member sheets
                            </Typography>
                            {panelistsLoading ? (
                                <Skeleton variant="rectangular" height={48} />
                            ) : panelistsError ? (
                                <Alert severity="error">{panelistsError}</Alert>
                            ) : panelists.length === 0 ? (
                                <Alert severity="info">
                                    Assign panel members to this group to review their sheets.
                                </Alert>
                            ) : (
                                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                                    <Tabs
                                        value={activePanelUid ?? panelists[0]?.uid}
                                        onChange={handlePanelTabChange}
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

                        {activePanelUid ? (
                            <>
                                {entriesError && (
                                    <Alert severity="error">{entriesError}</Alert>
                                )}

                                <PanelCommentTable
                                    title=
                                    {`${activePanelist?.label ?? 'Panel member'} · ${getPanelCommentStageLabel(activeStage, 'admin')}`}
                                    entries={entries}
                                    variant="admin"
                                    loading={entriesLoading || thesisLoading || panelistsLoading}
                                />
                            </>
                        ) : (
                            <Alert severity="info">
                                Select a panel member to review their comment sheet.
                            </Alert>
                        )}
                    </>
                )}
            </Stack>
        </AnimatedPage>
    );
}
