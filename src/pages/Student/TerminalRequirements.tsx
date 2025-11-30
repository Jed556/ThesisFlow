import * as React from 'react';
import {
    Alert, Box, Button, Card, CardContent, Chip, Grid, LinearProgress, Skeleton, Stack, Tab, Tabs, Typography,
} from '@mui/material';
import UploadIcon from '@mui/icons-material/Upload';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import { AnimatedPage } from '../../components/Animate';
import {
    SubmissionStatus,
    TerminalRequirementCard,
    TERMINAL_REQUIREMENT_ROLE_LABELS,
} from '../../components/TerminalRequirements';
import { useSession } from '@toolpad/core';
import type { Session } from '../../types/session';
import type { NavigationItem } from '../../types/navigation';
import type { ThesisStageName } from '../../types/thesis';
import type { ThesisGroup } from '../../types/group';
import type { TerminalRequirement } from '../../types/terminalRequirement';
import type { TerminalRequirementConfigEntry } from '../../types/terminalRequirementConfig';
import type { FileAttachment } from '../../types/file';
import type {
    TerminalRequirementApproverAssignments,
    TerminalRequirementSubmissionRecord,
} from '../../types/terminalRequirementSubmission';
import { useSnackbar } from '../../components/Snackbar';
import { listenThesesForParticipant, type ThesisRecord } from '../../utils/firebase/firestore/thesis';
import { getGroupsByMember } from '../../utils/firebase/firestore/groups';
import {
    getTerminalRequirementConfig,
    findAndListenTerminalRequirements,
    submitTerminalRequirement,
    type TerminalContext,
} from '../../utils/firebase/firestore/terminalRequirements';
import { uploadThesisFile, deleteThesisFile } from '../../utils/firebase/storage/thesis';
import {
    THESIS_STAGE_METADATA,
    buildStageCompletionMap,
    buildInterleavedStageLockMap,
    describeStageSequenceStep,
    getPreviousSequenceStep,
} from '../../utils/thesisStageUtils';
import {
    fetchTerminalRequirementFiles,
    getTerminalRequirementStatus,
    getTerminalRequirementsByStage,
} from '../../utils/terminalRequirements';
import { UnauthorizedNotice } from '../../layouts/UnauthorizedNotice';
import { DEFAULT_YEAR } from '../../config/firestore';

export const metadata: NavigationItem = {
    group: 'thesis',
    index: 2,
    title: 'Terminal Requirements',
    segment: 'terminal-requirements',
    icon: <UploadIcon />,
    roles: ['student'],
};

// FIX: In the new data model, thesis data and group membership are stored separately.\n// The page now fetches the user's group first, then gets the thesis from the group.

type RequirementFilesMap = Record<string, FileAttachment[]>;
type RequirementFlagMap = Record<string, boolean>;
type RequirementMessageMap = Record<string, string | null>;

interface StageStatusMeta {
    label: string;
    color: 'default' | 'success' | 'info' | 'warning' | 'error';
    variant: 'filled' | 'outlined';
}

