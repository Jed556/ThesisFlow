import * as React from 'react';
import {
    Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions,
    DialogContent, DialogContentText, DialogTitle, Skeleton, Stack, Typography
} from '@mui/material';
import HistoryEduIcon from '@mui/icons-material/HistoryEdu';
import { useSession } from '@toolpad/core';
import type { NavigationItem } from '../../types/navigation';
import type { Session } from '../../types/session';
import type { ThesisGroup } from '../../types/group';
import type { TopicProposalEntry, TopicProposalSetRecord } from '../../types/proposal';
import type { UserProfile } from '../../types/profile';
import { AnimatedPage } from '../../components/Animate';
import { TopicProposalEntryCard, TopicProposalFormDialog, type TopicProposalFormValues } from '../../components/TopicProposals';
import { ApprovalStatusChip, type ApprovalChipStatus } from '../../components/StatusChip';
import UnauthorizedNotice from '../../layouts/UnauthorizedNotice';
import { useSnackbar } from '../../contexts/SnackbarContext';
import {
    createProposalSetByGroup, listenTopicProposalSetsByGroup, markProposalAsThesisBySetId,
    submitProposalSetBySetId, updateDraftEntriesBySetId,
} from '../../utils/firebase/firestore/topicProposals';
import { getGroupsByLeader, getGroupsByMember } from '../../utils/firebase/firestore/groups';
import { findUsersByIds } from '../../utils/firebase/firestore/user';
import {
    areAllProposalsRejected, canEditProposalSet, getProposalSetMeta, pickActiveProposalSet
} from '../../utils/topicProposalUtils';
import { MAX_TOPIC_PROPOSALS } from '../../config/proposals';
import { auditAndNotify } from '../../utils/auditNotificationUtils';


export const metadata: NavigationItem = {
    group: 'thesis',
    index: 2,
    title: 'Topic Proposals',
    segment: 'topic-proposals',
    icon: <HistoryEduIcon />,
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
        description: '',
        problemStatement: '',
        expectedOutcome: '',
        keywords: [],
    };
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractTopicSequence(groupId: string, entryId: string): number | null {
    const pattern = new RegExp(`^${escapeRegExp(groupId)}-T(\\d+)$`);
    const match = entryId.match(pattern);
    if (!match || match.length < 2) {
        return null;
    }
    const sequence = Number(match[1]);
    return Number.isNaN(sequence) ? null : sequence;
}

function buildTopicEntryId(groupId: string, sequence: number): string {
    return `${groupId}-T${sequence}`;
}

function computeNextTopicSequence(groupId: string | undefined, sets: TopicProposalSetRecord[]): number {
    if (!groupId) {
        return 1;
    }

    let maxSequence = 0;
    sets.forEach((set) => {
        set.entries.forEach((entry) => {
            const sequence = extractTopicSequence(groupId, entry.id);
            if (sequence && sequence > maxSequence) {
                maxSequence = sequence;
            }
        });
    });

    return maxSequence + 1;
}

/**
 * Student-facing topic proposal workspace for drafting, submitting, and tracking proposal batches.
 */
