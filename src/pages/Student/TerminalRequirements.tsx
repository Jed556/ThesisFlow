import * as React from 'react';
import {
    Alert, Box, Card, CardContent, Chip, Grid, LinearProgress, Skeleton, Stack, Tab, Tabs, Typography,
} from '@mui/material';
import UploadIcon from '@mui/icons-material/Upload';
import { AnimatedPage } from '../../components/Animate';
import { TerminalRequirementCard } from '../../components/TerminalRequirements';
import { useSession } from '@toolpad/core';
import type { Session } from '../../types/session';
import type { NavigationItem } from '../../types/navigation';
import type { ThesisData, ThesisStage } from '../../types/thesis';
import type { ThesisGroup } from '../../types/group';
import type { TerminalRequirementDefinition } from '../../types/terminalRequirement';
import type { TerminalRequirementConfigEntry } from '../../types/terminalRequirementConfig';
import type { FileAttachment } from '../../types/file';
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
                    const requirements = stageRequirementsByStage[stageMeta.value] ?? [];
                    const submittedCount = requirements.filter((requirement) => (
                        (requirementFiles[requirement.id]?.length ?? 0) > 0
                    )).length;
                    const completed = unlocked && requirements.length > 0 && submittedCount === requirements.length;
                    const inProgress = unlocked && submittedCount > 0 && !completed;
                    const label = unlocked
                        ? (completed ? 'Submitted' : inProgress ? 'In progress' : 'Ready')
                        : 'Locked';
                    const chipColor: 'default' | 'success' | 'info' = unlocked
                        ? (completed ? 'success' : inProgress ? 'info' : 'default')
                        : 'default';
                    const chipVariant: 'filled' | 'outlined' = unlocked && (completed || inProgress) ? 'filled' : 'outlined';
                    return (
                        <Tab
                            key={stageMeta.value}
                            value={stageMeta.value}
                            label={(
                                <Stack spacing={0.5} alignItems="center">
                                    <Typography variant="body2" fontWeight={600}>{stageMeta.label}</Typography>
                                    <Chip label={label} size="small" color={chipColor} variant={chipVariant} />
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
                                    </Box>

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
                                                        onUpload={(files) => handleUploadRequirement(requirement, files)}
                                                        onDeleteFile={(file) => handleDeleteFile(requirement.id, file)}
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
