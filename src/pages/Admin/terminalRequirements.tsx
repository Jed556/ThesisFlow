import * as React from 'react';
import {
    Alert, Autocomplete, Box, Button, Card, CardContent, CircularProgress, Grid,
    Stack, Switch, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import { FactCheck as FactCheckIcon, Upload as UploadIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useSession } from '@toolpad/core';
import { AnimatedPage } from '../../components/Animate';
import { useSnackbar } from '../../components/Snackbar';
import { UnauthorizedNotice } from '../../layouts/UnauthorizedNotice';
import type { NavigationItem } from '../../types/navigation';
import type { Session } from '../../types/session';
import type { ThesisStageName } from '../../types/thesis';
import type { TerminalRequirement } from '../../types/terminalRequirement';
import type { TerminalRequirementConfigEntry, TerminalRequirementTemplateMetadata } from '../../types/terminalRequirementConfig';
import { findUserById } from '../../utils/firebase/firestore/user';
import { getGroupsByDepartment, getGroupDepartments } from '../../utils/firebase/firestore/groups';
import {
    getAllTerminalRequirementConfigs,
    getTerminalRequirementConfig,
    setTerminalRequirementConfig,
} from '../../utils/firebase/firestore/terminalRequirements';
import {
    uploadTerminalRequirementTemplate,
    deleteTerminalRequirementTemplate,
} from '../../utils/firebase/storage/terminalRequirements';
import {
    THESIS_STAGE_METADATA,
} from '../../utils/thesisStageUtils';
import {
    TERMINAL_REQUIREMENTS,
} from '../../utils/terminalRequirements';

type RequirementStateMap = Record<string, TerminalRequirementConfigEntry>;

function createDefaultRequirementState(): RequirementStateMap {
    return TERMINAL_REQUIREMENTS.reduce<RequirementStateMap>((acc, definition) => {
        acc[definition.id] = {
            stage: definition.stage,
            requirementId: definition.id,
            active: true,
        };
        return acc;
    }, {});
}

function mergeRequirementState(entries?: TerminalRequirementConfigEntry[]): RequirementStateMap {
    const base = createDefaultRequirementState();
    if (!entries || entries.length === 0) {
        return base;
    }
    entries.forEach((entry) => {
        if (!entry.requirementId || !base[entry.requirementId]) {
            return;
        }
        base[entry.requirementId] = {
            stage: entry.stage,
            requirementId: entry.requirementId,
            active: Boolean(entry.active),
            ...(entry.requireAttachment !== undefined ? { requireAttachment: entry.requireAttachment } : {}),
            ...(entry.template ? { template: { ...entry.template } } : {}),
        };
    });
    return base;
}

function cloneRequirementState(state: RequirementStateMap): RequirementStateMap {
    return Object.keys(state).reduce<RequirementStateMap>((acc, key) => {
        const entry = state[key];
        acc[key] = {
            stage: entry.stage,
            requirementId: entry.requirementId,
            active: entry.active,
            ...(entry.requireAttachment !== undefined ? { requireAttachment: entry.requireAttachment } : {}),
            ...(entry.template ? { template: { ...entry.template } } : {}),
        };
        return acc;
    }, {});
}

function areRequirementStatesEqual(a: RequirementStateMap, b: RequirementStateMap): boolean {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) {
        return false;
    }
    return aKeys.every((key) => {
        const entryA = a[key];
        const entryB = b[key];
        if (!entryA || !entryB) {
            return false;
        }
        const sameTemplate = entryA.template?.fileId === entryB.template?.fileId
            && entryA.template?.fileUrl === entryB.template?.fileUrl
            && entryA.template?.fileName === entryB.template?.fileName
            && entryA.template?.uploadedAt === entryB.template?.uploadedAt
            && entryA.template?.uploadedBy === entryB.template?.uploadedBy;
        return entryA.active === entryB.active
            && entryA.stage === entryB.stage
            && entryA.requireAttachment === entryB.requireAttachment
            && sameTemplate;
    });
}

interface RequirementRow {
    definition: TerminalRequirement;
    entry: TerminalRequirementConfigEntry;
}

export const metadata: NavigationItem = {
    group: 'management',
    index: 5,
    title: 'Terminal Requirements',
    segment: 'admin-terminal-requirements',
    icon: <FactCheckIcon />,
    roles: ['admin', 'developer'],
};

