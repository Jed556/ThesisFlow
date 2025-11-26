import * as React from 'react';
import {
    Alert,
    Autocomplete,
    Box,
    Button,
    Card,
    CardContent,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Skeleton,
    Stack,
    Tab,
    Tabs,
    TextField,
    Typography,
} from '@mui/material';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import UndoIcon from '@mui/icons-material/Undo';
import { useSession } from '@toolpad/core';
import type { Session } from '../../types/session';
import type { ThesisStage, ThesisData } from '../../types/thesis';
import type { ThesisGroup } from '../../types/group';
import type { FileAttachment } from '../../types/file';
import type { ReviewerAssignment, ReviewerRole } from '../../types/reviewer';
import type { TerminalRequirementApprovalRole, TerminalRequirementSubmissionRecord } from '../../types/terminalRequirementSubmission';
import { SubmissionStatus, TERMINAL_REQUIREMENT_ROLE_LABELS } from './SubmissionStatus';
import { TerminalRequirementCard } from './RequirementCard';
import { THESIS_STAGE_METADATA } from '../../utils/thesisStageUtils';
import { useSnackbar } from '../Snackbar';
import {
    getReviewerAssignmentsForUser,
    getThesisById,
    getThesisByGroupId,
} from '../../utils/firebase/firestore/thesis';
import { getGroupById, listenGroupsByPanelist } from '../../utils/firebase/firestore/groups';
import {
    listenTerminalRequirementSubmission,
    recordTerminalRequirementDecision,
} from '../../utils/firebase/firestore/terminalRequirementSubmissions';
import { fetchTerminalRequirementFiles, getTerminalRequirementsByStage } from '../../utils/terminalRequirements';

interface AssignmentOption {
    thesisId: string;
    label: string;
    groupId?: string;
}

const ROLE_TITLES: Record<TerminalRequirementApprovalRole, string> = {
    panel: 'Panel',
    adviser: 'Adviser',
    editor: 'Editor',
    statistician: 'Statistician',
};

export interface TerminalRequirementApprovalWorkspaceProps {
    role: TerminalRequirementApprovalRole;
    title: string;
    description: string;
    emptyStateMessage: string;
}

