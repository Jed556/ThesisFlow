import * as React from 'react';
import {
    Box, Button, Card, CardContent, Checkbox, Chip, FormControl, FormControlLabel, FormHelperText, InputLabel,
    ListItemText, MenuItem, Paper, Select, Skeleton, Stack, TextField, Typography
} from '@mui/material';
import type { FormAssignment, FormField, FormFieldValue, FormTemplate } from '../../types/forms';
import { useSnackbar } from '../Snackbar';

/**
 * Props accepted by the reusable form renderer.
 */
export interface FormRendererProps {
    /** Template describing the fields to render. */
    template: FormTemplate;
    /** Optional assignment metadata for contextual badges. */
    assignment?: FormAssignment;
    /** Display skeleton placeholders while data is loading. */
    loading?: boolean;
    /** Callback fired when the form is submitted successfully. */
    onSubmit?: (values: Record<string, FormFieldValue>) => void;
}

/**
 * Evaluate whether a value satisfies the requirement constraint for a field.
 */
function isFieldComplete(field: FormField, value: FormFieldValue): boolean {
    if (!field.required) return true;
    if (Array.isArray(value)) {
        return value.length > 0;
    }
    if (typeof value === 'boolean') {
        return value;
    }
    return Boolean(value);
}

/**
 * Declarative renderer that turns form templates into interactive React forms.
 */