export default function AdminTerminalRequirementsPage() {
    const session = useSession<Session>();
    const userUid = session?.user?.uid ?? '';
    const { showNotification } = useSnackbar();

    const canManage = session?.user?.role === 'admin' || session?.user?.role === 'developer';

    const [profileLoading, setProfileLoading] = React.useState(true);
    const [departments, setDepartments] = React.useState<string[]>([]);
    const [selectedDepartment, setSelectedDepartment] = React.useState('');

    const [courseOptions, setCourseOptions] = React.useState<string[]>([]);
    const [coursesLoading, setCoursesLoading] = React.useState(false);
    const [selectedCourse, setSelectedCourse] = React.useState('');

    const [configLoading, setConfigLoading] = React.useState(false);
    const [configError, setConfigError] = React.useState<string | null>(null);

    const [requirementState, setRequirementState] = React.useState<RequirementStateMap>(() => createDefaultRequirementState());
    const syncedStateRef = React.useRef<RequirementStateMap>(createDefaultRequirementState());

    const [activeStage, setActiveStage] = React.useState<ThesisStageName>(THESIS_STAGE_METADATA[0].value);
    const [saving, setSaving] = React.useState(false);
    const [uploadingMap, setUploadingMap] = React.useState<Record<string, boolean>>({});
    const [removingMap, setRemovingMap] = React.useState<Record<string, boolean>>({});

    const definitionById = React.useMemo<Record<string, TerminalRequirement>>(() => {
        return TERMINAL_REQUIREMENTS.reduce<Record<string, TerminalRequirement>>((acc, definition) => {
            acc[definition.id] = definition;
            return acc;
        }, {});
    }, []);

    const hasUnsavedChanges = React.useMemo(
        () => !areRequirementStatesEqual(requirementState, syncedStateRef.current),
        [requirementState]
    );

    React.useEffect(() => {
        if (!canManage || !userUid) {
            setProfileLoading(false);
            setDepartments([]);
            setSelectedDepartment('');
            return;
        }

        let cancelled = false;
        setProfileLoading(true);

        const loadDepartments = async () => {
            try {
                const [profile, allConfigs, groupDepartments] = await Promise.all([
                    findUserById(userUid),
                    getAllTerminalRequirementConfigs().catch(() => []),
                    getGroupDepartments().catch(() => []),
                ]);

                if (cancelled) {
                    return;
                }

                const managedDepartments = profile?.departments?.filter(Boolean)
                    ?? (profile?.department ? [profile.department] : []);

                const normalizedManaged = managedDepartments
                    .map((dept: string) => dept.trim())
                    .filter((dept: string): dept is string => Boolean(dept));
                normalizedManaged.sort((a: string, b: string) => a.localeCompare(b));

                // Extract departments from all terminal requirement configs
                const knownDepartments = new Set<string>();
                allConfigs.forEach((config) => {
                    if (config.department) {
                        knownDepartments.add(config.department.trim());
                    }
                });
                const normalizedKnown = Array.from(knownDepartments);

                const normalizedFromGroups = groupDepartments
                    .map((dept: string) => dept.trim())
                    .filter((dept: string): dept is string => Boolean(dept));

                const unique = new Set<string>([...normalizedKnown, ...normalizedManaged, ...normalizedFromGroups]);
                const sortedDepartments = Array.from(unique).sort((a, b) => a.localeCompare(b));
                setDepartments(sortedDepartments);

                const fallback = normalizedManaged[0] ?? sortedDepartments[0] ?? '';
                setSelectedDepartment((current) => {
                    if (current && current.trim()) {
                        const trimmed = current.trim();
                        return unique.has(trimmed) ? trimmed : current;
                    }
                    return fallback;
                });
            } catch (error) {
                console.error('Failed to load terminal requirement departments:', error);
                if (!cancelled) {
                    showNotification('Failed to load available departments.', 'error');
                    setDepartments([]);
                    setSelectedDepartment('');
                }
            } finally {
                if (!cancelled) {
                    setProfileLoading(false);
                }
            }
        };

        void loadDepartments();

        return () => {
            cancelled = true;
        };
    }, [canManage, showNotification, userUid]);

    React.useEffect(() => {
        setSelectedCourse('');
    }, [selectedDepartment]);

    React.useEffect(() => {
        if (!selectedDepartment) {
            setCourseOptions([]);
            setSelectedCourse('');
            return;
        }

        let cancelled = false;
        setCoursesLoading(true);

        const loadCourses = async () => {
            try {
                const [groups, allConfigs] = await Promise.all([
                    getGroupsByDepartment(selectedDepartment),
                    getAllTerminalRequirementConfigs().catch(() => []),
                ]);

                if (cancelled) {
                    return;
                }

                // Filter configs by department
                const filteredConfigs = allConfigs.filter(
                    (config) => config.department?.toLowerCase() === selectedDepartment.toLowerCase()
                );

                const fromGroups = groups
                    .map((group) => group.course?.trim())
                    .filter((course): course is string => Boolean(course));

                const fromConfigs = filteredConfigs
                    .map((config) => config.course?.trim())
                    .filter((course): course is string => Boolean(course));

                const uniqueCourses = Array.from(new Set([...fromGroups, ...fromConfigs])).sort((a, b) => a.localeCompare(b));
                setCourseOptions(uniqueCourses);
                setSelectedCourse((current) => {
                    if (current.trim()) {
                        return current.trim();
                    }
                    return uniqueCourses[0] ?? '';
                });
            } catch (error) {
                console.error('Failed to load courses for department:', error);
                if (!cancelled) {
                    showNotification('Failed to load courses for this department.', 'error');
                    setCourseOptions([]);
                    setSelectedCourse('');
                }
            } finally {
                if (!cancelled) {
                    setCoursesLoading(false);
                }
            }
        };

        void loadCourses();

        return () => {
            cancelled = true;
        };
    }, [selectedDepartment, showNotification]);

    React.useEffect(() => {
        if (!selectedDepartment || !selectedCourse) {
            const defaults = createDefaultRequirementState();
            setRequirementState(defaults);
            syncedStateRef.current = cloneRequirementState(defaults);
            return;
        }

        let cancelled = false;
        setConfigLoading(true);
        setConfigError(null);

        void getTerminalRequirementConfig(selectedDepartment, selectedCourse)
            .then((config) => {
                if (cancelled) {
                    return;
                }
                const nextState = mergeRequirementState(config?.requirements);
                setRequirementState(nextState);
                syncedStateRef.current = cloneRequirementState(nextState);
            })
            .catch((error) => {
                console.error('Failed to load terminal requirements config:', error);
                if (!cancelled) {
                    setConfigError('Unable to load terminal requirements for the selected course.');
                    const defaults = createDefaultRequirementState();
                    setRequirementState(defaults);
                    syncedStateRef.current = cloneRequirementState(defaults);
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
    }, [selectedCourse, selectedDepartment]);

    const persistEntries = React.useCallback(async (
        nextState: RequirementStateMap,
        options?: { silent?: boolean },
    ): Promise<boolean> => {
        if (!selectedDepartment || !selectedCourse) {
            showNotification('Select a department and course before saving.', 'error');
            return false;
        }

        const shouldShowLoader = !options?.silent;
        if (shouldShowLoader) {
            setSaving(true);
        }

        try {
            await setTerminalRequirementConfig({
                department: selectedDepartment,
                course: selectedCourse,
                requirements: Object.values(nextState),
            });
            return true;
        } catch (error) {
            console.error('Failed to save terminal requirements config:', error);
            showNotification('Failed to save terminal requirements.', 'error');
            return false;
        } finally {
            if (shouldShowLoader) {
                setSaving(false);
            }
        }
    }, [selectedCourse, selectedDepartment, showNotification]);

    const handleSave = React.useCallback(async () => {
        const success = await persistEntries(requirementState);
        if (success) {
            syncedStateRef.current = cloneRequirementState(requirementState);
            showNotification('Terminal requirements saved.', 'success');
        }
    }, [persistEntries, requirementState, showNotification]);

    const handleToggleRequirement = React.useCallback((requirementId: string, nextActive: boolean) => {
        setRequirementState((prev) => {
            const current = prev[requirementId];
            if (!current || current.active === nextActive) {
                return prev;
            }
            const nextState = { ...prev, [requirementId]: { ...current, active: nextActive } };
            return nextState;
        });
    }, []);

    const handleStageChange = React.useCallback((_: React.SyntheticEvent, nextStage: ThesisStageName) => {
        setActiveStage(nextStage);
    }, []);

    const stageRows = React.useMemo<RequirementRow[]>(() => {
        return TERMINAL_REQUIREMENTS
            .filter((requirement) => requirement.stage === activeStage)
            .map((definition) => ({
                definition,
                entry: requirementState[definition.id] ?? {
                    stage: definition.stage,
                    requirementId: definition.id,
                    active: true,
                },
            }));
    }, [activeStage, requirementState]);

    const handleTemplateUpload = React.useCallback(async (requirementId: string, file: File) => {
        if (!selectedDepartment || !selectedCourse) {
            showNotification('Pick a department and course first.', 'error');
            return;
        }
        if (!userUid) {
            showNotification('You must be signed in to upload templates.', 'error');
            return;
        }

        setUploadingMap((prev) => ({ ...prev, [requirementId]: true }));
        try {
            const uploadResult = await uploadTerminalRequirementTemplate({
                file,
                department: selectedDepartment,
                course: selectedCourse,
                requirementId,
                uploadedBy: userUid,
            });

            const metadata: TerminalRequirementTemplateMetadata = {
                fileId: uploadResult.fileId,
                fileName: uploadResult.fileName,
                fileUrl: uploadResult.fileUrl,
                uploadedAt: new Date().toISOString(),
                uploadedBy: userUid,
            };

            const nextState = cloneRequirementState(requirementState);
            const existing = nextState[requirementId] ?? {
                stage: definitionById[requirementId]?.stage ?? THESIS_STAGE_METADATA[0].value,
                requirementId,
                active: true,
            };
            nextState[requirementId] = {
                ...existing,
                template: metadata,
            };

            const success = await persistEntries(nextState, { silent: true });
            if (success) {
                setRequirementState(nextState);
                syncedStateRef.current = cloneRequirementState(nextState);
                showNotification('Template uploaded.', 'success');
            } else {
                await deleteTerminalRequirementTemplate(uploadResult.storagePath);
            }
        } catch (error) {
            console.error('Failed to upload template:', error);
            showNotification('Failed to upload template. Please try again.', 'error');
        } finally {
            setUploadingMap((prev) => ({ ...prev, [requirementId]: false }));
        }
    }, [definitionById, persistEntries, requirementState, selectedCourse, selectedDepartment, showNotification, userUid]);

    const handleRemoveTemplate = React.useCallback(async (requirementId: string) => {
        const currentEntry = requirementState[requirementId];
        if (!currentEntry?.template) {
            return;
        }

        setRemovingMap((prev) => ({ ...prev, [requirementId]: true }));
        try {
            if (currentEntry.template.fileUrl) {
                await deleteTerminalRequirementTemplate(currentEntry.template.fileUrl);
            }

            const nextState = cloneRequirementState(requirementState);
            nextState[requirementId] = { ...nextState[requirementId], template: undefined };

            const success = await persistEntries(nextState, { silent: true });
            if (success) {
                setRequirementState(nextState);
                syncedStateRef.current = cloneRequirementState(nextState);
                showNotification('Template removed.', 'success');
            }
        } catch (error) {
            console.error('Failed to remove template:', error);
            showNotification('Failed to remove template. Please try again.', 'error');
        } finally {
            setRemovingMap((prev) => ({ ...prev, [requirementId]: false }));
        }
    }, [persistEntries, requirementState, showNotification]);

    const renderRequirementCard = (row: RequirementRow) => {
        const { definition, entry } = row;
        const uploading = uploadingMap[definition.id];
        const removing = removingMap[definition.id];
        const hasTemplate = Boolean(entry.template);

        const uploadedAtLabel = entry.template?.uploadedAt
            ? new Date(entry.template.uploadedAt).toLocaleString()
            : null;

        return (
            <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Stack direction="row" justifyContent="space-between" spacing={2}>
                        <Box>
                            <Typography variant="subtitle1" fontWeight={600}>{definition.title}</Typography>
                            <Typography variant="body2" color="text.secondary">
                                {definition.description}
                            </Typography>
                        </Box>
                        <Stack alignItems="flex-end" spacing={0.5}>
                            <Typography variant="caption" color="text.secondary">
                                {entry.active ? 'Required' : 'Hidden'}
                            </Typography>
                            <Switch
                                checked={entry.active}
                                onChange={(_, checked) => handleToggleRequirement(definition.id, checked)}
                            />
                        </Stack>
                    </Stack>

                    {definition.instructions && (
                        <Typography variant="caption" color="text.secondary">
                            {definition.instructions}
                        </Typography>
                    )}

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
                        <Button
                            component="label"
                            variant="outlined"
                            startIcon={<UploadIcon />}
                            disabled={!selectedDepartment || !selectedCourse || uploading}
                        >
                            {uploading ? 'Uploading…' : hasTemplate ? 'Replace template' : 'Upload template'}
                            <input
                                type="file"
                                hidden
                                accept=".pdf,.doc,.docx"
                                onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    if (file) {
                                        void handleTemplateUpload(definition.id, file);
                                    }
                                    event.target.value = '';
                                }}
                            />
                        </Button>
                        {(uploading || removing) && <CircularProgress size={20} />}
                        {hasTemplate && (
                            <Stack direction="row" spacing={1} flexWrap="wrap">
                                <Button
                                    variant="text"
                                    component="a"
                                    href={entry.template?.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    View template
                                </Button>
                                <Button
                                    variant="text"
                                    color="error"
                                    startIcon={<DeleteIcon />}
                                    onClick={() => handleRemoveTemplate(definition.id)}
                                    disabled={removing}
                                >
                                    Remove
                                </Button>
                            </Stack>
                        )}
                    </Stack>

                    {uploadedAtLabel && (
                        <Typography variant="caption" color="text.secondary">
                            Uploaded on {uploadedAtLabel}
                        </Typography>
                    )}
                </CardContent>
            </Card>
        );
    };

    if (!canManage) {
        return <UnauthorizedNotice title="Terminal Requirements" variant="box" />;
    }

    return (
        <AnimatedPage variant="slideUp">
            <Stack spacing={3}>
                <Box>
                    <Typography color="text.secondary">
                        Choose which forms are required per stage and attach the latest templates for your courses.
                    </Typography>
                </Box>

                <Card variant="outlined">
                    <CardContent>
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
                            <Autocomplete
                                freeSolo
                                options={departments}
                                value={selectedDepartment}
                                onChange={(_, value) => setSelectedDepartment(value ?? '')}
                                onInputChange={(_, value, reason) => {
                                    if (reason === 'clear') {
                                        setSelectedDepartment('');
                                    }
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Department"
                                        placeholder={profileLoading ? 'Loading...' : 'Select department'}
                                    />
                                )}
                                disabled={profileLoading || departments.length === 0}
                                sx={{ minWidth: 240 }}
                            />
                            <Autocomplete
                                freeSolo
                                options={courseOptions}
                                value={selectedCourse}
                                onChange={(_, value) => setSelectedCourse(value ?? '')}
                                onInputChange={(_, value) => setSelectedCourse(value)}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Course"
                                        placeholder={coursesLoading ? 'Loading courses...' : 'Select or type course'}
                                    />
                                )}
                                disabled={!selectedDepartment}
                                sx={{ minWidth: 240 }}
                            />
                            <Box sx={{ flexGrow: 1 }} />
                            <Button
                                variant="contained"
                                onClick={handleSave}
                                disabled={saving || !hasUnsavedChanges || !selectedDepartment || !selectedCourse}
                            >
                                {saving ? 'Saving…' : 'Save changes'}
                            </Button>
                        </Stack>
                        {!selectedDepartment && !profileLoading && (
                            <Alert severity="info" sx={{ mt: 2 }}>
                                Add at least one department to your profile to manage requirements.
                            </Alert>
                        )}
                        {selectedDepartment && !selectedCourse && (
                            <Alert severity="info" sx={{ mt: 2 }}>
                                Select or enter a course to configure its requirements.
                            </Alert>
                        )}
                        {hasUnsavedChanges && (
                            <Alert severity="warning" sx={{ mt: 2 }}>
                                You have unsaved changes for this course.
                            </Alert>
                        )}
                    </CardContent>
                </Card>

                {configError && (
                    <Alert severity="error">{configError}</Alert>
                )}

                {configLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                        <CircularProgress />
                    </Box>
                ) : selectedDepartment && selectedCourse ? (
                    <Stack spacing={2}>
                        <Card variant="outlined">
                            <CardContent sx={{ p: 0 }}>
                                <Tabs
                                    value={activeStage}
                                    onChange={handleStageChange}
                                    variant="scrollable"
                                    scrollButtons
                                    allowScrollButtonsMobile
                                >
                                    {THESIS_STAGE_METADATA.map((stage) => (
                                        <Tab key={stage.value} value={stage.value} label={stage.label} />
                                    ))}
                                </Tabs>
                            </CardContent>
                        </Card>
                        {stageRows.length === 0 ? (
                            <Alert severity="info">
                                No terminal requirements defined for {activeStage}.
                            </Alert>
                        ) : (
                            <Grid container spacing={2}>
                                {stageRows.map((row) => (
                                    <Grid key={row.definition.id} size={{ xs: 12, md: 6 }}>
                                        {renderRequirementCard(row)}
                                    </Grid>
                                ))}
                            </Grid>
                        )}
                    </Stack>
                ) : (
                    <Alert severity="info">
                        Choose a department and course to start configuring terminal requirements.
                    </Alert>
                )}
            </Stack>
        </AnimatedPage>
    );
}
