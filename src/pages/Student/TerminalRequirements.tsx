import * as React from 'react';
import {
    Alert, Box, Button, Card, CardContent, Dialog, Grid, LinearProgress,
    Skeleton, Stack, Tab, Tabs, Typography,
} from '@mui/material';
import { FactCheck as FactCheckIcon, TaskAlt as TaskAltIcon } from '@mui/icons-material';
import { AnimatedPage } from '../../components/Animate';
import { SubmissionStatus, TerminalRequirementCard, TERMINAL_REQUIREMENT_ROLE_LABELS } from '../../components/TerminalRequirements';
import { FileViewer } from '../../components/File';
import { useSession } from '@toolpad/core';
import type { Session } from '../../types/session';
import type { NavigationItem } from '../../types/navigation';
import type { ThesisStageName } from '../../types/thesis';
import type { ThesisGroup } from '../../types/group';
import type { TerminalRequirement } from '../../types/terminalRequirement';
import type { TerminalRequirementConfigEntry } from '../../types/terminalRequirementTemplate';
import type { FileAttachment } from '../../types/file';
import type {
    TerminalRequirementApproverAssignments, TerminalRequirementSubmissionRecord
} from '../../types/terminalRequirementSubmission';
import type { ThesisChapter } from '../../types/thesis';
import type { PanelCommentReleaseMap, PanelCommentStage } from '../../types/panelComment';
import { createDefaultPanelCommentReleaseMap } from '../../types/panelComment';
import { useSnackbar } from '../../components/Snackbar';
import { listenThesesForParticipant, type ThesisRecord } from '../../utils/firebase/firestore/thesis';
import { getGroupsByMember } from '../../utils/firebase/firestore/groups';
import { listenAllChaptersForThesis, type ThesisChaptersContext } from '../../utils/firebase/firestore/chapters';
import {
    getTerminalRequirementConfig, findAndListenTerminalRequirements, submitTerminalRequirement, type TerminalContext,
} from '../../utils/firebase/firestore/terminalRequirements';
import {
    listenPanelCommentRelease, listenPanelCommentCompletion, type PanelCommentContext
} from '../../utils/firebase/firestore/panelComments';
import { isAnyTableReleasedForStage } from '../../utils/panelCommentUtils';
import { uploadThesisFile, deleteThesisFile, listTerminalRequirementFiles } from '../../utils/firebase/storage/thesis';
import {
    THESIS_STAGE_METADATA, buildStageCompletionMap, buildInterleavedStageLockMap,
    describeStageSequenceStep, getPreviousSequenceStep, canonicalizeStageValue,
    type StageGateOverrides,
} from '../../utils/thesisStageUtils';
import { getTerminalRequirementStatus } from '../../utils/terminalRequirements';
import { UnauthorizedNotice } from '../../layouts/UnauthorizedNotice';
import { DEFAULT_YEAR } from '../../config/firestore';
import { auditAndNotify } from '../../utils/auditNotificationUtils';

export const metadata: NavigationItem = {
    group: 'thesis',
    index: 4,
    title: 'Terminal Requirements',
    segment: 'terminal-requirements',
    icon: <FactCheckIcon />,
    roles: ['student'],
};

// FIX: In the new data model, thesis data and group membership are stored separately.\n// The page now fetches the user's group first, then gets the thesis from the group.

