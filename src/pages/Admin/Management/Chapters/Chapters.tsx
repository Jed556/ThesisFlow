import * as React from 'react';
import {
    Autocomplete,
    Box,
    Button,
    CircularProgress,
    Stack,
    TextField,
    Typography,
    Grid
} from '@mui/material';
import {
    Add as AddIcon,
    Refresh as RefreshIcon,
} from '@mui/icons-material';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSession } from '@toolpad/core';
import { AnimatedPage } from '../../../../components/Animate';
import { ChapterCard, ChapterDeleteDialog, ChapterManageDialog } from '../../../../components/Chapter';
import UnauthorizedNotice from '../../../../layouts/UnauthorizedNotice';
import type { NavigationItem } from '../../../../types/navigation';
import type { Session } from '../../../../types/session';
import type { ThesisChapterConfig, ChapterConfigFormData, ChapterFormErrorKey, ChapterConfigIdentifier } from '../../../../types/chapter';
import type { UserProfile } from '../../../../types/profile';
import { useSnackbar } from '../../../../contexts/SnackbarContext';
import {
    deleteChapterConfig,
    getAllChapterConfigs,
    getChapterConfigsByDepartment,
    getAllUsers,
    setChapterConfig,
} from '../../../../utils/firebase/firestore';
import { normalizeChapterOrder } from '../../../../utils/chapterUtils';

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
    const [manageDialogOpen, setManageDialogOpen] = React.useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
    const [editMode, setEditMode] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [deleting, setDeleting] = React.useState(false);

    const [selectedDepartment, setSelectedDepartment] = React.useState('');

    const [formData, setFormData] = React.useState<ChapterConfigFormData>({ ...emptyFormData });
    const [formErrors, setFormErrors] = React.useState<Partial<Record<ChapterFormErrorKey, string>>>({});

    const [selectedConfig, setSelectedConfig] = React.useState<ThesisChapterConfig | null>(null);
    const pendingEditRef = React.useRef<ChapterConfigIdentifier | null>(null);

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

    const loadUsers = React.useCallback(async () => {
        try {
            const allUsers = await getAllUsers();
            setUsers(allUsers);
        } catch (error) {
            console.error('Error loading users:', error);
            showNotification('Failed to load users for filters.', 'error');
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

    React.useEffect(() => {
        void loadUsers();
    }, [loadUsers]);

    React.useEffect(() => {
        void loadConfigs();
    }, [loadConfigs]);

    React.useEffect(() => {
        const state = location.state as { editChapter?: ChapterConfigIdentifier; filters?: ChapterConfigIdentifier } | null;
        if (!state) {
            return;
        }

        if (state.filters) {
            setSelectedDepartment(state.filters.department);
        }

        if (state.editChapter) {
            pendingEditRef.current = state.editChapter;
        }

        navigate(location.pathname, { replace: true, state: null });
    }, [location.pathname, location.state, navigate]);

    const handleOpenCreateDialog = React.useCallback(() => {
        setEditMode(false);
        setSelectedConfig(null);
        setFormData({
            ...emptyFormData,
            department: selectedDepartment,
        });
        setFormErrors({});
        setManageDialogOpen(true);
    }, [selectedDepartment]);

    const handleCloseManageDialog = React.useCallback(() => {
        setManageDialogOpen(false);
        setEditMode(false);
        setSelectedConfig(null);
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

            if (editMode && selectedConfig &&
                (trimmedData.department !== selectedConfig.department || trimmedData.course !== selectedConfig.course)
            ) {
                await deleteChapterConfig(selectedConfig.department, selectedConfig.course);
            }

            showNotification(editMode ? 'Chapter template updated.' : 'Chapter template created.', 'success');
            handleCloseManageDialog();
            void loadConfigs();
        } catch (error) {
            console.error('Error saving chapters:', error);
            showNotification('Failed to save chapter template.', 'error');
        } finally {
            setSaving(false);
        }
    }, [editMode, formData, handleCloseManageDialog, loadConfigs, selectedConfig, showNotification, validateForm]);

    const handleViewConfig = React.useCallback((config: ThesisChapterConfig) => {
        const path = encodeChapterPath(config.department, config.course);
        navigate(`/chapter-management/${path}`);
    }, [navigate]);

    const handleEditConfig = React.useCallback((config: ThesisChapterConfig) => {
        setEditMode(true);
        setSelectedConfig(config);
        setFormData({
            department: config.department,
            course: config.course,
            chapters: normalizeChapterOrder(config.chapters),
        });
        setFormErrors({});
        setManageDialogOpen(true);
    }, []);

    React.useEffect(() => {
        if (!pendingEditRef.current || configs.length === 0) {
            return;
        }

        const { department, course } = pendingEditRef.current;
        const match = configs.find(
            (config) => config.department === department && config.course === course
        );

        if (match) {
            handleEditConfig(match);
            pendingEditRef.current = null;
        }
    }, [configs, handleEditConfig]);

    const handleDeleteRequest = React.useCallback((config: ThesisChapterConfig) => {
        setSelectedConfig(config);
        setDeleteDialogOpen(true);
    }, []);

    const handleCloseDeleteDialog = React.useCallback(() => {
        setDeleteDialogOpen(false);
        setSelectedConfig(null);
    }, []);

    const handleConfirmDelete = React.useCallback(async () => {
        if (!selectedConfig) {
            return;
        }
        setDeleting(true);
        try {
            await deleteChapterConfig(selectedConfig.department, selectedConfig.course);
            showNotification('Chapter template deleted.', 'success');
            handleCloseDeleteDialog();
            void loadConfigs();
        } catch (error) {
            console.error('Error deleting chapter template:', error);
            showNotification('Failed to delete chapter template.', 'error');
        } finally {
            setDeleting(false);
        }
    }, [handleCloseDeleteDialog, loadConfigs, selectedConfig, showNotification]);

    if (!canManage) {
        return <UnauthorizedNotice title="Chapter Management" variant="box" />;
    }

    return (
        <AnimatedPage variant="fade">
            <Box>
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
                    <Stack direction="row" spacing={1} alignItems="center">
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
                                    onEdit={handleEditConfig}
                                    onDelete={handleDeleteRequest}
                                />
                            </Grid>
                        ))}
                    </Grid>
                )}

                <ChapterManageDialog
                    open={manageDialogOpen}
                    editMode={editMode}
                    formData={formData}
                    formErrors={formErrors}
                    departmentOptions={departmentOptions}
                    courseOptions={dialogCourseOptions}
                    saving={saving}
                    onClose={handleCloseManageDialog}
                    onFieldChange={handleFormFieldChange}
                    onSubmit={handleSave}
                />

                <ChapterDeleteDialog
                    open={deleteDialogOpen}
                    config={selectedConfig}
                    deleting={deleting}
                    onClose={handleCloseDeleteDialog}
                    onConfirm={handleConfirmDelete}
                />
            </Box>
        </AnimatedPage>
    );
}
