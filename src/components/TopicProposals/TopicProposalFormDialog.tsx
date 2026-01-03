import * as React from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material';

export interface TopicProposalFormValues {
    title: string;
    description: string;
    problemStatement?: string;
    expectedOutcome?: string;
    keywords: string[];
}

export interface TopicProposalFormDialogProps {
    open: boolean;
    mode: 'create' | 'edit';
    initialValues?: TopicProposalFormValues;
    loading?: boolean;
    onClose: () => void;
    onSubmit: (values: TopicProposalFormValues) => Promise<void> | void;
}

const EMPTY_VALUES: TopicProposalFormValues = {
    title: '',
    description: '',
    problemStatement: '',
    expectedOutcome: '',
    keywords: [],
};

function toKeywordsInput(keywords: string[] | undefined): string {
    return keywords?.join(', ') ?? '';
}

function fromKeywordsInput(value: string): string[] {
    return value
        .split(',')
        .map((keyword) => keyword.trim())
        .filter(Boolean);
}

/**
 * Dialog component used by students to create or update a topic proposal entry.
 */
export default function TopicProposalFormDialog(props: TopicProposalFormDialogProps) {
    const { open, mode, initialValues, loading = false, onClose, onSubmit } = props;
    const [values, setValues] = React.useState<TopicProposalFormValues>(initialValues ?? EMPTY_VALUES);
    const [keywordsInput, setKeywordsInput] = React.useState<string>(toKeywordsInput(initialValues?.keywords));
    const [errors, setErrors] = React.useState<Record<string, string>>({});

    React.useEffect(() => {
        setValues(initialValues ?? EMPTY_VALUES);
        setKeywordsInput(toKeywordsInput(initialValues?.keywords));
        setErrors({});
    }, [initialValues, open]);

    const handleSubmit = async () => {
        const validationErrors: Record<string, string> = {};
        if (!values.title.trim()) {
            validationErrors.title = 'Title is required';
        }
        if (!values.description.trim()) {
            validationErrors.description = 'Brief description is required';
        }

        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }

        await onSubmit({
            ...values,
            title: values.title.trim(),
            description: values.description.trim(),
            problemStatement: values.problemStatement?.trim() || undefined,
            expectedOutcome: values.expectedOutcome?.trim() || undefined,
            keywords: fromKeywordsInput(keywordsInput),
        });
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle>{mode === 'create' ? 'Add Topic Proposal' : 'Edit Topic Proposal'}</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField
                        label="Title"
                        value={values.title}
                        onChange={(e) => {
                            const value = e.target.value.slice(0, 20);
                            setValues((prev) => ({ ...prev, title: value }));
                            setErrors((prev) => ({ ...prev, title: '' }));
                        }}
                        error={Boolean(errors.title)}
                        helperText={errors.title || `${values.title.length}/20`}
                        disabled={loading}
                        fullWidth
                        slotProps={{ htmlInput: { maxLength: 20 } }}
                    />
                    <TextField
                        label="Brief Description"
                        value={values.description}
                        onChange={(e) => {
                            const value = e.target.value.slice(0, 1000);
                            setValues((prev) => ({ ...prev, description: value }));
                            setErrors((prev) => ({ ...prev, description: '' }));
                        }}
                        error={Boolean(errors.description)}
                        helperText={errors.description || `${values.description.length}/1000`}
                        disabled={loading}
                        fullWidth
                        multiline
                        minRows={3}
                        slotProps={{ htmlInput: { maxLength: 1000 } }}
                    />
                    <TextField
                        label="Problem Statement"
                        value={values.problemStatement ?? ''}
                        onChange={(e) => {
                            const value = e.target.value.slice(0, 1500);
                            setValues((prev) => ({ ...prev, problemStatement: value }));
                        }}
                        disabled={loading}
                        fullWidth
                        multiline
                        minRows={2}
                        helperText={`${(values.problemStatement ?? '').length}/1500`}
                        slotProps={{ htmlInput: { maxLength: 1500 } }}
                    />
                    <TextField
                        label="Expected Outcome"
                        value={values.expectedOutcome ?? ''}
                        onChange={(e) => {
                            const value = e.target.value.slice(0, 1500);
                            setValues((prev) => ({ ...prev, expectedOutcome: value }));
                        }}
                        disabled={loading}
                        fullWidth
                        multiline
                        minRows={2}
                        helperText={`${(values.expectedOutcome ?? '').length}/1500`}
                        slotProps={{ htmlInput: { maxLength: 1500 } }}
                    />
                    <TextField
                        label="Keywords (comma separated)"
                        value={keywordsInput}
                        onChange={(event) => setKeywordsInput(event.target.value)}
                        disabled={loading}
                        fullWidth
                    />
                </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 3 }}>
                <Button onClick={onClose} disabled={loading} color="inherit">
                    Cancel
                </Button>
                <Box sx={{ flexGrow: 1 }} />
                <Button onClick={handleSubmit} disabled={loading} variant="contained">
                    {mode === 'create' ? 'Add Proposal' : 'Save Changes'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
