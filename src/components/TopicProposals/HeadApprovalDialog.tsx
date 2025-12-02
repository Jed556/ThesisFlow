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

/**
 * Form values for head approval
 */
export interface HeadApprovalFormValues {
    notes: string;
    agendaType: AgendaType;
    department?: string;
    /** Dynamic agenda path - each element is a selected agenda title at that depth */
    agendaPath: string[];
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
    agendaType: 'institutional',
    department: '',
    agendaPath: [],
    ESG: '',
    SDG: '',
};

/**
 * Get agendas at a specific depth level given the current path
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
        const selected = current.find((a) => a.title === currentPath[i]);
        if (!selected) {
            return [];
        }
        current = selected.subAgenda;
    }
    return current;
}

/**
 * Dialog for head approval of topic proposals.
 * Allows selecting research agenda, sub-theme, ESG, and SDG.
 */
export default function HeadApprovalDialog(props: HeadApprovalDialogProps) {
    const { open, proposal, loading = false, onClose, onConfirm } = props;
    const [values, setValues] = React.useState<HeadApprovalFormValues>(EMPTY_VALUES);
    const [errors, setErrors] = React.useState<Record<string, string>>({});

    // Get institutional agendas
    const institutionalAgendas: AgendaItem[] = React.useMemo(() => {
        return (agendasData.institutionalAgenda.agenda as AgendaItem[]) ?? [];
    }, []);

    // Get departmental agendas
    const departmentalAgendas = React.useMemo(() => {
        return agendasData.departmentalAgendas ?? [];
    }, []);

    // Get available departments
    const availableDepartments = React.useMemo(() => {
        return departmentalAgendas.map((d: { department: string }) => d.department);
    }, [departmentalAgendas]);

    // Get root agendas based on type and department selection
    const rootAgendas: AgendaItem[] = React.useMemo(() => {
        if (values.agendaType === 'institutional') {
            return institutionalAgendas;
        }
        if (values.department) {
            const deptAgenda = departmentalAgendas.find((d: { department: string }) => d.department === values.department);
            return (deptAgenda?.agenda as AgendaItem[]) ?? [];
        }
        return [];
    }, [values.agendaType, values.department, institutionalAgendas, departmentalAgendas]);

    // Reset form when dialog opens/closes or proposal changes
    React.useEffect(() => {
        if (open && proposal) {
            // Pre-fill with existing values if available
            setValues({
                notes: '',
                agendaType: proposal.agenda?.type ?? 'institutional',
                department: proposal.agenda?.department ?? '',
                agendaPath: proposal.agenda?.agendaPath ?? [],
                ESG: proposal.ESG ?? '',
                SDG: proposal.SDG ?? '',
            });
            setErrors({});
        } else {
            setValues(EMPTY_VALUES);
            setErrors({});
        }
    }, [open, proposal]);

    const handleNotesChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setValues((prev) => ({ ...prev, notes: event.target.value }));
    };

    const handleAgendaTypeChange = (event: SelectChangeEvent<AgendaType>) => {
        setValues((prev) => ({
            ...prev,
            agendaType: event.target.value as AgendaType,
            department: '',
            agendaPath: [],
        }));
        setErrors({});
    };

    const handleDepartmentChange = (event: SelectChangeEvent<string>) => {
        setValues((prev) => ({
            ...prev,
            department: event.target.value,
            agendaPath: [],
        }));
        setErrors((prev) => ({ ...prev, department: '' }));
    };

    const handleAgendaChange = (depth: number) => (event: SelectChangeEvent<string>) => {
        const newValue = event.target.value;
        setValues((prev) => {
            // Truncate path to current depth and set new value
            const newPath = [...prev.agendaPath.slice(0, depth), newValue];
            return { ...prev, agendaPath: newPath };
        });
        // Clear errors for this depth and all deeper levels
        setErrors((prev) => {
            const newErrors = { ...prev };
            Object.keys(newErrors).forEach((key) => {
                if (key.startsWith('agenda_')) {
                    const keyDepth = parseInt(key.replace('agenda_', ''), 10);
                    if (keyDepth >= depth) {
                        delete newErrors[key];
                    }
                }
            });
            return newErrors;
        });
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

        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }

        await onConfirm(values);
    };

    // Generate dynamic agenda selectors based on current path depth
    const renderAgendaSelectors = () => {
        const selectors: React.ReactNode[] = [];
        let depth = 0;

        // Always show at least the first level if root agendas exist
        while (true) {
            const agendasAtDepth = getAgendasAtDepth(rootAgendas, values.agendaPath, depth);

            // Stop if no agendas available at this depth
            if (agendasAtDepth.length === 0) break;

            const currentValue = values.agendaPath[depth] ?? '';
            const isDisabled = loading || (depth > 0 && !values.agendaPath[depth - 1]);
            const labelPrefix = depth === 0 ? 'Agenda' : `Sub-Agenda Level ${depth}`;

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
                        {agendasAtDepth.map((agenda, index) => (
                            <MenuItem key={index} value={agenda.title}>
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

            // Only continue if we have a selection at this depth that has sub-agendas
            if (!currentValue) break;
            const selectedAgenda = agendasAtDepth.find((a) => a.title === currentValue);
            if (!selectedAgenda || selectedAgenda.subAgenda.length === 0) break;

            depth++;
        }

        return selectors;
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

                    {/* Research Agenda Selection */}
                    <Typography variant="subtitle1" fontWeight="medium">
                        Research Agenda Classification
                    </Typography>

                    {/* Agenda Type Selection */}
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

                    {/* Department Selection (only for departmental) */}
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
                                {availableDepartments.map((dept: string) => (
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

                    {/* Dynamic Agenda Selectors */}
                    {(values.agendaType === 'institutional' || values.department) && (
                        <>
                            {renderAgendaSelectors()}
                        </>
                    )}

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