export default function TerminalRequirementsPage() {
    const session = useSession<Session>();
    const userUid = session?.user?.uid ?? null;
    const { showNotification } = useSnackbar();

    const [thesis, setThesis] = React.useState<ThesisRecord | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [activeStage, setActiveStage] = React.useState<ThesisStageName>(THESIS_STAGE_METADATA[0].value);
    const [requirementFiles, setRequirementFiles] = React.useState<RequirementFilesMap>({});
    const [requirementLoading, setRequirementLoading] = React.useState<RequirementFlagMap>({});
    const [uploadingMap, setUploadingMap] = React.useState<RequirementFlagMap>({});
    const [uploadErrors, setUploadErrors] = React.useState<RequirementMessageMap>({});
    const [groupMeta, setGroupMeta] = React.useState<ThesisGroup | null>(null);
    const [requirementsConfig, setRequirementsConfig] = React.useState<TerminalRequirementConfigEntry[] | null>(null);
    const [configLoading, setConfigLoading] = React.useState(false);
    const [configError, setConfigError] = React.useState<string | null>(null);
    const [submissionByStage, setSubmissionByStage] = React.useState<
        Partial<Record<ThesisStageName, TerminalRequirementSubmissionRecord | null>>
    >({});
    const [submitLoading, setSubmitLoading] = React.useState(false);

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
            setThesis(null);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        const unsubscribe = listenThesesForParticipant(userUid, {
            onData: (records) => {
                // FIX: ThesisRecord doesn't have leader - just take the first thesis for now.
                // A more complete solution would match the thesis to the user's primary group.
                const preferred = records[0] ?? null;
                setThesis(preferred ?? null);
                setIsLoading(false);
                setError(null);
            },
            onError: (listenerError) => {
                console.error('Failed to load terminal requirements thesis record:', listenerError);
                setThesis(null);
                setIsLoading(false);
                setError('Unable to load your thesis right now. Please try again shortly.');
            },
        });

        return () => {
            unsubscribe();
        };
    }, [userUid]);

    React.useEffect(() => {
        // FIX: ThesisRecord doesn't have groupId - fetch the user's group instead
        if (!userUid) {
            setGroupMeta(null);
            setRequirementsConfig(null);
            setConfigError(null);
            setConfigLoading(false);
            return;
        }

        let cancelled = false;
        setGroupMeta(null);
        setRequirementsConfig(null);
        setConfigError(null);

        void getGroupsByMember(userUid)
            .then((groups) => {
                if (!cancelled) {
                    // Take the first active group the user is a member of
                    const activeGroup = groups.find((g) => g.status === 'active') ?? groups[0] ?? null;
                    if (activeGroup?.department && activeGroup?.course) {
                        setConfigLoading(true);
                    }
                    setGroupMeta(activeGroup);
                }
            })
            .catch((error) => {
                console.error('Failed to load thesis group for requirements:', error);
                if (!cancelled) {
                    setGroupMeta(null);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [userUid]);

    React.useEffect(() => {
        if (!groupMeta?.department || !groupMeta?.course) {
            setRequirementsConfig(null);
            setConfigLoading(false);
            setConfigError(null);
            return;
        }

        let cancelled = false;
        setConfigLoading(true);
        setConfigError(null);

        // FIX: getTerminalRequirementConfig takes a configId, not (department, course)
        // Use a convention like "department-course" as the config ID
        const configId = `${groupMeta.department}-${groupMeta.course}`;
        void getTerminalRequirementConfig(configId)
            .then((config) => {
                if (!cancelled) {
                    setRequirementsConfig(config?.requirements ?? null);
                }
            })
            .catch((error) => {
                console.error('Failed to load terminal requirement configuration:', error);
                if (!cancelled) {
                    setRequirementsConfig(null);
                    setConfigError('Unable to load customized requirements for your course. Showing defaults.');
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setConfigLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [groupMeta?.department, groupMeta?.course]);

    React.useEffect(() => {
        if (!thesis?.id) {
            setSubmissionByStage({});
            return;
        }

        const unsubscribers = THESIS_STAGE_METADATA.map((stageMeta) => {
            const stageValue = stageMeta.value;
            return findAndListenTerminalRequirements(thesis.id, stageValue, {
                onData: (records) => {
                    setSubmissionByStage((prev) => ({
                        ...prev,
                        [stageValue]: records[0] ?? null,
                    }));
                },
                onError: (listenerError) => {
                    console.error(`Terminal requirement submission listener error for ${stageValue}:`, listenerError);
                },
            });
        });

        return () => {
            unsubscribers.forEach((unsubscribe) => unsubscribe());
        };
    }, [thesis?.id]);

    const configRequirementMap = React.useMemo(() => {
        if (!requirementsConfig) {
            return null;
        }
        return requirementsConfig.reduce<Record<string, TerminalRequirementConfigEntry>>((acc, entry) => {
            acc[entry.requirementId] = entry;
            return acc;
        }, {});
    }, [requirementsConfig]);

    const stageRequirementsByStage = React.useMemo(() => {
        return THESIS_STAGE_METADATA.reduce<Record<ThesisStageName, TerminalRequirement[]>>((acc, stageMeta) => {
            const baseDefinitions = getTerminalRequirementsByStage(stageMeta.value);
            if (!configRequirementMap) {
                acc[stageMeta.value] = baseDefinitions;
            } else {
                acc[stageMeta.value] = baseDefinitions
                    .filter((definition) => {
                        const entry = configRequirementMap[definition.id];
                        return entry ? entry.active : false;
                    })
                    .map((definition) => {
                        const entry = configRequirementMap[definition.id];
                        if (!entry?.template) {
                            return definition;
                        }
                        return {
                            ...definition,
                            templateFileId: entry.template.fileId,
                            templateFileName: entry.template.fileName,
                            templateFileUrl: entry.template.fileUrl,
                        };
                    });
            }
            return acc;
        }, {} as Record<ThesisStageName, TerminalRequirement[]>);
    }, [configRequirementMap]);

    const approverAssignments = React.useMemo<TerminalRequirementApproverAssignments>(() => {
        const assignments: TerminalRequirementApproverAssignments = {};
        const members = groupMeta?.members;

        const panels = members?.panels?.filter((uid): uid is string => Boolean(uid)) ?? [];
        if (panels.length) {
            assignments.panel = panels;
        }

        // FIX: adviser, editor, statistician are on group.members, not on thesis
        const adviserUid = members?.adviser;
        if (adviserUid) {
            assignments.adviser = [adviserUid];
        }

        const editorUid = members?.editor;
        if (editorUid) {
            assignments.editor = [editorUid];
        }

        const statisticianUid = members?.statistician;
        if (statisticianUid) {
            assignments.statistician = [statisticianUid];
        }

        return assignments;
    }, [groupMeta?.members]);

    const isConfigInitializing = configLoading && !requirementsConfig;

    // FIX: ThesisData doesn't have chapters directly - it has stages which can contain chapters
    const normalizedChapters = React.useMemo(() => {
        if (!thesis?.stages) return [];
        return thesis.stages.flatMap((stage) => stage.chapters ?? []);
    }, [thesis?.stages]);
    const chapterCompletionMap = React.useMemo(
        () => buildStageCompletionMap(normalizedChapters, { treatEmptyAsComplete: false }),
        [normalizedChapters],
    );

    const terminalRequirementCompletionMap = React.useMemo(() => {
        return THESIS_STAGE_METADATA.reduce<Record<ThesisStageName, boolean>>((acc, stageMeta) => {
            const submission = submissionByStage[stageMeta.value];
            acc[stageMeta.value] = submission?.status === 'approved';
            return acc;
        }, {} as Record<ThesisStageName, boolean>);
    }, [submissionByStage]);

    const stageLockMaps = React.useMemo(() => buildInterleavedStageLockMap({
        chapters: chapterCompletionMap,
        terminalRequirements: terminalRequirementCompletionMap,
    }), [chapterCompletionMap, terminalRequirementCompletionMap]);

    const terminalStageLockMap = stageLockMaps.terminalRequirements;

    const stageRequirements = stageRequirementsByStage[activeStage] ?? [];
    const activeStageLocked = terminalStageLockMap[activeStage] ?? false;
    const activeStageMeta = React.useMemo(
        () => THESIS_STAGE_METADATA.find((stage) => stage.value === activeStage),
        [activeStage],
    );

    const loadRequirementFiles = React.useCallback(async (requirementId: string) => {
        if (!thesis?.id) {
            return;
        }
        setRequirementLoading((prev) => ({ ...prev, [requirementId]: true }));
        try {
            const files = await fetchTerminalRequirementFiles(thesis.id, requirementId);
            setRequirementFiles((prev) => ({ ...prev, [requirementId]: files }));
        } catch (loadError) {
            console.error('Failed to load requirement files:', loadError);
        } finally {
            setRequirementLoading((prev) => ({ ...prev, [requirementId]: false }));
        }
    }, [thesis?.id]);

    React.useEffect(() => {
        if (!thesis?.id || activeStageLocked) {
            return;
        }
        stageRequirements.forEach((requirement) => {
            if (requirementFiles[requirement.id]) {
                return;
            }
            void loadRequirementFiles(requirement.id);
        });
    }, [thesis?.id, activeStageLocked, stageRequirements, requirementFiles, loadRequirementFiles]);

    const handleUploadRequirement = React.useCallback(async (
        requirement: TerminalRequirement,
        fileList: FileList,
    ) => {
        // FIX: Use groupMeta.id instead of thesis.groupId (thesis doesn't have groupId)
        if (!thesis?.id || !groupMeta?.id || !userUid) {
            showNotification('You must be signed in to upload requirements.', 'error');
            return;
        }
        const files = Array.from(fileList);
        if (files.length === 0) {
            return;
        }

        setUploadingMap((prev) => ({ ...prev, [requirement.id]: true }));
        setUploadErrors((prev) => ({ ...prev, [requirement.id]: null }));

        try {
            for (const file of files) {
                await uploadThesisFile({
                    file,
                    userUid,
                    thesisId: thesis.id,
                    groupId: groupMeta.id,
                    category: 'attachment',
                    metadata: {
                        scope: 'terminal-requirements',
                        requirementId: requirement.id,
                        stage: requirement.stage,
                    },
                    terminalStage: requirement.stage,
                    terminalRequirementId: requirement.id,
                });
            }
            showNotification('Requirement uploaded successfully.', 'success');
            await loadRequirementFiles(requirement.id);
        } catch (uploadError) {
            const message = uploadError instanceof Error
                ? uploadError.message
                : 'Failed to upload requirement.';
            setUploadErrors((prev) => ({ ...prev, [requirement.id]: message }));
            showNotification(message, 'error');
        } finally {
            setUploadingMap((prev) => ({ ...prev, [requirement.id]: false }));
        }
    }, [loadRequirementFiles, showNotification, thesis?.id, groupMeta?.id, userUid]);

    const handleDeleteFile = React.useCallback(async (requirementId: string, file: FileAttachment) => {
        if (!thesis?.id || !file.id || !file.url) {
            showNotification('Unable to delete file. Missing metadata.', 'error');
            return;
        }
        try {
            await deleteThesisFile(file.url, thesis.id, file.id);
            showNotification('File removed.', 'success');
            await loadRequirementFiles(requirementId);
        } catch (deleteError) {
            console.error('Failed to delete requirement file:', deleteError);
            showNotification('Failed to delete file. Please try again.', 'error');
        }
    }, [loadRequirementFiles, showNotification, thesis?.id]);

    const handleStageChange = React.useCallback((_: React.SyntheticEvent, nextStage: ThesisStageName) => {
        setActiveStage(nextStage);
    }, []);

    const stageProgress = React.useMemo(() => {
        const submittedCount = stageRequirements.filter((requirement) => {
            const files = requirementFiles[requirement.id];
            return files && files.length > 0;
        }).length;
        const total = stageRequirements.length || 1;
        return {
            submittedCount,
            total: stageRequirements.length,
            percent: Math.round((submittedCount / total) * 100),
        };
    }, [stageRequirements, requirementFiles]);

    const stageStatusMetaMap = React.useMemo(() => {
        return THESIS_STAGE_METADATA.reduce<Record<ThesisStageName, StageStatusMeta>>((acc, stageMeta) => {
            const stageValue = stageMeta.value;
            const unlocked = !(terminalStageLockMap[stageValue] ?? false);
            const submission = submissionByStage[stageValue];
            let label: string;
            let color: StageStatusMeta['color'];
            let variant: StageStatusMeta['variant'];

            if (!unlocked) {
                label = 'Locked';
                color = 'default';
                variant = 'outlined';
            } else if (submission) {
                if (submission.status === 'approved') {
                    label = 'Approved';
                    color = 'success';
                    variant = 'filled';
                } else if (submission.status === 'returned') {
                    label = 'Needs updates';
                    color = 'warning';
                    variant = 'filled';
                } else {
                    label = 'Submitted';
                    color = 'info';
                    variant = 'filled';
                }
            } else {
                const requirements = stageRequirementsByStage[stageValue] ?? [];
                const submittedCount = requirements.filter((requirement) => (
                    (requirementFiles[requirement.id]?.length ?? 0) > 0
                )).length;
                const completed = requirements.length > 0 && submittedCount === requirements.length;
                const inProgress = submittedCount > 0 && !completed;
                label = completed ? 'Ready to submit' : inProgress ? 'In progress' : 'Ready';
                color = completed ? 'success' : inProgress ? 'info' : 'default';
                variant = completed || inProgress ? 'filled' : 'outlined';
            }

            acc[stageValue] = { label, color, variant };
            return acc;
        }, {} as Record<ThesisStageName, StageStatusMeta>);
    }, [terminalStageLockMap, submissionByStage, stageRequirementsByStage, requirementFiles]);

    const stageTitle = activeStageMeta?.label ?? activeStage;
    const stageLockedDescription = React.useMemo(() => {
        const previousStep = getPreviousSequenceStep(activeStage, 'terminal');
        if (previousStep) {
            return `Complete ${describeStageSequenceStep(previousStep)} to unlock ${stageTitle} requirements.`;
        }
        return 'Complete the required chapters to unlock this checklist.';
    }, [activeStage, stageTitle]);

    const activeSubmission = submissionByStage[activeStage] ?? null;
    const stageLockedByWorkflow = Boolean(activeSubmission?.locked);
    const allowFileActions = !activeStageLocked && !stageLockedByWorkflow;
    const readyForSubmission = stageRequirements.length > 0
        && stageRequirements.every((requirement) => (requirementFiles[requirement.id]?.length ?? 0) > 0);
    const submitButtonLabel = activeSubmission?.status === 'returned'
        ? 'Resubmit requirements'
        : 'Submit requirements';
    const canSubmit = allowFileActions && readyForSubmission && !submitLoading;
    const pendingRoleLabel = activeSubmission?.currentRole
        ? TERMINAL_REQUIREMENT_ROLE_LABELS[activeSubmission.currentRole]
        : 'mentor';

    const handleSubmitStage = React.useCallback(async () => {
        // FIX: Use groupMeta.id instead of thesis.groupId
        if (!thesis?.id || !groupMeta?.id) {
            showNotification('Missing thesis metadata. Please reload the page and try again.', 'error');
            return;
        }
        if (!userUid) {
            showNotification('You must be signed in to submit requirements.', 'error');
            return;
        }
        if (stageRequirements.length === 0) {
            showNotification('No requirements are configured for this stage yet.', 'info');
            return;
        }
        if (!readyForSubmission) {
            showNotification('Upload all required files before submitting.', 'error');
            return;
        }

        setSubmitLoading(true);
        try {
            // FIX: Use submitTerminalRequirement instead of submitTerminalRequirementStage
            // Submit each requirement in the stage individually
            const ctx: TerminalContext = {
                year: DEFAULT_YEAR,
                department: groupMeta.department ?? '',
                course: groupMeta.course ?? '',
                groupId: groupMeta.id,
                thesisId: thesis.id,
                stage: activeStage,
            };

            for (const requirement of stageRequirements) {
                await submitTerminalRequirement({
                    ctx,
                    requirementId: requirement.id,
                    submittedBy: userUid,
                    assignments: approverAssignments,
                    definition: requirement,
                });
            }
            showNotification('Submitted for mentor review.', 'success');
        } catch (submitError) {
            console.error('Failed to submit terminal requirements:', submitError);
            const message = submitError instanceof Error
                ? submitError.message
                : 'Failed to submit requirements.';
            showNotification(message, 'error');
        } finally {
            setSubmitLoading(false);
        }
    }, [
        thesis?.id,
        groupMeta,
        userUid,
        stageRequirements,
        readyForSubmission,
        activeStage,
        approverAssignments,
        showNotification,
    ]);

    const workflowAlert = React.useMemo(() => {
        if (!activeSubmission) {
            return null;
        }

        if (activeSubmission.status === 'in_review') {
            return (
                <Alert severity="info">
                    Submitted {formatDateTime(activeSubmission.submittedAt)}. Uploads are locked while{' '}
                    {pendingRoleLabel.toLowerCase()} reviews your files.
                </Alert>
            );
        }

        if (activeSubmission.status === 'returned') {
            return (
                <Alert severity="warning">
                    {activeSubmission.returnNote ?? 'A mentor requested changes to your submission.'}
                    {activeSubmission.returnedBy && (
                        <Typography variant="body2" sx={{ mt: 1 }}>
                            Returned by{' '}
                            {TERMINAL_REQUIREMENT_ROLE_LABELS[activeSubmission.returnedBy]} on{' '}
                            {formatDateTime(activeSubmission.returnedAt)}.
                        </Typography>
                    )}
                </Alert>
            );
        }

        if (activeSubmission.status === 'approved') {
            const approvedAt = formatDateTime(
                activeSubmission.completedAt
                ?? activeSubmission.updatedAt
                ?? activeSubmission.submittedAt,
            );
            return (
                <Alert severity="success">
                    Stage approved on {approvedAt}. You can continue to the next milestone.
                </Alert>
            );
        }

        return null;
    }, [activeSubmission, formatDateTime, pendingRoleLabel]);

    const renderTabs = () => (
        <Card variant="outlined" sx={{ mb: 3 }}>
            <Tabs
                value={activeStage}
                onChange={handleStageChange}
                variant="scrollable"
                scrollButtons
                allowScrollButtonsMobile
            >
                {THESIS_STAGE_METADATA.map((stageMeta) => {
                    const unlocked = !(terminalStageLockMap[stageMeta.value] ?? false);
                    const statusMeta = stageStatusMetaMap[stageMeta.value] ?? {
                        label: unlocked ? 'Ready' : 'Locked',
                        color: unlocked ? 'default' : 'default',
                        variant: unlocked ? 'outlined' : 'outlined',
                    };
                    return (
                        <Tab
                            key={stageMeta.value}
                            value={stageMeta.value}
                            label={(
                                <Stack spacing={0.5} alignItems="center">
                                    <Typography variant="body2" fontWeight={600}>{stageMeta.label}</Typography>
                                    <Chip
                                        label={statusMeta.label}
                                        size="small"
                                        color={statusMeta.color}
                                        variant={statusMeta.variant}
                                    />
                                </Stack>
                            )}
                        />
                    );
                })}
            </Tabs>
        </Card>
    );

    if (session?.loading) {
        return (
            <AnimatedPage variant="slideUp">
                <Skeleton variant="text" width="60%" height={48} sx={{ mb: 2 }} />
                <Skeleton variant="rectangular" height={180} />
            </AnimatedPage>
        );
    }

    if (!userUid) {
        return (
            <AnimatedPage variant="slideUp">
                <Alert severity="info">Sign in to manage your terminal requirements.</Alert>
            </AnimatedPage>
        );
    }

    if (error) {
        return (
            <AnimatedPage variant="slideUp">
                <Alert severity="error">{error}</Alert>
            </AnimatedPage>
        );
    }

    if (isLoading) {
        return (
            <AnimatedPage variant="slideUp">
                <Stack spacing={3}>
                    <Skeleton variant="text" width="55%" height={42} />
                    <Skeleton variant="rectangular" height={64} />
                    <Skeleton variant="rectangular" height={320} />
                </Stack>
            </AnimatedPage>
        );
    }

    if (!thesis) {
        return (
            <AnimatedPage variant="slideUp">
                <UnauthorizedNotice
                    title="No thesis record"
                    description="Your terminal requirements will appear here once your thesis record is available."
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
                        Upload the signed forms and supporting documents needed for each stage after your chapters are approved.
                    </Typography>
                </Box>

                {renderTabs()}

                {activeStageLocked ? (
                    <UnauthorizedNotice
                        title={`${stageTitle} requirements locked`}
                        description={stageLockedDescription}
                        variant="box"
                    />
                ) : isConfigInitializing ? (
                    <Stack spacing={3}>
                        <Skeleton variant="rectangular" height={160} />
                        <Skeleton variant="rectangular" height={320} />
                    </Stack>
                ) : (
                    <>
                        {configError && (
                            <Alert severity="warning">{configError}</Alert>
                        )}
                        <Card variant="outlined">
                            <CardContent>
                                <Stack spacing={3}>
                                    <Box>
                                        <Typography variant="h6" gutterBottom>
                                            {stageTitle} requirement checklist
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Submitted {stageProgress.submittedCount} of {stageProgress.total || 0} requirement(s)
                                        </Typography>
                                        <LinearProgress
                                            variant="determinate"
                                            value={Number.isFinite(stageProgress.percent) ? stageProgress.percent : 0}
                                            sx={{ mt: 1, height: 8, borderRadius: 4 }}
                                        />
                                        <Stack
                                            direction={{ xs: 'column', sm: 'row' }}
                                            spacing={1.5}
                                            alignItems={{ sm: 'center' }}
                                            sx={{ mt: 2 }}
                                        >
                                            <Button
                                                variant="contained"
                                                startIcon={<TaskAltIcon />}
                                                onClick={handleSubmitStage}
                                                disabled={!canSubmit}
                                            >
                                                {submitLoading ? 'Submitting…' : submitButtonLabel}
                                            </Button>
                                            {!readyForSubmission && allowFileActions && (
                                                <Typography variant="caption" color="text.secondary">
                                                    Upload files for every requirement to enable submission.
                                                </Typography>
                                            )}
                                        </Stack>
                                    </Box>

                                    {workflowAlert}

                                    <SubmissionStatus
                                        submission={activeSubmission}
                                        highlightRole={activeSubmission?.currentRole ?? null}
                                    />

                                    {stageRequirements.length === 0 ? (
                                        <Alert severity="info">
                                            No terminal requirements are configured for this stage yet.
                                        </Alert>
                                    ) : (
                                        <Grid container spacing={2}>
                                            {stageRequirements.map((requirement) => (
                                                <Grid key={requirement.id} size={{ xs: 12, md: 6 }}>
                                                    <TerminalRequirementCard
                                                        requirement={requirement}
                                                        files={requirementFiles[requirement.id]}
                                                        status={getTerminalRequirementStatus(requirementFiles[requirement.id])}
                                                        loading={requirementLoading[requirement.id]}
                                                        uploading={uploadingMap[requirement.id]}
                                                        error={uploadErrors[requirement.id] ?? undefined}
                                                        disabled={!allowFileActions}
                                                        onUpload={allowFileActions
                                                            ? (files) => handleUploadRequirement(requirement, files)
                                                            : undefined}
                                                        onDeleteFile={allowFileActions
                                                            ? (file) => handleDeleteFile(requirement.id, file)
                                                            : undefined}
                                                    />
                                                </Grid>
                                            ))}
                                        </Grid>
                                    )}
                                </Stack>
                            </CardContent>
                        </Card>
                    </>
                )}
            </Stack>
        </AnimatedPage>
    );
}
