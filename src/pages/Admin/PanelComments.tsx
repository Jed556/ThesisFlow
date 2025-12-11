import * as React from 'react';
import {
    Alert, Autocomplete, Box, Button, Chip, Divider, List, ListItemButton,
    ListItemText, Paper, Skeleton, Stack, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import { Send as SendIcon } from '@mui/icons-material';
import CommentBankIcon from '@mui/icons-material/CommentBank';
import { useSession } from '@toolpad/core';
import type { Session } from '../../types/session';
import type { NavigationItem } from '../../types/navigation';
import type { ThesisGroup } from '../../types/group';
import type { ThesisStageName } from '../../types/thesis';
import type { PanelCommentEntry, PanelCommentReleaseMap, PanelCommentStage } from '../../types/panelComment';
import type { TerminalRequirementSubmissionRecord } from '../../types/terminalRequirementSubmission';
import { AnimatedPage } from '../../components/Animate';
import { PanelCommentTable } from '../../components/PanelComments';
import { useSnackbar } from '../../components/Snackbar';
import { getAllGroups } from '../../utils/firebase/firestore/groups';
import { listenThesisByGroupId, type ThesisRecord } from '../../utils/firebase/firestore/thesis';
import { findAndListenTerminalRequirements } from '../../utils/firebase/firestore/terminalRequirements';
import {
    listenPanelCommentEntries, listenPanelCommentRelease, setPanelCommentTableReleaseState,
    isPanelTableReleased, isPanelTableReadyForReview, type PanelCommentContext
} from '../../utils/firebase/firestore/panelComments';
import { findUsersByIds } from '../../utils/firebase/firestore/user';
import {
    PANEL_COMMENT_STAGE_METADATA, getPanelCommentStageLabel, formatPanelistDisplayName
} from '../../utils/panelCommentUtils';
import { createDefaultPanelCommentReleaseMap } from '../../types/panelComment';
import { DEFAULT_YEAR } from '../../config/firestore';
import { auditAndNotify } from '../../utils/auditNotificationUtils';

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

    // Cascading filters: department > course > group
    const [selectedDepartment, setSelectedDepartment] = React.useState<string>('');
    const [selectedCourse, setSelectedCourse] = React.useState<string>('');
    const [selectedGroupId, setSelectedGroupId] = React.useState<string>('');

    // Derive unique departments from all groups
    const departments = React.useMemo(() => {
        const uniqueDepts = new Set<string>();
        groups.forEach((group) => {
            if (group.department) {
                uniqueDepts.add(group.department);
            }
        });
        return Array.from(uniqueDepts).sort((a, b) => a.localeCompare(b));
    }, [groups]);

    // Derive courses for the selected department
    const courses = React.useMemo(() => {
        if (!selectedDepartment) return [];
        const uniqueCourses = new Set<string>();
        groups
            .filter((group) => group.department === selectedDepartment)
            .forEach((group) => {
                if (group.course) {
                    uniqueCourses.add(group.course);
                }
            });
        return Array.from(uniqueCourses).sort((a, b) => a.localeCompare(b));
    }, [groups, selectedDepartment]);

    // Filter groups by selected department and course
    const filteredGroups = React.useMemo(() => {
        return groups.filter((group) => {
            if (selectedDepartment && group.department !== selectedDepartment) return false;
            if (selectedCourse && group.course !== selectedCourse) return false;
            return true;
        });
    }, [groups, selectedDepartment, selectedCourse]);

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
    /** Terminal requirement submission records by stage for unlock logic */
    const [terminalSubmissionsByStage, setTerminalSubmissionsByStage] = React.useState<
        Partial<Record<ThesisStageName, TerminalRequirementSubmissionRecord[]>>
    >({});

    React.useEffect(() => {
        let cancelled = false;
        setGroupsLoading(true);
        void getAllGroups()
            .then((result) => {
                if (cancelled) return;
                setGroups(result);
                setGroupsLoading(false);
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

    // Auto-select first department when groups load
    React.useEffect(() => {
        if (departments.length > 0 && !selectedDepartment) {
            setSelectedDepartment(departments[0]);
        }
    }, [departments, selectedDepartment]);

    // Reset course and group when department changes
    React.useEffect(() => {
        setSelectedCourse('');
        setSelectedGroupId('');
    }, [selectedDepartment]);

    // Auto-select first course when courses change
    React.useEffect(() => {
        if (courses.length > 0 && !selectedCourse) {
            setSelectedCourse(courses[0]);
        }
    }, [courses, selectedCourse]);

    // Reset group when course changes
    React.useEffect(() => {
        setSelectedGroupId('');
    }, [selectedCourse]);

    // Auto-select first group when filtered groups change
    React.useEffect(() => {
        if (filteredGroups.length > 0 && !selectedGroupId) {
            setSelectedGroupId(filteredGroups[0].id);
        }
    }, [filteredGroups, selectedGroupId]);

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

    // Listen for terminal requirement submissions to determine release eligibility
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

    /**
     * Build a map of terminal requirement approval status for each unlock stage.
     * A stage is considered ready when ALL terminal requirements for that stage are approved.
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

    const activeStageMeta = React.useMemo(
        () => PANEL_COMMENT_STAGE_METADATA.find((meta) => meta.id === activeStage),
        [activeStage]
    );
    const activePanelist = React.useMemo(
        () => panelists.find((panel) => panel.uid === activePanelUid) ?? null,
        [panelists, activePanelUid]
    );
    /** Admin can release when terminal requirements for the unlock stage are approved */
    const canRelease = activeStageMeta
        ? (terminalApprovalMap[activeStageMeta.terminalUnlockStage] ?? false)
        : false;

    /** Check if the active panelist's table is released */
    const isActivePanelTableReleased = React.useMemo(() => {
        if (!activePanelUid) return false;
        return isPanelTableReleased(releaseMap, activeStage, activePanelUid);
    }, [releaseMap, activeStage, activePanelUid]);

    const handleStageChange = React.useCallback((_: React.SyntheticEvent, value: PanelCommentStage) => {
        setActiveStage(value);
    }, []);

    const handlePanelTabChange = React.useCallback((_: React.SyntheticEvent, value: string) => {
        setActivePanelUid(value);
    }, []);

    const handleSelectDepartment = (_: unknown, value: string | null) => {
        setSelectedDepartment(value ?? '');
    };

    const handleSelectCourse = (_: unknown, value: string | null) => {
        setSelectedCourse(value ?? '');
    };

    const handleSelectGroup = (_: unknown, value: ThesisGroup | null) => {
        setSelectedGroupId(value?.id ?? '');
    };

    /** Release a specific panelist's table to students */
    const handleReleaseTable = React.useCallback(async (panelUid: string) => {
        if (!panelCommentCtx || !userUid) {
            showNotification('Select a group first.', 'error');
            return;
        }
        if (!canRelease) {
            const stageName = activeStageMeta?.releaseStageLabel ?? 'stage';
            showNotification(`Terminal requirements for ${stageName} must be approved first.`, 'warning');
            return;
        }
        setReleaseSaving(true);
        try {
            await setPanelCommentTableReleaseState(panelCommentCtx, activeStage, panelUid, true, userUid);
            const panelistName = panelists.find(p => p.uid === panelUid)?.label ?? 'Panel member';

            // Create audit notification for panel comment release
            if (selectedGroup) {
                try {
                    const stageLabel = getPanelCommentStageLabel(activeStage);
                    await auditAndNotify({
                        group: selectedGroup,
                        userId: userUid,
                        name: 'Panel Comments Released',
                        description: `Panel comments for ${stageLabel} stage from ${panelistName} have been released to students.`,
                        category: 'panel',
                        action: 'panel_comment_released',
                        targets: {
                            groupMembers: true,
                            leader: true,
                            excludeUserId: userUid,
                        },
                        details: { stage: activeStage, panelUid, panelistName },
                        sendEmail: true,
                    });
                } catch (auditError) {
                    console.error('Failed to create audit notification:', auditError);
                }
            }

            showNotification(`${panelistName}'s comments sent to students.`, 'success');
        } catch (error) {
            console.error('Failed to release panel table:', error);
            showNotification('Unable to release comments right now.', 'error');
        } finally {
            setReleaseSaving(false);
        }
    }, [panelCommentCtx, userUid, activeStage, canRelease, activeStageMeta, panelists, selectedGroup, showNotification]);

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

                {/* Cascading filters: Department > Course > Group */}
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                    <Autocomplete
                        options={departments}
                        value={selectedDepartment || null}
                        onChange={handleSelectDepartment}
                        loading={groupsLoading}
                        sx={{ flex: 1 }}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Department"
                                placeholder={groupsLoading ? 'Loading…' : 'Select department'}
                            />
                        )}
                    />
                    <Autocomplete
                        options={courses}
                        value={selectedCourse || null}
                        onChange={handleSelectCourse}
                        disabled={!selectedDepartment}
                        sx={{ flex: 1 }}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Course"
                                placeholder={!selectedDepartment ? 'Select department first' : 'Select course'}
                            />
                        )}
                    />
                    <Autocomplete
                        options={filteredGroups}
                        value={selectedGroup}
                        onChange={handleSelectGroup}
                        disabled={!selectedCourse}
                        getOptionLabel={(option) => option.name || option.id}
                        sx={{ flex: 1 }}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Group"
                                placeholder={!selectedCourse ? 'Select course first' : 'Select group'}
                            />
                        )}
                    />
                </Stack>

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

                        {!canRelease && (
                            <Alert severity="warning">
                                Waiting for {activeStageMeta?.releaseStageLabel ?? 'stage'} terminal requirements approval
                                before tables can be released to students.
                            </Alert>
                        )}

                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                            {/* Table Rail - Left sidebar with panelist tables */}
                            <Paper variant="outlined" sx={{ minWidth: 280, maxWidth: 320, flexShrink: 0 }}>
                                <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                                    <Typography variant="subtitle2" color="text.secondary">
                                        Panel Member Tables
                                    </Typography>
                                </Box>
                                {panelistsLoading ? (
                                    <Stack spacing={1} sx={{ p: 2 }}>
                                        <Skeleton variant="rectangular" height={48} />
                                        <Skeleton variant="rectangular" height={48} />
                                    </Stack>
                                ) : panelistsError ? (
                                    <Alert severity="error" sx={{ m: 2 }}>{panelistsError}</Alert>
                                ) : panelists.length === 0 ? (
                                    <Alert severity="info" sx={{ m: 2 }}>
                                        Assign panel members to this group to manage their sheets.
                                    </Alert>
                                ) : (
                                    <List disablePadding>
                                        {panelists.map((panel) => {
                                            const isReleased = isPanelTableReleased(releaseMap, activeStage, panel.uid);
                                            const isReady = isPanelTableReadyForReview(releaseMap, activeStage, panel.uid);
                                            const isSelected = activePanelUid === panel.uid;
                                            return (
                                                <React.Fragment key={panel.uid}>
                                                    <ListItemButton
                                                        selected={isSelected}
                                                        onClick={() => setActivePanelUid(panel.uid)}
                                                        sx={{ py: 1.5 }}
                                                    >
                                                        <ListItemText
                                                            primary={panel.label}
                                                            secondary={
                                                                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                                                                    <Chip
                                                                        size="small"
                                                                        label={isReleased ? 'Released' : isReady ? 'Ready' : 'Not released'}
                                                                        color={isReleased ? 'success' : isReady ? 'warning' : 'default'}
                                                                    />
                                                                    {!isReleased && canRelease && (
                                                                        <Button
                                                                            size="small"
                                                                            variant="outlined"
                                                                            startIcon={<SendIcon />}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                void handleReleaseTable(panel.uid);
                                                                            }}
                                                                            disabled={releaseSaving}
                                                                        >
                                                                            Send
                                                                        </Button>
                                                                    )}
                                                                </Stack>
                                                            }
                                                        />
                                                    </ListItemButton>
                                                    <Divider />
                                                </React.Fragment>
                                            );
                                        })}
                                    </List>
                                )}
                            </Paper>

                            {/* Main content - Selected table entries */}
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                {activePanelUid ? (
                                    <>
                                        {entriesError && (
                                            <Alert severity="error" sx={{ mb: 2 }}>{entriesError}</Alert>
                                        )}

                                        <PanelCommentTable
                                            title={`${activePanelist?.label ?? 'Panel member'} · ${getPanelCommentStageLabel(activeStage, 'admin')}`}
                                            entries={entries}
                                            variant="admin"
                                            loading={entriesLoading || thesisLoading || panelistsLoading}
                                            released={isActivePanelTableReleased}
                                        />
                                    </>
                                ) : (
                                    <Alert severity="info">
                                        Select a panel member from the list to view their comment sheet.
                                    </Alert>
                                )}
                            </Box>
                        </Stack>
                    </>
                )}
            </Stack>
        </AnimatedPage>
    );
}