export function FormRenderer({ template, assignment, loading = false, onSubmit }: FormRendererProps) {
    const { showNotification } = useSnackbar();
    const initialValues = React.useMemo<Record<string, FormFieldValue>>(() => {
        return template.fields.reduce<Record<string, FormFieldValue>>((acc, field) => {
            acc[field.id] = field.defaultValue ?? (field.fieldType === 'multiSelect' ? [] : field.fieldType === 'checkbox' ? false : field.fieldType === 'file' ? [] : '');
            return acc;
        }, {});
    }, [template.fields]);

    const [values, setValues] = React.useState<Record<string, FormFieldValue>>(initialValues);
    const [submitting, setSubmitting] = React.useState(false);

    React.useEffect(() => {
        setValues(initialValues);
    }, [initialValues]);

    /**
     * Update a field value inside the local state container.
     */
    const updateValue = React.useCallback((field: FormField, nextValue: FormFieldValue) => {
        setValues((prev) => ({ ...prev, [field.id]: nextValue }));
    }, []);

    /**
     * Capture text field changes.
     */
    const handleTextChange = (field: FormField) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        updateValue(field, event.target.value);
    };

    /**
     * Handle multi select interactions.
     */
    const handleSelectChange = (field: FormField) => (event: React.ChangeEvent<{ value: unknown }>) => {
        updateValue(field, event.target.value as string[]);
    };

    /**
     * Toggle checkbox value.
     */
    const handleCheckboxChange = (field: FormField) => (event: React.ChangeEvent<HTMLInputElement>) => {
        updateValue(field, event.target.checked);
    };

    /**
     * Store file blobs prior to upload.
     */
    const handleFileChange = (field: FormField) => (event: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = event.target.files ? Array.from(event.target.files) : [];
        updateValue(field, fileList);
    };

    /**
     * Simulate capturing a digital signature.
     */
    const handleSignature = (field: FormField) => () => {
        const timestamp = new Date().toLocaleString();
        updateValue(field, `Signed electronically on ${timestamp}`);
        showNotification('Signature captured.', 'success', 3000);
    };

    /**
     * Submit handler with basic required field validation.
     */
    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const missingField = template.fields.find((field) => !isFieldComplete(field, values[field.id]));
        if (missingField) {
            showNotification(`Please complete "${missingField.label}" before submitting.`, 'warning');
            return;
        }

        setSubmitting(true);
        onSubmit?.(values);
        showNotification('Form submitted successfully.', 'success');
        setSubmitting(false);
    };

    if (loading) {
        return (
            <Card>
                <CardContent>
                    <Stack spacing={2}>
                        {[1, 2, 3, 4].map((index) => (
                            <Stack key={index} spacing={1.5}>
                                <Skeleton variant="text" width="40%" height={28} />
                                <Skeleton variant="rounded" height={48} />
                            </Stack>
                        ))}
                    </Stack>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column' }}>
            <CardContent>
                <Stack spacing={3}>
                    <Box>
                        <Typography variant="h6" gutterBottom>
                            {template.title}
                        </Typography>
                        {template.description && (
                            <Typography variant="body2" color="text.secondary">
                                {template.description}
                            </Typography>
                        )}
                        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                            <Chip label={`Audience: ${template.audience}`} size="small" />
                            <Chip label={`Version ${template.version}`} size="small" />
                            {assignment?.dueDate && <Chip label={`Due ${assignment.dueDate}`} size="small" color="warning" />}
                        </Stack>
                    </Box>

                    {template.fields.map((field) => {
                        const value = values[field.id];
                        const isInvalid = field.required && !isFieldComplete(field, value);

                        switch (field.fieldType) {
                            case 'shortText':
                            case 'longText':
                                return (
                                    <TextField
                                        key={field.id}
                                        label={field.label}
                                        value={typeof value === 'string' ? value : ''}
                                        onChange={handleTextChange(field)}
                                        required={field.required}
                                        helperText={field.helperText}
                                        placeholder={field.placeholder}
                                        multiline={field.fieldType === 'longText'}
                                        minRows={field.fieldType === 'longText' ? field.rows ?? 4 : undefined}
                                        error={isInvalid}
                                        fullWidth
                                    />
                                );
                            case 'select':
                                return (
                                    <FormControl key={field.id} fullWidth required={field.required} error={isInvalid}>
                                        <InputLabel>{field.label}</InputLabel>
                                        <Select
                                            label={field.label}
                                            value={typeof value === 'string' ? value : ''}
                                            onChange={(event) => updateValue(field, event.target.value as string)}
                                        >
                                            {(field.options ?? []).map((option) => (
                                                <MenuItem key={option.id} value={option.value}>
                                                    {option.label}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                        {field.helperText && <FormHelperText>{field.helperText}</FormHelperText>}
                                    </FormControl>
                                );
                            case 'multiSelect':
                                return (
                                    <FormControl key={field.id} fullWidth required={field.required} error={isInvalid}>
                                        <InputLabel>{field.label}</InputLabel>
                                        <Select
                                            label={field.label}
                                            multiple
                                            value={Array.isArray(value) ? value : []}
                                            renderValue={(selected) => (selected as string[]).map((item) => field.options?.find((option) => option.value === item)?.label ?? item).join(', ')}
                                            onChange={handleSelectChange(field)}
                                        >
                                            {(field.options ?? []).map((option) => (
                                                <MenuItem key={option.id} value={option.value}>
                                                    <Checkbox checked={Array.isArray(value) ? value.includes(option.value) : false} />
                                                    <ListItemText primary={option.label} secondary={option.description} />
                                                </MenuItem>
                                            ))}
                                        </Select>
                                        {field.helperText && <FormHelperText>{field.helperText}</FormHelperText>}
                                    </FormControl>
                                );
                            case 'checkbox':
                                return (
                                    <FormControlLabel
                                        key={field.id}
                                        control={
                                            <Checkbox
                                                checked={Boolean(value)}
                                                onChange={handleCheckboxChange(field)}
                                                required={field.required}
                                            />
                                        }
                                        label={
                                            <Box>
                                                <Typography variant="body1">{field.label}</Typography>
                                                {field.helperText && (
                                                    <Typography variant="body2" color="text.secondary">
                                                        {field.helperText}
                                                    </Typography>
                                                )}
                                            </Box>
                                        }
                                    />
                                );
                            case 'date':
                                return (
                                    <TextField
                                        key={field.id}
                                        type="date"
                                        label={field.label}
                                        value={typeof value === 'string' ? value : ''}
                                        onChange={handleTextChange(field)}
                                        required={field.required}
                                        helperText={field.helperText}
                                        slotProps={{ inputLabel: { shrink: true } }}
                                    />
                                );
                            case 'file':
                                return (
                                    <Box key={field.id}>
                                        <Button variant="outlined" component="label">
                                            {field.label}
                                            <input type="file" hidden multiple onChange={handleFileChange(field)} />
                                        </Button>
                                        <Stack spacing={0.5} sx={{ mt: 1 }}>
                                            {Array.isArray(value) && value.length > 0 && (value as File[]).map((file) => (
                                                <Typography key={file.name} variant="body2" color="text.secondary">
                                                    {file.name}
                                                </Typography>
                                            ))}
                                        </Stack>
                                        {field.helperText && (
                                            <Typography variant="caption" color="text.secondary">
                                                {field.helperText}
                                            </Typography>
                                        )}
                                    </Box>
                                );
                            case 'signature':
                                return (
                                    <Paper
                                        key={field.id}
                                        variant="outlined"
                                        sx={{ p: 2, borderStyle: 'dashed', display: 'flex', flexDirection: 'column', gap: 1 }}
                                    >
                                        <Typography variant="subtitle2">{field.label}</Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {typeof value === 'string' && value
                                                ? value
                                                : field.helperText ?? 'Click the button below to add your signature.'}
                                        </Typography>
                                        <Button variant="contained" onClick={handleSignature(field)}>
                                            Add signature
                                        </Button>
                                    </Paper>
                                );
                            default:
                                return null;
                        }
                    })}
                </Stack>
            </CardContent>
            <Box sx={{ px: 3, pb: 3 }}>
                <Button type="submit" variant="contained" disabled={submitting}>
                    Submit form
                </Button>
            </Box>
        </Card>
    );
}

export default FormRenderer;
