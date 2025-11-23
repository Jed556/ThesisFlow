import * as React from 'react';
import {
    Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions,
    DialogContent, DialogContentText, DialogTitle, Skeleton, Stack, Typography
} from '@mui/material';
import TopicIcon from '@mui/icons-material/Topic';
import { useSession } from '@toolpad/core';
import type { NavigationItem } from '../../types/navigation';
import type { Session } from '../../types/session';
import type { ThesisGroup } from '../../types/group';
import type { TopicProposalEntry, TopicProposalSetRecord } from '../../types/topicProposal';
import type { UserProfile } from '../../types/profile';
import { AnimatedPage } from '../../components/Animate';
import { TopicProposalEntryCard, TopicProposalFormDialog, type TopicProposalFormValues } from '../../components/TopicProposals';
import UnauthorizedNotice from '../../layouts/UnauthorizedNotice';
import { useSnackbar } from '../../contexts/SnackbarContext';
import {
    createTopicProposalSet, listenTopicProposalSetsByGroup, markProposalAsThesis,
    submitTopicProposalSet, updateTopicProposalDraftEntries,
} from '../../utils/firebase/firestore/topicProposals';
import { getGroupsByLeader, getGroupsByMember } from '../../utils/firebase/firestore/groups';
import { getUsersByIds } from '../../utils/firebase/firestore/user';
import { areAllProposalsRejected, canEditProposalSet, pickActiveProposalSet } from '../../utils/topicProposalUtils';
import { MAX_TOPIC_PROPOSALS } from '../../config/proposals';

export const metadata: NavigationItem = {
    group: 'thesis',
    index: 2,
    title: 'Topic Proposals',
    segment: 'topic-proposals',
    icon: <TopicIcon />,
    roles: ['student'],
};

function pickPrimaryGroup(groups: ThesisGroup[]): ThesisGroup | null {
    if (groups.length === 0) {
        return null;
    }

    const priority = ['active', 'review', 'draft'];
    const sorted = [...groups].sort((a, b) => {
        const aScore = priority.indexOf(a.status);
        const bScore = priority.indexOf(b.status);
        if (aScore === -1 && bScore === -1) {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        if (aScore === -1) {
            return 1;
        }
        if (bScore === -1) {
            return -1;
        }
        return aScore - bScore;
    });

    return sorted[0];
}

function buildEmptyFormValues(): TopicProposalFormValues {
    return {
        title: '',
        abstract: '',
        problemStatement: '',
        expectedOutcome: '',
        keywords: [],
    };
}

function createEntryId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).slice(2);
}

/**
 * Student-facing topic proposal workspace for drafting, submitting, and tracking proposal cycles.
 */
