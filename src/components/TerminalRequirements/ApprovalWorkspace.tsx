import * as React from 'react';
import {
    Alert, Autocomplete, Box, Button, Card, CardContent, Dialog, DialogActions, DialogContent,
    DialogContentText, DialogTitle, Skeleton, Stack, Tab, Tabs, TextField, Typography
} from '@mui/material';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import UndoIcon from '@mui/icons-material/Undo';
import { useSession } from '@toolpad/core';
import type { Session } from '../../types/session';
import type { ThesisStageName, ThesisData } from '../../types/thesis';
import type { ThesisGroup } from '../../types/group';
import type { FileAttachment } from '../../types/file';
import type { TerminalRequirementApprovalRole, TerminalRequirementSubmissionRecord } from '../../types/terminalRequirementSubmission';
import { SubmissionStatus, TERMINAL_REQUIREMENT_ROLE_LABELS } from './SubmissionStatus';
import { TerminalRequirementCard } from './RequirementCard';
import { FileViewer } from '../File';
import { THESIS_STAGE_METADATA, canonicalizeStageValue, getStageLabel } from '../../utils/thesisStageUtils';
import { useSnackbar } from '../Snackbar';
import {
    getReviewerAssignmentsForUser, findThesisById, findThesisByGroupId, type ReviewerRole, type ReviewerAssignment,
} from '../../utils/firebase/firestore/thesis';
import { findGroupById, listenGroupsByPanelist } from '../../utils/firebase/firestore/groups';
import {
    findAndListenTerminalRequirements, findAndRecordTerminalRequirementDecision, getTerminalRequirementConfig
} from '../../utils/firebase/firestore/terminalRequirements';
import type { TerminalRequirementConfigEntry } from '../../types/terminalRequirementTemplate';
import type { TerminalRequirement } from '../../types/terminalRequirement';
import { listTerminalRequirementFiles } from '../../utils/firebase/storage/thesis';
import { DEFAULT_YEAR } from '../../config/firestore';
import {
    notifyTerminalApproval, notifyTerminalReturned, type TerminalApprovalRole
} from '../../utils/auditNotificationUtils';

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
    description: string;
    emptyStateMessage: string;
}

