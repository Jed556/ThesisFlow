import * as React from 'react';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Skeleton,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import { useSession } from '@toolpad/core';
import type { NavigationItem } from '../../types/navigation';
import type { Session } from '../../types/session';
import type { ThesisGroup } from '../../types/group';
import type { TopicProposalEntry, TopicProposalSetRecord } from '../../types/topicProposal';
import type { UserProfile } from '../../types/profile';
import { AnimatedPage } from '../../components/Animate';
import { TopicProposalEntryCard } from '../../components/TopicProposals';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { listenTopicProposalSetsByGroup, recordModeratorDecision } from '../../utils/firebase/firestore/topicProposals';
import { getGroupsByCourse } from '../../utils/firebase/firestore/groups';
import { getUserById } from '../../utils/firebase/firestore/user';

export const metadata: NavigationItem = {
    group: 'management',
    index: 0,
    title: 'Moderator Topic Proposals',
    segment: 'moderator/topic-proposals',
    icon: <HowToVoteIcon />,
    roles: ['moderator', 'admin'],
};

interface DecisionDialogState {
    setId: string;
    proposal: TopicProposalEntry;
    decision: 'approved' | 'rejected';
}

/**
 * Moderator dashboard for reviewing student topic proposals before they advance to head approval.
 */
export default function ModeratorTopicProposalsPage() {
    const session = useSession<Session>();
    const moderatorUid = session?.user?.uid;
    const { showNotification } = useSnackbar();

    const [profile, setProfile] = React.useState<UserProfile | null>(null);
    const [profileLoading, setProfileLoading] = React.useState(true);
    const [profileError, setProfileError] = React.useState<string | null>(null);

    const [assignedGroups, setAssignedGroups] = React.useState<ThesisGroup[]>([]);
    const [groupsLoading, setGroupsLoading] = React.useState(false);
    const [groupsError, setGroupsError] = React.useState<string | null>(null);
    const [groupProposalSets, setGroupProposalSets] = React.useState<Map<string, TopicProposalSetRecord | null>>(new Map());

    const [decisionDialog, setDecisionDialog] = React.useState<DecisionDialogState | null>(null);
    const [decisionNotes, setDecisionNotes] = React.useState('');
    const [decisionLoading, setDecisionLoading] = React.useState(false);

    React.useEffect(() => {
        if (!moderatorUid) {
            setProfile(null);
            setProfileLoading(false);
            return;
        }

        let cancelled = false;
        setProfileLoading(true);
        setProfileError(null);

        void getUserById(moderatorUid)
            .then((userProfile) => {
                if (cancelled) {
                    return;
                }
                setProfile(userProfile ?? null);
            })
            .catch((fetchError) => {
                console.error('Failed to fetch moderator profile:', fetchError);
                if (!cancelled) {
                    setProfileError('Unable to load your profile.');
                    setProfile(null);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setProfileLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [moderatorUid]);

    const moderatorSections = React.useMemo(() => {
        if (!profile) {
            return [];
        }

        const explicitSections = (profile.moderatedSections ?? []).filter(Boolean);
        if (explicitSections.length > 0) {
            return explicitSections;
        }

        return profile.course ? [profile.course] : [];
    }, [profile]);

    React.useEffect(() => {
        if (moderatorSections.length === 0) {
            setAssignedGroups([]);
            return;
        }

        let cancelled = false;
        setGroupsLoading(true);
        setGroupsError(null);

        void (async () => {
            try {
                const resolvedGroups = await Promise.all(
                    moderatorSections.map((section) => getGroupsByCourse(section))
                );

                if (cancelled) {
                    return;
                }

                const deduped = new Map<string, ThesisGroup>();
                resolvedGroups.flat().forEach((group) => {
                    deduped.set(group.id, group);
                });
                setAssignedGroups(Array.from(deduped.values()));
            } catch (fetchError) {
                console.error('Failed to fetch moderator groups:', fetchError);
                if (!cancelled) {
                    setGroupsError('Unable to load groups for your assigned sections.');
                    setAssignedGroups([]);
                }
            } finally {
                if (!cancelled) {
                    setGroupsLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [moderatorSections]);

    React.useEffect(() => {
        if (assignedGroups.length === 0) {
            setGroupProposalSets(new Map());
            return () => { /* no-op */ };
        }

        const unsubscribes = assignedGroups.map((group) =>
            listenTopicProposalSetsByGroup(group.id, {
                onData: (records) => {
                    setGroupProposalSets((previous) => {
                        const next = new Map(previous);
                        next.set(group.id, records[0] ?? null);
                        return next;
                    });
                },
                onError: (listenerError) => {
                    console.error(`Failed to listen to topic proposals for group ${group.id}:`, listenerError);
                },
            })
        );

        return () => {
            unsubscribes.forEach((unsubscribe) => unsubscribe());
        };
    }, [assignedGroups]);

    const pendingCount = React.useMemo(() => {
        let total = 0;
        groupProposalSets.forEach((record) => {
            if (!record) {
                return;
            }
            total += record.entries.filter((entry) => entry.status === 'submitted').length;
        });
        return total;
    }, [groupProposalSets]);

    const sectionsLabel = React.useMemo(() => {
        if (moderatorSections.length === 0) {
            return 'No sections assigned';
        }
        if (moderatorSections.length <= 2) {
            return moderatorSections.join(', ');
        }
        const [first, second] = moderatorSections;
        return `${first}, ${second} +${moderatorSections.length - 2} more`;
    }, [moderatorSections]);

    const sortedGroups = React.useMemo(() => {
        return [...assignedGroups].sort((a, b) => a.name.localeCompare(b.name));
    }, [assignedGroups]);

    const handleOpenDecision = (setId: string, proposal: TopicProposalEntry, decision: 'approved' | 'rejected') => {
        setDecisionDialog({ setId, proposal, decision });
        setDecisionNotes('');
    };

    const handleConfirmDecision = async () => {
        if (!decisionDialog || !moderatorUid) {
            return;
        }
        setDecisionLoading(true);
        try {
            await recordModeratorDecision({
                setId: decisionDialog.setId,
                proposalId: decisionDialog.proposal.id,
                reviewerUid: moderatorUid,
                decision: decisionDialog.decision,
                notes: decisionNotes.trim() || undefined,
            });
            showNotification('Decision recorded', 'success');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to record decision';
            showNotification(message, 'error');
        } finally {
            setDecisionLoading(false);
            setDecisionDialog(null);
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

    if (!moderatorUid) {
        return (
            <AnimatedPage variant="slideUp">
                <Alert severity="info">Sign in to review topic proposals.</Alert>
            </AnimatedPage>
        );
    }

    return (
        <AnimatedPage variant="slideUp">
            <Stack spacing={3}>
                <Box>
                    <Typography variant="h4" gutterBottom>
                        Moderator topic proposals
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Monitor every group in the sections you moderate. You can view drafts at any time,
                        but only proposals that were formally submitted can be approved or rejected.
                    </Typography>
                </Box>

                <Card>
                    <CardContent>
                        <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={2}
                            alignItems="center"
                            justifyContent="space-between"
                        >
                            <Box>
                                <Typography variant="subtitle1">Pending proposals</Typography>
                                <Typography variant="h4">{pendingCount}</Typography>
                            </Box>
                            <Chip
                                label={sectionsLabel}
                                color={moderatorSections.length > 0 ? 'info' : 'default'}
                                variant={moderatorSections.length > 0 ? 'filled' : 'outlined'}
                            />
                        </Stack>
                    </CardContent>
                </Card>

                {profileError && <Alert severity="error">{profileError}</Alert>}
                {groupsError && <Alert severity="error">{groupsError}</Alert>}
                {!profileLoading && moderatorSections.length === 0 && (
                    <Alert severity="info">
                        Your profile does not list any sections to moderate. Update your course assignments to see
                        student submissions.
                    </Alert>
                )}

                {(profileLoading || groupsLoading) && (
                    <Stack spacing={2}>
                        {Array.from({ length: 2 }).map((_, index) => (
                            <Skeleton key={index} variant="rectangular" height={140} />
                        ))}
                    </Stack>
                )}

                {!groupsLoading && moderatorSections.length > 0 && sortedGroups.length === 0 && (
                    <Alert severity="info">No thesis groups are assigned to your sections yet.</Alert>
                )}

                {sortedGroups.map((group) => {
                    const record = groupProposalSets.get(group.id);
                    const entries = record?.entries ?? [];
                    const awaitingHead = Boolean(record?.awaitingHead);

                    return (
                        <Card key={group.id} variant="outlined">
                            <CardContent>
                                <Stack
                                    direction={{ xs: 'column', sm: 'row' }}
                                    justifyContent="space-between"
                                    spacing={1}
                                    sx={{ mb: 2 }}
                                >
                                    <Box>
                                        <Typography variant="h6">{group.name}</Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {group.course ?? 'Unassigned section'} • {group.department ?? 'No department listed'}
                                        </Typography>
                                    </Box>
                                    <Stack direction="row" spacing={1}>
                                        <Chip label={`Cycle #${record?.cycle ?? 1}`} size="small" />
                                        {awaitingHead && <Chip label="Head queue" size="small" color="warning" />}
                                    </Stack>
                                </Stack>

                                {record === undefined && (
                                    <Skeleton variant="rectangular" height={100} />
                                )}

                                {record === null && (
                                    <Alert severity="info">This group has not created any topic proposals yet.</Alert>
                                )}

                                {record && entries.length === 0 && (
                                    <Alert severity="info">No topic proposals have been drafted in this cycle.</Alert>
                                )}

                                {record && entries.length > 0 && (
                                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} useFlexGap flexWrap="wrap">
                                        {entries.map((entry) => {
                                            const isActionable = entry.status === 'submitted';
                                            const actions = isActionable
                                                ? [
                                                    <Button
                                                        key="approve"
                                                        variant="contained"
                                                        color="success"
                                                        size="small"
                                                        onClick={() => handleOpenDecision(record.id, entry, 'approved')}
                                                    >
                                                        Approve
                                                    </Button>,
                                                    <Button
                                                        key="reject"
                                                        variant="outlined"
                                                        color="error"
                                                        size="small"
                                                        onClick={() => handleOpenDecision(record.id, entry, 'rejected')}
                                                    >
                                                        Reject
                                                    </Button>,
                                                ]
                                                : [
                                                    <Tooltip
                                                        key="view-only"
                                                        title="Only submitted proposals can be reviewed"
                                                        placement="top"
                                                    >
                                                        <span>
                                                            <Button size="small" disabled>
                                                                Await submission
                                                            </Button>
                                                        </span>
                                                    </Tooltip>,
                                                ];

                                            return (
                                                <Box key={entry.id} sx={{ flex: '1 1 320px', minWidth: 280 }}>
                                                    <TopicProposalEntryCard
                                                        entry={entry}
                                                        author={undefined}
                                                        actions={actions}
                                                    />
                                                </Box>
                                            );
                                        })}
                                    </Stack>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </Stack>

            <Dialog open={Boolean(decisionDialog)} onClose={() => setDecisionDialog(null)} fullWidth maxWidth="sm">
                <DialogTitle>
                    {decisionDialog?.decision === 'approved' ? 'Approve topic proposal' : 'Reject topic proposal'}
                </DialogTitle>
                <DialogContent>
                    <TextField
                        label="Optional notes"
                        fullWidth
                        multiline
                        minRows={3}
                        value={decisionNotes}
                        onChange={(event) => setDecisionNotes(event.target.value)}
                        placeholder="Add guidance or justification for the student group"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDecisionDialog(null)} color="inherit" disabled={decisionLoading}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirmDecision}
                        variant="contained"
                        color={decisionDialog?.decision === 'approved' ? 'success' : 'error'}
                        disabled={decisionLoading}
                    >
                        Confirm
                    </Button>
                </DialogActions>
            </Dialog>
        </AnimatedPage>
    );
}
