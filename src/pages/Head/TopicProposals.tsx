import * as React from 'react';
import {
    Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions,
    DialogContent, DialogTitle, Skeleton, Stack, TextField, Tooltip, Typography,
} from '@mui/material';
import { HistoryEdu as HistoryEduIcon } from '@mui/icons-material';
import type { NavigationItem } from '../../types/navigation';
import { useSession } from '@toolpad/core';
import type { Session } from '../../types/session';
import type { ThesisGroup } from '../../types/group';
import type { TopicProposalEntry, TopicProposalSetRecord } from '../../types/proposal';
import type { UserProfile } from '../../types/profile';
import { AnimatedPage } from '../../components/Animate';
import { HeadApprovalDialog, TopicProposalEntryCard } from '../../components/TopicProposals';
import type { HeadApprovalFormValues } from '../../components/TopicProposals';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { listenTopicProposalSetsByGroup, recordHeadDecision } from '../../utils/firebase/firestore/topicProposals';
import { getGroupsByDepartment } from '../../utils/firebase/firestore/groups';
import { findUserById } from '../../utils/firebase/firestore/user';
import { auditAndNotify } from '../../utils/auditNotificationUtils';

export const metadata: NavigationItem = {
    group: 'management',
    index: 1,
    title: 'Topic Proposals',
    segment: 'head-topic-proposals',
    icon: <HistoryEduIcon />,
    roles: ['head'],
};

interface ApprovalDialogState {
    setId: string;
    proposal: TopicProposalEntry;
}

interface RejectionDialogState {
    setId: string;
    proposal: TopicProposalEntry;
}

function describeHeadRestriction(status: TopicProposalEntry['status']): { label: string; tooltip: string } {
    switch (status) {
        case 'draft':
            return { label: 'Draft', tooltip: 'Group is still editing this topic.' };
        case 'submitted':
            return { label: 'Await moderator', tooltip: 'Moderator must approve before head review.' };
        case 'moderator_rejected':
            return { label: 'Moderator rejected', tooltip: 'Moderator already rejected this topic.' };
        case 'head_approved':
            return { label: 'Approved', tooltip: 'You already approved this topic.' };
        case 'head_rejected':
            return { label: 'Rejected', tooltip: 'You already rejected this topic.' };
        default:
            return { label: 'No action', tooltip: 'No head action required yet.' };
    }
}

/**
 * Head reviewer workspace scoped to their assigned departments.
 */
