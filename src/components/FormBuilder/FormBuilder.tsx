import * as React from 'react';
import {
    Box,
    Button,
    Card,
    CardActions,
    CardContent,
    Chip,
    Divider,
    Grid,
    IconButton,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    MenuItem,
    Stack,
    Switch,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import { DeleteOutline, ArrowUpward, ArrowDownward, ContentCopy } from '@mui/icons-material';
import type { FormAssignment, FormField, FormFieldOption, FormFieldType, FormTemplate, FormAudience } from '../../types/forms';
import { useFormBuilder, createEmptyField } from './hooks/useFormBuilder';
import { useSnackbar } from '../Snackbar';

/**
 * Palette definition for supported field types.
 */
const FIELD_LIBRARY: Array<{ type: FormFieldType; label: string; description: string }> = [
    { type: 'shortText', label: 'Short answer', description: 'Single-line text input for brief responses.' },
    { type: 'longText', label: 'Long answer', description: 'Multi-line text area for detailed explanations.' },
    { type: 'select', label: 'Dropdown', description: 'Single choice from predefined options.' },
    { type: 'multiSelect', label: 'Multi-select', description: 'Select multiple options from a list.' },
    { type: 'checkbox', label: 'Checkbox', description: 'Binary confirmation field.' },
    { type: 'date', label: 'Date', description: 'Calendar date picker control.' },
    { type: 'file', label: 'File upload', description: 'Collect supporting documents and artefacts.' },
    { type: 'signature', label: 'Signature', description: 'Capture a digital signature acknowledgement.' },
];

/**
 * Props for the form builder surface.
 */
export interface FormBuilderProps {
    /** Template seed to load into the builder. */
    initialTemplate?: FormTemplate;
    /** Informational context about the assignment currently being edited. */
    assignmentContext?: FormAssignment;
    /** Persist the working template when users hit the save action. */
    onSave?: (template: FormTemplate) => void;
    /** Callback executed when the template is ready to be published. */
    onPublish?: (template: FormTemplate) => void;
}

/**
 * Generate ids for new options added within the builder.
 */
function createOptionId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return `option-${crypto.randomUUID()}`;
    }
    return `option-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Rich form builder that allows reviewers to configure templates before sending them to students.
 */
export function FormBuilder({ initialTemplate, assignmentContext, onSave, onPublish }: FormBuilderProps) {
    const builder = useFormBuilder(initialTemplate);
    const { template, activeFieldId, setActiveFieldId, updateTemplateMeta, addField, updateField, removeField, moveField, reset } = builder;
    const activeField = template.fields.find((field) => field.id === activeFieldId) ?? template.fields[0];
    const { showNotification } = useSnackbar();

    /**
     * Persist template via consumer defined callback.
     */
    const handleSave = React.useCallback(() => {
        if (onSave) {
            onSave(template);
        }
        showNotification('Template saved to drafts.', 'success');
    }, [onSave, showNotification, template]);

    /**
     * Publish template via consumer defined callback.
     */
    const handlePublish = React.useCallback(() => {
        if (onPublish) {
            onPublish({ ...template, status: 'active' });
        }
        showNotification('Template published and ready to share.', 'info');
    }, [onPublish, showNotification, template]);

    /**
     * Duplicate the currently active field for quick iteration.
     */
    const handleDuplicate = React.useCallback(() => {
        if (!activeField) return;
        const newField = addField(activeField.fieldType);
        updateField(newField.id, {
            label: `${activeField.label} copy`,
            helperText: activeField.helperText,
            placeholder: activeField.placeholder,
            required: activeField.required,
            maxLength: activeField.maxLength,
            rows: activeField.rows,
            allowMultiple: activeField.allowMultiple,
            options: activeField.options?.map((option) => ({
                ...option,
                id: createOptionId(),
            })),
        });
    }, [activeField, addField, updateField]);

    /**
     * Change template metadata such as title, description, or audience.
     */
    const handleTemplateChange = (key: keyof FormTemplate) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        updateTemplateMeta({ [key]: event.target.value } as Partial<FormTemplate>);
    };

    /**
     * Alter the template audience from the toggle buttons.
     */
    const handleAudienceChange = (_: React.SyntheticEvent, audience: FormAudience | null) => {
        if (!audience) return;
        updateTemplateMeta({ audience });
    };

    /**
     * Update the core field properties (label, helper text, etc.).
     */
    const handleFieldChange = <K extends keyof FormField>(fieldId: string, key: K) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const value = key === 'required' ? (event.target as HTMLInputElement).checked : event.target.value;
        updateField(fieldId, { [key]: value } as Partial<FormField>);
    };

    /**
     * Update option content inside select or multi-select fields.
     */
    const handleOptionChange = (field: FormField, optionId: string, updates: Partial<FormFieldOption>) => {
        const options = field.options?.map((option) => option.id === optionId ? { ...option, ...updates } : option);
        updateField(field.id, { options });
    };

    /**
     * Remove an option from the active field.
     */
    const handleRemoveOption = (field: FormField, optionId: string) => {
        const options = field.options?.filter((option) => option.id !== optionId) ?? [];
        updateField(field.id, { options });
    };

    /**
     * Append a new option to the active field.
     */
    const handleAddOption = (field: FormField) => {
        const options = [...(field.options ?? []), {
            id: createOptionId(),
            label: 'New option',
            value: `option-${(field.options?.length ?? 0) + 1}`,
        }];
        updateField(field.id, { options });
    };

    return (
        <Grid container spacing={3} sx={{ mt: 0 }}>
            <Grid item xs={12} md={4} lg={3}>
                <Stack spacing={3}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Form details
                            </Typography>
                            <Stack spacing={2}>
                                <TextField
                                    label="Form title"
                                    value={template.title}
                                    onChange={handleTemplateChange('title')}
                                    fullWidth
                                    size="small"
                                />
                                <TextField
                                    label="Description"
                                    multiline
                                    minRows={3}
                                    value={template.description ?? ''}
                                    onChange={handleTemplateChange('description')}
                                    fullWidth
                                />
                                <TextField
                                    label="Version"
                                    value={template.version}
                                    onChange={handleTemplateChange('version')}
                                    size="small"
                                />
                                <TextField
                                    label="Tags (comma separated)"
                                    value={(template.tags ?? []).join(', ')}
                                    onChange={(event) => {
                                        updateTemplateMeta({ tags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean) });
                                    }}
                                    size="small"
                                />
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Typography variant="body2">Audience:</Typography>
                                    <TextField
                                        select
                                        size="small"
                                        value={template.audience}
                                        onChange={(event) => handleAudienceChange(event as any, event.target.value as FormAudience)}
                                        sx={{ minWidth: 140 }}
                                    >
                                        <MenuItem value="student">Students</MenuItem>
                                        <MenuItem value="adviser">Advisers</MenuItem>
                                        <MenuItem value="editor">Editors</MenuItem>
                                    </TextField>
                                </Stack>
                                {assignmentContext && (
                                    <Box>
                                        <Typography variant="body2" color="text.secondary">
                                            Linked assignment
                                        </Typography>
                                        <Typography variant="subtitle2">{assignmentContext.title}</Typography>
                                        <Chip label={assignmentContext.status} size="small" sx={{ mt: 1 }} />
                                    </Box>
                                )}
                            </Stack>
                        </CardContent>
                        <CardActions sx={{ justifyContent: 'space-between', px: 3, pb: 3 }}>
                            <Button variant="outlined" color="inherit" onClick={reset}>Reset</Button>
                            <Stack direction="row" spacing={1}>
                                <Button variant="outlined" onClick={handleSave}>Save draft</Button>
                                <Button variant="contained" onClick={handlePublish}>Publish</Button>
                            </Stack>
                        </CardActions>
                    </Card>

                    <Card>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Field library
                            </Typography>
                            <Stack spacing={1.5}>
                                {FIELD_LIBRARY.map((item) => (
                                    <Button
                                        key={item.type}
                                        variant="outlined"
                                        color="primary"
                                        onClick={() => {
                                            const field = addField(item.type);
                                            const { id: _id, fieldType, ...defaults } = createEmptyField(item.type);
                                            updateField(field.id, defaults);
                                        }}
                                        sx={{ justifyContent: 'space-between' }}
                                    >
                                        <Box textAlign="left">
                                            <Typography variant="body1" fontWeight={600}>{item.label}</Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                {item.description}
                                            </Typography>
                                        </Box>
                                    </Button>
                                ))}
                            </Stack>
                        </CardContent>
                    </Card>
                </Stack>
            </Grid>

            <Grid item xs={12} md={4} lg={4}>
                <Card sx={{ height: '100%' }}>
                    <CardContent sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <Typography variant="h6" gutterBottom>
                            Form structure
                        </Typography>
                        {template.fields.length === 0 ? (
                            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Typography variant="body2" color="text.secondary">
                                    Start by adding fields from the library to compose your form.
                                </Typography>
                            </Box>
                        ) : (
                            <List dense sx={{ flex: 1, overflow: 'auto' }}>
                                {template.fields.map((field, index) => (
                                    <ListItem
                                        key={field.id}
                                        disablePadding
                                        secondaryAction={
                                            <Stack direction="row" spacing={0.5}>
                                                <Tooltip title="Move up">
                                                    <span>
                                                        <IconButton size="small" disabled={index === 0} onClick={() => moveField(field.id, -1)}>
                                                            <ArrowUpward fontSize="inherit" />
                                                        </IconButton>
                                                    </span>
                                                </Tooltip>
                                                <Tooltip title="Move down">
                                                    <span>
                                                        <IconButton size="small" disabled={index === template.fields.length - 1} onClick={() => moveField(field.id, 1)}>
                                                            <ArrowDownward fontSize="inherit" />
                                                        </IconButton>
                                                    </span>
                                                </Tooltip>
                                                <Tooltip title="Duplicate">
                                                    <IconButton size="small" onClick={handleDuplicate}>
                                                        <ContentCopy fontSize="inherit" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Remove field">
                                                    <IconButton size="small" onClick={() => removeField(field.id)}>
                                                        <DeleteOutline fontSize="inherit" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Stack>
                                        }
                                    >
                                        <ListItemButton
                                            selected={field.id === activeField?.id}
                                            onClick={() => setActiveFieldId(field.id)}
                                        >
                                            <ListItemText
                                                primary={field.label || 'Untitled field'}
                                                secondary={field.fieldType}
                                            />
                                        </ListItemButton>
                                    </ListItem>
                                ))}
                            </List>
                        )}
                    </CardContent>
                </Card>
            </Grid>

            <Grid item xs={12} md={4} lg={5}>
                <Card sx={{ height: '100%' }}>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            Field configuration
                        </Typography>
                        {!activeField ? (
                            <Typography variant="body2" color="text.secondary">
                                Select a field from the structure list to edit its settings.
                            </Typography>
                        ) : (
                            <Stack spacing={2}>
                                <TextField
                                    label="Field label"
                                    value={activeField.label}
                                    onChange={handleFieldChange(activeField.id, 'label')}
                                    fullWidth
                                />
                                <TextField
                                    label="Helper text"
                                    value={activeField.helperText ?? ''}
                                    onChange={handleFieldChange(activeField.id, 'helperText')}
                                    fullWidth
                                    multiline
                                    minRows={2}
                                />
                                {['shortText', 'longText'].includes(activeField.fieldType) && (
                                    <TextField
                                        label="Placeholder"
                                        value={activeField.placeholder ?? ''}
                                        onChange={handleFieldChange(activeField.id, 'placeholder')}
                                        fullWidth
                                    />
                                )}
                                {activeField.fieldType === 'longText' && (
                                    <TextField
                                        label="Suggested rows"
                                        type="number"
                                        value={activeField.rows ?? 5}
                                        onChange={handleFieldChange(activeField.id, 'rows')}
                                        inputProps={{ min: 2, max: 12 }}
                                        size="small"
                                    />
                                )}
                                {activeField.fieldType === 'shortText' && (
                                    <TextField
                                        label="Max characters"
                                        type="number"
                                        value={activeField.maxLength ?? ''}
                                        onChange={handleFieldChange(activeField.id, 'maxLength')}
                                        size="small"
                                        inputProps={{ min: 10, max: 500 }}
                                    />
                                )}
                                {['select', 'multiSelect'].includes(activeField.fieldType) && (
                                    <Box>
                                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                                            <Typography variant="subtitle2">Options</Typography>
                                            <Button size="small" onClick={() => handleAddOption(activeField)}>Add option</Button>
                                        </Stack>
                                        <Stack spacing={1.5}>
                                            {(activeField.options ?? []).map((option) => (
                                                <Stack key={option.id} direction="row" spacing={1} alignItems="center">
                                                    <TextField
                                                        label="Label"
                                                        value={option.label}
                                                        onChange={(event) => handleOptionChange(activeField, option.id, { label: event.target.value })}
                                                        size="small"
                                                        fullWidth
                                                    />
                                                    <TextField
                                                        label="Value"
                                                        value={option.value}
                                                        onChange={(event) => handleOptionChange(activeField, option.id, { value: event.target.value })}
                                                        size="small"
                                                        fullWidth
                                                    />
                                                    <IconButton onClick={() => handleRemoveOption(activeField, option.id)}>
                                                        <DeleteOutline />
                                                    </IconButton>
                                                </Stack>
                                            ))}
                                        </Stack>
                                    </Box>
                                )}
                                <Stack direction="row" alignItems="center" spacing={1}>
                                    <Switch
                                        checked={Boolean(activeField.required)}
                                        onChange={(event) => updateField(activeField.id, { required: event.target.checked })}
                                    />
                                    <Typography variant="body2">Required field</Typography>
                                </Stack>
                            </Stack>
                        )}
                    </CardContent>
                    {assignmentContext && (
                        <CardActions sx={{ justifyContent: 'flex-end', px: 3, pb: 3 }}>
                            <Chip label={`Due ${assignmentContext.dueDate ?? 'TBD'}`} size="small" />
                        </CardActions>
                    )}
                </Card>
            </Grid>
        </Grid>
    );
}

export default FormBuilder;