export function TerminalRequirementApprovalWorkspace({
    role,
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
    const [requirementConfig, setRequirementConfig] = React.useState<
        Record<string, TerminalRequirementConfigEntry>
    >({});
    const [submissionByStage, setSubmissionByStage] = React.useState<
        Partial<Record<ThesisStageName, TerminalRequirementSubmissionRecord[]>>
    >({});
    const [activeStage, setActiveStage] = React.useState<ThesisStageName | null>(null);
    const [filesByRequirement, setFilesByRequirement] = React.useState<
        Record<string, FileAttachment[]>
    >({});
    const [fileLoading, setFileLoading] = React.useState<Record<string, boolean>>({});
    const [decisionLoading, setDecisionLoading] = React.useState(false);
    const [returnDialogOpen, setReturnDialogOpen] = React.useState(false);
    const [returnNote, setReturnNote] = React.useState('');
    const [viewingFile, setViewingFile] = React.useState<FileAttachment | null>(null);

    /** Ref to track if we've already auto-selected a stage for the current thesis */
    const hasAutoSelectedStage = React.useRef(false);

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
                onData: (groups: ThesisGroup[]) => {
                    // Don't use deprecated group.thesis - store groupId and resolve thesis later
                    setAssignmentOptions(groups.map((group) => ({
                        thesisId: '', // Will be resolved via findThesisByGroupId
                        label: group.name || group.id,
                        groupId: group.id,
                    })));
                    setAssignmentLoading(false);
                },
                onError: (listenerError: Error) => {
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
                console.error('Failed to load expert assignments:', error);
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
        const fallbackGroupId = fallback.groupId;
        setThesisLoading(true);
        void (async () => {
            try {
                const groupThesis = await findThesisByGroupId(fallbackGroupId);
                if (cancelled) {
                    return;
                }
                if (groupThesis?.id) {
                    const resolvedThesisId = groupThesis.id;
                    setSelectedThesisId(resolvedThesisId);
                    // Update the assignment option with the resolved thesisId for future matching
                    setAssignmentOptions((prev) => prev.map((opt) =>
                        opt.groupId === fallbackGroupId ? { ...opt, thesisId: resolvedThesisId } : opt
                    ));
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
            hasAutoSelectedStage.current = false;
            return;
        }
        // Reset auto-selection when a different thesis is selected
        hasAutoSelectedStage.current = false;

        let cancelled = false;
        const loadThesis = async () => {
            setThesisLoading(true);
            setThesisError(null);
            setThesis(null);
            setGroupMeta(null);
            try {
                const data = await findThesisById(selectedThesisId);
                if (cancelled) {
                    return;
                }
                if (data) {
                    setThesis({ ...data, id: selectedThesisId });
                    if (data.groupId) {
                        const group = await findGroupById(data.groupId);
                        if (!cancelled) {
                            setGroupMeta(group);
                        }
                    }
                } else {
                    setThesisError('Unable to load thesis details.');
                }
            } catch (error) {
                console.error('Failed to load thesis record for expert approvals:', error);
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
            return findAndListenTerminalRequirements(selectedThesisId, stageValue, {
                onData: (records: TerminalRequirementSubmissionRecord[]) => {
                    setSubmissionByStage((prev) => ({
                        ...prev,
                        [stageValue]: records,
                    }));
                },
                onError: (listenerError: Error) => {
                    console.error(`Submission listener error for ${stageValue}:`, listenerError);
                },
            });
        });
        return () => {
            unsubscribers.forEach((unsubscribe) => unsubscribe());
        };
    }, [selectedThesisId]);

    // Load requirement configuration based on group's department/course
    React.useEffect(() => {
        if (!groupMeta?.department || !groupMeta?.course || !groupMeta?.year) {
            setRequirementConfig({});
            return;
        }
        let cancelled = false;
        void (async () => {
            try {
                const config = await getTerminalRequirementConfig({
                    year: groupMeta.year!,
                    department: groupMeta.department!,
                    course: groupMeta.course!,
                });
                if (!cancelled) {
                    // Convert requirements array to a map keyed by requirementId
                    const configMap: Record<string, TerminalRequirementConfigEntry> = {};
                    if (config?.requirements) {
                        config.requirements.forEach((entry) => {
                            configMap[entry.requirementId] = entry;
                        });
                    }
                    setRequirementConfig(configMap);
                }
            } catch (error) {
                console.error('Failed to load terminal requirement config:', error);
                if (!cancelled) {
                    setRequirementConfig({});
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [groupMeta?.year, groupMeta?.department, groupMeta?.course]);

    const availableStages = React.useMemo(() => {
        return THESIS_STAGE_METADATA.filter((stageMeta) => {
            const submissions = submissionByStage[stageMeta.value];
            return submissions && submissions.length > 0;
        });
    }, [submissionByStage]);

    /**
     * Find the first stage where this role needs to take action (currentRole matches).
     * Falls back to the first available stage if none require action.
     */
    const getInProgressStageForRole = React.useCallback(() => {
        for (const stageMeta of availableStages) {
            const submissions = submissionByStage[stageMeta.value];
            const needsAction = submissions?.some(
                (sub) => sub.locked && sub.status === 'in_review' && sub.currentRole === role
            );
            if (needsAction) {
                return stageMeta.value;
            }
        }
        return availableStages[0]?.value ?? null;
    }, [availableStages, submissionByStage, role]);

    React.useEffect(() => {
        if (!availableStages.length) {
            setActiveStage(null);
            hasAutoSelectedStage.current = false;
            return;
        }
        const currentStageSubmissions = activeStage ? submissionByStage[activeStage] : undefined;
        if (!activeStage || !currentStageSubmissions || currentStageSubmissions.length === 0) {
            // Auto-select in-progress stage only once per thesis selection
            if (!hasAutoSelectedStage.current) {
                hasAutoSelectedStage.current = true;
                const inProgressStage = getInProgressStageForRole();
                setActiveStage(inProgressStage);
            } else {
                setActiveStage(availableStages[0].value);
            }
        }
    }, [availableStages, activeStage, submissionByStage, getInProgressStageForRole]);

    const resolvedStage = activeStage ?? availableStages[0]?.value ?? null;
    // Get all submissions for the resolved stage
    const activeSubmissions = resolvedStage ? (submissionByStage[resolvedStage] ?? []) : [];
    // Use the first submission for display purposes (they should have similar workflow state)
    const activeSubmission = activeSubmissions.length > 0 ? activeSubmissions[0] : null;
    // Collect all requirement IDs from all submissions in the stage
    const allRequirementIds = React.useMemo(() => {
        const ids = new Set<string>();
        activeSubmissions.forEach((submission) => {
            submission.requirementIds.forEach((id) => ids.add(id));
        });
        return Array.from(ids);
    }, [activeSubmissions]);

    const stageRequirements: TerminalRequirement[] = React.useMemo(() => {
        if (!resolvedStage || allRequirementIds.length === 0) {
            return [];
        }
        // Filter requirements by stage and map to TerminalRequirement format
        // Use canonicalizeStageValue to handle both slug and full name formats
        return Object.values(requirementConfig)
            .filter((entry) => {
                const canonicalEntryStage = canonicalizeStageValue(entry.stage);
                return canonicalEntryStage === resolvedStage &&
                    allRequirementIds.includes(entry.requirementId);
            })
            .map((entry): TerminalRequirement => ({
                id: entry.requirementId,
                stage: resolvedStage, // Use canonical slug
                title: entry.title ?? entry.requirementId,
                description: entry.description ?? '',
            }));
    }, [resolvedStage, allRequirementIds, requirementConfig]);

    React.useEffect(() => {
        setFilesByRequirement({});
        setFileLoading({});
    }, [resolvedStage, selectedThesisId]);

    const loadRequirementFiles = React.useCallback(async (requirementId: string) => {
        if (!thesis?.id || !groupMeta?.id || !resolvedStage) {
            return;
        }
        setFileLoading((prev) => ({ ...prev, [requirementId]: true }));
        try {
            const files = await listTerminalRequirementFiles({
                thesisId: thesis.id,
                groupId: groupMeta.id,
                stage: resolvedStage,
                requirementId,
                year: groupMeta.year ?? DEFAULT_YEAR,
                department: groupMeta.department ?? '',
                course: groupMeta.course ?? '',
            });
            setFilesByRequirement((prev) => ({ ...prev, [requirementId]: files }));
        } catch (error) {
            console.error('Failed to load requirement files for expert view:', error);
        } finally {
            setFileLoading((prev) => ({ ...prev, [requirementId]: false }));
        }
    }, [
        groupMeta?.course,
        groupMeta?.department,
        groupMeta?.id,
        groupMeta?.year,
        resolvedStage,
        thesis?.id,
    ]);

    React.useEffect(() => {
        if (allRequirementIds.length === 0 || !resolvedStage) {
            return;
        }
        allRequirementIds.forEach((requirementId) => {
            if (!filesByRequirement[requirementId]) {
                void loadRequirementFiles(requirementId);
            }
        });
    }, [allRequirementIds, filesByRequirement, loadRequirementFiles, resolvedStage]);

    // Can decide if ANY submission in this stage is awaiting this role's decision
    const canDecide = React.useMemo(() => {
        if (!userUid) return false;
        return activeSubmissions.some((submission) =>
            submission.locked &&
            submission.status === 'in_review' &&
            submission.currentRole === role
        );
    }, [userUid, activeSubmissions, role]);

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
        const groupId = option.groupId;
        setThesisLoading(true);
        void (async () => {
            try {
                const groupThesis = await findThesisByGroupId(groupId as string);
                if (groupThesis?.id) {
                    const resolvedThesisId = groupThesis.id;
                    setSelectedThesisId(resolvedThesisId);
                    // Update the assignment option with the resolved thesisId for future matching
                    setAssignmentOptions((prev) => prev.map((opt) =>
                        opt.groupId === groupId ? { ...opt, thesisId: resolvedThesisId } : opt
                    ));
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
            const updatedRecord = await findAndRecordTerminalRequirementDecision({
                thesisId: thesis.id,
                stage: resolvedStage,
                role,
                approverUid: userUid,
                action: 'approve',
            });
            showNotification('Stage approved.', 'success');

            // Audit notification for terminal requirement approval
            if (groupMeta) {
                const stageName = getStageLabel(resolvedStage);

                // Check if this is the final approval (all approvers approved)
                const isFinalApproval = updatedRecord.status === 'approved';

                // Determine next approver role (if not final)
                const nextApproverRole = isFinalApproval
                    ? null
                    : updatedRecord.currentRole as TerminalApprovalRole | null;

                void notifyTerminalApproval({
                    group: groupMeta,
                    approverId: userUid,
                    approverRole: role as TerminalApprovalRole,
                    stageName,
                    isFinalApproval,
                    nextApproverRole,
                    details: { stage: resolvedStage },
                });
            }
        } catch (error) {
            console.error('Failed to approve terminal requirements:', error);
            const message = error instanceof Error ? error.message : 'Unable to save your decision.';
            showNotification(message, 'error');
        } finally {
            setDecisionLoading(false);
        }
    }, [thesis?.id, resolvedStage, activeSubmission, role, userUid, showNotification, groupMeta]);

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
            await findAndRecordTerminalRequirementDecision({
                thesisId: thesis.id,
                stage: resolvedStage,
                role,
                approverUid: userUid,
                action: 'return',
                note: returnNote.trim() || undefined,
            });
            showNotification('Request sent back to students.', 'info');

            // Audit notification for terminal requirement return
            if (groupMeta) {
                const stageName = getStageLabel(resolvedStage);
                void notifyTerminalReturned({
                    group: groupMeta,
                    returnerId: userUid,
                    returnerRole: role as TerminalApprovalRole,
                    stageName,
                    note: returnNote.trim() || undefined,
                    details: { stage: resolvedStage },
                });
            }

            setReturnDialogOpen(false);
            setReturnNote('');
        } catch (error) {
            console.error('Failed to return terminal requirements:', error);
            const message = error instanceof Error ? error.message : 'Unable to send recommendations.';
            showNotification(message, 'error');
        } finally {
            setDecisionLoading(false);
        }
    }, [thesis?.id, resolvedStage, activeSubmission, role, userUid, returnNote, showNotification, groupMeta]);

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
            const returnedByLabel = activeSubmission.returnedBy
                ? TERMINAL_REQUIREMENT_ROLE_LABELS[activeSubmission.returnedBy]
                : 'a expert';
            return (
                <Alert severity="warning">
                    Returned to students by {returnedByLabel} on{' '}
                    {formatDateTime(activeSubmission.returnedAt)}.
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

    // For panel assignments, thesisId is resolved later, so also match by groupId
    const selectedAssignment = assignmentOptions.find((option) =>
        option.thesisId === selectedThesisId ||
        (option.groupId && groupMeta?.id && option.groupId === groupMeta.id)
    ) ?? null;

    return (
        <Stack spacing={3}>
            <Box>
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
                                        {groupMeta?.name
                                            ? `Group ${groupMeta.name}`
                                            : groupMeta?.id
                                                ? `Group ${groupMeta.id}`
                                                : 'No group metadata'}
                                    </Typography>
                                </Box>

                                <Tabs
                                    value={resolvedStage}
                                    onChange={(_, value: ThesisStageName) => setActiveStage(value)}
                                    variant="scrollable"
                                    scrollButtons="auto"
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
                                                onViewFile={setViewingFile}
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

            {/* File Viewer Dialog */}
            <Dialog
                open={Boolean(viewingFile)}
                onClose={() => setViewingFile(null)}
                maxWidth="xl"
                fullWidth
                slotProps={{
                    paper: { sx: { height: '90vh' } },
                }}
            >
                <FileViewer
                    file={viewingFile}
                    onBack={() => setViewingFile(null)}
                    height="100%"
                    showToolbar
                />
            </Dialog>
        </Stack>
    );
}
