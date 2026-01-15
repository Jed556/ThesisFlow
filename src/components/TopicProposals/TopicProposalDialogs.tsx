import * as React from 'react';
import {
    Box, Button, Dialog, DialogActions, DialogContent,
    DialogTitle, FormControl, FormHelperText, InputLabel, MenuItem,
    Select, Skeleton, Stack, TextField, Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import type { TopicProposalEntry } from '../../types/proposal';
import type { AgendaItem, AgendaType, ESG, SDG } from '../../types/thesis';
import { ESG_VALUES, SDG_VALUES } from '../../types/thesis';
import agendasData from '../../config/agendas.json';
import {
    charLimitHelperText, limitChars, limitWords, wordLimitHelperText
} from '../../utils/textLimitUtils';

/**
 * Shared approval form values for moderator/head topic proposal approval dialogs.
 */
export interface TopicProposalApprovalFormValues {
    notes: string;
    agendaType: AgendaType;
    department?: string;
    /** Dynamic agenda path - each element is a selected agenda title at that depth */
    agendaPath: string[];
    ESG: ESG | '';
    SDG: SDG | '';
}

export type ModeratorApprovalFormValues = TopicProposalApprovalFormValues;
export type ChairApprovalFormValues = TopicProposalApprovalFormValues;
export type HeadApprovalFormValues = TopicProposalApprovalFormValues;

export interface TopicProposalApprovalDialogProps {
    /** Whether the dialog is open */
    open: boolean;
    /** Role of approver; changes copy/CTA */
    role: 'moderator' | 'chair' | 'head';
    /** The proposal entry being approved */
    proposal: TopicProposalEntry | null;
    /** Whether the dialog is in loading state */
    loading?: boolean;
    /** Callback when dialog is closed */
    onClose: () => void;
    /** Callback when approval is confirmed */
    onConfirm: (values: TopicProposalApprovalFormValues) => Promise<void> | void;
}

export type ModeratorApprovalDialogProps = Omit<TopicProposalApprovalDialogProps, 'role' | 'onConfirm'> & {
    onConfirm: (values: ModeratorApprovalFormValues) => Promise<void> | void;
};

export type ChairApprovalDialogProps = Omit<TopicProposalApprovalDialogProps, 'role' | 'onConfirm'> & {
    onConfirm: (values: ChairApprovalFormValues) => Promise<void> | void;
};

export type HeadApprovalDialogProps = Omit<TopicProposalApprovalDialogProps, 'role' | 'onConfirm'> & {
    onConfirm: (values: HeadApprovalFormValues) => Promise<void> | void;
};

const EMPTY_APPROVAL_VALUES: TopicProposalApprovalFormValues = {
    notes: '',
    agendaType: 'institutional',
    department: '',
    agendaPath: [],
    ESG: '',
    SDG: '',
};

/**
 * Get agendas at a specific depth level given the current path.
 */
function getAgendasAtDepth(
    rootAgendas: AgendaItem[],
    currentPath: string[],
    depth: number
): AgendaItem[] {
    if (depth === 0) {
        return rootAgendas;
    }

    let current = rootAgendas;
    for (let i = 0; i < depth && i < currentPath.length; i++) {
        const selected = current.find((agenda) => agenda.title === currentPath[i]);
        if (!selected) {
            return [];
        }
        current = selected.subAgenda;
    }
    return current;
}

/**
 * Single approval dialog that supports both moderator and head workflows.
 */
export function TopicProposalApprovalDialog(props: TopicProposalApprovalDialogProps) {
    const { open, role, proposal, loading = false, onClose, onConfirm } = props;
    const [values, setValues] = React.useState<TopicProposalApprovalFormValues>(EMPTY_APPROVAL_VALUES);
    const [errors, setErrors] = React.useState<Record<string, string>>({});

    const institutionalAgendas: AgendaItem[] = React.useMemo(() => {
        return (agendasData.institutionalAgenda.agenda as AgendaItem[]) ?? [];
    }, []);

    const departmentalAgendas = React.useMemo(() => {
        return agendasData.departmentalAgendas ?? [];
    }, []);

    const availableDepartments = React.useMemo(() => {
        return departmentalAgendas.map((dept) => dept.department);
    }, [departmentalAgendas]);

    const rootAgendas: AgendaItem[] = React.useMemo(() => {
        if (values.agendaType === 'institutional') {
            return institutionalAgendas;
        }
        if (values.department) {
            const deptAgenda = departmentalAgendas.find((dept) => dept.department === values.department);
            return (deptAgenda?.agenda as AgendaItem[]) ?? [];
        }
        return [];
    }, [values.agendaType, values.department, institutionalAgendas, departmentalAgendas]);

    React.useEffect(() => {
        if (open && proposal) {
            setValues({
                notes: '',
                agendaType: proposal.agenda?.type ?? 'institutional',
                department: proposal.agenda?.department ?? '',
                agendaPath: proposal.agenda?.agendaPath ?? [],
                ESG: proposal.ESG ?? '',
                SDG: proposal.SDG ?? '',
            });
            setErrors({});
            return;
        }

        setValues(EMPTY_APPROVAL_VALUES);
        setErrors({});
    }, [open, proposal]);

    const handleAgendaTypeChange = (event: SelectChangeEvent<AgendaType>) => {
        setValues((previous) => ({
            ...previous,
            agendaType: event.target.value as AgendaType,
            department: '',
            agendaPath: [],
        }));
        setErrors({});
    };

    const handleDepartmentChange = (event: SelectChangeEvent<string>) => {
        setValues((previous) => ({
            ...previous,
            department: event.target.value,
            agendaPath: [],
        }));
        setErrors((previous) => ({ ...previous, department: '' }));
    };

    const handleAgendaChange = (depth: number) => (event: SelectChangeEvent<string>) => {
        const newValue = event.target.value;
        setValues((previous) => {
            if (!newValue && depth > 0) {
                return { ...previous, agendaPath: previous.agendaPath.slice(0, depth) };
            }
            const newPath = [...previous.agendaPath.slice(0, depth), newValue];
            return { ...previous, agendaPath: newPath };
        });

        setErrors((previous) => {
            const next = { ...previous };
            Object.keys(next).forEach((key) => {
                if (!key.startsWith('agenda_')) {
                    return;
                }
                const keyDepth = Number.parseInt(key.replace('agenda_', ''), 10);
                if (!Number.isNaN(keyDepth) && keyDepth >= depth) {
                    delete next[key];
                }
            });
            return next;
        });
    };

    const handleESGChange = (event: SelectChangeEvent<ESG | ''>) => {
        setValues((previous) => ({ ...previous, ESG: event.target.value as ESG | '' }));
        setErrors((previous) => ({ ...previous, ESG: '' }));
    };

    const handleSDGChange = (event: SelectChangeEvent<SDG | ''>) => {
        setValues((previous) => ({ ...previous, SDG: event.target.value as SDG | '' }));
        setErrors((previous) => ({ ...previous, SDG: '' }));
    };

    const handleConfirm = async () => {
        const validationErrors: Record<string, string> = {};

        if (values.agendaType === 'departmental' && !values.department) {
            validationErrors.department = 'Department is required';
        }
        if (values.agendaPath.length === 0) {
            validationErrors.agenda_0 = 'At least one agenda level is required';
        }
        if (!values.ESG) {
            validationErrors.ESG = 'ESG category is required';
        }
        if (!values.SDG) {
            validationErrors.SDG = 'SDG is required';
        }
        if (!values.notes.trim()) {
            validationErrors.notes = 'Approval notes are required';
        }

        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }

        await onConfirm(values);
    };

    const renderAgendaSelectors = () => {
        const selectors: React.ReactNode[] = [];
        let depth = 0;

        while (true) {
            const agendasAtDepth = getAgendasAtDepth(rootAgendas, values.agendaPath, depth);
            if (agendasAtDepth.length === 0) {
                break;
            }

            const currentValue = values.agendaPath[depth] ?? '';
            const isDisabled = loading || (depth > 0 && !values.agendaPath[depth - 1]);
            const isOptional = depth > 0;
            const labelPrefix = depth === 0
                ? 'Agenda'
                : `Sub-Agenda Level ${depth} (Optional)`;

            selectors.push(
                <FormControl
                    key={`agenda-${depth}`}
                    fullWidth
                    error={Boolean(errors[`agenda_${depth}`])}
                    disabled={isDisabled}
                >
                    <InputLabel id={`agenda-${depth}-label`}>{labelPrefix}</InputLabel>
                    <Select
                        labelId={`agenda-${depth}-label`}
                        value={currentValue}
                        onChange={handleAgendaChange(depth)}
                        label={labelPrefix}
                    >
                        {isOptional && (
                            <MenuItem value="">
                                <em>None</em>
                            </MenuItem>
                        )}
                        {agendasAtDepth.map((agenda) => (
                            <MenuItem key={agenda.title} value={agenda.title}>
                                {agenda.title}
                            </MenuItem>
                        ))}
                    </Select>
                    {errors[`agenda_${depth}`] && (
                        <FormHelperText>{errors[`agenda_${depth}`]}</FormHelperText>
                    )}
                    {depth > 0 && !values.agendaPath[depth - 1] && (
                        <FormHelperText>Select the previous level first</FormHelperText>
                    )}
                </FormControl>
            );

            if (!currentValue) {
                break;
            }
            const selectedAgenda = agendasAtDepth.find((agenda) => agenda.title === currentValue);
            if (!selectedAgenda || selectedAgenda.subAgenda.length === 0) {
                break;
            }

            depth++;
        }

        return selectors;
    };

    if (!proposal) {
        return null;
    }

    const isModerator = role === 'moderator';
    const isChair = role === 'chair';
    const _isHead = role === 'head';

    const getDialogTitle = () => {
        if (isModerator) return 'Approve Topic & Set Classification';
        if (isChair) return 'Review & Approve Topic Proposal';
        return 'Review & Approve Topic Proposal';
    };

    const getDescriptionText = () => {
        if (isModerator) {
            return 'As a moderator, you are responsible for classifying this topic proposal. '
                + 'The Program Chair will review and confirm (or adjust) your classification before it goes to the head.';
        }
        if (isChair) {
            return 'Review the classification set by the moderator below. '
                + 'You may adjust the agenda, ESG, and SDG before forwarding to the Research Head for final approval.';
        }
        return 'Review the classification set by the moderator and Program Chair below. '
            + 'You may adjust the agenda, ESG, and SDG before giving final approval.';
    };

    const getApproveButtonText = () => {
        if (isModerator) return 'Approve & Forward to Chair';
        if (isChair) return 'Approve & Forward to Head';
        return 'Approve Topic';
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle>
                {getDialogTitle()}
            </DialogTitle>
            <DialogContent>
                <Stack spacing={3} sx={{ mt: 1 }}>
                    <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Topic Title
                        </Typography>
                        {proposal.title ? (
                            <Typography variant="h6">{proposal.title}</Typography>
                        ) : (
                            <Skeleton variant="text" width="60%" />
                        )}
                        <Typography
                            variant="subtitle2"
                            color="text.secondary"
                            sx={{ mt: 1 }}
                            gutterBottom
                        >
                            Description
                        </Typography>
                        {proposal.description ? (
                            <Typography variant="body2" color="text.secondary">
                                {proposal.description}
                            </Typography>
                        ) : (
                            <Skeleton variant="text" width="100%" />
                        )}
                    </Box>

                    <Typography variant="body2" color="text.secondary">
                        {getDescriptionText()}
                    </Typography>

                    <Typography variant="subtitle1" fontWeight="medium">
                        Research Agenda Classification
                    </Typography>

                    <FormControl fullWidth disabled={loading}>
                        <InputLabel id="agenda-type-label">Agenda Type</InputLabel>
                        <Select
                            labelId="agenda-type-label"
                            value={values.agendaType}
                            onChange={handleAgendaTypeChange}
                            label="Agenda Type"
                        >
                            <MenuItem value="institutional">Institutional Research</MenuItem>
                            <MenuItem value="departmental">Collegiate & Departmental</MenuItem>
                        </Select>
                    </FormControl>

                    {values.agendaType === 'departmental' && (
                        <FormControl
                            fullWidth
                            error={Boolean(errors.department)}
                            disabled={loading}
                        >
                            <InputLabel id="department-label">Department</InputLabel>
                            <Select
                                labelId="department-label"
                                value={values.department ?? ''}
                                onChange={handleDepartmentChange}
                                label="Department"
                            >
                                {availableDepartments.map((dept) => (
                                    <MenuItem key={dept} value={dept}>
                                        {dept}
                                    </MenuItem>
                                ))}
                            </Select>
                            {errors.department && (
                                <FormHelperText>{errors.department}</FormHelperText>
                            )}
                        </FormControl>
                    )}

                    {(values.agendaType === 'institutional' || values.department) && (
                        <>{renderAgendaSelectors()}</>
                    )}

                    <Typography variant="subtitle1" fontWeight="medium">
                        Sustainability Classification
                    </Typography>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                        <FormControl fullWidth error={Boolean(errors.ESG)} disabled={loading}>
                            <InputLabel id="esg-label">ESG Category</InputLabel>
                            <Select
                                labelId="esg-label"
                                value={values.ESG}
                                onChange={handleESGChange}
                                label="ESG Category"
                            >
                                {ESG_VALUES.map((esg) => (
                                    <MenuItem key={esg} value={esg}>
                                        {esg}
                                    </MenuItem>
                                ))}
                            </Select>
                            {errors.ESG && <FormHelperText>{errors.ESG}</FormHelperText>}
                        </FormControl>

                        <FormControl fullWidth error={Boolean(errors.SDG)} disabled={loading}>
                            <InputLabel id="sdg-label">Sustainable Development Goal</InputLabel>
                            <Select
                                labelId="sdg-label"
                                value={values.SDG}
                                onChange={handleSDGChange}
                                label="Sustainable Development Goal"
                            >
                                {SDG_VALUES.map((sdg, index) => (
                                    <MenuItem key={sdg} value={sdg}>
                                        {index + 1}. {sdg}
                                    </MenuItem>
                                ))}
                            </Select>
                            {errors.SDG && <FormHelperText>{errors.SDG}</FormHelperText>}
                        </FormControl>
                    </Stack>

                    <TextField
                        label="Approval Notes"
                        fullWidth
                        multiline
                        minRows={3}
                        value={values.notes}
                        onChange={(event) =>
                            setValues((previous) => ({
                                ...previous,
                                notes: event.target.value.slice(0, 500),
                            }))
                        }
                        placeholder="Provide feedback and guidance to the student group"
                        disabled={loading}
                        required
                        error={Boolean(errors.notes)}
                        helperText={errors.notes || `${values.notes.length}/500`}
                        slotProps={{ htmlInput: { maxLength: 500 } }}
                    />
                </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 3 }}>
                <Button onClick={onClose} color="inherit" disabled={loading}>
                    Cancel
                </Button>
                <Box sx={{ flexGrow: 1 }} />
                <Button
                    onClick={handleConfirm}
                    variant="contained"
                    color="success"
                    disabled={loading}
                >
                    {getApproveButtonText()}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