export default function StudentTopicProposalsPage() {
    const session = useSession<Session>();
    const userUid = session?.user?.uid;
    const { showNotification } = useSnackbar();

    const [group, setGroup] = React.useState<ThesisGroup | null>(null);
    const [groupError, setGroupError] = React.useState<string | null>(null);
    const [groupLoading, setGroupLoading] = React.useState(true);
    const [groupReloadToken, setGroupReloadToken] = React.useState(0);
    const [memberProfiles, setMemberProfiles] = React.useState<Map<string, UserProfile>>(new Map());

    const [proposalSets, setProposalSets] = React.useState<TopicProposalSetRecord[]>([]);
    const [proposalError, setProposalError] = React.useState<string | null>(null);
    const [proposalLoading, setProposalLoading] = React.useState(false);
    const [nextTopicSequence, setNextTopicSequence] = React.useState(1);

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
                const primary = pickPrimaryGroup(unique);
                if (cancelled) {
                    return;
                }
                setGroup(primary);
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
    }, [userUid, groupReloadToken]);

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
                const profiles = await findUsersByIds(Array.from(memberIds));
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

    React.useEffect(() => {
        if (!group?.id) {
            setNextTopicSequence(1);
            return;
        }
        setNextTopicSequence(computeNextTopicSequence(group.id, proposalSets));
    }, [group?.id, proposalSets]);

    const activeSet = React.useMemo(() => pickActiveProposalSet(proposalSets), [proposalSets]);
    const isLeader = group?.members.leader === userUid;
    const isMember = Boolean(userUid && (
        group?.members.leader === userUid ||
        group?.members.members.includes(userUid)
    ));
    // Members can add/edit entries in draft mode, but only leader can create batches and submit
    const canEditEntries = canEditProposalSet(activeSet) && isMember;
    const canSubmitSet = canEditProposalSet(activeSet) && isLeader;
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

    // Check if any entry is marked as used for thesis
    const usedThesisEntry = React.useMemo(() => {
        if (!activeSet) return undefined;
        return activeSet.entries.find((entry) => entry.usedAsThesis);
    }, [activeSet]);

    const activeSetMeta = getProposalSetMeta(activeSet);

    const activeSetStatusLabel = activeSetMeta.hasApproved
        ? 'Topic approved'
        : activeSetMeta.allRejected
            ? 'All topics rejected'
            : (activeSetMeta.awaitingModerator || activeSetMeta.awaitingHead)
                ? 'Under review'
                : 'Draft in progress';

    const activeSetChipLabel = activeSetMeta.hasApproved
        ? 'Approved'
        : activeSetMeta.allRejected
            ? 'Rejected'
            : (activeSetMeta.awaitingModerator || activeSetMeta.awaitingHead)
                ? 'Under Review'
                : 'Draft';

    let activeSetChipColor: 'success' | 'error' | 'default' = 'default';
    if (activeSetMeta.hasApproved) activeSetChipColor = 'success';
    else if (activeSetMeta.allRejected) activeSetChipColor = 'error';

    const handleOpenForm = (entry?: TopicProposalEntry) => {
        if (!activeSet) {
            return;
        }
        if (entry) {
            setFormMode('edit');
            setEditingEntryId(entry.id);
            setFormValues({
                title: entry.title,
                description: entry.description,
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
        if (!group?.id) {
            showNotification('Unable to save draft without a thesis group.', 'error');
            return;
        }
        setFormSaving(true);
        const isNewEntry = !editingEntryId;
        const entryId = editingEntryId ?? buildTopicEntryId(group.id, nextTopicSequence);
        if (isNewEntry) {
            setNextTopicSequence((prev) => prev + 1);
        }
        try {
            const now = new Date();
            const nextEntries = editingEntryId
                ? activeSet.entries.map((entry) =>
                    entry.id === entryId
                        ? {
                            ...entry,
                            title: values.title,
                            description: values.description,
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
                        description: values.description,
                        problemStatement: values.problemStatement,
                        expectedOutcome: values.expectedOutcome,
                        keywords: values.keywords,
                        proposedBy: userUid,
                        createdAt: now,
                        updatedAt: now,
                        status: 'draft',
                    } satisfies TopicProposalEntry,
                ];
            await updateDraftEntriesBySetId(activeSet.id, nextEntries);
            showNotification('Draft saved', 'success');
            setFormOpen(false);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to save draft';
            showNotification(message, 'error');
            if (isNewEntry) {
                setNextTopicSequence((prev) => Math.max(prev - 1, 1));
            }
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
            await updateDraftEntriesBySetId(activeSet.id, remaining);
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
            await submitProposalSetBySetId(activeSet.id, userUid);
            showNotification('Topic proposals submitted for review', 'success');

            // Audit notification for topic proposal submission
            if (group) {
                void auditAndNotify({
                    group,
                    userId: userUid,
                    name: 'Topic Proposals Submitted',
                    description: `Topic proposals (Batch ${activeSet.batch ?? 1}) have been submitted for review.`,
                    category: 'proposal',
                    action: 'proposal_submitted',
                    targets: {
                        groupMembers: true,
                        moderators: true,
                        excludeUserId: userUid,
                    },
                    details: { setId: activeSet.id, setNumber: activeSet.batch ?? 1 },
                });
            }
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
            const nextSetNumber = proposalSets.reduce((acc, set) => Math.max(acc, set.batch ?? 0), 0) + 1;
            await createProposalSetByGroup(group.id, { createdBy: userUid, set: nextSetNumber });
            showNotification('New topic proposal batch started', 'success');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to start proposal batch';
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
            await markProposalAsThesisBySetId({
                proposalId: activeSet.id,
                entryId: useTopicDialog.id,
                requestedBy: userUid,
            });
            showNotification('Thesis created from your selected topic. Chapters are now unlocked.', 'success');
            setGroupReloadToken((token) => token + 1);
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
                    description={
                        'Create or join a thesis group first. Topic proposals are only available to active groups ' +
                        'that have been submitted to the Research Moderator.'
                    }
                />
            </AnimatedPage>
        );
    }

    const editorAssigned = Boolean(group.members.editor);

    if (!editorAssigned) {
        return (
            <AnimatedPage variant="fade">
                <UnauthorizedNotice
                    variant='box'
                    title="Assign a research editor first"
                    description="Have your research editor approve the request to unlock topic proposal submissions."
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

                {!isLeader && isMember && (
                    <Alert severity="info">
                        You can add and edit topic proposals. Only the group leader can submit proposals for review or start new batches.
                    </Alert>
                )}

                {proposalError && (
                    <Alert severity="error">{proposalError}</Alert>
                )}

                {canStartNewSet && (
                    <Alert severity="warning" action={
                        <Button onClick={handleCreateSet} disabled={createSetLoading} color="inherit" size="small">
                            Start new batch
                        </Button>
                    }>
                        All proposals in your current batch were rejected. You can submit a fresh batch of ideas.
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
                                            Start proposal batch
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
                                    <Typography variant="h6">Batch #{activeSet.batch}</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {activeSetStatusLabel}
                                    </Typography>
                                </Box>
                                <Stack direction="row" spacing={1}>
                                    <Chip
                                        label={activeSetChipLabel}
                                        color={activeSetChipColor}
                                    />
                                    {activeSet.awaitingModerator && <Chip label="For Moderator" color="info" />}
                                    {activeSet.awaitingHead && <Chip label="For Head" color="warning" />}
                                    {usedThesisEntry && <Chip label="In Use" color="success" variant="outlined" />}
                                </Stack>
                            </Stack>

                            {(canEditEntries || canSubmitSet) && (
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 3 }}>
                                    {canEditEntries && (
                                        <Button
                                            variant="contained"
                                            disabled={activeSet.entries.length >= MAX_TOPIC_PROPOSALS}
                                            onClick={() => handleOpenForm()}
                                        >
                                            Add proposal ({activeSet.entries.length}/{MAX_TOPIC_PROPOSALS})
                                        </Button>
                                    )}
                                    {canSubmitSet && (
                                        <Button
                                            variant="outlined"
                                            color="success"
                                            disabled={activeSet.entries.length === 0 || submissionLoading}
                                            onClick={handleSubmitSet}
                                        >
                                            Submit for review
                                        </Button>
                                    )}
                                </Stack>
                            )}

                            {activeSet.entries.length > 0 && (
                                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} useFlexGap flexWrap="wrap" sx={{ mt: 3 }}>
                                    {activeSet.entries.map((entry) => {
                                        const author = memberProfiles.get(entry.proposedBy);
                                        const isEntryInUse = entry.usedAsThesis === true;
                                        const lockedByAnotherEntry = Boolean(usedThesisEntry && !isEntryInUse);
                                        const entryActions: React.ReactNode[] = [];
                                        if (canEditEntries) {
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
                                                    disabled={lockedByAnotherEntry || isEntryInUse || useTopicLoading}
                                                    onClick={() => setUseTopicDialog(entry)}
                                                >
                                                    {isEntryInUse ? 'In use' : 'Use this topic'}
                                                </Button>
                                            );
                                        }

                                        // Get decision info from the proposal batch audits
                                        const entryAudits = activeSet?.audits?.filter(
                                            audit => audit.proposalId === entry.id
                                        ) || [];
                                        const moderatorAudit = entryAudits.find(a => a.stage === 'moderator');
                                        const headAudit = entryAudits.find(a => a.stage === 'head');

                                        /**
                                         * Map audit status to unified ApprovalChipStatus
                                         */
                                        const mapAuditToChipStatus = (status: string): ApprovalChipStatus => {
                                            if (status === 'approved') return 'approved';
                                            if (status === 'rejected') return 'rejected';
                                            return 'pending';
                                        };

                                        const footer = moderatorAudit || headAudit ? (
                                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                                {moderatorAudit && (
                                                    <ApprovalStatusChip
                                                        roleLabel="Moderator"
                                                        status={mapAuditToChipStatus(moderatorAudit.status)}
                                                        decidedAt={moderatorAudit.reviewedAt}
                                                        size="small"
                                                    />
                                                )}
                                                {headAudit && (
                                                    <ApprovalStatusChip
                                                        roleLabel="Head"
                                                        status={mapAuditToChipStatus(headAudit.status)}
                                                        decidedAt={headAudit.reviewedAt}
                                                        size="small"
                                                    />
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
                        </CardContent>
                    </Card>
                )}

                {historySets.length > 0 && (
                    <Stack spacing={2}>
                        <Typography variant="h6">Previous submission batches</Typography>
                        {historySets.map((set) => {
                            const meta = getProposalSetMeta(set);
                            const statusLabel = meta.hasApproved
                                ? 'Topic approved'
                                : meta.allRejected
                                    ? 'All topics rejected'
                                    : (meta.awaitingModerator || meta.awaitingHead)
                                        ? 'Under review'
                                        : 'Draft in progress';
                            const chipLabel = meta.hasApproved
                                ? 'Approved'
                                : meta.allRejected
                                    ? 'Rejected'
                                    : (meta.awaitingModerator || meta.awaitingHead)
                                        ? 'Under Review'
                                        : 'Draft';
                            let chipColor: 'success' | 'error' | 'default' = 'default';
                            if (meta.hasApproved) chipColor = 'success';
                            else if (meta.allRejected) chipColor = 'error';

                            return (
                                <Card key={set.id} variant="outlined">
                                    <CardContent>
                                        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                                            <Box>
                                                <Typography variant="subtitle1">Batch #{set.batch}</Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {set.entries.length} topic(s) • {statusLabel}
                                                </Typography>
                                            </Box>
                                            <Stack direction="row" spacing={1}>
                                                <Chip label={chipLabel} size="small" color={chipColor} />
                                                {set.awaitingModerator && <Chip label="Moderator" color="info" size="small" />}
                                                {set.awaitingHead && <Chip label="Head" color="warning" size="small" />}
                                            </Stack>
                                        </Stack>
                                    </CardContent>
                                </Card>
                            );
                        })}
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
