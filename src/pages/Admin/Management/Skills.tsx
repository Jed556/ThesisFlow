import * as React from 'react';
import {
    Alert, Autocomplete, Box, Button, Card, CardActions, CardContent, Chip,
    CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
    Divider, FormControlLabel, IconButton, List, ListItem,
    ListItemText, Skeleton, Stack,
    Switch, TextField, Tooltip, Typography,
} from '@mui/material';
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    Edit as EditIcon,
    Psychology as SkillIcon,
} from '@mui/icons-material';
import { useSession } from '@toolpad/core';
import { AnimatedPage } from '../../../components/Animate';
import { GrowTransition } from '../../../components/Animate';
import UnauthorizedNotice from '../../../layouts/UnauthorizedNotice';
import { useSnackbar } from '../../../contexts/SnackbarContext';
import type { NavigationItem } from '../../../types/navigation';
import type { Session } from '../../../types/session';
import type { SkillTemplateRecord } from '../../../types/skillTemplate';
import { SKILL_RATING_LABELS } from '../../../types/skillTemplate';
import {
    createSkillTemplate,
    updateSkillTemplate,
    deleteSkillTemplate,
    listenSkillTemplates,
} from '../../../utils/firebase/firestore/skillTemplates';
import { getUserDepartments } from '../../../utils/firebase/firestore/user';
import { DEFAULT_YEAR } from '../../../config/firestore';

export const metadata: NavigationItem = {
    group: 'management',
    index: 6,
    title: 'Skills',
    segment: 'skills-management',
    icon: <SkillIcon />,
    roles: ['admin', 'developer', 'head'],
};

interface SkillFormData {
    name: string;
    description: string;
    category: string;
    isActive: boolean;
}

const emptyFormData: SkillFormData = {
    name: '',
    description: '',
    category: '',
    isActive: true,
};

/**
 * Admin page for managing department-level adviser skill templates.
 * Advisers/editors/statisticians must rate their skills before increasing slots.
 */
