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
import type { ThesisData, ThesisStage } from '../../types/thesis';
import type { ThesisGroup } from '../../types/group';
import type { TerminalRequirementDefinition } from '../../types/terminalRequirement';
import type { TerminalRequirementConfigEntry } from '../../types/terminalRequirementConfig';
import type { FileAttachment } from '../../types/file';
import type {
    TerminalRequirementApproverAssignments,
    TerminalRequirementSubmissionRecord,
} from '../../types/terminalRequirementSubmission';
import { useSnackbar } from '../../components/Snackbar';
import { listenThesesForParticipant } from '../../utils/firebase/firestore/thesis';
import { getGroupById } from '../../utils/firebase/firestore/groups';
import { getTerminalRequirementConfig } from '../../utils/firebase/firestore/terminalRequirementConfigs';
import { uploadThesisFile, deleteThesisFile } from '../../utils/firebase/storage/thesis';
import {
    THESIS_STAGE_METADATA,
    buildStageCompletionMap,
} from '../../utils/thesisStageUtils';
import {
    fetchTerminalRequirementFiles,
    getTerminalRequirementStatus,
    getTerminalRequirementsByStage,
} from '../../utils/terminalRequirements';
import {
    listenTerminalRequirementSubmission,
    submitTerminalRequirementStage,
} from '../../utils/firebase/firestore/terminalRequirementSubmissions';
import { UnauthorizedNotice } from '../../layouts/UnauthorizedNotice';

export const metadata: NavigationItem = {
    group: 'thesis',
    index: 2,
    title: 'Terminal Requirements',
    segment: 'terminal-requirements',
    icon: <UploadIcon />,
    roles: ['student'],
};

type ThesisRecord = ThesisData & { id: string };

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
    const [activeStage, setActiveStage] = React.useState<ThesisStage>(THESIS_STAGE_METADATA[0].value);
    const [requirementFiles, setRequirementFiles] = React.useState<RequirementFilesMap>({});
    const [requirementLoading, setRequirementLoading] = React.useState<RequirementFlagMap>({});
    const [uploadingMap, setUploadingMap] = React.useState<RequirementFlagMap>({});
    const [uploadErrors, setUploadErrors] = React.useState<RequirementMessageMap>({});
    const [groupMeta, setGroupMeta] = React.useState<ThesisGroup | null>(null);
    const [requirementsConfig, setRequirementsConfig] = React.useState<TerminalRequirementConfigEntry[] | null>(null);
    const [configLoading, setConfigLoading] = React.useState(false);
    const [configError, setConfigError] = React.useState<string | null>(null);
    const [submissionByStage, setSubmissionByStage] = React.useState<
        Partial<Record<ThesisStage, TerminalRequirementSubmissionRecord | null>>
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
                const preferred = records.find((record) => record.leader === userUid) ?? records[0] ?? null;
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
        if (!thesis?.groupId) {
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

        void getGroupById(thesis.groupId)
            .then((group) => {
                if (!cancelled) {
                    if (group?.department && group?.course) {
                        setConfigLoading(true);
                    }
                    setGroupMeta(group);
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
    }, [thesis?.groupId]);

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

        void getTerminalRequirementConfig(groupMeta.department, groupMeta.course)
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
            return listenTerminalRequirementSubmission(thesis.id, stageValue, {
                onData: (record) => {
                    setSubmissionByStage((prev) => ({
                        ...prev,
                        [stageValue]: record,
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
        return THESIS_STAGE_METADATA.reduce<Record<ThesisStage, TerminalRequirementDefinition[]>>((acc, stageMeta) => {
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
        }, {} as Record<ThesisStage, TerminalRequirementDefinition[]>);
    }, [configRequirementMap]);

    const approverAssignments = React.useMemo<TerminalRequirementApproverAssignments>(() => {
        const assignments: TerminalRequirementApproverAssignments = {};
        const members = groupMeta?.members;

        const panels = members?.panels?.filter((uid): uid is string => Boolean(uid)) ?? [];
        if (panels.length) {
            assignments.panel = panels;
        }

        const adviserUid = members?.adviser ?? thesis?.adviser;
        if (adviserUid) {
            assignments.adviser = [adviserUid];
        }

        const editorUid = members?.editor ?? thesis?.editor;
        if (editorUid) {
            assignments.editor = [editorUid];
        }

        const statisticianUid = members?.statistician ?? thesis?.statistician;
        if (statisticianUid) {
            assignments.statistician = [statisticianUid];
        }

        return assignments;
    }, [groupMeta?.members, thesis?.adviser, thesis?.editor, thesis?.statistician]);

    const isConfigInitializing = configLoading && !requirementsConfig;

    const normalizedChapters = thesis?.chapters ?? [];
    const stageUnlockMap = React.useMemo(
        () => buildStageCompletionMap(normalizedChapters, { treatEmptyAsComplete: false }),
        [normalizedChapters],
    );

    const stageRequirements = stageRequirementsByStage[activeStage] ?? [];
    const activeStageUnlocked = stageUnlockMap[activeStage] ?? false;
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
        if (!thesis?.id || !activeStageUnlocked) {
            return;
        }
        stageRequirements.forEach((requirement) => {
            if (requirementFiles[requirement.id]) {
                return;
            }
            void loadRequirementFiles(requirement.id);
        });
    }, [thesis?.id, activeStageUnlocked, stageRequirements, requirementFiles, loadRequirementFiles]);

    const handleUploadRequirement = React.useCallback(async (
        requirement: TerminalRequirementDefinition,
        fileList: FileList,
    ) => {
        if (!thesis?.id || !userUid) {
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
    }, [loadRequirementFiles, showNotification, thesis?.id, userUid]);

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

    const handleStageChange = React.useCallback((_: React.SyntheticEvent, nextStage: ThesisStage) => {
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
        return THESIS_STAGE_METADATA.reduce<Record<ThesisStage, StageStatusMeta>>((acc, stageMeta) => {
            const stageValue = stageMeta.value;
            const unlocked = stageUnlockMap[stageValue];
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
        }, {} as Record<ThesisStage, StageStatusMeta>);
    }, [stageUnlockMap, submissionByStage, stageRequirementsByStage, requirementFiles]);

    const activeSubmission = submissionByStage[activeStage] ?? null;
    const stageLockedByWorkflow = Boolean(activeSubmission?.locked);
    const allowFileActions = activeStageUnlocked && !stageLockedByWorkflow;
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
        if (!thesis?.id || !thesis.groupId) {
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
            await submitTerminalRequirementStage({
                thesisId: thesis.id,
                groupId: thesis.groupId,
                stage: activeStage,
                requirementIds: stageRequirements.map((requirement) => requirement.id),
                submittedBy: userUid,
                assignments: approverAssignments,
            });
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
        thesis?.groupId,
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
                    const unlocked = stageUnlockMap[stageMeta.value];
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
                <Alert severity="info">
                    Your terminal requirements will appear here once your thesis record is available.
                </Alert>
            </AnimatedPage>
        );
    }

    const stageTitle = activeStageMeta?.label ?? activeStage;
    const stageLockedDescription = `Complete all ${stageTitle} chapters to unlock its requirements.`;

    return (
        <AnimatedPage variant="slideUp">
            <Stack spacing={3}>
                <Box>
                    <Typography variant="h4" gutterBottom>
                        Terminal Requirements
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Upload the signed forms and supporting documents needed for each stage after your chapters are approved.
                    </Typography>
                </Box>

                {renderTabs()}

                {!activeStageUnlocked ? (
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
