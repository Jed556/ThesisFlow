import * as React from 'react';
import {
    Autocomplete, Box, Button, CircularProgress, Dialog, DialogActions,
    DialogContent, DialogTitle, LinearProgress, Stack, TextField, Typography, Grid
} from '@mui/material';
import {
    Add as AddIcon, Refresh as RefreshIcon, FileDownload as ExportIcon,
    FileUpload as ImportIcon, RestartAlt as ResetIcon
} from '@mui/icons-material';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSession } from '@toolpad/core';
import { AnimatedPage } from '../../../../components/Animate';
import { ChapterCard, ChapterManageDialog } from '../../../../components/Chapter';
import UnauthorizedNotice from '../../../../layouts/UnauthorizedNotice';
import type { NavigationItem } from '../../../../types/navigation';
import type { Session } from '../../../../types/session';
import type { ThesisChapterConfig, ChapterConfigFormData, ChapterFormErrorKey } from '../../../../types/chapter';
import type { UserProfile } from '../../../../types/profile';
import { useSnackbar } from '../../../../contexts/SnackbarContext';
import {
    getAllChapterConfigs, getChapterConfigsByDepartment, findAllUsers, setChapterConfig,
    loadOrSeedChapterTemplates, exportChapterTemplates, importChapterTemplates,
    seedMissingChapterTemplates,
    type FullChapterTemplatesData, type LoadOrSeedChapterTemplatesResult, type DepartmentCoursePair
} from '../../../../utils/firebase/firestore';
import { normalizeChapterOrder } from '../../../../utils/chapterUtils';
import { DEFAULT_YEAR } from '../../../../config/firestore';

const emptyFormData: ChapterConfigFormData = {
    department: '',
    course: '',
    chapters: [],
};

export const metadata: NavigationItem = {
    group: 'management',
    index: 2,
    title: 'Chapters',
    segment: 'chapter-management',
    icon: <MenuBookIcon />,
    roles: ['admin', 'developer'],
};

function encodeChapterPath(department: string, course: string) {
    return `${encodeURIComponent(department)}/${encodeURIComponent(course)}`;
}

/**
 * Admin page for managing required thesis chapters per course.
 */