/**
 * Backwards-compatible wrapper for moderator approval.
 */
export function ModeratorApprovalDialog(props: ModeratorApprovalDialogProps) {
    return (
        <TopicProposalApprovalDialog
            {...props}
            role="moderator"
        />
    );
}

/**
 * Wrapper for program chair approval.
 */
export function ChairApprovalDialog(props: ChairApprovalDialogProps) {
    return (
        <TopicProposalApprovalDialog
            {...props}
            role="chair"
        />
    );
}

/**
 * Backwards-compatible wrapper for head approval.
 */
export function HeadApprovalDialog(props: HeadApprovalDialogProps) {
    return (
        <TopicProposalApprovalDialog
            {...props}
            role="head"
        />
    );
}

export interface TopicProposalDecisionDialogProps {
    /** Whether the dialog is open */
    open: boolean;
    /** The decision type */
    decision: 'approved' | 'rejected';
    /** The role of the user making the decision */
    role: 'moderator' | 'chair' | 'head';
    /** The proposal title for display */
    proposalTitle?: string;
    /** Whether the dialog is in loading state */
    loading?: boolean;
    /** Callback when dialog is closed */
    onClose: () => void;
    /** Callback when decision is confirmed with notes */
    onConfirm: (notes: string) => Promise<void> | void;
}