export default function HeadTopicProposalsPage() {
    const session = useSession<Session>();
    const headUid = session?.user?.uid;
    const { showNotification } = useSnackbar();

    const [profile, setProfile] = React.useState<UserProfile | null>(null);
    const [profileLoading, setProfileLoading] = React.useState(true);
    const [profileError, setProfileError] = React.useState<string | null>(null);

    const [assignedGroups, setAssignedGroups] = React.useState<ThesisGroup[]>([]);
    const [groupsLoading, setGroupsLoading] = React.useState(false);
    const [groupsError, setGroupsError] = React.useState<string | null>(null);
    const [groupProposalSets, setGroupProposalSets] = React.useState<Map<string, TopicProposalSetRecord | null>>(new Map());

    // Separate state for approval and rejection dialogs
    const [approvalDialog, setApprovalDialog] = React.useState<ApprovalDialogState | null>(null);
    const [rejectionDialog, setRejectionDialog] = React.useState<RejectionDialogState | null>(null);
    const [rejectionNotes, setRejectionNotes] = React.useState('');
    const [decisionLoading, setDecisionLoading] = React.useState(false);

    React.useEffect(() => {
        if (!headUid) {
            setProfile(null);
            setProfileLoading(false);
            return;
        }

        let cancelled = false;
        setProfileLoading(true);
        setProfileError(null);

        void findUserById(headUid)
            .then((userProfile) => {
                if (!cancelled) {
                    setProfile(userProfile ?? null);
                }
            })
            .catch((error) => {
                console.error('Failed to load head profile:', error);
                if (!cancelled) {
                    setProfile(null);
                    setProfileError('Unable to load your profile.');
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
    }, [headUid]);

    const headDepartments = React.useMemo(() => {
        if (!profile) {
            return [];
        }
        const multi = (profile.departments ?? []).filter(Boolean);
        if (multi.length > 0) {
            return multi;
        }
        return profile.department ? [profile.department] : [];
    }, [profile]);

    React.useEffect(() => {
        if (headDepartments.length === 0) {
            setAssignedGroups([]);
            return;
        }

        let cancelled = false;
        setGroupsLoading(true);
        setGroupsError(null);

        void (async () => {
            try {
                const groupsByDepartment = await Promise.all(
                    headDepartments.map((department) => getGroupsByDepartment(department))
                );

                if (cancelled) {
                    return;
                }

                const deduped = new Map<string, ThesisGroup>();
                groupsByDepartment.flat().forEach((group) => {
                    deduped.set(group.id, group);
                });
                setAssignedGroups(Array.from(deduped.values()));
            } catch (error) {
                console.error('Failed to fetch groups for head:', error);
                if (!cancelled) {
                    setGroupsError('Unable to load groups for your departments.');
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
    }, [headDepartments]);

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
                onError: (error) => {
                    console.error(`Failed to listen to proposals for group ${group.id}:`, error);
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
            total += record.entries.filter((entry) => entry.status === 'head_review').length;
        });
        return total;
    }, [groupProposalSets]);

    const departmentsLabel = React.useMemo(() => {
        if (headDepartments.length === 0) {
            return 'No departments assigned';
        }
        if (headDepartments.length <= 2) {
            return headDepartments.join(', ');
        }
        const [first, second] = headDepartments;
        return `${first}, ${second} +${headDepartments.length - 2} more`;
    }, [headDepartments]);

    const sortedGroups = React.useMemo(() => {
        return [...assignedGroups].sort((a, b) => a.name.localeCompare(b.name));
    }, [assignedGroups]);

    const handleOpenApproval = (setId: string, proposal: TopicProposalEntry) => {
        setApprovalDialog({ setId, proposal });
    };

    const handleOpenRejection = (setId: string, proposal: TopicProposalEntry) => {
        setRejectionDialog({ setId, proposal });
        setRejectionNotes('');
    };

    const handleConfirmApproval = async (values: HeadApprovalFormValues) => {
        if (!approvalDialog || !headUid) {
            return;
        }
        setDecisionLoading(true);
        try {
            await recordHeadDecision({
                setId: approvalDialog.setId,
                proposalId: approvalDialog.proposal.id,
                reviewerUid: headUid,
                decision: 'approved',
                notes: values.notes.trim() || undefined,
                agenda: values.agendaPath.length > 0 ? {
                    type: values.agendaType,
                    department: values.department || undefined,
                    agendaPath: values.agendaPath,
                } : undefined,
                ESG: values.ESG || undefined,
                SDG: values.SDG || undefined,
            });
            showNotification('Topic approved successfully', 'success');

            // Audit notification for head approval
            const group = assignedGroups.find((g) =>
                groupProposalSets.get(g.id)?.id === approvalDialog.setId
            );
            if (group) {
                void auditAndNotify({
                    group,
                    userId: headUid,
                    name: 'Topic Approved by Head',
                    // eslint-disable-next-line max-len
                    description: `Topic "${approvalDialog.proposal.title}" has been approved by the Research Head. Your group can now proceed with the thesis.`,
                    category: 'proposal',
                    action: 'proposal_approved',
                    targets: {
                        groupMembers: true,
                        excludeUserId: headUid,
                    },
                    details: {
                        proposalTitle: approvalDialog.proposal.title,
                        decision: 'approved',
                        reviewerRole: 'head',
                    },
                });
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to approve topic';
            showNotification(message, 'error');
        } finally {
            setDecisionLoading(false);
            setApprovalDialog(null);
        }
    };

    const handleConfirmRejection = async () => {
        if (!rejectionDialog || !headUid) {
            return;
        }
        setDecisionLoading(true);
        try {
            await recordHeadDecision({
                setId: rejectionDialog.setId,
                proposalId: rejectionDialog.proposal.id,
                reviewerUid: headUid,
                decision: 'rejected',
                notes: rejectionNotes.trim() || undefined,
            });
            showNotification('Topic rejected', 'success');

            // Audit notification for head rejection
            const group = assignedGroups.find((g) =>
                groupProposalSets.get(g.id)?.id === rejectionDialog.setId
            );
            if (group) {
                void auditAndNotify({
                    group,
                    userId: headUid,
                    name: 'Topic Rejected by Head',
                    // eslint-disable-next-line max-len
                    description: `Topic "${rejectionDialog.proposal.title}" has been rejected by the Research Head.${rejectionNotes.trim() ? ` Reason: ${rejectionNotes.trim()}` : ''}`,
                    category: 'proposal',
                    action: 'proposal_rejected',
                    targets: {
                        groupMembers: true,
                        excludeUserId: headUid,
                    },
                    details: {
                        proposalTitle: rejectionDialog.proposal.title,
                        decision: 'rejected',
                        notes: rejectionNotes.trim() || undefined,
                        reviewerRole: 'head',
                    },
                });
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to reject topic';
            showNotification(message, 'error');
        } finally {
            setDecisionLoading(false);
            setRejectionDialog(null);
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

    if (!headUid) {
        return (
            <AnimatedPage variant="slideUp">
                <Alert severity="info">Sign in to review department topic proposals.</Alert>
            </AnimatedPage>
        );
    }

    return (
        <AnimatedPage variant="slideUp">
            <Stack spacing={3}>
                <Box>
                    <Typography variant="body1" color="text.secondary">
                        Review every group in your departments. Finalize only the topics that were approved by moderators.
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
                                <Typography variant="subtitle1">Awaiting head decision</Typography>
                                <Typography variant="h4">{pendingCount}</Typography>
                            </Box>
                            <Chip
                                label={departmentsLabel}
                                color={headDepartments.length > 0 ? 'info' : 'default'}
                                variant={headDepartments.length > 0 ? 'filled' : 'outlined'}
                            />
                        </Stack>
                    </CardContent>
                </Card>

                {profileError && <Alert severity="error">{profileError}</Alert>}
                {groupsError && <Alert severity="error">{groupsError}</Alert>}
                {!profileLoading && headDepartments.length === 0 && (
                    <Alert severity="info">Your profile is not linked to any departments. Update it to view proposals.</Alert>
                )}

                {(profileLoading || groupsLoading) && (
                    <Stack spacing={2}>
                        {Array.from({ length: 2 }).map((_, index) => (
                            <Skeleton key={index} variant="rectangular" height={140} />
                        ))}
                    </Stack>
                )}

                {!groupsLoading && headDepartments.length > 0 && sortedGroups.length === 0 && (
                    <Alert severity="info">No thesis groups are registered under your departments yet.</Alert>
                )}

                {sortedGroups.map((group) => {
                    const record = groupProposalSets.get(group.id);
                    const entries = record?.entries ?? [];
                    const awaitingHead = Boolean(record?.awaitingHead);
                    const awaitingModerator = Boolean(record?.awaitingModerator);

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
                                            {group.department ?? 'No department listed'} • {group.course ?? 'No course listed'}
                                        </Typography>
                                    </Box>
                                    <Stack direction="row" spacing={1}>
                                        <Chip label={`Batch ${record?.batch ?? 1}`} size="small" />
                                        {awaitingHead && <Chip label="Head queue" color="warning" size="small" />}
                                        {!awaitingHead && awaitingModerator && (
                                            <Chip label="Moderator queue" color="info" size="small" />
                                        )}
                                    </Stack>
                                </Stack>

                                {record === undefined && <Skeleton variant="rectangular" height={100} />}
                                {record === null && (
                                    <Alert severity="info">This group has not started a topic proposal batch yet.</Alert>
                                )}
                                {record && entries.length === 0 && (
                                    <Alert severity="info">No topic proposals exist for this batch yet.</Alert>
                                )}

                                {record && entries.length > 0 && (
                                    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} useFlexGap flexWrap="wrap">
                                        {entries.map((entry) => {
                                            const actionable = entry.status === 'head_review';
                                            const restriction = describeHeadRestriction(entry.status);
                                            const actions = actionable
                                                ? [
                                                    <Button
                                                        key="approve"
                                                        variant="contained"
                                                        color="success"
                                                        size="small"
                                                        onClick={() => handleOpenApproval(record.id, entry)}
                                                    >
                                                        Approve
                                                    </Button>,
                                                    <Button
                                                        key="reject"
                                                        variant="outlined"
                                                        color="error"
                                                        size="small"
                                                        onClick={() => handleOpenRejection(record.id, entry)}
                                                    >
                                                        Reject
                                                    </Button>,
                                                ]
                                                : [
                                                    <Tooltip key="view-only" title={restriction.tooltip} placement="top">
                                                        <span>
                                                            <Button size="small" disabled>
                                                                {restriction.label}
                                                            </Button>
                                                        </span>
                                                    </Tooltip>,
                                                ];

                                            return (
                                                <Box key={entry.id} sx={{ flex: '1 1 320px', minWidth: 280 }}>
                                                    <TopicProposalEntryCard
                                                        entry={entry}
                                                        author={undefined}
                                                        highlight={entry.status === 'head_approved'}
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

            {/* Head Approval Dialog with agenda, ESG, SDG selection */}
            <HeadApprovalDialog
                open={Boolean(approvalDialog)}
                proposal={approvalDialog?.proposal ?? null}
                loading={decisionLoading}
                onClose={() => setApprovalDialog(null)}
                onConfirm={handleConfirmApproval}
            />

            {/* Simple Rejection Dialog */}
            <Dialog open={Boolean(rejectionDialog)} onClose={() => setRejectionDialog(null)} fullWidth maxWidth="sm">
                <DialogTitle>Reject Topic Proposal</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Provide feedback to help the group improve their proposal.
                    </Typography>
                    <TextField
                        label="Rejection Notes"
                        fullWidth
                        multiline
                        minRows={3}
                        value={rejectionNotes}
                        onChange={(event) => setRejectionNotes(event.target.value)}
                        placeholder="Explain why this topic is being rejected"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRejectionDialog(null)} color="inherit" disabled={decisionLoading}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirmRejection}
                        variant="contained"
                        color="error"
                        disabled={decisionLoading}
                    >
                        Reject Topic
                    </Button>
                </DialogActions>
            </Dialog>
        </AnimatedPage>
    );
}