export default function AdminChapterManagementPage() {
    const session = useSession<Session>();
    const navigate = useNavigate();
    const location = useLocation();
    const { showNotification } = useSnackbar();

    const userRole = session?.user?.role;
    const canManage = userRole === 'admin' || userRole === 'developer';

    const [users, setUsers] = React.useState<UserProfile[]>([]);
    const [configs, setConfigs] = React.useState<ThesisChapterConfig[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [initialLoading, setInitialLoading] = React.useState(true);
    const [isSeeding, setIsSeeding] = React.useState(false);
    const [manageDialogOpen, setManageDialogOpen] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [resetDialogOpen, setResetDialogOpen] = React.useState(false);

    const [selectedDepartment, setSelectedDepartment] = React.useState('');

    const [formData, setFormData] = React.useState<ChapterConfigFormData>({ ...emptyFormData });
    const [formErrors, setFormErrors] = React.useState<Partial<Record<ChapterFormErrorKey, string>>>({});

    // File input ref for import
    const fileInputRef = React.useRef<HTMLInputElement>(null);


    const filtersApplied = Boolean(selectedDepartment);

    const departmentOptions = React.useMemo(() => {
        const unique = new Set<string>();
        users.forEach((user) => {
            const department = user.department?.trim();
            if (department) {
                unique.add(department);
            }
        });
        return Array.from(unique).sort((a, b) => a.localeCompare(b));
    }, [users]);

    const getCoursesForDepartment = React.useCallback(
        (department: string) => {
            const normalized = department.trim();
            if (!normalized) {
                return [];
            }
            const unique = new Set<string>();
            users.forEach((user) => {
                if (user.department?.trim() === normalized && user.course?.trim()) {
                    unique.add(user.course.trim());
                }
            });
            return Array.from(unique).sort((a, b) => a.localeCompare(b));
        },
        [users]
    );

    // No top-level course filter needed — each course has a single template.

    const dialogCourseOptions = React.useMemo(
        () => getCoursesForDepartment(formData.department),
        [formData.department, getCoursesForDepartment]
    );

    // Initial load: seed chapter templates from default data if none exist
    const initializeChapterTemplates = React.useCallback(async () => {
        try {
            const defaultData = await import('../../../../config/chapters.json');
            const data = defaultData.default as unknown as Omit<FullChapterTemplatesData, 'updatedAt'>;

            // Check if we need to seed and show appropriate UI
            const result: LoadOrSeedChapterTemplatesResult = await loadOrSeedChapterTemplates(DEFAULT_YEAR, data);

            if (result.seeded) {
                setIsSeeding(true);
                // Small delay to show the seeding message
                await new Promise((resolve) => setTimeout(resolve, 1500));
                setIsSeeding(false);
                showNotification('Default chapter templates have been added to the database.', 'success');
            }

            // Also seed missing templates for department/course pairs from existing users
            const allUsers = await findAllUsers();
            setUsers(allUsers);

            // Extract unique department/course pairs from users
            const pairsMap = new Map<string, { department: string; course: string }>();
            for (const user of allUsers) {
                if (user.department && user.course) {
                    const key = `${user.department}|${user.course}`;
                    if (!pairsMap.has(key)) {
                        pairsMap.set(key, { department: user.department, course: user.course });
                    }
                }
            }
            const departmentCoursePairs = Array.from(pairsMap.values());

            // Seed missing templates with default chapters
            if (departmentCoursePairs.length > 0 && data.defaultChapters.length > 0) {
                const seededCount = await seedMissingChapterTemplates(
                    DEFAULT_YEAR,
                    departmentCoursePairs,
                    data.defaultChapters
                );
                if (seededCount > 0) {
                    showNotification(
                        `Added default chapter templates for ${seededCount} department/course combination(s).`,
                        'info'
                    );
                }
            }
        } catch (error) {
            console.error('Error initializing chapter templates:', error);
            showNotification('Failed to initialize chapter templates.', 'error');
        } finally {
            setInitialLoading(false);
        }
    }, [showNotification]);

    const loadConfigs = React.useCallback(async () => {
        if (!filtersApplied) {
            setConfigs([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            let data: ThesisChapterConfig[] = [];
            if (selectedDepartment) {
                data = await getChapterConfigsByDepartment(selectedDepartment);
            } else {
                data = await getAllChapterConfigs();
            }
            setConfigs(data);
        } catch (error) {
            console.error('Error loading chapters:', error);
            showNotification('Failed to load chapter requirements.', 'error');
        } finally {
            setLoading(false);
        }
    }, [filtersApplied, selectedDepartment, showNotification]);

    // Initialize templates on mount
    React.useEffect(() => {
        void initializeChapterTemplates();
    }, [initializeChapterTemplates]);

    React.useEffect(() => {
        void loadConfigs();
    }, [loadConfigs]);

    React.useEffect(() => {
        const state = location.state as { filters?: { department: string } } | null;
        if (!state) {
            return;
        }

        if (state.filters) {
            setSelectedDepartment(state.filters.department);
        }

        navigate(location.pathname, { replace: true, state: null });
    }, [location.pathname, location.state, navigate]);

    const handleOpenCreateDialog = React.useCallback(() => {
        setFormData({
            ...emptyFormData,
            department: selectedDepartment,
        });
        setFormErrors({});
        setManageDialogOpen(true);
    }, [selectedDepartment]);

    const handleCloseManageDialog = React.useCallback(() => {
        setManageDialogOpen(false);
        setFormData({ ...emptyFormData });
        setFormErrors({});
    }, []);

    const handleFormFieldChange = React.useCallback((changes: Partial<ChapterConfigFormData>) => {
        setFormData((prev) => ({ ...prev, ...changes }));
        setFormErrors((prev) => {
            const next = { ...prev };
            (Object.keys(changes) as ChapterFormErrorKey[]).forEach((key) => {
                if (key in next) {
                    delete next[key];
                }
            });
            return next;
        });
    }, []);

    const validateForm = React.useCallback((data: ChapterConfigFormData) => {
        const errors: Partial<Record<ChapterFormErrorKey, string>> = {};
        if (!data.department.trim()) {
            errors.department = 'Department is required.';
        }
        if (!data.course.trim()) {
            errors.course = 'Course is required.';
        }
        if (data.chapters.length === 0) {
            errors.chapters = 'Add at least one chapter.';
        } else if (data.chapters.some((chapter) => !chapter.title.trim())) {
            errors.chapters = 'Every chapter must have a title.';
        }
        return errors;
    }, []);

    const handleSave = React.useCallback(async () => {
        const trimmedData: ChapterConfigFormData = {
            ...formData,
            department: formData.department.trim(),
            course: formData.course.trim(),
            chapters: normalizeChapterOrder(formData.chapters).map((chapter) => ({
                ...chapter,
                title: chapter.title.trim(),
                description: chapter.description?.trim() || '',
            })),
        };

        const errors = validateForm(trimmedData);
        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }

        setSaving(true);
        try {
            await setChapterConfig({
                department: trimmedData.department,
                course: trimmedData.course,
                chapters: trimmedData.chapters,
            });

            showNotification('Chapter template created.', 'success');
            handleCloseManageDialog();
            void loadConfigs();
        } catch (error) {
            console.error('Error saving chapters:', error);
            showNotification('Failed to save chapter template.', 'error');
        } finally {
            setSaving(false);
        }
    }, [formData, handleCloseManageDialog, loadConfigs, showNotification, validateForm]);

    const handleViewConfig = React.useCallback((config: ThesisChapterConfig) => {
        const path = encodeChapterPath(config.department, config.course);
        navigate(`/chapter-management/${path}`);
    }, [navigate]);

    // ========================================================================
    // Import/Export Handlers
    // ========================================================================

    const handleExport = React.useCallback(async () => {
        try {
            const data = await exportChapterTemplates(DEFAULT_YEAR);
            if (!data) {
                showNotification('No chapter templates to export.', 'warning');
                return;
            }
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'chapter-templates.json';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            showNotification('Chapter templates exported successfully.', 'success');
        } catch (error) {
            console.error('Error exporting chapter templates:', error);
            showNotification('Failed to export chapter templates.', 'error');
        }
    }, [showNotification]);

    const handleImportClick = React.useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleFileChange = React.useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text) as FullChapterTemplatesData;

            // Validate structure
            if (!data.departmentTemplates || !Array.isArray(data.departmentTemplates)) {
                throw new Error('Invalid chapter templates file structure');
            }

            await importChapterTemplates(DEFAULT_YEAR, data, true);
            showNotification('Chapter templates imported successfully.', 'success');
            void loadConfigs();
        } catch (error) {
            console.error('Failed to import chapter templates:', error);
            showNotification('Failed to import chapter templates. Please check the file format.', 'error');
        }

        event.target.value = '';
    }, [loadConfigs, showNotification]);

    const handleResetToDefault = React.useCallback(async () => {
        try {
            const defaultData = await import('../../../../config/chapters.json');
            const data = defaultData.default as unknown as Omit<FullChapterTemplatesData, 'updatedAt'>;
            await importChapterTemplates(DEFAULT_YEAR, data, true);
            showNotification('Chapter templates reset to default.', 'success');
            setResetDialogOpen(false);
            void loadConfigs();
        } catch (error) {
            console.error('Failed to reset chapter templates:', error);
            showNotification('Failed to reset chapter templates.', 'error');
        }
    }, [loadConfigs, showNotification]);

    if (!canManage) {
        return <UnauthorizedNotice title="Chapter Management" variant="box" />;
    }

    if (initialLoading || isSeeding) {
        return (
            <AnimatedPage variant="fade">
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 10, gap: 2 }}>
                    {isSeeding ? (
                        <>
                            <Typography variant="h6" color="text.secondary">
                                Pushing default chapters to database...
                            </Typography>
                            <Box sx={{ width: '100%', maxWidth: 400 }}>
                                <LinearProgress />
                            </Box>
                            <Typography variant="body2" color="text.secondary">
                                Setting up chapter templates for all courses
                            </Typography>
                        </>
                    ) : (
                        <CircularProgress />
                    )}
                </Box>
            </AnimatedPage>
        );
    }

    return (
        <AnimatedPage variant="fade">
            <Box>
                {/* Hidden file input for import */}
                <input
                    type="file"
                    ref={fileInputRef}
                    accept=".json"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                />

                <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={2}
                    alignItems={{ md: 'center' }}
                    justifyContent="space-between"
                    sx={{ mb: 4 }}
                >
                    <Box>
                        <Typography color="text.secondary">
                            Define the thesis chapters each course must submit.
                        </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        <Autocomplete
                            options={departmentOptions}
                            value={selectedDepartment}
                            onChange={(_, newValue) => setSelectedDepartment(newValue || '')}
                            renderInput={(params) => (
                                <TextField {...params} label="Filter by Department" placeholder="Select department" />
                            )}
                            sx={{ minWidth: 250 }}
                            size="small"
                        />

                        <Button startIcon={<RefreshIcon />} variant="outlined" onClick={loadConfigs}>
                            Refresh
                        </Button>
                        <Button startIcon={<ExportIcon />} variant="outlined" onClick={handleExport}>
                            Export
                        </Button>
                        <Button startIcon={<ImportIcon />} variant="outlined" onClick={handleImportClick}>
                            Import
                        </Button>
                        <Button
                            startIcon={<ResetIcon />}
                            variant="outlined"
                            color="warning"
                            onClick={() => setResetDialogOpen(true)}
                        >
                            Reset
                        </Button>
                        <Button startIcon={<AddIcon />} variant="contained" onClick={handleOpenCreateDialog}>
                            New Template
                        </Button>
                    </Stack>
                </Stack>

                {/* filters moved to the top controls */}

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
                        <CircularProgress />
                    </Box>
                ) : configs.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 8 }}>
                        <Typography variant="h6" gutterBottom>
                            {filtersApplied ? 'No chapter templates found' : 'Select filters to view templates'}
                        </Typography>
                        <Typography color="text.secondary">
                            {filtersApplied
                                ? 'No chapter requirements match the selected filters.'
                                : 'Choose a department and course to manage chapter requirements.'}
                        </Typography>
                    </Box>
                ) : (
                    <Grid container spacing={3}>
                        {configs.map((config) => (
                            <Grid
                                key={`${config.department}-${config.course}`}
                                size={{ xs: 12, sm: 6, md: 4, lg: 3 }}
                            >
                                <ChapterCard
                                    config={config}
                                    onClick={handleViewConfig}
                                />
                            </Grid>
                        ))}
                    </Grid>
                )}

                <ChapterManageDialog
                    open={manageDialogOpen}
                    editMode={false}
                    formData={formData}
                    formErrors={formErrors}
                    departmentOptions={departmentOptions}
                    courseOptions={dialogCourseOptions}
                    saving={saving}
                    onClose={handleCloseManageDialog}
                    onFieldChange={handleFormFieldChange}
                    onSubmit={handleSave}
                />

                {/* Reset Confirmation Dialog */}
                <Dialog open={resetDialogOpen} onClose={() => setResetDialogOpen(false)}>
                    <DialogTitle>Reset Chapter Templates</DialogTitle>
                    <DialogContent>
                        <Typography>
                            Are you sure you want to reset all chapter templates to the default configuration?
                            This will <strong>delete all existing templates</strong> and replace them with the defaults.
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setResetDialogOpen(false)}>Cancel</Button>
                        <Button variant="contained" color="error" onClick={handleResetToDefault}>
                            Reset to Default
                        </Button>
                    </DialogActions>
                </Dialog>

            </Box>
        </AnimatedPage>
    );
}