export default function SkillsManagementPage() {
    const session = useSession<Session>();
    const { showNotification } = useSnackbar();

    const userRole = session?.user?.role;
    const userDepartment = session?.user?.department;
    const canManage = userRole === 'admin' || userRole === 'developer' || userRole === 'head';

    // State
    const [departments, setDepartments] = React.useState<string[]>([]);
    const [selectedDepartment, setSelectedDepartment] = React.useState<string>('');
    const [skills, setSkills] = React.useState<SkillTemplateRecord[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [departmentsLoading, setDepartmentsLoading] = React.useState(true);

    // Dialog state
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [editingSkill, setEditingSkill] = React.useState<SkillTemplateRecord | null>(null);
    const [formData, setFormData] = React.useState<SkillFormData>(emptyFormData);
    const [saving, setSaving] = React.useState(false);

    // Delete confirmation
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
    const [skillToDelete, setSkillToDelete] = React.useState<SkillTemplateRecord | null>(null);
    const [deleting, setDeleting] = React.useState(false);

    // Load departments
    React.useEffect(() => {
        if (!canManage) return;

        setDepartmentsLoading(true);
        void (async () => {
            try {
                // Get all departments from the system
                const allDepts = await getUserDepartments();

                if (userRole === 'admin' || userRole === 'developer') {
                    // Admin/developer can see all departments
                    setDepartments(allDepts);
                    // Default to first department or user's department
                    if (allDepts.length > 0) {
                        setSelectedDepartment(userDepartment && allDepts.includes(userDepartment)
                            ? userDepartment
                            : allDepts[0]);
                    }
                } else if (userRole === 'head' && userDepartment) {
                    // Head can only manage their department
                    setDepartments([userDepartment]);
                    setSelectedDepartment(userDepartment);
                } else {
                    setDepartments([]);
                }
            } catch (err) {
                console.error('Failed to load departments:', err);
                showNotification('Failed to load departments', 'error');
            } finally {
                setDepartmentsLoading(false);
            }
        })();
    }, [canManage, userRole, userDepartment, showNotification]);

    // Listen to skills for selected department
    React.useEffect(() => {
        if (!selectedDepartment) {
            setSkills([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        const unsubscribe = listenSkillTemplates(DEFAULT_YEAR, selectedDepartment, {
            onData: (data) => {
                setSkills(data);
                setLoading(false);
            },
            onError: (err) => {
                console.error('Failed to load skills:', err);
                showNotification('Failed to load skills', 'error');
                setLoading(false);
            },
        });

        return () => unsubscribe();
    }, [selectedDepartment, showNotification]);

    // Form handlers
    const handleOpenCreateDialog = () => {
        setEditingSkill(null);
        setFormData(emptyFormData);
        setDialogOpen(true);
    };

    const handleOpenEditDialog = (skill: SkillTemplateRecord) => {
        setEditingSkill(skill);
        setFormData({
            name: skill.name,
            description: skill.description ?? '',
            category: skill.category ?? '',
            isActive: skill.isActive,
        });
        setDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setEditingSkill(null);
        setFormData(emptyFormData);
    };

    const handleFormChange = (field: keyof SkillFormData, value: string | boolean) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleSaveSkill = async () => {
        if (!formData.name.trim()) {
            showNotification('Skill name is required', 'warning');
            return;
        }

        if (!selectedDepartment) {
            showNotification('Please select a department first', 'warning');
            return;
        }

        setSaving(true);
        try {
            if (editingSkill) {
                // Update existing skill
                await updateSkillTemplate(DEFAULT_YEAR, selectedDepartment, editingSkill.id, {
                    name: formData.name.trim(),
                    description: formData.description.trim() || undefined,
                    category: formData.category.trim() || undefined,
                    isActive: formData.isActive,
                });
                showNotification('Skill updated successfully', 'success');
            } else {
                // Create new skill
                const nextOrder = skills.length > 0
                    ? Math.max(...skills.map((s) => s.order ?? 0)) + 1
                    : 0;
                await createSkillTemplate(
                    DEFAULT_YEAR,
                    selectedDepartment,
                    {
                        name: formData.name.trim(),
                        description: formData.description.trim() || undefined,
                        category: formData.category.trim() || undefined,
                        order: nextOrder,
                        isActive: formData.isActive,
                    },
                    session?.user?.uid
                );
                showNotification('Skill created successfully', 'success');
            }
            handleCloseDialog();
        } catch (err) {
            console.error('Failed to save skill:', err);
            showNotification('Failed to save skill', 'error');
        } finally {
            setSaving(false);
        }
    };

    // Delete handlers
    const handleOpenDeleteDialog = (skill: SkillTemplateRecord) => {
        setSkillToDelete(skill);
        setDeleteDialogOpen(true);
    };

    const handleCloseDeleteDialog = () => {
        setDeleteDialogOpen(false);
        setSkillToDelete(null);
    };

    const handleDeleteSkill = async () => {
        if (!skillToDelete || !selectedDepartment) return;

        setDeleting(true);
        try {
            await deleteSkillTemplate(DEFAULT_YEAR, selectedDepartment, skillToDelete.id);
            showNotification('Skill deleted successfully', 'success');
            handleCloseDeleteDialog();
        } catch (err) {
            console.error('Failed to delete skill:', err);
            showNotification('Failed to delete skill', 'error');
        } finally {
            setDeleting(false);
        }
    };

    // Toggle skill active status
    const handleToggleActive = async (skill: SkillTemplateRecord) => {
        try {
            await updateSkillTemplate(DEFAULT_YEAR, selectedDepartment, skill.id, {
                isActive: !skill.isActive,
            });
            showNotification(
                `Skill ${skill.isActive ? 'disabled' : 'enabled'} successfully`,
                'success'
            );
        } catch (err) {
            console.error('Failed to toggle skill status:', err);
            showNotification('Failed to update skill status', 'error');
        }
    };

    // Get unique categories from current skills
    const categories = React.useMemo(() => {
        const unique = new Set<string>();
        skills.forEach((skill) => {
            if (skill.category?.trim()) {
                unique.add(skill.category.trim());
            }
        });
        return Array.from(unique).sort();
    }, [skills]);

    // Group skills by category
    const skillsByCategory = React.useMemo(() => {
        const grouped = new Map<string, SkillTemplateRecord[]>();
        const uncategorized: SkillTemplateRecord[] = [];

        skills.forEach((skill) => {
            const category = skill.category?.trim();
            if (category) {
                const existing = grouped.get(category) ?? [];
                existing.push(skill);
                grouped.set(category, existing);
            } else {
                uncategorized.push(skill);
            }
        });

        // Sort skills within each category by order
        grouped.forEach((skillList, key) => {
            grouped.set(key, skillList.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
        });
        uncategorized.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        return { grouped, uncategorized };
    }, [skills]);

    if (session?.loading) {
        return (
            <AnimatedPage variant="fade">
                <Box sx={{ p: 3 }}>
                    <Skeleton variant="text" width={300} height={40} />
                    <Skeleton variant="rectangular" height={200} sx={{ mt: 2 }} />
                </Box>
            </AnimatedPage>
        );
    }

    if (!canManage) {
        return (
            <UnauthorizedNotice
                variant="box"
                title="Admin access required"
                description="This page is only available to administrators and department heads."
            />
        );
    }

    return (
        <AnimatedPage variant="slideUp">
            <Stack spacing={3}>
                {/* Header */}
                <Box>
                    <Typography variant="h5" gutterBottom>
                        Adviser Skills Management
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Define the skills that advisers, editors, and statisticians can rate themselves on.
                        Experts must rate their skills before requesting additional thesis slots.
                    </Typography>
                </Box>

                {/* Department selector */}
                <Card>
                    <CardContent>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-start">
                            <Autocomplete
                                options={departments}
                                value={selectedDepartment}
                                onChange={(_, newValue) => setSelectedDepartment(newValue ?? '')}
                                loading={departmentsLoading}
                                sx={{ minWidth: 250 }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Department"
                                        placeholder="Select a department"
                                        slotProps={{
                                            input: {
                                                ...params.InputProps,
                                                endAdornment: (
                                                    <>
                                                        {departmentsLoading ? (
                                                            <CircularProgress size={20} />
                                                        ) : null}
                                                        {params.InputProps.endAdornment}
                                                    </>
                                                ),
                                            },
                                        }}
                                    />
                                )}
                            />
                            <Button
                                variant="contained"
                                startIcon={<AddIcon />}
                                onClick={handleOpenCreateDialog}
                                disabled={!selectedDepartment}
                            >
                                Add Skill
                            </Button>
                        </Stack>
                    </CardContent>
                </Card>

                {/* Skills list */}
                {loading ? (
                    <Card>
                        <CardContent>
                            <Stack spacing={2}>
                                {[1, 2, 3].map((i) => (
                                    <Skeleton key={i} variant="rectangular" height={60} />
                                ))}
                            </Stack>
                        </CardContent>
                    </Card>
                ) : !selectedDepartment ? (
                    <Alert severity="info">
                        Select a department to manage its skill templates.
                    </Alert>
                ) : skills.length === 0 ? (
                    <Card>
                        <CardContent>
                            <Typography variant="body1" color="text.secondary" textAlign="center">
                                No skills defined for this department yet.
                                Add skills that advisers should rate themselves on.
                            </Typography>
                        </CardContent>
                        <CardActions sx={{ justifyContent: 'center' }}>
                            <Button
                                variant="outlined"
                                startIcon={<AddIcon />}
                                onClick={handleOpenCreateDialog}
                            >
                                Add First Skill
                            </Button>
                        </CardActions>
                    </Card>
                ) : (
                    <Stack spacing={2}>
                        {/* Grouped by category */}
                        {Array.from(skillsByCategory.grouped.entries()).map(([category, categorySkills]) => (
                            <Card key={category}>
                                <CardContent>
                                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                                        {category}
                                    </Typography>
                                    <Divider sx={{ mb: 2 }} />
                                    <List disablePadding>
                                        {categorySkills.map((skill) => (
                                            <SkillListItem
                                                key={skill.id}
                                                skill={skill}
                                                onEdit={() => handleOpenEditDialog(skill)}
                                                onDelete={() => handleOpenDeleteDialog(skill)}
                                                onToggleActive={() => handleToggleActive(skill)}
                                            />
                                        ))}
                                    </List>
                                </CardContent>
                            </Card>
                        ))}

                        {/* Uncategorized skills */}
                        {skillsByCategory.uncategorized.length > 0 && (
                            <Card>
                                <CardContent>
                                    {skillsByCategory.grouped.size > 0 && (
                                        <>
                                            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                                                Uncategorized
                                            </Typography>
                                            <Divider sx={{ mb: 2 }} />
                                        </>
                                    )}
                                    <List disablePadding>
                                        {skillsByCategory.uncategorized.map((skill) => (
                                            <SkillListItem
                                                key={skill.id}
                                                skill={skill}
                                                onEdit={() => handleOpenEditDialog(skill)}
                                                onDelete={() => handleOpenDeleteDialog(skill)}
                                                onToggleActive={() => handleToggleActive(skill)}
                                            />
                                        ))}
                                    </List>
                                </CardContent>
                            </Card>
                        )}
                    </Stack>
                )}
            </Stack>

            {/* Create/Edit Dialog */}
            <Dialog
                open={dialogOpen}
                onClose={handleCloseDialog}
                maxWidth="sm"
                fullWidth
                slots={{ transition: GrowTransition }}
            >
                <DialogTitle>
                    {editingSkill ? 'Edit Skill' : 'Add New Skill'}
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={3} sx={{ mt: 1 }}>
                        <TextField
                            label="Skill Name"
                            value={formData.name}
                            onChange={(e) => handleFormChange('name', e.target.value)}
                            fullWidth
                            required
                            placeholder="e.g., Machine Learning, Statistical Analysis"
                        />
                        <TextField
                            label="Description"
                            value={formData.description}
                            onChange={(e) => handleFormChange('description', e.target.value)}
                            fullWidth
                            multiline
                            rows={2}
                            placeholder="Brief description of the skill..."
                        />
                        <Autocomplete
                            freeSolo
                            options={categories}
                            value={formData.category}
                            onInputChange={(_, newValue) => handleFormChange('category', newValue)}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Category"
                                    placeholder="e.g., Technical, Research Methods"
                                    helperText="Group related skills together"
                                />
                            )}
                        />
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={formData.isActive}
                                    onChange={(e) => handleFormChange('isActive', e.target.checked)}
                                />
                            }
                            label="Active (visible to experts for rating)"
                        />
                        <Box>
                            <Typography variant="caption" color="text.secondary">
                                Rating Scale Preview:
                            </Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
                                {Object.entries(SKILL_RATING_LABELS).map(([value, label]) => (
                                    <Chip
                                        key={value}
                                        label={`${value}: ${label}`}
                                        size="small"
                                        variant="outlined"
                                    />
                                ))}
                            </Stack>
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog} disabled={saving}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleSaveSkill}
                        disabled={saving || !formData.name.trim()}
                    >
                        {saving ? 'Saving...' : editingSkill ? 'Update' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={deleteDialogOpen}
                onClose={handleCloseDeleteDialog}
                slots={{ transition: GrowTransition }}
            >
                <DialogTitle>Delete Skill?</DialogTitle>
                <DialogContent>
                    <Typography>
                        Are you sure you want to delete the skill{' '}
                        <strong>{skillToDelete?.name}</strong>?
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Experts who have rated this skill will retain their ratings, but the skill
                        will no longer appear in the rating form.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDeleteDialog} disabled={deleting}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={handleDeleteSkill}
                        disabled={deleting}
                    >
                        {deleting ? 'Deleting...' : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>
        </AnimatedPage>
    );
}