type RequirementFilesMap = Record<string, FileAttachment[]>;
type RequirementFlagMap = Record<string, boolean>;
type RequirementMessageMap = Record<string, string | null>;

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
        Partial<Record<ThesisStageName, TerminalRequirementSubmissionRecord[]>>
    >({});
    const [submitLoading, setSubmitLoading] = React.useState(false);
    /** Chapters fetched from subcollection (new hierarchical structure) */
    const [chapters, setChapters] = React.useState<ThesisChapter[]>([]);
    const [viewingFile, setViewingFile] = React.useState<FileAttachment | null>(null);
    /** Panel comment release status for sequence locking */
    const [panelCommentReleaseMap, setPanelCommentReleaseMap] = React.useState<PanelCommentReleaseMap>(
        createDefaultPanelCommentReleaseMap()
    );
    /** Panel comment approval status - gates Post terminal requirements */
    const [panelCommentApprovalMap, setPanelCommentApprovalMap] = React.useState<
        Partial<Record<ThesisStageName, boolean>>
    >({});

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

    // Fetch chapters from subcollection (new hierarchical structure)
    React.useEffect(() => {
        if (!thesis?.id || !groupMeta?.id || !groupMeta?.department || !groupMeta?.course) {
            setChapters([]);
            return;
        }

        const chaptersCtx: ThesisChaptersContext = {
            year: groupMeta.year ?? DEFAULT_YEAR,
            department: groupMeta.department,
            course: groupMeta.course,
            groupId: groupMeta.id,
            thesisId: thesis.id,
        };

        const unsubscribe = listenAllChaptersForThesis(chaptersCtx, {
            onData: (allChapters) => {
                setChapters(allChapters);
            },
            onError: (listenerError) => {
                console.error('Failed to load chapters:', listenerError);
                setChapters([]);
            },
        });

        return () => {
            unsubscribe();
        };
    }, [thesis?.id, groupMeta?.id, groupMeta?.department, groupMeta?.course, groupMeta?.year]);

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

        const year = groupMeta.year ?? DEFAULT_YEAR;
        void getTerminalRequirementConfig({
            year,
            department: groupMeta.department,
            course: groupMeta.course,
        })
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
    }, [groupMeta?.department, groupMeta?.course, groupMeta?.year]);

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
                        [stageValue]: records,
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
            if (!configRequirementMap) {
                // No config loaded yet - return empty array for each stage
                acc[stageMeta.value] = [];
            } else {
                // Build requirements from config entries for this stage
                // Use canonicalizeStageValue to handle both slug and full name formats
                acc[stageMeta.value] = Object.values(configRequirementMap)
                    .filter((entry) => {
                        const canonicalEntryStage = canonicalizeStageValue(entry.stage);
                        return canonicalEntryStage === stageMeta.value && entry.required;
                    })
                    .map((entry): TerminalRequirement => ({
                        id: entry.requirementId,
                        stage: stageMeta.value, // Use canonical slug
                        title: entry.title ?? entry.requirementId,
                        description: entry.description ?? '',
                        ...(entry.fileTemplate && {
                            templateFile: {
                                id: entry.fileTemplate.fileId,
                                name: entry.fileTemplate.fileName,
                                url: entry.fileTemplate.fileUrl,
                                type: '',
                                size: '',
                                uploadDate: entry.fileTemplate.uploadedAt,
                                author: entry.fileTemplate.uploadedBy,
                            },
                        }),
                    }));
            }
            return acc;
        }, {} as Record<ThesisStageName, TerminalRequirement[]>);
    }, [configRequirementMap]);

    const approverAssignments = React.useMemo<TerminalRequirementApproverAssignments>(() => {
        const assignments: TerminalRequirementApproverAssignments = {};
        const members = groupMeta?.members;

        // Panel approval is only required for "Post" stages, not "Pre" stages
        // Pre stages slugs: "pre-proposal", "pre-defense"
        const isPreStage = activeStage.startsWith('pre-');
        if (!isPreStage) {
            const panels = members?.panels?.filter((uid): uid is string => Boolean(uid)) ?? [];
            if (panels.length) {
                assignments.panel = panels;
            }
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
    }, [groupMeta?.members, activeStage]);

    const isConfigInitializing = configLoading && !requirementsConfig;

    // FIX: Use treatEmptyAsComplete: true so that stages without chapters don't block
    // terminal requirements. If no chapters are defined for a stage, students should
    // still be able to access terminal requirements for that stage.
    const chapterCompletionMap = React.useMemo(
        () => buildStageCompletionMap(chapters, { treatEmptyAsComplete: true }),
        [chapters],
    );

    const terminalRequirementCompletionMap = React.useMemo(() => {
        return THESIS_STAGE_METADATA.reduce<Record<ThesisStageName, boolean>>((acc, stageMeta) => {
            const submissions = submissionByStage[stageMeta.value] ?? [];
            // Stage is complete if there are submissions and ALL are approved
            acc[stageMeta.value] = submissions.length > 0 && submissions.every((s) => s.status === 'approved');
            return acc;
        }, {} as Record<ThesisStageName, boolean>);
    }, [submissionByStage]);

    /** Build panel comment context from group metadata */
    const panelCommentCtx: PanelCommentContext | null = React.useMemo(() => {
        if (!groupMeta) return null;
        return {
            year: groupMeta.year ?? DEFAULT_YEAR,
            department: groupMeta.department ?? '',
            course: groupMeta.course ?? '',
            groupId: groupMeta.id,
        };
    }, [groupMeta]);

    /** Listen for panel comment release status */
    React.useEffect(() => {
        if (!panelCommentCtx) {
            setPanelCommentReleaseMap(createDefaultPanelCommentReleaseMap());
            return;
        }

        const unsubscribe = listenPanelCommentRelease(panelCommentCtx, {
            onData: (releaseMap) => {
                setPanelCommentReleaseMap(releaseMap);
            },
            onError: (err) => {
                console.error('Failed to load panel comment release status:', err);
                setPanelCommentReleaseMap(createDefaultPanelCommentReleaseMap());
            },
        });

        return () => {
            unsubscribe();
        };
    }, [panelCommentCtx]);

    /** Listen for panel comment APPROVAL status - gates Post terminal requirements */
    React.useEffect(() => {
        if (!panelCommentCtx) {
            setPanelCommentApprovalMap({});
            return;
        }

        const stages: PanelCommentStage[] = ['proposal', 'defense'];
        const stageToThesisStage: Record<PanelCommentStage, ThesisStageName> = {
            'proposal': 'pre-proposal',
            'defense': 'pre-defense',
        };

        const unsubscribers = stages.map((panelCommentStage) => (
            listenPanelCommentCompletion(panelCommentCtx, panelCommentStage, {
                onData: (allApproved) => {
                    const thesisStage = stageToThesisStage[panelCommentStage];
                    setPanelCommentApprovalMap((prev) => ({
                        ...prev,
                        [thesisStage]: allApproved,
                    }));
                },
                onError: (err) => {
                    console.error(`Failed to listen for panel comment approval (${panelCommentStage}):`, err);
                },
            })
        ));

        return () => {
            unsubscribers.forEach((unsubscribe) => unsubscribe());
        };
    }, [panelCommentCtx]);

    /**
     * Panel comment completion map for sequence locking.
     * Maps thesis stage slugs to whether panel comments are RELEASED.
     * This unlocks Post-Proposal/Post-Defense chapters when comments are released.
     */
    const panelCommentCompletionMap = React.useMemo((): Partial<Record<ThesisStageName, boolean>> => {
        return {
            'pre-proposal': isAnyTableReleasedForStage('proposal', panelCommentReleaseMap),
            'pre-defense': isAnyTableReleasedForStage('defense', panelCommentReleaseMap),
        };
    }, [panelCommentReleaseMap]);

    /**
     * Stage gate overrides for terminal requirements.
     * Post-Proposal and Post-Defense terminals require panel comments to be APPROVED.
     */
    const stageGateOverrides = React.useMemo<StageGateOverrides>(() => ({
        terminalRequirements: {
            'post-proposal': panelCommentApprovalMap['pre-proposal'] ?? false,
            'post-defense': panelCommentApprovalMap['pre-defense'] ?? false,
        },
    }), [panelCommentApprovalMap]);

    const stageLockMaps = React.useMemo(() => buildInterleavedStageLockMap({
        chapters: chapterCompletionMap,
        terminalRequirements: terminalRequirementCompletionMap,
        panelComments: panelCommentCompletionMap,
    }, stageGateOverrides), [chapterCompletionMap, terminalRequirementCompletionMap, panelCommentCompletionMap, stageGateOverrides]);

    const terminalStageLockMap = stageLockMaps.terminalRequirements;

    const stageRequirements = stageRequirementsByStage[activeStage] ?? [];
    const activeStageLocked = terminalStageLockMap[activeStage] ?? false;
    const activeStageMeta = React.useMemo(
        () => THESIS_STAGE_METADATA.find((stage) => stage.value === activeStage),
        [activeStage],
    );

    const loadRequirementFiles = React.useCallback(async (requirement: TerminalRequirement) => {
        if (!thesis?.id || !groupMeta?.id) {
            return;
        }
        setRequirementLoading((prev) => ({ ...prev, [requirement.id]: true }));
        try {
            const files = await listTerminalRequirementFiles({
                thesisId: thesis.id,
                groupId: groupMeta.id,
                stage: requirement.stage,
                requirementId: requirement.id,
                year: groupMeta.year ?? DEFAULT_YEAR,
                department: groupMeta.department ?? '',
                course: groupMeta.course ?? '',
            });
            setRequirementFiles((prev) => ({ ...prev, [requirement.id]: files }));
        } catch (loadError) {
            console.error('Failed to load requirement files:', loadError);
        } finally {
            setRequirementLoading((prev) => ({ ...prev, [requirement.id]: false }));
        }
    }, [groupMeta?.course, groupMeta?.department, groupMeta?.id, groupMeta?.year, thesis?.id]);

    React.useEffect(() => {
        if (!thesis?.id || activeStageLocked) {
            return;
        }
        stageRequirements.forEach((requirement) => {
            if (requirementFiles[requirement.id]) {
                return;
            }
            void loadRequirementFiles(requirement);
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
        const uploadYear = groupMeta.year ?? DEFAULT_YEAR;
        const uploadDepartment = groupMeta.department ?? '';
        const uploadCourse = groupMeta.course ?? '';

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
                    year: uploadYear,
                    department: uploadDepartment,
                    course: uploadCourse,
                });
            }
            showNotification('Requirement uploaded successfully.', 'success');
            await loadRequirementFiles(requirement);
        } catch (uploadError) {
            const message = uploadError instanceof Error
                ? uploadError.message
                : 'Failed to upload requirement.';
            setUploadErrors((prev) => ({ ...prev, [requirement.id]: message }));
            showNotification(message, 'error');
        } finally {
            setUploadingMap((prev) => ({ ...prev, [requirement.id]: false }));
        }
    }, [
        groupMeta?.course,
        groupMeta?.department,
        groupMeta?.id,
        groupMeta?.year,
        loadRequirementFiles,
        showNotification,
        thesis?.id,
        userUid,
    ]);

    const handleDeleteFile = React.useCallback(async (requirement: TerminalRequirement, file: FileAttachment) => {
        if (!thesis?.id || !file.id || !file.url) {
            showNotification('Unable to delete file. Missing metadata.', 'error');
            return;
        }
        try {
            await deleteThesisFile(file.url);
            showNotification('File removed.', 'success');
            await loadRequirementFiles(requirement);
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

    const stageTitle = activeStageMeta?.label ?? activeStage;
    const stageLockedDescription = React.useMemo(() => {
        const previousStep = getPreviousSequenceStep(activeStage, 'terminal');
        if (previousStep) {
            return `Complete ${describeStageSequenceStep(previousStep)} to unlock ${stageTitle} requirements.`;
        }
        return 'Complete the required chapters to unlock this checklist.';
    }, [activeStage, stageTitle]);

    // Get all submissions for the active stage and derive aggregate status
    const activeSubmissions = submissionByStage[activeStage] ?? [];
    // Use the first submission for display purposes, but consider all for workflow logic
    const activeSubmission = activeSubmissions[0] ?? null;
    // Stage is locked by workflow if ANY submission is locked
    const stageLockedByWorkflow = activeSubmissions.some((s) => s.locked);
    const allowFileActions = !activeStageLocked && !stageLockedByWorkflow;
    const readyForSubmission = stageRequirements.length > 0
        && stageRequirements.every((requirement) => (requirementFiles[requirement.id]?.length ?? 0) > 0);
    const submitButtonLabel = activeSubmission?.status === 'returned'
        ? 'Resubmit requirements'
        : 'Submit requirements';
    const canSubmit = allowFileActions && readyForSubmission && !submitLoading;
    const pendingRoleLabel = activeSubmission?.currentRole
        ? TERMINAL_REQUIREMENT_ROLE_LABELS[activeSubmission.currentRole]
        : 'expert';

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
            showNotification('Submitted for expert review.', 'success');

            // Audit notification for terminal requirement submission
            void auditAndNotify({
                group: groupMeta,
                userId: userUid,
                name: 'Terminal Requirements Submitted',
                description: `Terminal requirements for ${activeStage} have been submitted for review.`,
                category: 'terminal',
                action: 'submission_created',
                targets: {
                    groupMembers: true,
                    adviser: true,
                    excludeUserId: userUid,
                },
                details: { stage: activeStage, requirementCount: stageRequirements.length },
            });
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
        if (activeSubmissions.length === 0 || !activeSubmission) {
            return null;
        }

        // Check if ALL submissions in the stage are approved (required for unlock)
        const allApproved = activeSubmissions.every((s) => s.status === 'approved');
        const someInReview = activeSubmissions.some((s) => s.status === 'in_review');
        const someReturned = activeSubmissions.some((s) => s.status === 'returned');

        // Show returned status if any submission is returned
        if (someReturned) {
            const returnedSubmission = activeSubmissions.find((s) => s.status === 'returned');
            return (
                <Alert severity="warning">
                    {returnedSubmission?.returnNote ?? 'A service requested changes to your submission.'}
                    {returnedSubmission?.returnedBy && (
                        <Typography variant="body2" sx={{ mt: 1 }}>
                            Returned by{' '}
                            {TERMINAL_REQUIREMENT_ROLE_LABELS[returnedSubmission.returnedBy]} on{' '}
                            {formatDateTime(returnedSubmission.returnedAt)}.
                        </Typography>
                    )}
                </Alert>
            );
        }

        // Show in_review status if any submission is still being reviewed
        if (someInReview) {
            return (
                <Alert severity="info">
                    Submitted {formatDateTime(activeSubmission.submittedAt)}. Uploads are locked while{' '}
                    {pendingRoleLabel.toLowerCase()} reviews your files.
                </Alert>
            );
        }

        // Only show approved if ALL submissions are approved
        if (allApproved) {
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
    }, [activeSubmissions, activeSubmission, formatDateTime, pendingRoleLabel]);

    const renderTabs = () => (
        <Card variant="outlined" sx={{ mb: 3 }}>
            <Tabs
                value={activeStage}
                onChange={handleStageChange}
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
            >
                {THESIS_STAGE_METADATA.map((stageMeta) => (
                    <Tab
                        key={stageMeta.value}
                        value={stageMeta.value}
                        label={stageMeta.label}
                    />
                ))}
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
                    <Box sx={{ display: 'flex', flexGrow: 1, alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
                        <UnauthorizedNotice
                            title={`${stageTitle} requirements locked`}
                            description={stageLockedDescription}
                            variant="box"
                            sx={{ minHeight: 'auto' }}
                        />
                    </Box>
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
                                                            ? (file) => handleDeleteFile(requirement, file)
                                                            : undefined}
                                                        onViewFile={setViewingFile}
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
        </AnimatedPage>
    );
}
