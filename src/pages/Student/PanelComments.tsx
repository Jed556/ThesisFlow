import * as React from 'react';
import { Alert, Box, Skeleton, Stack, Tab, Tabs, Typography } from '@mui/material';
import CommentBankIcon from '@mui/icons-material/CommentBank';
import { useSession } from '@toolpad/core';
import type { Session } from '../../types/session';
import type { NavigationItem } from '../../types/navigation';
import type { ThesisData } from '../../types/thesis';
import type { ThesisGroup } from '../../types/group';
import {
    createDefaultPanelCommentReleaseMap, type PanelCommentEntry,
    type PanelCommentReleaseMap, type PanelCommentStage,
} from '../../types/panelComment';
import { AnimatedPage } from '../../components/Animate';
import { PanelCommentTable } from '../../components/PanelComments';
import { UnauthorizedNotice } from '../../layouts/UnauthorizedNotice';
import { useSnackbar } from '../../components/Snackbar';
import {
    listenPanelCommentEntries, listenPanelCommentRelease,
    updatePanelCommentStudentFields, type PanelCommentContext,
} from '../../utils/firebase/firestore/panelComments';
import { findGroupById, getGroupsByLeader, getGroupsByMember } from '../../utils/firebase/firestore/groups';
import { findThesisByGroupId } from '../../utils/firebase/firestore/thesis';
import { findUsersByIds } from '../../utils/firebase/firestore/user';
import { buildStageCompletionMap } from '../../utils/thesisStageUtils';
import {
    PANEL_COMMENT_STAGE_METADATA, canStudentAccessPanelStage, formatPanelistDisplayName, getPanelCommentStageLabel
} from '../../utils/panelCommentUtils';
import { DEFAULT_YEAR } from '../../config/firestore';

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

    const stageCompletionMap = React.useMemo(() => (
        buildStageCompletionMap(thesis?.chapters ?? [], { treatEmptyAsComplete: false })
    ), [thesis?.chapters]);

    const stageAccessible = canStudentAccessPanelStage(activeStage, stageCompletionMap, releaseMap);
    const activePanelist = React.useMemo(
        () => panelists.find((panel) => panel.uid === activePanelUid) ?? null,
        [panelists, activePanelUid]
    );
    const stageMeta = PANEL_COMMENT_STAGE_METADATA.find((item) => item.id === activeStage);
    const lockedDescription = React.useMemo(() => {
        const releaseReady = releaseMap[activeStage]?.sent ?? false;
        if (!releaseReady) {
            if (!stageMeta) {
                return 'Waiting for the admin to release the panel comments.';
            }
            const stageReady = stageCompletionMap[stageMeta.unlockStage] ?? false;
            if (!stageReady) {
                return `Complete all ${stageMeta.unlockStage} chapters`;
            }
            return 'Waiting for the admin to release the panel comments for viewing.';
        }
        return 'Panel comments are not available yet.';
    }, [activeStage, releaseMap, stageCompletionMap, stageMeta]);

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
                        label={stage.studentLabel}
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
        </AnimatedPage>
    );
}
