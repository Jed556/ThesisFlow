import * as React from 'react';
import {
    Alert, Autocomplete, Box, Button, Chip, Dialog, DialogActions, DialogContent,
    DialogTitle, Divider, IconButton, MenuItem, Paper, Stack, Step, StepLabel,
    Stepper, TextField, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import AssignmentIcon from '@mui/icons-material/Assignment';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import type { GridColDef, GridRowParams } from '@mui/x-data-grid';
import { GridActionsCellItem } from '@mui/x-data-grid';
import { AnimatedPage, GrowTransition } from '../../../components/Animate';
import { DataGrid } from '../../../components/DataGrid';
import { useSession } from '@toolpad/core';
import { useSnackbar } from '../../../contexts/SnackbarContext';
import type { NavigationItem } from '../../../types/navigation';
import type { FormTemplate, FormField, FormFieldType, FormFieldOption, FormWorkflowStep, FormAudience } from '../../../types/forms';
import type { Session } from '../../../types/session';
import type { ThesisGroup } from '../../../types/group';
import {
    getAllFormTemplates,
    createFormTemplate,
    updateFormTemplate,
    deleteFormTemplate,
    setFormTemplate,
} from '../../../utils/firebase/firestore';
import { getAllGroups } from '../../../utils/firebase/firestore';
import { importFormsFromCsv, exportFormsToCsv } from '../../../utils/csv/form';
import UnauthorizedNotice from '../../../layouts/UnauthorizedNotice';
import { useBackgroundJobControls, useBackgroundJobFlag } from '../../../hooks/useBackgroundJobs';

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
    const { startJob } = useBackgroundJobControls();
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

    // Local state for Step 0 to avoid expensive state updates on every keystroke
    const [localFormDetails, setLocalFormDetails] = React.useState({
        title: '',
        description: '',
        audience: 'student' as FormAudience,
        status: 'draft' as FormTemplate['status'],
        dueDate: undefined as string | undefined,
        reviewerNotes: '',
    });

    const [selectedFieldIndex, setSelectedFieldIndex] = React.useState<number | null>(null);
    const [formErrors, setFormErrors] = React.useState<Record<string, string>>({});

    const isMountedRef = React.useRef(true);
    React.useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // Memoize columns to prevent DataGrid re-renders
    const columns = React.useMemo<GridColDef<FormTemplate>[]>(() => [
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
    ], []);

    // Track active form import jobs to pause reloads until the import finishes
    const hasActiveImport = useBackgroundJobFlag(
        React.useCallback((job) => {
            if (job.status !== 'pending' && job.status !== 'running') {
                return false;
            }
            const jobType = job.metadata?.jobType as string | undefined;
            return jobType === 'forms-import';
        }, [])
    );

    const loadData = React.useCallback(async () => {
        if (hasActiveImport) {
            return;
        }
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
    }, [showNotification, hasActiveImport]);

    React.useEffect(() => {
        loadData();
    }, [loadData]);

    const resetBuilder = React.useCallback(() => {
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
        setLocalFormDetails({
            title: '',
            description: '',
            audience: 'student',
            status: 'draft',
            dueDate: undefined,
            reviewerNotes: '',
        });
        setSelectedFieldIndex(null);
        setActiveStep(0);
        setFormErrors({});
    }, []);

    const handleOpenCreateDialog = React.useCallback(() => {
        resetBuilder();
        setDialogOpen(true);
    }, [resetBuilder]);

    const handleOpenEditDialog = React.useCallback((form: FormTemplate) => {
        setSelectedForm(form);
        setBuilderState({
            template: {
                title: form.title,
                description: form.description,
                audience: form.audience,
                status: form.status,
                tags: form.tags || [],
                dueInDays: form.dueInDays,
                dueDate: form.dueDate,
                reviewerNotes: form.reviewerNotes,
            },
            fields: [...form.fields],
            workflow: form.workflow || [],
            availableGroups: form.availableToGroups || [],
        });
        setLocalFormDetails({
            title: form.title,
            description: form.description || '',
            audience: form.audience,
            status: form.status,
            dueDate: form.dueDate,
            reviewerNotes: form.reviewerNotes || '',
        });
        setDialogOpen(true);
    }, []);

    const handleOpenDeleteDialog = React.useCallback((form: FormTemplate) => {
        setSelectedForm(form);
        setDeleteDialogOpen(true);
    }, []);

    const handleCloseDialog = React.useCallback(() => {
        setDialogOpen(false);
        setDeleteDialogOpen(false);
        setSelectedForm(null);
        resetBuilder();
    }, [resetBuilder]);

    const validateStep = React.useCallback((step: number): boolean => {
        const errors: Record<string, string> = {};

        if (step === 0) {
            if (!localFormDetails.title?.trim()) {
                errors.title = 'Form title is required';
            }
            if (!localFormDetails.audience) {
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
    }, [localFormDetails.title, localFormDetails.audience, builderState.fields, builderState.workflow]);

    const handleNext = React.useCallback(() => {
        if (validateStep(activeStep)) {
            // When leaving step 0, commit local form details to builderState
            if (activeStep === 0) {
                setBuilderState(prev => ({
                    ...prev,
                    template: {
                        ...prev.template,
                        title: localFormDetails.title,
                        description: localFormDetails.description,
                        audience: localFormDetails.audience,
                        status: localFormDetails.status,
                        dueDate: localFormDetails.dueDate,
                        reviewerNotes: localFormDetails.reviewerNotes,
                    },
                }));
            }
            setActiveStep((prev) => prev + 1);
        }
    }, [activeStep, validateStep, localFormDetails]);

    const handleBack = React.useCallback(() => {
        setActiveStep((prev) => prev - 1);
    }, []);

    const handleSave = React.useCallback(async () => {
        if (!validateStep(activeStep)) return;

        // Commit local form details to builderState before saving
        if (activeStep === 0) {
            setBuilderState(prev => ({
                ...prev,
                template: {
                    ...prev.template,
                    title: localFormDetails.title,
                    description: localFormDetails.description,
                    audience: localFormDetails.audience,
                    status: localFormDetails.status,
                    dueDate: localFormDetails.dueDate,
                    reviewerNotes: localFormDetails.reviewerNotes,
                },
            }));
        }

        setSaving(true);
        try {
            // Use localFormDetails if on step 0, otherwise use builderState
            const templateData = activeStep === 0 ? {
                title: localFormDetails.title,
                description: localFormDetails.description,
                audience: localFormDetails.audience,
                status: localFormDetails.status,
                dueDate: localFormDetails.dueDate,
                reviewerNotes: localFormDetails.reviewerNotes,
                tags: builderState.template.tags,
            } : builderState.template;

            const formData: Omit<FormTemplate, 'id' | 'createdAt' | 'updatedAt'> = {
                title: templateData.title!,
                description: templateData.description,
                version: selectedForm?.version || '1.0.0',
                audience: templateData.audience!,
                fields: builderState.fields.map((f, idx) => ({ ...f, id: f.id || `field-${idx}` })),
                status: templateData.status!,
                createdBy: selectedForm?.createdBy || session?.user?.uid || '',
                tags: templateData.tags,
                reviewerNotes: templateData.reviewerNotes,
                dueDate: templateData.dueDate,
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
    }, [
        activeStep, validateStep, localFormDetails, builderState,
        selectedForm, forms, session?.user?.uid, handleCloseDialog, showNotification
    ]);

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

    const handleExport = React.useCallback((selectedForms: FormTemplate[]) => {
        try {
            const csvText = exportFormsToCsv(selectedForms);
            const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `forms-export-${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            showNotification(`Exported ${selectedForms.length} form(s) to CSV`, 'success');
        } catch (error) {
            console.error('Error exporting forms:', error);
            showNotification('Failed to export forms to CSV', 'error');
        }
    }, [showNotification]);

    const handleImport = React.useCallback(async (file: File) => {
        startJob(
            `Importing forms from ${file.name}`,
            async (updateProgress, signal) => {
                const text = await file.text();
                if (signal.aborted) {
                    throw new Error('Import cancelled');
                }

                const { parsed: importedForms, errors: parseErrors } = importFormsFromCsv(text);

                const errors: string[] = [];
                if (parseErrors.length) {
                    errors.push(...parseErrors.map((e: string) => `Parse: ${e}`));
                }

                if (signal.aborted) {
                    throw new Error('Import cancelled');
                }

                const total = importedForms.length;
                let successCount = 0;

                for (let i = 0; i < importedForms.length; i++) {
                    if (signal.aborted) {
                        throw new Error('Import cancelled');
                    }

                    const formData = importedForms[i];
                    if (total > 0) {
                        updateProgress({
                            current: i + 1,
                            total,
                            message: `Creating form ${formData.title || `#${i + 1}`}`,
                        });
                    }

                    try {
                        const fallbackId = `imported-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
                        const formId = (formData as Partial<FormTemplate>).id || fallbackId;
                        await setFormTemplate(formId, {
                            ...formData,
                            id: formId,
                        });
                        successCount++;
                    } catch (importError) {
                        const identifier = formData.title || formData.id || `row ${i + 2}`;
                        errors.push(
                            `Failed to import ${identifier}: ${importError instanceof Error ? importError.message : 'Unknown error'}`
                        );
                    }
                }

                return {
                    count: successCount,
                    errors,
                    total,
                };
            },
            { fileName: file.name, fileSize: file.size, jobType: 'forms-import' },
            (job) => {
                if (isMountedRef.current) {
                    (async () => {
                        try {
                            setLoading(true);
                            const [formsData, groupsData] = await Promise.all([
                                getAllFormTemplates(),
                                getAllGroups(),
                            ]);
                            setForms(formsData);
                            setGroups(groupsData);
                        } catch {
                            // handled below via notifications
                        } finally {
                            setLoading(false);
                        }
                    })();
                }

                if (job.status === 'completed' && job.result) {
                    const result = job.result as { count: number; errors: string[]; total: number };
                    if (result.errors.length > 0) {
                        showNotification(
                            `Imported ${result.count} of ${result.total} form(s) with warnings`,
                            'warning',
                            6000,
                            {
                                label: 'View Details',
                                onClick: () =>
                                    showNotification(`Import warnings:\n${result.errors.join('\n')}`, 'info', 0),
                            }
                        );
                    } else {
                        showNotification(`Successfully imported ${result.count} form(s)`, 'success');
                    }
                } else if (job.status === 'failed') {
                    showNotification(`Form import failed: ${job.error}`, 'error');
                }
            }
        );

        showNotification('Form import started in the background.', 'info', 5000);
    }, [startJob, showNotification]);

    const getAdditionalActions = React.useCallback((params: GridRowParams<FormTemplate>) => [
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
    ], [handleOpenEditDialog, handleOpenDeleteDialog]);

    if (userRole !== 'admin' && userRole !== 'developer') {
        return (
            <AnimatedPage variant="fade">
                <UnauthorizedNotice description="You need to be an administrator or developer to manage forms." />
            </AnimatedPage>
        );
    }

    // Memoize DataGrid to prevent re-renders when dialog state changes
    const dataGridSection = React.useMemo(() => (
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
            importDisabled={hasActiveImport}
            enableRefresh
            enableAdd
            enableQuickFilter
            onRefresh={loadData}
            onAdd={handleOpenCreateDialog}
            onExport={handleExport}
            onImport={handleImport}
        />
    ), [forms, columns, loading, getAdditionalActions, hasActiveImport, loadData, handleOpenCreateDialog, handleExport, handleImport]);

    return (
        <AnimatedPage variant="fade">
            <Box sx={{ width: '100%' }}>
                {dataGridSection}

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
                                        value={localFormDetails.title || ''}
                                        onChange={(e) =>
                                            setLocalFormDetails(prev => ({ ...prev, title: e.target.value }))
                                        }
                                        error={!!formErrors.title}
                                        helperText={formErrors.title}
                                        required
                                        fullWidth
                                    />

                                    <TextField
                                        label="Description"
                                        value={localFormDetails.description || ''}
                                        onChange={(e) =>
                                            setLocalFormDetails(prev => ({ ...prev, description: e.target.value }))
                                        }
                                        multiline
                                        rows={3}
                                        fullWidth
                                    />

                                    <TextField
                                        select
                                        label="Target Audience"
                                        value={localFormDetails.audience || 'student'}
                                        onChange={(e) =>
                                            setLocalFormDetails(prev => ({
                                                ...prev,
                                                audience: e.target.value as FormAudience,
                                            }))
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
                                        value={localFormDetails.status || 'draft'}
                                        onChange={(e) =>
                                            setLocalFormDetails(prev => ({
                                                ...prev,
                                                status: e.target.value as FormTemplate['status'],
                                            }))
                                        }
                                        fullWidth
                                    >
                                        <MenuItem value="draft">Draft</MenuItem>
                                        <MenuItem value="active">Active</MenuItem>
                                        <MenuItem value="archived">Archived</MenuItem>
                                    </TextField>

                                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                                        <DatePicker
                                            label="Due Date"
                                            value={localFormDetails.dueDate ? dayjs(localFormDetails.dueDate) : null}
                                            onChange={(newValue) =>
                                                setLocalFormDetails(prev => ({
                                                    ...prev,
                                                    dueDate: newValue ? newValue.toISOString() : undefined,
                                                }))
                                            }
                                            slotProps={{
                                                textField: {
                                                    fullWidth: true,
                                                    helperText: 'Select the due date for this form',
                                                },
                                            }}
                                        />
                                    </LocalizationProvider>

                                    <TextField
                                        label="Reviewer Notes"
                                        value={localFormDetails.reviewerNotes || ''}
                                        onChange={(e) =>
                                            setLocalFormDetails(prev => ({ ...prev, reviewerNotes: e.target.value }))
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
                                                    position: 'relative',
                                                    border: selectedFieldIndex === index ? 2 : 0,
                                                    borderColor: 'primary.main',
                                                }}
                                            >
                                                {/* Click overlay - only visible when not selected */}
                                                {selectedFieldIndex !== index && (
                                                    <Box
                                                        onClick={() => setSelectedFieldIndex(index)}
                                                        sx={{
                                                            position: 'absolute',
                                                            top: 0,
                                                            left: 0,
                                                            right: 0,
                                                            bottom: 0,
                                                            cursor: 'pointer',
                                                            zIndex: 1,
                                                        }}
                                                    />
                                                )}
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