export default function StudentTopicProposalsPage() {
    const session = useSession<Session>();
    const userUid = session?.user?.uid;
    const { showNotification } = useSnackbar();

    const [group, setGroup] = React.useState<ThesisGroup | null>(null);
    const [groupError, setGroupError] = React.useState<string | null>(null);
    const [groupLoading, setGroupLoading] = React.useState(true);
    const [memberProfiles, setMemberProfiles] = React.useState<Map<string, UserProfile>>(new Map());

    const [proposalSets, setProposalSets] = React.useState<TopicProposalSetRecord[]>([]);
    const [proposalError, setProposalError] = React.useState<string | null>(null);
    const [proposalLoading, setProposalLoading] = React.useState(false);

    const [formOpen, setFormOpen] = React.useState(false);
    const [formMode, setFormMode] = React.useState<'create' | 'edit'>('create');
    const [formValues, setFormValues] = React.useState<TopicProposalFormValues>(buildEmptyFormValues());
    const [editingEntryId, setEditingEntryId] = React.useState<string | null>(null);
    const [formSaving, setFormSaving] = React.useState(false);

    const [submissionLoading, setSubmissionLoading] = React.useState(false);
    const [createSetLoading, setCreateSetLoading] = React.useState(false);
    const [deleteDialog, setDeleteDialog] = React.useState<TopicProposalEntry | null>(null);
    const [useTopicDialog, setUseTopicDialog] = React.useState<TopicProposalEntry | null>(null);
    const [useTopicLoading, setUseTopicLoading] = React.useState(false);

    React.useEffect(() => {
        if (!userUid) {
            setGroup(null);
            setGroupLoading(false);
            return;
        }

        let cancelled = false;

        const loadGroup = async () => {
            setGroupLoading(true);
            setGroupError(null);
            try {
                const [leaderGroups, memberGroups] = await Promise.all([
                    getGroupsByLeader(userUid),
                    getGroupsByMember(userUid),
                ]);
                if (cancelled) {
                    return;
                }
                const combined = [...leaderGroups, ...memberGroups];
                const unique = Array.from(new Map(combined.map((item) => [item.id, item])).values());
                setGroup(pickPrimaryGroup(unique));
            } catch (error) {
                console.error('Failed to load student groups:', error);
                if (!cancelled) {
                    setGroupError('Unable to load your thesis group.');
                }
            } finally {
                if (!cancelled) {
                    setGroupLoading(false);
                }
            }
        };

        void loadGroup();

        return () => {
            cancelled = true;
        };
    }, [userUid]);

    React.useEffect(() => {
        if (!group?.id) {
            setMemberProfiles(new Map());
            return;
        }

        const memberIds = new Set<string>();
        memberIds.add(group.members.leader);
        group.members.members.forEach((uid) => uid && memberIds.add(uid));
        if (group.members.adviser) {
            memberIds.add(group.members.adviser);
        }
        if (group.members.editor) {
            memberIds.add(group.members.editor);
        }

        void (async () => {
            try {
                const profiles = await getUsersByIds(Array.from(memberIds));
                const profileMap = new Map<string, UserProfile>();
                profiles.forEach((profile) => {
                    profileMap.set(profile.uid, profile);
                });
                setMemberProfiles(profileMap);
            } catch (error) {
                console.error('Failed to load group member profiles:', error);
            }
        })();
    }, [group]);

    React.useEffect(() => {
        if (!group?.id) {
            setProposalSets([]);
            setProposalLoading(false);
            return;
        }

        setProposalLoading(true);
        const unsubscribe = listenTopicProposalSetsByGroup(group.id, {
            onData: (records) => {
                setProposalSets(records);
                setProposalError(null);
                setProposalLoading(false);
            },
            onError: (error) => {
                console.error('Failed to listen to topic proposals:', error);
                setProposalSets([]);
                setProposalError('Unable to load topic proposals right now.');
                setProposalLoading(false);
            },
        });

        return () => {
            unsubscribe();
        };
    }, [group?.id]);

    const activeSet = React.useMemo(() => pickActiveProposalSet(proposalSets), [proposalSets]);
    const isLeader = group?.members.leader === userUid;
    const editable = canEditProposalSet(activeSet) && isLeader;
    const canStartNewSet = React.useMemo(() => {
        if (!isLeader || !activeSet) {
            return false;
        }
        return areAllProposalsRejected(activeSet.entries) && !activeSet.awaitingHead && !activeSet.awaitingModerator;
    }, [activeSet, isLeader]);

    const historySets = React.useMemo(
        () => proposalSets.filter((set) => set.id !== activeSet?.id),
        [proposalSets, activeSet?.id]
    );

    const handleOpenForm = (entry?: TopicProposalEntry) => {
        if (!activeSet) {
            return;
        }
        if (entry) {
            setFormMode('edit');
            setEditingEntryId(entry.id);
            setFormValues({
                title: entry.title,
                abstract: entry.abstract,
                problemStatement: entry.problemStatement ?? '',
                expectedOutcome: entry.expectedOutcome ?? '',
                keywords: entry.keywords ?? [],
            });
        } else {
            setFormMode('create');
            setEditingEntryId(null);
            setFormValues(buildEmptyFormValues());
        }
        setFormOpen(true);
    };

    const handleSaveEntry = async (values: TopicProposalFormValues) => {
        if (!activeSet || !userUid) {
            return;
        }
        setFormSaving(true);
        try {
            const now = new Date().toISOString();
            const entryId = editingEntryId ?? createEntryId();
            const nextEntries = editingEntryId
                ? activeSet.entries.map((entry) =>
                    entry.id === entryId
                        ? {
                            ...entry,
                            title: values.title,
                            abstract: values.abstract,
                            problemStatement: values.problemStatement,
                            expectedOutcome: values.expectedOutcome,
                            keywords: values.keywords,
                            updatedAt: now,
                        }
                        : entry,
                )
                : [
                    ...activeSet.entries,
                    {
                        id: entryId,
                        title: values.title,
                        abstract: values.abstract,
                        problemStatement: values.problemStatement,
                        expectedOutcome: values.expectedOutcome,
                        keywords: values.keywords,
                        proposedBy: userUid,
                        createdAt: now,
                        updatedAt: now,
                        status: 'draft',
                    } satisfies TopicProposalEntry,
                ];
            await updateTopicProposalDraftEntries(activeSet.id, nextEntries);
            showNotification('Draft saved', 'success');
            setFormOpen(false);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to save draft';
            showNotification(message, 'error');
        } finally {
            setFormSaving(false);
        }
    };

    const handleDeleteEntry = async () => {
        if (!activeSet || !deleteDialog) {
            return;
        }
        try {
            const remaining = activeSet.entries.filter((entry) => entry.id !== deleteDialog.id);
            await updateTopicProposalDraftEntries(activeSet.id, remaining);
            showNotification('Proposal removed from draft', 'success');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to remove proposal';
            showNotification(message, 'error');
        } finally {
            setDeleteDialog(null);
        }
    };

    const handleSubmitSet = async () => {
        if (!activeSet || !userUid) {
            return;
        }
        setSubmissionLoading(true);
        try {
            await submitTopicProposalSet({ setId: activeSet.id, submittedBy: userUid });
            showNotification('Topic proposals submitted for review', 'success');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to submit proposals';
            showNotification(message, 'error');
        } finally {
            setSubmissionLoading(false);
        }
    };

    const handleCreateSet = async () => {
        if (!group?.id || !userUid) {
            return;
        }
        setCreateSetLoading(true);
        try {
            const nextCycle = proposalSets.reduce((acc, set) => Math.max(acc, set.cycle), 0) + 1;
            await createTopicProposalSet({ groupId: group.id, createdBy: userUid, cycle: nextCycle });
            showNotification('New topic proposal cycle started', 'success');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to start proposal cycle';
            showNotification(message, 'error');
        } finally {
            setCreateSetLoading(false);
        }
    };

    const handleUseTopic = async () => {
        if (!group || !activeSet || !useTopicDialog || !userUid) {
            return;
        }
        setUseTopicLoading(true);
        try {
            await markProposalAsThesis({
                setId: activeSet.id,
                proposalId: useTopicDialog.id,
                groupId: group.id,
                requestedBy: userUid,
            });
            showNotification('Topic ready to be used as thesis title', 'success');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to mark topic as thesis';
            showNotification(message, 'error');
        } finally {
            setUseTopicLoading(false);
            setUseTopicDialog(null);
        }
    };

    if (!session?.user && session?.loading) {
        return (
            <AnimatedPage variant="slideUp">
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240 }}>
                    <CircularProgress />
                </Box>
            </AnimatedPage>
        );
    }

    if (!userUid) {
        return (
            <AnimatedPage variant="slideUp">
                <Alert severity="info">Sign in to manage topic proposals.</Alert>
            </AnimatedPage>
        );
    }

    if (groupLoading) {
        return (
            <AnimatedPage variant="slideUp">
                <Stack spacing={2}>
                    <Skeleton variant="text" height={48} width="60%" />
                    <Skeleton variant="rectangular" height={160} />
                </Stack>
            </AnimatedPage>
        );
    }

    if (!group) {
        return (
            <AnimatedPage variant="fade">
                <UnauthorizedNotice
                    variant='box'
                    title="Topic proposals locked"
                    description="Create or join a thesis group first. Topic proposals are only available to active groups that have been submitted to the Research Moderator."
                />
            </AnimatedPage>
        );
    }

    const adviserAssigned = Boolean(group.members.adviser);
    const editorAssigned = Boolean(group.members.editor);

    if (!adviserAssigned || !editorAssigned) {
        return (
            <AnimatedPage variant="fade">
                <UnauthorizedNotice
                    variant='box'
                    title="Complete adviser & editor selection"
                    description="Assign both a thesis adviser and research editor before submitting topic proposals."
                />
            </AnimatedPage>
        );
    }

    if (groupError) {
        return (
            <AnimatedPage variant="slideUp">
                <Alert severity="error">{groupError}</Alert>
            </AnimatedPage>
        );
    }

    return (
        <AnimatedPage variant="slideUp">
            <Stack spacing={3}>
                <Box>
                    <Typography variant="body1" color="text.secondary">
                        Draft up to {MAX_TOPIC_PROPOSALS} topics, collaborate with your group, and submit them for
                        moderator and head review.
                    </Typography>
                </Box>

                {!isLeader && (
                    <Alert severity="info">
                        Only the group leader can edit or submit topic proposals. You can still monitor the review status here.
                    </Alert>
                )}

                {proposalError && (
                    <Alert severity="error">{proposalError}</Alert>
                )}

                {canStartNewSet && (
                    <Alert severity="warning" action={
                        <Button onClick={handleCreateSet} disabled={createSetLoading} color="inherit" size="small">
                            Start new set
                        </Button>
                    }>
                        All proposals in your current cycle were rejected. You can submit a fresh set of ideas.
                    </Alert>
                )}

                {(!activeSet || proposalLoading) ? (
                    <Card>
                        <CardContent>
                            {proposalLoading ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                                    <CircularProgress size={32} />
                                </Box>
                            ) : (
                                <Stack spacing={2} alignItems="flex-start">
                                    <Typography variant="h6">No topic proposals yet</Typography>
                                    {isLeader && (
                                        <Button variant="contained" onClick={handleCreateSet} disabled={createSetLoading}>
                                            Start proposal cycle
                                        </Button>
                                    )}
                                </Stack>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    <Card>
                        <CardContent>
                            <Stack
                                spacing={1}
                                direction={{ xs: 'column', sm: 'row' }}
                                justifyContent="space-between"
                                alignItems={{ xs: 'flex-start', sm: 'center' }}
                            >
                                <Box>
                                    <Typography variant="h6">Cycle #{activeSet.cycle}</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {activeSet.status === 'draft' && 'Draft in progress'}
                                        {activeSet.status === 'under_review' && 'Under review'}
                                        {activeSet.status === 'approved' && 'Topic approved'}
                                        {activeSet.status === 'rejected' && 'All topics rejected'}
                                    </Typography>
                                </Box>
                                <Stack direction="row" spacing={1}>
                                    <Chip
                                        label={activeSet.status.replace('_', ' ')}
                                        color={activeSet.status === 'approved'
                                            ? 'success'
                                            : activeSet.status === 'rejected'
                                                ? 'error'
                                                : 'default'}
                                    />
                                    {activeSet.awaitingModerator && <Chip label="For Moderator" color="info" />}
                                    {activeSet.awaitingHead && <Chip label="For Head" color="warning" />}
                                    {activeSet.lockedEntryId && <Chip label="In Use" color="success" variant="outlined" />}
                                </Stack>
                            </Stack>

                            {editable && (
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 3 }}>
                                    <Button
                                        variant="contained"
                                        disabled={activeSet.entries.length >= MAX_TOPIC_PROPOSALS}
                                        onClick={() => handleOpenForm()}
                                    >
                                        Add proposal ({activeSet.entries.length}/{MAX_TOPIC_PROPOSALS})
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        color="success"
                                        disabled={activeSet.entries.length === 0 || submissionLoading}
                                        onClick={handleSubmitSet}
                                    >
                                        Submit for review
                                    </Button>
                                </Stack>
                            )}
                        </CardContent>
                    </Card>
                )}

                {activeSet && activeSet.entries.length > 0 && (
                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} useFlexGap flexWrap="wrap">
                        {activeSet.entries.map((entry) => {
                            const author = memberProfiles.get(entry.proposedBy);
                            const entryActions: React.ReactNode[] = [];
                            if (editable) {
                                entryActions.push(
                                    <Button key="edit" size="small" onClick={() => handleOpenForm(entry)}>
                                        Edit
                                    </Button>,
                                    <Button key="remove" size="small" color="error" onClick={() => setDeleteDialog(entry)}>
                                        Remove
                                    </Button>,
                                );
                            }

                            if (entry.status === 'head_approved') {
                                entryActions.push(
                                    <Button
                                        key="use-topic"
                                        variant="contained"
                                        color="success"
                                        size="small"
                                        disabled={Boolean(activeSet.lockedEntryId) && activeSet.lockedEntryId !== entry.id}
                                        onClick={() => setUseTopicDialog(entry)}
                                    >
                                        {activeSet.lockedEntryId === entry.id ? 'In use' : 'Use this topic'}
                                    </Button>
                                );
                            }

                            const footer = entry.moderatorDecision || entry.headDecision ? (
                                <Stack spacing={1}>
                                    {entry.moderatorDecision && (
                                        <Typography variant="caption" color="text.secondary">
                                            Moderator: {entry.moderatorDecision.decision}
                                            {entry.moderatorDecision.notes ? ` – ${entry.moderatorDecision.notes}` : ''}
                                        </Typography>
                                    )}
                                    {entry.headDecision && (
                                        <Typography variant="caption" color="text.secondary">
                                            Head: {entry.headDecision.decision}
                                            {entry.headDecision.notes ? ` – ${entry.headDecision.notes}` : ''}
                                        </Typography>
                                    )}
                                </Stack>
                            ) : undefined;

                            return (
                                <Box key={entry.id} sx={{ flex: '1 1 320px', minWidth: 280 }}>
                                    <TopicProposalEntryCard
                                        entry={entry}
                                        author={author}
                                        highlight={entry.status === 'head_approved'}
                                        actions={entryActions.length > 0 ? entryActions : undefined}
                                        footer={footer}
                                    />
                                </Box>
                            );
                        })}
                    </Stack>
                )}

                {historySets.length > 0 && (
                    <Stack spacing={2}>
                        <Typography variant="h6">Previous submission cycles</Typography>
                        {historySets.map((set) => (
                            <Card key={set.id} variant="outlined">
                                <CardContent>
                                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                                        <Box>
                                            <Typography variant="subtitle1">Cycle #{set.cycle}</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {set.entries.length} topic(s) • {set.status.replace('_', ' ')}
                                            </Typography>
                                        </Box>
                                        <Stack direction="row" spacing={1}>
                                            <Chip label={set.status.replace('_', ' ')} size="small" />
                                            {set.awaitingModerator && <Chip label="Moderator" color="info" size="small" />}
                                            {set.awaitingHead && <Chip label="Head" color="warning" size="small" />}
                                        </Stack>
                                    </Stack>
                                </CardContent>
                            </Card>
                        ))}
                    </Stack>
                )}
            </Stack>

            <TopicProposalFormDialog
                open={formOpen}
                mode={formMode}
                initialValues={formValues}
                loading={formSaving}
                onClose={() => setFormOpen(false)}
                onSubmit={(values) => handleSaveEntry(values)}
            />

            <Dialog open={Boolean(deleteDialog)} onClose={() => setDeleteDialog(null)}>
                <DialogTitle>Remove topic proposal</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        This will remove “{deleteDialog?.title}” from your draft set. You can add it again later.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialog(null)} color="inherit">Cancel</Button>
                    <Button onClick={handleDeleteEntry} color="error">Remove</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={Boolean(useTopicDialog)} onClose={() => setUseTopicDialog(null)}>
                <DialogTitle>Use this topic as your thesis</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Confirm using “{useTopicDialog?.title}” as your official thesis title. This action will pin the
                        topic and update your group record.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setUseTopicDialog(null)} color="inherit" disabled={useTopicLoading}>
                        Cancel
                    </Button>
                    <Button onClick={handleUseTopic} color="success" disabled={useTopicLoading}>
                        Confirm
                    </Button>
                </DialogActions>
            </Dialog>
        </AnimatedPage>
    );
}