export function TerminalRequirementApprovalWorkspace({
    role,
    title,
    description,
    emptyStateMessage,
}: TerminalRequirementApprovalWorkspaceProps) {
    const session = useSession<Session>();
    const userUid = session?.user?.uid ?? null;
    const { showNotification } = useSnackbar();

    const [assignmentOptions, setAssignmentOptions] = React.useState<AssignmentOption[]>([]);
    const [assignmentLoading, setAssignmentLoading] = React.useState(true);
    const [selectedThesisId, setSelectedThesisId] = React.useState<string>('');
    const [thesis, setThesis] = React.useState<(ThesisData & { id: string }) | null>(null);
    const [thesisLoading, setThesisLoading] = React.useState(false);
    const [thesisError, setThesisError] = React.useState<string | null>(null);
    const [groupMeta, setGroupMeta] = React.useState<ThesisGroup | null>(null);
    const [submissionByStage, setSubmissionByStage] = React.useState<Partial<Record<ThesisStage, TerminalRequirementSubmissionRecord | null>>>({});
    const [activeStage, setActiveStage] = React.useState<ThesisStage | null>(null);
    const [filesByRequirement, setFilesByRequirement] = React.useState<Record<string, FileAttachment[]>>({});
    const [fileLoading, setFileLoading] = React.useState<Record<string, boolean>>({});
    const [decisionLoading, setDecisionLoading] = React.useState(false);
    const [returnDialogOpen, setReturnDialogOpen] = React.useState(false);
    const [returnNote, setReturnNote] = React.useState('');

    const formatDateTime = React.useCallback((value?: string | null) => {
        if (!value) {
            return '—';
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return value;
        }
        return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
    }, []);

    React.useEffect(() => {
        if (!userUid) {
            setAssignmentOptions([]);
            setAssignmentLoading(false);
            return;
        }

        if (role === 'panel') {
            setAssignmentLoading(true);
            const unsubscribe = listenGroupsByPanelist(userUid, {
                onData: (groups) => {
                    setAssignmentOptions(groups.map((group) => ({
                        thesisId: group.thesisId ?? '',
                        label: group.name || group.id,
                        groupId: group.id,
                    })));
                    setAssignmentLoading(false);
                },
                onError: (listenerError) => {
                    console.error('Failed to load panel assignments:', listenerError);
                    setAssignmentOptions([]);
                    setAssignmentLoading(false);
                },
            });
            return () => unsubscribe();
        }

        let cancelled = false;
        const loadAssignments = async () => {
            setAssignmentLoading(true);
            try {
                const reviewerRole = role as Exclude<TerminalRequirementApprovalRole, 'panel'> & ReviewerRole;
                const rows = await getReviewerAssignmentsForUser(reviewerRole, userUid);
                if (!cancelled) {
                    setAssignmentOptions(rows.map((row: ReviewerAssignment) => ({
                        thesisId: row.thesisId,
                        label: row.thesisTitle || row.thesisId,
                    })));
                }
            } catch (error) {
                console.error('Failed to load mentor assignments:', error);
                if (!cancelled) {
                    setAssignmentOptions([]);
                }
            } finally {
                if (!cancelled) {
                    setAssignmentLoading(false);
                }
            }
        };

        void loadAssignments();
        return () => {
            cancelled = true;
        };
    }, [role, userUid]);

    React.useEffect(() => {
        if (!assignmentOptions.length) {
            setSelectedThesisId('');
            return;
        }

        if (selectedThesisId && assignmentOptions.some((option) => option.thesisId === selectedThesisId)) {
            return;
        }

        const fallback = assignmentOptions.find((option) => option.thesisId) ?? assignmentOptions[0];
        if (fallback.thesisId) {
            setSelectedThesisId(fallback.thesisId);
            return;
        }

        if (!fallback.groupId) {
            setSelectedThesisId('');
            return;
        }

        let cancelled = false;
        setThesisLoading(true);
        void (async () => {
            try {
                const groupThesis = await getThesisByGroupId(fallback.groupId!);
                if (cancelled) {
                    return;
                }
                if (groupThesis?.id) {
                    setSelectedThesisId(groupThesis.id);
                } else {
                    setSelectedThesisId('');
                    showNotification('No thesis found for this group yet.', 'info');
                }
            } catch (error) {
                console.error('Failed to resolve thesis for fallback selection:', error);
                if (!cancelled) {
                    showNotification('Unable to resolve thesis for this group.', 'error');
                }
            } finally {
                if (!cancelled) {
                    setThesisLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [assignmentOptions, selectedThesisId, showNotification]);

    React.useEffect(() => {
        if (!selectedThesisId) {
            setThesis(null);
            setGroupMeta(null);
            setSubmissionByStage({});
            setThesisError(null);
            return;
        }

        let cancelled = false;
        const loadThesis = async () => {
            setThesisLoading(true);
            setThesisError(null);
            setThesis(null);
            setGroupMeta(null);
            try {
                const data = await getThesisById(selectedThesisId);
                if (cancelled) {
                    return;
                }
                if (data) {
                    setThesis({ ...data, id: selectedThesisId });
                    if (data.groupId) {
                        const group = await getGroupById(data.groupId);
                        if (!cancelled) {
                            setGroupMeta(group);
                        }
                    }
                } else {
                    setThesisError('Unable to load thesis details.');
                }
            } catch (error) {
                console.error('Failed to load thesis record for mentor approvals:', error);
                if (!cancelled) {
                    setThesisError('Unable to load thesis details.');
                }
            } finally {
                if (!cancelled) {
                    setThesisLoading(false);
                }
            }
        };

        void loadThesis();
        return () => {
            cancelled = true;
        };
    }, [selectedThesisId]);

    React.useEffect(() => {
        if (!selectedThesisId) {
            setSubmissionByStage({});
            return;
        }
        const unsubscribers = THESIS_STAGE_METADATA.map((stageMeta) => {
            const stageValue = stageMeta.value;
            return listenTerminalRequirementSubmission(selectedThesisId, stageValue, {
                onData: (record) => {
                    setSubmissionByStage((prev) => ({
                        ...prev,
                        [stageValue]: record,
                    }));
                },
                onError: (listenerError) => {
                    console.error(`Submission listener error for ${stageValue}:`, listenerError);
                },
            });
        });
        return () => {
            unsubscribers.forEach((unsubscribe) => unsubscribe());
        };
    }, [selectedThesisId]);

    const availableStages = React.useMemo(() => {
        return THESIS_STAGE_METADATA.filter((stageMeta) => submissionByStage[stageMeta.value]);
    }, [submissionByStage]);

    React.useEffect(() => {
        if (!availableStages.length) {
            setActiveStage(null);
            return;
        }
        if (!activeStage || !submissionByStage[activeStage]) {
            setActiveStage(availableStages[0].value);
        }
    }, [availableStages, activeStage, submissionByStage]);

    const resolvedStage = activeStage ?? availableStages[0]?.value ?? null;
    const activeSubmission = resolvedStage ? (submissionByStage[resolvedStage] ?? null) : null;
    const stageRequirements = React.useMemo(() => {
        if (!resolvedStage || !activeSubmission) {
            return [];
        }
        const definitions = getTerminalRequirementsByStage(resolvedStage);
        return definitions.filter((definition) => activeSubmission.requirementIds.includes(definition.id));
    }, [resolvedStage, activeSubmission]);

    React.useEffect(() => {
        setFilesByRequirement({});
        setFileLoading({});
    }, [resolvedStage, selectedThesisId]);

    const loadRequirementFiles = React.useCallback(async (requirementId: string) => {
        if (!thesis?.id) {
            return;
        }
        setFileLoading((prev) => ({ ...prev, [requirementId]: true }));
        try {
            const files = await fetchTerminalRequirementFiles(thesis.id, requirementId);
            setFilesByRequirement((prev) => ({ ...prev, [requirementId]: files }));
        } catch (error) {
            console.error('Failed to load requirement files for mentor view:', error);
        } finally {
            setFileLoading((prev) => ({ ...prev, [requirementId]: false }));
        }
    }, [thesis?.id]);

    React.useEffect(() => {
        if (!activeSubmission) {
            return;
        }
        activeSubmission.requirementIds.forEach((requirementId) => {
            if (!filesByRequirement[requirementId]) {
                void loadRequirementFiles(requirementId);
            }
        });
    }, [activeSubmission, filesByRequirement, loadRequirementFiles]);

    const canDecide = Boolean(
        userUid
        && activeSubmission
        && activeSubmission.locked
        && activeSubmission.status === 'in_review'
        && activeSubmission.currentRole === role,
    );

    const awaitingLabel = activeSubmission?.currentRole
        ? TERMINAL_REQUIREMENT_ROLE_LABELS[activeSubmission.currentRole]
        : 'Workflow';

    const handleSelectAssignment = React.useCallback((_: unknown, option: AssignmentOption | null) => {
        if (!option) {
            setSelectedThesisId('');
            return;
        }
        if (option.thesisId) {
            setSelectedThesisId(option.thesisId);
            return;
        }
        if (!option.groupId) {
            showNotification('This group has no thesis yet.', 'info');
            return;
        }
        setThesisLoading(true);
        void (async () => {
            try {
                const groupThesis = await getThesisByGroupId(option.groupId);
                if (groupThesis?.id) {
                    setSelectedThesisId(groupThesis.id);
                } else {
                    showNotification('No thesis found for this group yet.', 'info');
                }
            } catch (error) {
                console.error('Failed to resolve thesis for group selection:', error);
                showNotification('Unable to resolve thesis for this group.', 'error');
            } finally {
                setThesisLoading(false);
            }
        })();
    }, [showNotification]);

    const handleApprove = React.useCallback(async () => {
        if (!thesis?.id || !resolvedStage || !activeSubmission) {
            return;
        }
        if (!userUid) {
            showNotification('Sign in to record your decision.', 'error');
            return;
        }
        setDecisionLoading(true);
        try {
            await recordTerminalRequirementDecision({
                thesisId: thesis.id,
                stage: resolvedStage,
                role,
                approverUid: userUid,
                action: 'approve',
            });
            showNotification('Stage approved.', 'success');
        } catch (error) {
            console.error('Failed to approve terminal requirements:', error);
            const message = error instanceof Error ? error.message : 'Unable to save your decision.';
            showNotification(message, 'error');
        } finally {
            setDecisionLoading(false);
        }
    }, [thesis?.id, resolvedStage, activeSubmission, role, userUid, showNotification]);

    const handleConfirmReturn = React.useCallback(async () => {
        if (!thesis?.id || !resolvedStage || !activeSubmission) {
            return;
        }
        if (!userUid) {
            showNotification('Sign in to record your decision.', 'error');
            return;
        }
        setDecisionLoading(true);
        try {
            await recordTerminalRequirementDecision({
                thesisId: thesis.id,
                stage: resolvedStage,
                role,
                approverUid: userUid,
                action: 'return',
                note: returnNote.trim() || undefined,
            });
            showNotification('Request sent back to students.', 'info');
            setReturnDialogOpen(false);
            setReturnNote('');
        } catch (error) {
            console.error('Failed to return terminal requirements:', error);
            const message = error instanceof Error ? error.message : 'Unable to send recommendations.';
            showNotification(message, 'error');
        } finally {
            setDecisionLoading(false);
        }
    }, [thesis?.id, resolvedStage, activeSubmission, role, userUid, returnNote, showNotification]);

    const handleCloseReturnDialog = React.useCallback(() => {
        if (decisionLoading) {
            return;
        }
        setReturnDialogOpen(false);
        setReturnNote('');
    }, [decisionLoading]);

    const stageAlert = React.useMemo(() => {
        if (!activeSubmission) {
            return (
                <Alert severity="info">
                    Select a stage with submitted requirements to review the files.
                </Alert>
            );
        }

        if (activeSubmission.status === 'in_review') {
            const message = canDecide
                ? 'This stage is awaiting your decision.'
                : `Waiting for ${awaitingLabel.toLowerCase()} review.`;
            return (
                <Alert severity="info">{message}</Alert>
            );
        }

        if (activeSubmission.status === 'returned') {
            return (
                <Alert severity="warning">
                    Returned to students by {activeSubmission.returnedBy ? TERMINAL_REQUIREMENT_ROLE_LABELS[activeSubmission.returnedBy] : 'a mentor'} on {formatDateTime(activeSubmission.returnedAt)}.
                </Alert>
            );
        }

        if (activeSubmission.status === 'approved') {
            return (
                <Alert severity="success">
                    Stage approved on {formatDateTime(activeSubmission.completedAt ?? activeSubmission.updatedAt)}.
                </Alert>
            );
        }

        return null;
    }, [activeSubmission, awaitingLabel, canDecide, formatDateTime]);

    if (session?.loading) {
        return (
            <Stack spacing={2}>
                <Skeleton variant="text" width="40%" height={36} />
                <Skeleton variant="rectangular" height={200} />
            </Stack>
        );
    }

    if (!userUid) {
        return (
            <Alert severity="info">
                Sign in with your {ROLE_TITLES[role].toLowerCase()} account to review terminal requirements.
            </Alert>
        );
    }

    const selectedAssignment = assignmentOptions.find((option) => option.thesisId === selectedThesisId) ?? null;

    return (
        <Stack spacing={3}>
            <Box>
                <Typography variant="h4" gutterBottom>
                    {title}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    {description}
                </Typography>
            </Box>

            <Autocomplete<AssignmentOption, false, false, false>
                options={assignmentOptions}
                value={selectedAssignment}
                loading={assignmentLoading}
                onChange={handleSelectAssignment}
                getOptionLabel={(option) => option.label}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        label={`${ROLE_TITLES[role]} assignments`}
                        placeholder={assignmentLoading ? 'Loading…' : 'Select thesis'}
                    />
                )}
            />

            {!assignmentLoading && assignmentOptions.length === 0 && (
                <Alert severity="info">{emptyStateMessage}</Alert>
            )}

            {selectedThesisId && (
                thesisLoading ? (
                    <Card>
                        <CardContent>
                            <Stack spacing={2}>
                                <Skeleton variant="text" width="50%" height={28} />
                                <Skeleton variant="rectangular" height={200} />
                            </Stack>
                        </CardContent>
                    </Card>
                ) : thesisError ? (
                    <Alert severity="error">{thesisError}</Alert>
                ) : !availableStages.length ? (
                    <Alert severity="info">No terminal requirement submissions are ready for review.</Alert>
                ) : (
                    <Card>
                        <CardContent>
                            <Stack spacing={3}>
                                <Box>
                                    <Typography variant="h6" gutterBottom>
                                        {thesis?.title ?? 'Thesis'}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {groupMeta?.name ? `Group ${groupMeta.name}` : groupMeta?.id ? `Group ${groupMeta.id}` : 'No group metadata'}
                                    </Typography>
                                </Box>

                                <Tabs
                                    value={resolvedStage}
                                    onChange={(_, value: ThesisStage) => setActiveStage(value)}
                                    variant="scrollable"
                                    allowScrollButtonsMobile
                                >
                                    {availableStages.map((stage) => (
                                        <Tab key={stage.value} value={stage.value} label={stage.label} />
                                    ))}
                                </Tabs>

                                {stageAlert}

                                <SubmissionStatus
                                    submission={activeSubmission}
                                    highlightRole={activeSubmission?.currentRole ?? null}
                                />

                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                                    <Button
                                        variant="contained"
                                        startIcon={<TaskAltIcon />}
                                        onClick={handleApprove}
                                        disabled={!canDecide || decisionLoading}
                                    >
                                        {decisionLoading && canDecide ? 'Saving…' : 'Approve stage'}
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        startIcon={<UndoIcon />}
                                        onClick={() => setReturnDialogOpen(true)}
                                        disabled={!canDecide || decisionLoading}
                                    >
                                        Request changes
                                    </Button>
                                </Stack>

                                {stageRequirements.length === 0 ? (
                                    <Alert severity="info">
                                        No requirement definitions were captured for this submission.
                                    </Alert>
                                ) : (
                                    <Stack spacing={2}>
                                        {stageRequirements.map((requirement) => (
                                            <TerminalRequirementCard
                                                key={requirement.id}
                                                requirement={requirement}
                                                files={filesByRequirement[requirement.id]}
                                                status="submitted"
                                                loading={fileLoading[requirement.id]}
                                                disabled
                                            />
                                        ))}
                                    </Stack>
                                )}
                            </Stack>
                        </CardContent>
                    </Card>
                )
            )}

            <Dialog open={returnDialogOpen} onClose={handleCloseReturnDialog} fullWidth maxWidth="sm">
                <DialogTitle>Request changes</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Let the students know what to improve before you can approve this stage.
                    </DialogContentText>
                    <TextField
                        label="Feedback"
                        multiline
                        minRows={3}
                        fullWidth
                        margin="normal"
                        value={returnNote}
                        onChange={(event) => setReturnNote(event.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseReturnDialog} disabled={decisionLoading}>Cancel</Button>
                    <Button
                        onClick={handleConfirmReturn}
                        variant="contained"
                        startIcon={<UndoIcon />}
                        disabled={decisionLoading}
                    >
                        Send request
                    </Button>
                </DialogActions>
            </Dialog>
        </Stack>
    );
}