// ============================================================================
// Skill List Item Component
// ============================================================================

interface SkillListItemProps {
    skill: SkillTemplateRecord;
    onEdit: () => void;
    onDelete: () => void;
    onToggleActive: () => void;
}

function SkillListItem({ skill, onEdit, onDelete, onToggleActive }: SkillListItemProps) {
    return (
        <ListItem
            sx={{
                borderRadius: 1,
                mb: 1,
                bgcolor: skill.isActive ? 'transparent' : 'action.disabledBackground',
                opacity: skill.isActive ? 1 : 0.7,
            }}
            secondaryAction={
                <Stack direction="row" spacing={0.5} alignItems="center">
                    <Tooltip title={skill.isActive ? 'Disable skill' : 'Enable skill'}>
                        <Switch
                            size="small"
                            checked={skill.isActive}
                            onChange={onToggleActive}
                        />
                    </Tooltip>
                    <Tooltip title="Edit skill">
                        <IconButton onClick={onEdit} size="small">
                            <EditIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete skill">
                        <IconButton onClick={onDelete} size="small" color="error">
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Stack>
            }
        >
            <ListItemText
                primary={
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Typography
                            variant="body1"
                            sx={{
                                textDecoration: skill.isActive ? 'none' : 'line-through',
                            }}
                        >
                            {skill.name}
                        </Typography>
                        {!skill.isActive && (
                            <Chip label="Disabled" size="small" color="default" />
                        )}
                    </Stack>
                }
                secondary={skill.description}
            />
        </ListItem>
    );
}