/**
 * Dialog for moderator/head rejection (and optionally approval) notes.
 */
export function TopicProposalDecisionDialog({
    open,
    decision,
    role,
    proposalTitle,
    loading = false,
    onClose,
    onConfirm,
}: TopicProposalDecisionDialogProps) {
    const [notes, setNotes] = React.useState('');

    React.useEffect(() => {
        if (open) {
            setNotes('');
        }
    }, [open]);

    const handleConfirm = async () => {
        if (notes.trim().length === 0) {
            return;
        }
        await onConfirm(notes.trim());
    };

    const isApproval = decision === 'approved';
    const roleLabel = role === 'moderator' ? 'Moderator' : role === 'chair' ? 'Program Chair' : 'Head';

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>
                {isApproval ? `${roleLabel} Approval` : `${roleLabel} Rejection`}
            </DialogTitle>
            <DialogContent>
                {proposalTitle && (
                    <Typography variant="body2" fontWeight="medium" sx={{ mb: 1 }}>
                        Topic: {proposalTitle}
                    </Typography>
                )}
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {isApproval
                        ? 'Provide feedback and guidance for the student group.'
                        : 'Explain why this topic is being rejected to help the group improve.'}
                </Typography>
                <TextField
                    label={isApproval ? 'Approval Notes' : 'Rejection Notes'}
                    fullWidth
                    multiline
                    minRows={3}
                    value={notes}
                    onChange={(event) => setNotes(event.target.value.slice(0, 500))}
                    placeholder={isApproval
                        ? 'Add guidance or justification for the student group'
                        : 'Explain why this topic is being rejected'}
                    required
                    error={notes.trim().length === 0}
                    helperText={notes.trim().length === 0
                        ? `Notes are required. (${notes.length}/500)`
                        : `${notes.length}/500`}
                    slotProps={{ htmlInput: { maxLength: 500 } }}
                    autoFocus
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit" disabled={loading}>
                    Cancel
                </Button>
                <Button
                    onClick={handleConfirm}
                    variant="contained"
                    color={isApproval ? 'success' : 'error'}
                    disabled={loading || notes.trim().length === 0}
                >
                    {isApproval ? 'Approve' : 'Reject'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

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

const EMPTY_FORM_VALUES: TopicProposalFormValues = {
    title: '',
    description: '',
    problemStatement: '',
    expectedOutcome: '',
    keywords: [],
};

const TITLE_WORD_LIMIT = 20;
const DESCRIPTION_CHAR_LIMIT = 1000;
const PROBLEM_STATEMENT_CHAR_LIMIT = 1500;
const EXPECTED_OUTCOME_CHAR_LIMIT = 1500;

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
export function TopicProposalFormDialog(props: TopicProposalFormDialogProps) {
    const { open, mode, initialValues, loading = false, onClose, onSubmit } = props;
    const [values, setValues] = React.useState<TopicProposalFormValues>(initialValues ?? EMPTY_FORM_VALUES);
    const [keywordsInput, setKeywordsInput] = React.useState<string>(toKeywordsInput(initialValues?.keywords));
    const [errors, setErrors] = React.useState<Record<string, string>>({});

    React.useEffect(() => {
        setValues(initialValues ?? EMPTY_FORM_VALUES);
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
                        onChange={(event) => {
                            const nextValue = limitWords(event.target.value, TITLE_WORD_LIMIT);
                            setValues((previous) => ({ ...previous, title: nextValue }));
                            setErrors((previous) => ({ ...previous, title: '' }));
                        }}
                        error={Boolean(errors.title)}
                        helperText={errors.title || wordLimitHelperText(values.title, TITLE_WORD_LIMIT)}
                        disabled={loading}
                        fullWidth
                    />
                    <TextField
                        label="Brief Description"
                        value={values.description}
                        onChange={(event) => {
                            const nextValue = limitChars(event.target.value, DESCRIPTION_CHAR_LIMIT);
                            setValues((previous) => ({ ...previous, description: nextValue }));
                            setErrors((previous) => ({ ...previous, description: '' }));
                        }}
                        error={Boolean(errors.description)}
                        helperText={errors.description || charLimitHelperText(values.description, DESCRIPTION_CHAR_LIMIT)}
                        disabled={loading}
                        fullWidth
                        multiline
                        minRows={3}
                        slotProps={{ htmlInput: { maxLength: DESCRIPTION_CHAR_LIMIT } }}
                    />
                    <TextField
                        label="Problem Statement"
                        value={values.problemStatement ?? ''}
                        onChange={(event) => {
                            const nextValue = limitChars(event.target.value, PROBLEM_STATEMENT_CHAR_LIMIT);
                            setValues((previous) => ({ ...previous, problemStatement: nextValue }));
                        }}
                        disabled={loading}
                        fullWidth
                        multiline
                        minRows={2}
                        helperText={charLimitHelperText(values.problemStatement ?? '', PROBLEM_STATEMENT_CHAR_LIMIT)}
                        slotProps={{ htmlInput: { maxLength: PROBLEM_STATEMENT_CHAR_LIMIT } }}
                    />
                    <TextField
                        label="Expected Outcome"
                        value={values.expectedOutcome ?? ''}
                        onChange={(event) => {
                            const nextValue = limitChars(event.target.value, EXPECTED_OUTCOME_CHAR_LIMIT);
                            setValues((previous) => ({ ...previous, expectedOutcome: nextValue }));
                        }}
                        disabled={loading}
                        fullWidth
                        multiline
                        minRows={2}
                        helperText={charLimitHelperText(values.expectedOutcome ?? '', EXPECTED_OUTCOME_CHAR_LIMIT)}
                        slotProps={{ htmlInput: { maxLength: EXPECTED_OUTCOME_CHAR_LIMIT } }}
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
