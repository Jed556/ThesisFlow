import * as React from 'react';
import {
    Alert, Autocomplete, Box, Button, Chip, Dialog, DialogActions, DialogContent,
    DialogTitle, Divider, IconButton, MenuItem, Paper, Stack, Step, StepLabel,
    Stepper, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import type { GridColDef, GridRowParams } from '@mui/x-data-grid';
import { GridActionsCellItem } from '@mui/x-data-grid';
import { AnimatedPage, GrowTransition } from '../../components/Animate';
import { DataGrid } from '../../components/DataGrid';
import { useSession } from '@toolpad/core';
import { useSnackbar } from '../../contexts/SnackbarContext';
import type { NavigationItem } from '../../types/navigation';
import type { FormTemplate, FormField, FormFieldType, FormFieldOption, FormWorkflowStep, FormAudience } from '../../types/forms';
import type { Session } from '../../types/session';
import type { ThesisGroup } from '../../types/group';
import {
    getAllFormTemplates,
    createFormTemplate,
    updateFormTemplate,
    deleteFormTemplate,
    setFormTemplate,
} from '../../utils/firebase/firestore';
import { getAllGroups } from '../../utils/firebase/firestore';
import {
    formTemplatesToCSV,
    csvToFormTemplates,
    downloadCSV,
    readCSVFile,
} from '../../utils/csvUtils';
import UnauthorizedNotice from '../../layouts/UnauthorizedNotice';

export const metadata: NavigationItem = {
    group: 'management',
    index: 2,
    title: 'Forms',
    segment: 'form-management',
    icon: <AssignmentIcon />,
    roles: ['admin', 'developer'],
};

const FIELD_TYPES: { value: FormFieldType; label: string }[] = [
    { value: 'shortText', label: 'Short Text' },
    { value: 'longText', label: 'Long Text' },
    { value: 'select', label: 'Dropdown' },
    { value: 'multiSelect', label: 'Multiple Choice' },
    { value: 'date', label: 'Date' },
    { value: 'file', label: 'File Upload' },
    { value: 'checkbox', label: 'Checkbox' },
    { value: 'signature', label: 'Signature' },
];

const AUDIENCE_OPTIONS: (FormAudience | 'admin')[] = ['student', 'adviser', 'editor', 'admin'];

const STATUS_COLORS: Record<
    FormTemplate['status'],
    'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'
> = {
    draft: 'default',
    active: 'success',
    archived: 'warning',
};

interface FormBuilderState {
    template: Partial<FormTemplate>;
    fields: FormField[];
    workflow: FormWorkflowStep[];
    availableGroups: string[];
}

const emptyField: FormField = {
    id: '',
    fieldType: 'shortText',
    label: '',
    required: false,
};

const emptyWorkflowStep: FormWorkflowStep = {
    order: 1,
    role: 'student',
    label: '',
    requiresSignature: false,
    required: true,
};

/**
 * Admin page for managing form templates with Google Forms-inspired UI
 */
export default function AdminFormManagementPage() {
    const session = useSession<Session>();
    const { showNotification } = useSnackbar();
    const userRole = session?.user?.role;

    const [forms, setForms] = React.useState<FormTemplate[]>([]);
    const [groups, setGroups] = React.useState<ThesisGroup[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
    const [selectedForm, setSelectedForm] = React.useState<FormTemplate | null>(null);
    const [saving, setSaving] = React.useState(false);

    // Stepper state
    const [activeStep, setActiveStep] = React.useState(0);
    const steps = ['Form Details', 'Questions', 'Workflow & Access'];

    // Form builder state
    const [builderState, setBuilderState] = React.useState<FormBuilderState>({
        template: {
            title: '',
            description: '',
            audience: 'student',
            status: 'draft',
            tags: [],
        },
        fields: [],
        workflow: [],
        availableGroups: [],
    });

    const [selectedFieldIndex, setSelectedFieldIndex] = React.useState<number | null>(null);
    const [formErrors, setFormErrors] = React.useState<Record<string, string>>({});

    const loadData = React.useCallback(async () => {
        try {
            setLoading(true);
            // Load from Firestore
            const [formsData, groupsData] = await Promise.all([
                getAllFormTemplates(),
                getAllGroups(),
            ]);
            setForms(formsData);
            setGroups(groupsData);
        } catch (error) {
            console.error('Error loading data:', error);
            showNotification('Failed to load data. Please try again.', 'error');
        } finally {
            setLoading(false);
        }
    }, [showNotification]);

    React.useEffect(() => {
        loadData();
    }, [loadData]);

    const resetBuilder = () => {
        setBuilderState({
            template: {
                title: '',
                description: '',
                audience: 'student',
                status: 'draft',
                tags: [],
            },
            fields: [],
            workflow: [],
            availableGroups: [],
        });
        setSelectedFieldIndex(null);
        setActiveStep(0);
        setFormErrors({});
    };

    const handleOpenCreateDialog = () => {
        resetBuilder();
        setDialogOpen(true);
    };

    const handleOpenEditDialog = (form: FormTemplate) => {
        setSelectedForm(form);
        setBuilderState({
            template: {
                title: form.title,
                description: form.description,
                audience: form.audience,
                status: form.status,
                tags: form.tags || [],
                dueInDays: form.dueInDays,
                reviewerNotes: form.reviewerNotes,
            },
            fields: [...form.fields],
            workflow: form.workflow || [],
            availableGroups: form.availableToGroups || [],
        });
        setDialogOpen(true);
    };

    const handleOpenDeleteDialog = (form: FormTemplate) => {
        setSelectedForm(form);
        setDeleteDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setDeleteDialogOpen(false);
        setSelectedForm(null);
        resetBuilder();
    };

    const validateStep = (step: number): boolean => {
        const errors: Record<string, string> = {};

        if (step === 0) {
            if (!builderState.template.title?.trim()) {
                errors.title = 'Form title is required';
            }
            if (!builderState.template.audience) {
                errors.audience = 'Target audience is required';
            }
        } else if (step === 1) {
            if (builderState.fields.length === 0) {
                errors.fields = 'At least one question is required';
            }
            builderState.fields.forEach((field, index) => {
                if (!field.label.trim()) {
                    errors[`field-${index}-label`] = 'Question label is required';
                }
                if ((field.fieldType === 'select' || field.fieldType === 'multiSelect') &&
                    (!field.options || field.options.length === 0)) {
                    errors[`field-${index}-options`] = 'At least one option is required';
                }
            });
        } else if (step === 2) {
            if (builderState.workflow.length === 0) {
                errors.workflow = 'At least one workflow step is required';
            }
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleNext = () => {
        if (validateStep(activeStep)) {
            setActiveStep((prev) => prev + 1);
        }
    };

    const handleBack = () => {
        setActiveStep((prev) => prev - 1);
    };

    const handleSave = async () => {
        if (!validateStep(activeStep)) return;

        setSaving(true);
        try {
            const formData: Omit<FormTemplate, 'id' | 'createdAt' | 'updatedAt'> = {
                title: builderState.template.title!,
                description: builderState.template.description,
                version: selectedForm?.version || '1.0.0',
                audience: builderState.template.audience!,
                fields: builderState.fields.map((f, idx) => ({ ...f, id: f.id || `field-${idx}` })),
                status: builderState.template.status!,
                createdBy: selectedForm?.createdBy || session?.user?.uid || '',
                tags: builderState.template.tags,
                reviewerNotes: builderState.template.reviewerNotes,
                dueInDays: builderState.template.dueInDays,
                workflow: builderState.workflow,
                availableToGroups: builderState.availableGroups,
            };

            // Save to Firestore
            if (selectedForm) {
                await updateFormTemplate(selectedForm.id, formData);
                const updatedForm = {
                    ...formData,
                    id: selectedForm.id,
                    createdAt: selectedForm.createdAt,
                    updatedAt: new Date().toISOString(),
                };
                setForms(forms.map((f) => (f.id === updatedForm.id ? updatedForm : f)));
                showNotification(`Form "${formData.title}" updated successfully`, 'success');
            } else {
                const createdForm = await createFormTemplate(formData);
                setForms([...forms, createdForm]);
                showNotification(`Form "${formData.title}" created successfully`, 'success');
            }

            handleCloseDialog();
        } catch (error) {
            console.error('Error saving form:', error);
            showNotification('Failed to save form. Please try again.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedForm) return;

        setSaving(true);
        try {
            // Delete from Firestore
            await deleteFormTemplate(selectedForm.id);
            setForms(forms.filter((f) => f.id !== selectedForm.id));
            showNotification(`Form "${selectedForm.title}" deleted successfully`, 'success');
            handleCloseDialog();
        } catch (error) {
            console.error('Error deleting form:', error);
            showNotification('Failed to delete form. Please try again.', 'error');
        } finally {
            setSaving(false);
        }
    };

    // Field management
    const handleAddField = () => {
        const newField: FormField = {
            ...emptyField,
            id: `field-${builderState.fields.length}`,
            label: `Question ${builderState.fields.length + 1}`,
        };
        setBuilderState({
            ...builderState,
            fields: [...builderState.fields, newField],
        });
        setSelectedFieldIndex(builderState.fields.length);
    };

    const handleUpdateField = (index: number, updates: Partial<FormField>) => {
        const newFields = [...builderState.fields];
        newFields[index] = { ...newFields[index], ...updates };
        setBuilderState({ ...builderState, fields: newFields });
    };

    const handleDeleteField = (index: number) => {
        setBuilderState({
            ...builderState,
            fields: builderState.fields.filter((_, i) => i !== index),
        });
        if (selectedFieldIndex === index) {
            setSelectedFieldIndex(null);
        }
    };

    const handleMoveField = (index: number, direction: 'up' | 'down') => {
        const newFields = [...builderState.fields];
        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        if (swapIndex < 0 || swapIndex >= newFields.length) return;

        [newFields[index], newFields[swapIndex]] = [newFields[swapIndex], newFields[index]];
        setBuilderState({ ...builderState, fields: newFields });
        setSelectedFieldIndex(swapIndex);
    };

    const handleDuplicateField = (index: number) => {
        const fieldToDuplicate = builderState.fields[index];
        const newField: FormField = {
            ...fieldToDuplicate,
            id: `field-${builderState.fields.length}`,
            label: `${fieldToDuplicate.label} (Copy)`,
        };
        const newFields = [...builderState.fields];
        newFields.splice(index + 1, 0, newField);
        setBuilderState({ ...builderState, fields: newFields });
        setSelectedFieldIndex(index + 1);
    };

    // Workflow management
    const handleAddWorkflowStep = () => {
        const newStep: FormWorkflowStep = {
            ...emptyWorkflowStep,
            order: builderState.workflow.length + 1,
            label: `Step ${builderState.workflow.length + 1}`,
        };
        setBuilderState({
            ...builderState,
            workflow: [...builderState.workflow, newStep],
        });
    };

    const handleUpdateWorkflowStep = (index: number, updates: Partial<FormWorkflowStep>) => {
        const newWorkflow = [...builderState.workflow];
        newWorkflow[index] = { ...newWorkflow[index], ...updates };
        setBuilderState({ ...builderState, workflow: newWorkflow });
    };

    const handleDeleteWorkflowStep = (index: number) => {
        const newWorkflow = builderState.workflow.filter((_, i) => i !== index);
        // Reorder
        newWorkflow.forEach((step, i) => {
            step.order = i + 1;
        });
        setBuilderState({ ...builderState, workflow: newWorkflow });
    };

    const columns: GridColDef<FormTemplate>[] = [
        {
            field: 'title',
            headerName: 'Form Title',
            flex: 1.5,
            minWidth: 250,
        },
        {
            field: 'audience',
            headerName: 'Audience',
            width: 130,
            renderCell: (params) => (
                <Chip label={params.value} color="primary" size="small" sx={{ textTransform: 'capitalize' }} />
            ),
        },
        {
            field: 'fields',
            headerName: 'Questions',
            width: 100,
            valueGetter: (value: FormField[]) => value.length,
        },
        {
            field: 'status',
            headerName: 'Status',
            width: 120,
            renderCell: (params) => (
                <Chip
                    label={params.value}
                    color={STATUS_COLORS[params.value as FormTemplate['status']]}
                    size="small"
                    sx={{ textTransform: 'capitalize' }}
                />
            ),
        },
        {
            field: 'updatedAt',
            headerName: 'Last Updated',
            width: 180,
            valueFormatter: (value) => new Date(value as string).toLocaleString(),
        },
    ];

    const handleExport = (selectedForms: FormTemplate[]) => {
        try {
            const csv = formTemplatesToCSV(selectedForms);
            downloadCSV(csv, `forms-export-${new Date().toISOString().split('T')[0]}.csv`);
            showNotification(`Exported ${selectedForms.length} form(s) to CSV`, 'success');
        } catch (error) {
            console.error('Error exporting forms:', error);
            showNotification('Failed to export forms to CSV', 'error');
        }
    };

    const handleImport = async (file: File) => {
        try {
            const csvContent = await readCSVFile(file);
            const importedForms = csvToFormTemplates(csvContent);

            // Import forms to Firestore
            for (const formData of importedForms) {
                const formId = `imported-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
                await setFormTemplate(formId, {
                    id: formId,
                    ...formData,
                });
            }

            // Reload data
            await loadData();
            showNotification(`Successfully imported ${importedForms.length} form(s)`, 'success');
        } catch (error) {
            console.error('Error importing forms:', error);
            showNotification('Failed to import forms from CSV', 'error');
        }
    };

    const getAdditionalActions = (params: GridRowParams<FormTemplate>) => [
        <GridActionsCellItem
            key="edit"
            icon={<EditIcon />}
            label="Edit"
            onClick={() => handleOpenEditDialog(params.row)}
            showInMenu={false}
        />,
        <GridActionsCellItem
            key="delete"
            icon={<DeleteIcon />}
            label="Delete"
            onClick={() => handleOpenDeleteDialog(params.row)}
            showInMenu={false}
        />,
    ];

    if (userRole !== 'admin' && userRole !== 'developer') {
        return (
            <AnimatedPage variant="fade">
                <UnauthorizedNotice description="You need to be an administrator or developer to manage forms." />
            </AnimatedPage>
        );
    }

    return (
        <AnimatedPage variant="fade">
            <Box sx={{ width: '100%' }}>
                <DataGrid
                    rows={forms}
                    columns={columns}
                    loading={loading}
                    initialPage={0}
                    initialPageSize={10}
                    pageSizeOptions={[5, 10, 25, 50]}
                    checkboxSelection
                    disableRowSelectionOnClick
                    height={600}
                    additionalActions={getAdditionalActions}
                    enableMultiDelete
                    enableExport
                    enableImport
                    enableRefresh
                    enableAdd
                    enableQuickFilter
                    onRefresh={loadData}
                    onAdd={handleOpenCreateDialog}
                    onExport={handleExport}
                    onImport={handleImport}
                />

                {/* Form Builder Dialog */}
                <Dialog
                    open={dialogOpen}
                    onClose={handleCloseDialog}
                    maxWidth="lg"
                    fullWidth
                    slots={{ transition: GrowTransition }}
                >
                    <DialogTitle>
                        {selectedForm ? 'Edit Form Template' : 'Create New Form Template'}
                    </DialogTitle>
                    <DialogContent>
                        <Box sx={{ mt: 2 }}>
                            <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
                                {steps.map((label) => (
                                    <Step key={label}>
                                        <StepLabel>{label}</StepLabel>
                                    </Step>
                                ))}
                            </Stepper>

                            {formErrors.general && (
                                <Alert severity="error" sx={{ mb: 2 }}>
                                    {formErrors.general}
                                </Alert>
                            )}

                            {/* Step 1: Form Details */}
                            {activeStep === 0 && (
                                <Stack spacing={3}>
                                    <TextField
                                        label="Form Title"
                                        value={builderState.template.title || ''}
                                        onChange={(e) =>
                                            setBuilderState({
                                                ...builderState,
                                                template: { ...builderState.template, title: e.target.value },
                                            })
                                        }
                                        error={!!formErrors.title}
                                        helperText={formErrors.title}
                                        required
                                        fullWidth
                                    />

                                    <TextField
                                        label="Description"
                                        value={builderState.template.description || ''}
                                        onChange={(e) =>
                                            setBuilderState({
                                                ...builderState,
                                                template: { ...builderState.template, description: e.target.value },
                                            })
                                        }
                                        multiline
                                        rows={3}
                                        fullWidth
                                    />

                                    <TextField
                                        select
                                        label="Target Audience"
                                        value={builderState.template.audience || 'student'}
                                        onChange={(e) =>
                                            setBuilderState({
                                                ...builderState,
                                                template: {
                                                    ...builderState.template,
                                                    audience: e.target.value as FormAudience,
                                                },
                                            })
                                        }
                                        error={!!formErrors.audience}
                                        helperText={formErrors.audience || 'Who will fill out this form?'}
                                        required
                                        fullWidth
                                    >
                                        <MenuItem value="student">Student</MenuItem>
                                        <MenuItem value="adviser">Adviser</MenuItem>
                                        <MenuItem value="editor">Editor</MenuItem>
                                    </TextField>

                                    <TextField
                                        select
                                        label="Status"
                                        value={builderState.template.status || 'draft'}
                                        onChange={(e) =>
                                            setBuilderState({
                                                ...builderState,
                                                template: {
                                                    ...builderState.template,
                                                    status: e.target.value as FormTemplate['status'],
                                                },
                                            })
                                        }
                                        fullWidth
                                    >
                                        <MenuItem value="draft">Draft</MenuItem>
                                        <MenuItem value="active">Active</MenuItem>
                                        <MenuItem value="archived">Archived</MenuItem>
                                    </TextField>

                                    <TextField
                                        label="Due In (Days)"
                                        type="number"
                                        value={builderState.template.dueInDays || ''}
                                        onChange={(e) =>
                                            setBuilderState({
                                                ...builderState,
                                                template: {
                                                    ...builderState.template,
                                                    dueInDays: Number(e.target.value) || undefined,
                                                },
                                            })
                                        }
                                        helperText="Suggested due date offset in days once assigned"
                                        fullWidth
                                    />

                                    <TextField
                                        label="Reviewer Notes"
                                        value={builderState.template.reviewerNotes || ''}
                                        onChange={(e) =>
                                            setBuilderState({
                                                ...builderState,
                                                template: { ...builderState.template, reviewerNotes: e.target.value },
                                            })
                                        }
                                        multiline
                                        rows={2}
                                        helperText="Internal notes for reviewers"
                                        fullWidth
                                    />
                                </Stack>
                            )}

                            {/* Step 2: Questions */}
                            {activeStep === 1 && (
                                <Box>
                                    {formErrors.fields && (
                                        <Alert severity="error" sx={{ mb: 2 }}>
                                            {formErrors.fields}
                                        </Alert>
                                    )}

                                    <Stack spacing={2}>
                                        {builderState.fields.map((field, index) => (
                                            <Paper
                                                key={field.id}
                                                elevation={selectedFieldIndex === index ? 4 : 1}
                                                sx={{
                                                    p: 2,
                                                    cursor: 'pointer',
                                                    border: selectedFieldIndex === index ? 2 : 0,
                                                    borderColor: 'primary.main',
                                                }}
                                                onClick={() => setSelectedFieldIndex(index)}
                                            >
                                                <Stack spacing={2}>
                                                    <Stack direction="row" spacing={1} alignItems="center">
                                                        <TextField
                                                            label="Question"
                                                            value={field.label}
                                                            onChange={(e) =>
                                                                handleUpdateField(index, { label: e.target.value })
                                                            }
                                                            error={!!formErrors[`field-${index}-label`]}
                                                            helperText={formErrors[`field-${index}-label`]}
                                                            size="small"
                                                            fullWidth
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                        <TextField
                                                            select
                                                            label="Type"
                                                            value={field.fieldType}
                                                            onChange={(e) =>
                                                                handleUpdateField(index, {
                                                                    fieldType: e.target.value as FormFieldType,
                                                                })
                                                            }
                                                            size="small"
                                                            sx={{ minWidth: 150 }}
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            {FIELD_TYPES.map((type) => (
                                                                <MenuItem key={type.value} value={type.value}>
                                                                    {type.label}
                                                                </MenuItem>
                                                            ))}
                                                        </TextField>
                                                    </Stack>

                                                    {selectedFieldIndex === index && (
                                                        <>
                                                            <TextField
                                                                label="Helper Text"
                                                                value={field.helperText || ''}
                                                                onChange={(e) =>
                                                                    handleUpdateField(index, {
                                                                        helperText: e.target.value,
                                                                    })
                                                                }
                                                                size="small"
                                                                fullWidth
                                                            />

                                                            <Stack direction="row" spacing={1} alignItems="center">
                                                                <Typography variant="body2">Required:</Typography>
                                                                <ToggleButtonGroup
                                                                    value={field.required ? 'yes' : 'no'}
                                                                    exclusive
                                                                    onChange={(_, value) =>
                                                                        value &&
                                                                        handleUpdateField(index, {
                                                                            required: value === 'yes',
                                                                        })
                                                                    }
                                                                    size="small"
                                                                >
                                                                    <ToggleButton value="yes">Yes</ToggleButton>
                                                                    <ToggleButton value="no">No</ToggleButton>
                                                                </ToggleButtonGroup>
                                                            </Stack>

                                                            {(field.fieldType === 'select' ||
                                                                field.fieldType === 'multiSelect') && (
                                                                    <Box>
                                                                        <Typography variant="body2" sx={{ mb: 1 }}>
                                                                            Options:
                                                                        </Typography>
                                                                        {field.options?.map((option, optIndex) => (
                                                                            <Stack
                                                                                key={option.id}
                                                                                direction="row"
                                                                                spacing={1}
                                                                                sx={{ mb: 1 }}
                                                                            >
                                                                                <TextField
                                                                                    value={option.label}
                                                                                    onChange={(e) => {
                                                                                        const newOptions = [
                                                                                            ...(field.options || []),
                                                                                        ];
                                                                                        newOptions[optIndex] = {
                                                                                            ...option,
                                                                                            label: e.target.value,
                                                                                            value: e.target.value,
                                                                                        };
                                                                                        handleUpdateField(index, {
                                                                                            options: newOptions,
                                                                                        });
                                                                                    }}
                                                                                    size="small"
                                                                                    fullWidth
                                                                                />
                                                                                <IconButton
                                                                                    size="small"
                                                                                    onClick={() => {
                                                                                        handleUpdateField(index, {
                                                                                            options: field.options?.filter(
                                                                                                (_, i) => i !== optIndex,
                                                                                            ),
                                                                                        });
                                                                                    }}
                                                                                >
                                                                                    <DeleteIcon fontSize="small" />
                                                                                </IconButton>
                                                                            </Stack>
                                                                        ))}
                                                                        <Button
                                                                            startIcon={<AddIcon />}
                                                                            onClick={() => {
                                                                                const optionNum =
                                                                                    (field.options?.length || 0) + 1;
                                                                                const newOption: FormFieldOption = {
                                                                                    id: `opt-${optionNum}`,
                                                                                    label: `Option ${optionNum}`,
                                                                                    value: `option-${optionNum}`,
                                                                                };
                                                                                handleUpdateField(index, {
                                                                                    options: [
                                                                                        ...(field.options || []),
                                                                                        newOption,
                                                                                    ],
                                                                                });
                                                                            }}
                                                                            size="small"
                                                                        >
                                                                            Add Option
                                                                        </Button>
                                                                    </Box>
                                                                )}

                                                            <Divider />

                                                            <Stack direction="row" spacing={1}>
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => handleMoveField(index, 'up')}
                                                                    disabled={index === 0}
                                                                >
                                                                    <ArrowUpwardIcon fontSize="small" />
                                                                </IconButton>
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => handleMoveField(index, 'down')}
                                                                    disabled={index === builderState.fields.length - 1}
                                                                >
                                                                    <ArrowDownwardIcon fontSize="small" />
                                                                </IconButton>
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => handleDuplicateField(index)}
                                                                >
                                                                    <ContentCopyIcon fontSize="small" />
                                                                </IconButton>
                                                                <IconButton
                                                                    size="small"
                                                                    color="error"
                                                                    onClick={() => handleDeleteField(index)}
                                                                >
                                                                    <DeleteIcon fontSize="small" />
                                                                </IconButton>
                                                            </Stack>
                                                        </>
                                                    )}
                                                </Stack>
                                            </Paper>
                                        ))}

                                        <Button
                                            startIcon={<AddIcon />}
                                            variant="outlined"
                                            onClick={handleAddField}
                                            fullWidth
                                        >
                                            Add Question
                                        </Button>
                                    </Stack>
                                </Box>
                            )}

                            {/* Step 3: Workflow & Access */}
                            {activeStep === 2 && (
                                <Stack spacing={3}>
                                    <Box>
                                        <Typography variant="h6" gutterBottom>
                                            Workflow Steps
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                            Define the sequence of approvals and reviews
                                        </Typography>

                                        {formErrors.workflow && (
                                            <Alert severity="error" sx={{ mb: 2 }}>
                                                {formErrors.workflow}
                                            </Alert>
                                        )}

                                        <Stack spacing={2}>
                                            {builderState.workflow.map((step, index) => (
                                                <Paper key={step.order} elevation={1} sx={{ p: 2 }}>
                                                    <Stack spacing={2}>
                                                        <Stack direction="row" spacing={2} alignItems="center">
                                                            <Chip label={`Step ${step.order}`} color="primary" />
                                                            <TextField
                                                                label="Step Label"
                                                                value={step.label}
                                                                onChange={(e) =>
                                                                    handleUpdateWorkflowStep(index, {
                                                                        label: e.target.value,
                                                                    })
                                                                }
                                                                size="small"
                                                                fullWidth
                                                            />
                                                            <TextField
                                                                select
                                                                label="Role"
                                                                value={step.role}
                                                                onChange={(e) =>
                                                                    handleUpdateWorkflowStep(index, {
                                                                        role: e.target.value as FormAudience | 'admin',
                                                                    })
                                                                }
                                                                size="small"
                                                                sx={{ minWidth: 150 }}
                                                            >
                                                                {AUDIENCE_OPTIONS.map((role) => (
                                                                    <MenuItem key={role} value={role}>
                                                                        {role.charAt(0).toUpperCase() + role.slice(1)}
                                                                    </MenuItem>
                                                                ))}
                                                            </TextField>
                                                            <IconButton
                                                                size="small"
                                                                color="error"
                                                                onClick={() => handleDeleteWorkflowStep(index)}
                                                            >
                                                                <DeleteIcon />
                                                            </IconButton>
                                                        </Stack>

                                                        <Stack direction="row" spacing={2}>
                                                            <Stack direction="row" spacing={1} alignItems="center">
                                                                <Typography variant="body2">Signature:</Typography>
                                                                <ToggleButtonGroup
                                                                    value={step.requiresSignature ? 'yes' : 'no'}
                                                                    exclusive
                                                                    onChange={(_, value) =>
                                                                        value &&
                                                                        handleUpdateWorkflowStep(index, {
                                                                            requiresSignature: value === 'yes',
                                                                        })
                                                                    }
                                                                    size='small'
                                                                >
                                                                    <ToggleButton value="yes">Yes</ToggleButton>
                                                                    <ToggleButton value="no">No</ToggleButton>
                                                                </ToggleButtonGroup>
                                                            </Stack>

                                                            <Stack direction="row" spacing={1} alignItems="center">
                                                                <Typography variant="body2">Required:</Typography>
                                                                <ToggleButtonGroup
                                                                    value={step.required ? 'yes' : 'no'}
                                                                    exclusive
                                                                    onChange={(_, value) =>
                                                                        value &&
                                                                        handleUpdateWorkflowStep(index, {
                                                                            required: value === 'yes',
                                                                        })
                                                                    }
                                                                    size='small'
                                                                >
                                                                    <ToggleButton value="yes">Yes</ToggleButton>
                                                                    <ToggleButton value="no">No</ToggleButton>
                                                                </ToggleButtonGroup>
                                                            </Stack>
                                                        </Stack>
                                                    </Stack>
                                                </Paper>
                                            ))}

                                            <Button
                                                startIcon={<AddIcon />}
                                                variant="outlined"
                                                onClick={handleAddWorkflowStep}
                                            >
                                                Add Workflow Step
                                            </Button>
                                        </Stack>
                                    </Box>

                                    <Box>
                                        <Typography variant="h6" gutterBottom>
                                            Access Control
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                            Select which groups can access this form
                                        </Typography>

                                        <Autocomplete
                                            multiple
                                            options={groups}
                                            getOptionLabel={(option) => option.name}
                                            value={groups.filter((g) =>
                                                builderState.availableGroups.includes(g.id),
                                            )}
                                            onChange={(_, newValue) =>
                                                setBuilderState({
                                                    ...builderState,
                                                    availableGroups: newValue.map((g) => g.id),
                                                })
                                            }
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    label="Available to Groups"
                                                    helperText="Leave empty to make available to all groups"
                                                />
                                            )}
                                        />
                                    </Box>
                                </Stack>
                            )}
                        </Box>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseDialog} disabled={saving}>
                            Cancel
                        </Button>
                        {activeStep > 0 && (
                            <Button onClick={handleBack} disabled={saving}>
                                Back
                            </Button>
                        )}
                        {activeStep < steps.length - 1 ? (
                            <Button onClick={handleNext} variant="contained" disabled={saving}>
                                Next
                            </Button>
                        ) : (
                            <Button onClick={handleSave} variant="contained" disabled={saving}>
                                {saving ? 'Saving...' : selectedForm ? 'Save Changes' : 'Create Form'}
                            </Button>
                        )}
                    </DialogActions>
                </Dialog>

                {/* Delete Confirmation Dialog */}
                <Dialog open={deleteDialogOpen} onClose={handleCloseDialog} slots={{ transition: GrowTransition }}>
                    <DialogTitle>Delete Form</DialogTitle>
                    <DialogContent>
                        <Typography>
                            Are you sure you want to delete form <strong>{selectedForm?.title}</strong>? This action
                            cannot be undone.
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseDialog} disabled={saving}>
                            Cancel
                        </Button>
                        <Button onClick={handleDelete} variant="contained" color="error" disabled={saving}>
                            {saving ? 'Deleting...' : 'Delete'}
                        </Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </AnimatedPage>
    );
}
