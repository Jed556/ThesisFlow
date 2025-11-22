import * as React from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material';

export interface TopicProposalFormValues {
    title: string;
    abstract: string;
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
    abstract: '',
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

    const handleFieldChange = (field: keyof TopicProposalFormValues) => (
        event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => {
        const nextValue = event.target.value;
        setValues((prev) => ({ ...prev, [field]: nextValue }));
        setErrors((prev) => ({ ...prev, [field]: '' }));
    };

    const handleSubmit = async () => {
        const validationErrors: Record<string, string> = {};
        if (!values.title.trim()) {
            validationErrors.title = 'Title is required';
        }
        if (!values.abstract.trim()) {
            validationErrors.abstract = 'Abstract is required';
        }

        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }

        await onSubmit({
            ...values,
            title: values.title.trim(),
            abstract: values.abstract.trim(),
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
                        onChange={handleFieldChange('title')}
                        error={Boolean(errors.title)}
                        helperText={errors.title}
                        disabled={loading}
                        fullWidth
                    />
                    <TextField
                        label="Abstract"
                        value={values.abstract}
                        onChange={handleFieldChange('abstract')}
                        error={Boolean(errors.abstract)}
                        helperText={errors.abstract}
                        disabled={loading}
                        fullWidth
                        multiline
                        minRows={3}
                    />
                    <TextField
                        label="Problem Statement"
                        value={values.problemStatement ?? ''}
                        onChange={handleFieldChange('problemStatement')}
                        disabled={loading}
                        fullWidth
                        multiline
                        minRows={2}
                    />
                    <TextField
                        label="Expected Outcome"
                        value={values.expectedOutcome ?? ''}
                        onChange={handleFieldChange('expectedOutcome')}
                        disabled={loading}
                        fullWidth
                        multiline
                        minRows={2}
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
