import * as React from 'react';
import {
    Box, Button, Dialog, DialogActions, DialogContent,
    DialogTitle, FormControl, FormHelperText, InputLabel, MenuItem,
    Select, Skeleton, Stack, TextField, Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import type { TopicProposalEntry } from '../../types/proposal';
import type { ESG, SDG } from '../../types/thesis';
import { ESG_VALUES, SDG_VALUES } from '../../types/thesis';
import agendasData from '../../config/agendas.json';

/**
 * Theme structure from agendas.json
 */
interface AgendaTheme {
    id: string;
    title: string;
    subThemes: string[];
}

/**
 * Form values for head approval
 */
export interface HeadApprovalFormValues {
    notes: string;
    agenda: {
        mainTheme: string;
        subTheme: string;
    };
    ESG: ESG | '';
    SDG: SDG | '';
}

export interface HeadApprovalDialogProps {
    /** Whether the dialog is open */
    open: boolean;
    /** The proposal entry being approved */
    proposal: TopicProposalEntry | null;
    /** Whether the dialog is in loading state */
    loading?: boolean;
    /** Callback when dialog is closed */
    onClose: () => void;
    /** Callback when approval is confirmed */
    onConfirm: (values: HeadApprovalFormValues) => Promise<void> | void;
}

const EMPTY_VALUES: HeadApprovalFormValues = {
    notes: '',
    agenda: {
        mainTheme: '',
        subTheme: '',
    },
    ESG: '',
    SDG: '',
};

/**
 * Dialog for head approval of topic proposals.
 * Allows selecting research agenda, sub-theme, ESG, and SDG.
 */
export default function HeadApprovalDialog(props: HeadApprovalDialogProps) {
    const { open, proposal, loading = false, onClose, onConfirm } = props;
    const [values, setValues] = React.useState<HeadApprovalFormValues>(EMPTY_VALUES);
    const [errors, setErrors] = React.useState<Record<string, string>>({});

    // Get themes from institutional research agenda
    const themes: AgendaTheme[] = React.useMemo(() => {
        return agendasData.institutionalResearchAgenda.themes;
    }, []);

    // Get available sub-themes based on selected main theme
    const availableSubThemes = React.useMemo(() => {
        if (!values.agenda.mainTheme) {
            return [];
        }
        const selectedTheme = themes.find((theme) => theme.title === values.agenda.mainTheme);
        return selectedTheme?.subThemes ?? [];
    }, [values.agenda.mainTheme, themes]);

    // Reset form when dialog opens/closes or proposal changes
    React.useEffect(() => {
        if (open && proposal) {
            // Pre-fill with existing values if available
            setValues({
                notes: '',
                agenda: {
                    mainTheme: proposal.agenda?.mainTheme ?? '',
                    subTheme: proposal.agenda?.subTheme ?? '',
                },
                ESG: proposal.ESG ?? '',
                SDG: proposal.SDG ?? '',
            });
            setErrors({});
        } else {
            setValues(EMPTY_VALUES);
            setErrors({});
        }
    }, [open, proposal]);

    // Reset sub-theme when main theme changes
    React.useEffect(() => {
        if (values.agenda.mainTheme && !availableSubThemes.includes(values.agenda.subTheme)) {
            setValues((prev) => ({
                ...prev,
                agenda: {
                    ...prev.agenda,
                    subTheme: '',
                },
            }));
        }
    }, [values.agenda.mainTheme, values.agenda.subTheme, availableSubThemes]);

    const handleNotesChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setValues((prev) => ({ ...prev, notes: event.target.value }));
    };

    const handleMainThemeChange = (event: SelectChangeEvent<string>) => {
        const newMainTheme = event.target.value;
        setValues((prev) => ({
            ...prev,
            agenda: {
                mainTheme: newMainTheme,
                subTheme: '', // Reset sub-theme when main theme changes
            },
        }));
        setErrors((prev) => ({ ...prev, mainTheme: '', subTheme: '' }));
    };

    const handleSubThemeChange = (event: SelectChangeEvent<string>) => {
        setValues((prev) => ({
            ...prev,
            agenda: {
                ...prev.agenda,
                subTheme: event.target.value,
            },
        }));
        setErrors((prev) => ({ ...prev, subTheme: '' }));
    };

    const handleESGChange = (event: SelectChangeEvent<ESG | ''>) => {
        setValues((prev) => ({ ...prev, ESG: event.target.value as ESG | '' }));
        setErrors((prev) => ({ ...prev, ESG: '' }));
    };

    const handleSDGChange = (event: SelectChangeEvent<SDG | ''>) => {
        setValues((prev) => ({ ...prev, SDG: event.target.value as SDG | '' }));
        setErrors((prev) => ({ ...prev, SDG: '' }));
    };

    const handleConfirm = async () => {
        const validationErrors: Record<string, string> = {};

        if (!values.agenda.mainTheme) {
            validationErrors.mainTheme = 'Research agenda is required';
        }
        if (!values.agenda.subTheme) {
            validationErrors.subTheme = 'Sub-theme is required';
        }
        if (!values.ESG) {
            validationErrors.ESG = 'ESG category is required';
        }
        if (!values.SDG) {
            validationErrors.SDG = 'SDG is required';
        }

        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }

        await onConfirm(values);
    };

    if (!proposal) {
        return null;
    }

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
            <DialogTitle>Approve Topic Proposal</DialogTitle>
            <DialogContent>
                <Stack spacing={3} sx={{ mt: 1 }}>
                    {/* Proposal Info Summary */}
                    <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            Topic Title
                        </Typography>
                        {proposal.title ? (
                            <Typography variant="h6">{proposal.title}</Typography>
                        ) : (
                            <Skeleton variant="text" width="60%" />
                        )}
                        <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }} gutterBottom>
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

                    {/* Research Agenda Selection */}
                    <Typography variant="subtitle1" fontWeight="medium">
                        Research Agenda Classification
                    </Typography>

                    <FormControl fullWidth error={Boolean(errors.mainTheme)} disabled={loading}>
                        <InputLabel id="main-theme-label">Research Agenda (Main Theme)</InputLabel>
                        <Select
                            labelId="main-theme-label"
                            value={values.agenda.mainTheme}
                            onChange={handleMainThemeChange}
                            label="Research Agenda (Main Theme)"
                        >
                            {themes.map((theme) => (
                                <MenuItem key={theme.id} value={theme.title}>
                                    {theme.id}. {theme.title}
                                </MenuItem>
                            ))}
                        </Select>
                        {errors.mainTheme && <FormHelperText>{errors.mainTheme}</FormHelperText>}
                    </FormControl>

                    <FormControl
                        fullWidth
                        error={Boolean(errors.subTheme)}
                        disabled={loading || !values.agenda.mainTheme}
                    >
                        <InputLabel id="sub-theme-label">Sub-Theme</InputLabel>
                        <Select
                            labelId="sub-theme-label"
                            value={values.agenda.subTheme}
                            onChange={handleSubThemeChange}
                            label="Sub-Theme"
                        >
                            {availableSubThemes.map((subTheme, index) => (
                                <MenuItem key={index} value={subTheme}>
                                    {subTheme}
                                </MenuItem>
                            ))}
                        </Select>
                        {errors.subTheme && <FormHelperText>{errors.subTheme}</FormHelperText>}
                        {!values.agenda.mainTheme && (
                            <FormHelperText>Select a main theme first</FormHelperText>
                        )}
                    </FormControl>

                    {/* ESG & SDG Selection */}
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

                    {/* Notes */}
                    <TextField
                        label="Optional Notes"
                        fullWidth
                        multiline
                        minRows={3}
                        value={values.notes}
                        onChange={handleNotesChange}
                        placeholder="Share feedback with the student group"
                        disabled={loading}
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
                    Approve Topic
                </Button>
            </DialogActions>
        </Dialog>
    );
}
