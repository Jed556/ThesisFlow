import * as React from 'react';
import {
    Alert, Box, Button, Card, CardContent, Chip, Collapse, Dialog, DialogActions,
    DialogContent, DialogTitle, Divider, IconButton, LinearProgress, List, ListItem,
    ListItemText, Skeleton, Stack, TextField, Tooltip, Typography
} from '@mui/material';
import {
    Add as AddIcon, Article as ArticleIcon, Business as BusinessIcon, Delete as DeleteIcon,
    Download as DownloadIcon, Edit as EditIcon, ExpandLess as ExpandLessIcon,
    ExpandMore as ExpandMoreIcon, School as SchoolIcon, Upload as UploadIcon
} from '@mui/icons-material';
import { AnimatedPage } from '../../../components/Animate';
import { useSnackbar } from '../../../contexts/SnackbarContext';
import { getUserDepartments } from '../../../utils/firebase/firestore/user';
import type { NavigationItem } from '../../../types/navigation';

export const metadata: NavigationItem = {
    group: 'management',
    index: 5,
    title: 'Agenda',
    segment: 'agenda-management',
    icon: <ArticleIcon />,
    roles: ['admin', 'developer', 'head'],
};

/**
 * Recursive agenda item structure
 */
interface AgendaItem {
    title: string;
    description?: string;
    subAgenda: AgendaItem[];
}

/**
 * Department agenda structure
 */
interface DepartmentAgenda {
    department: string;
    agenda: AgendaItem[];
}

/**
 * Full agendas data structure
 */
interface AgendasData {
    institutionalAgenda: {
        title: string;
        agenda: AgendaItem[];
    };
    departmentalAgendas: DepartmentAgenda[];
}

import {
    saveFullAgendasData, loadOrSeedFullAgendasData, type FullAgendasData, type LoadOrSeedAgendasResult
} from '../../../utils/firebase/firestore/agendas';
import { DEFAULT_YEAR } from '../../../config/firestore';

/**
 * Load agendas from Firestore, or seed with default data if empty
 * @returns Object containing agendas data and whether seeding occurred
 */
async function loadAgendas(): Promise<LoadOrSeedAgendasResult> {
    // Load default data from JSON
    const defaultData = await import('../../../config/agendas.json');
    const data = defaultData.default as unknown as FullAgendasData;

    // Load from Firestore or seed with defaults
    return loadOrSeedFullAgendasData(DEFAULT_YEAR, data);
}

/**
 * Save agendas to Firestore
 */
async function saveAgendas(data: AgendasData): Promise<void> {
    await saveFullAgendasData(DEFAULT_YEAR, data);
}

/**
 * Count total sub-agendas recursively
 */
function countSubAgendas(agendas: AgendaItem[]): number {
    let count = 0;
    for (const agenda of agendas) {
        count += 1 + countSubAgendas(agenda.subAgenda);
    }
    return count;
}

// ============================================================================
// Recursive Agenda Item Component
// ============================================================================

interface RecursiveAgendaItemProps {
    agenda: AgendaItem;
    path: number[]; // Index path to this item
    depth: number;
    expanded: boolean;
    onToggle: () => void;
    onAdd: (path: number[]) => void;
    onEdit: (path: number[], agenda: AgendaItem) => void;
    onDelete: (path: number[], title: string) => void;
    chipColor?: 'primary' | 'secondary';
}

/**
 * Renders a single agenda item with recursive sub-agendas
 */
function RecursiveAgendaItem({
    agenda,
    path,
    depth,
    expanded,
    onToggle,
    onAdd,
    onEdit,
    onDelete,
    chipColor = 'primary',
}: RecursiveAgendaItemProps) {
    const hasSubAgendas = agenda.subAgenda.length > 0;
    const [subExpanded, setSubExpanded] = React.useState<Set<number>>(new Set());

    const toggleSubItem = (index: number) => {
        setSubExpanded((prev) => {
            const next = new Set(prev);
            if (next.has(index)) {
                next.delete(index);
            } else {
                next.add(index);
            }
            return next;
        });
    };

    return (
        <React.Fragment>
            <ListItem
                sx={{
                    bgcolor: depth === 0 ? 'action.hover' : 'transparent',
                    borderRadius: 1,
                    mb: 0.5,
                    pl: depth * 3,
                    borderLeft: depth > 0 ? '2px solid' : 'none',
                    borderColor: 'divider',
                }}
                secondaryAction={
                    <Stack direction="row" spacing={0.5}>
                        <Tooltip title="Add Sub-Agenda">
                            <IconButton size="small" onClick={() => onAdd(path)}>
                                <AddIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                            <IconButton size="small" onClick={() => onEdit(path, agenda)}>
                                <EditIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                            <IconButton size="small" color="error" onClick={() => onDelete(path, agenda.title)}>
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Stack>
                }
            >
                {hasSubAgendas && (
                    <IconButton size="small" onClick={onToggle} sx={{ mr: 1 }}>
                        {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                )}
                {!hasSubAgendas && <Box sx={{ width: 40 }} />}
                <ListItemText
                    primary={
                        <Stack direction="row" spacing={1} alignItems="center">
                            {depth === 0 && (
                                <Chip
                                    label={path[path.length - 1] + 1}
                                    size="small"
                                    color={chipColor}
                                />
                            )}
                            <Typography
                                variant={depth === 0 ? 'subtitle1' : 'body2'}
                                fontWeight={depth === 0 ? 500 : 400}
                            >
                                {agenda.title}
                            </Typography>
                        </Stack>
                    }
                    secondary={hasSubAgendas ? `${agenda.subAgenda.length} sub-agenda(s)` : undefined}
                />
            </ListItem>
            {hasSubAgendas && (
                <Collapse in={expanded}>
                    <List disablePadding>
                        {agenda.subAgenda.map((subAgenda, subIndex) => (
                            <RecursiveAgendaItem
                                key={subIndex}
                                agenda={subAgenda}
                                path={[...path, subIndex]}
                                depth={depth + 1}
                                expanded={subExpanded.has(subIndex)}
                                onToggle={() => toggleSubItem(subIndex)}
                                onAdd={onAdd}
                                onEdit={onEdit}
                                onDelete={onDelete}
                                chipColor={chipColor}
                            />
                        ))}
                    </List>
                </Collapse>
            )}
        </React.Fragment>
    );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Admin page for managing research agendas with recursive nesting.
 */
export default function AgendasManagementPage() {
    const { showNotification } = useSnackbar();

    const [agendas, setAgendas] = React.useState<AgendasData | null>(null);
    const [departments, setDepartments] = React.useState<string[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [isSeeding, setIsSeeding] = React.useState(false);
    const [expandedInstitutional, setExpandedInstitutional] = React.useState<Set<number>>(new Set());
    const [expandedDepartments, setExpandedDepartments] = React.useState<Set<string>>(new Set());
    const [expandedDeptAgendas, setExpandedDeptAgendas] = React.useState<Set<string>>(new Set());

    // Dialog states
    const [agendaDialogOpen, setAgendaDialogOpen] = React.useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);

    // Form states
    const [editingAgenda, setEditingAgenda] = React.useState<{
        type: 'institutional' | 'department';
        departmentIndex?: number;
        path: number[]; // Path to parent, empty for root level
        agenda: AgendaItem | null; // null for new agenda
    } | null>(null);
    const [deleteTarget, setDeleteTarget] = React.useState<{
        label: string;
        onConfirm: () => void;
    } | null>(null);

    // File input ref
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Load agendas and departments on mount
    React.useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const [result, depts] = await Promise.all([
                    loadAgendas(),
                    getUserDepartments().catch(() => []),
                ]);
                if (!cancelled) {
                    const { data, seeded } = result;

                    // Show seeding indicator if data was seeded
                    if (seeded) {
                        setIsSeeding(true);
                        // Small delay to show the seeding message
                        await new Promise((resolve) => setTimeout(resolve, 1500));
                        if (!cancelled) {
                            setIsSeeding(false);
                            showNotification('Default agendas have been added to the database.', 'success');
                        }
                    }

                    // Ensure all departments have an entry
                    const existingDepts = new Set(
                        data.departmentalAgendas.map((d: DepartmentAgenda) => d.department)
                    );
                    for (const dept of depts) {
                        if (!existingDepts.has(dept)) {
                            data.departmentalAgendas.push({
                                department: dept,
                                agenda: [],
                            });
                        }
                    }
                    // Sort departments alphabetically
                    data.departmentalAgendas.sort((a, b) =>
                        a.department.localeCompare(b.department)
                    );
                    setAgendas(data as AgendasData);
                    setDepartments(depts.sort());
                    setLoading(false);
                }
            } catch (error) {
                console.error('Failed to load agendas:', error);
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };
        void load();
        return () => { cancelled = true; };
    }, [showNotification]);

    // Save agendas to Firestore whenever they change (debounced)
    React.useEffect(() => {
        if (!agendas) return;

        // Debounce Firestore writes to avoid excessive costs
        const timeoutId = setTimeout(() => {
            void saveAgendas(agendas).catch((error) => {
                console.error('Failed to save agendas to Firestore:', error);
            });
        }, 1000); // 1 second debounce

        return () => clearTimeout(timeoutId);
    }, [agendas]);

    // ========================================================================
    // Toggle expansion
    // ========================================================================

    const toggleInstitutionalAgenda = (index: number) => {
        setExpandedInstitutional((prev) => {
            const next = new Set(prev);
            if (next.has(index)) {
                next.delete(index);
            } else {
                next.add(index);
            }
            return next;
        });
    };

    const toggleDepartment = (department: string) => {
        setExpandedDepartments((prev) => {
            const next = new Set(prev);
            if (next.has(department)) {
                next.delete(department);
            } else {
                next.add(department);
            }
            return next;
        });
    };

    const toggleDeptAgenda = (key: string) => {
        setExpandedDeptAgendas((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    // ========================================================================
    // Helper to navigate/modify agenda by path
    // ========================================================================

    const updateAgendaAtPath = (
        agendas: AgendaItem[],
        path: number[],
        updater: (agenda: AgendaItem) => AgendaItem
    ): AgendaItem[] => {
        const newAgendas = [...agendas];
        if (path.length === 1) {
            newAgendas[path[0]] = updater(newAgendas[path[0]]);
        } else {
            newAgendas[path[0]] = {
                ...newAgendas[path[0]],
                subAgenda: updateAgendaAtPath(
                    newAgendas[path[0]].subAgenda,
                    path.slice(1),
                    updater
                ),
            };
        }
        return newAgendas;
    };

    const deleteAgendaAtPath = (
        agendas: AgendaItem[],
        path: number[]
    ): AgendaItem[] => {
        const newAgendas = [...agendas];
        if (path.length === 1) {
            newAgendas.splice(path[0], 1);
        } else {
            newAgendas[path[0]] = {
                ...newAgendas[path[0]],
                subAgenda: deleteAgendaAtPath(
                    newAgendas[path[0]].subAgenda,
                    path.slice(1)
                ),
            };
        }
        return newAgendas;
    };

    const addAgendaAtPath = (
        agendas: AgendaItem[],
        path: number[],
        newAgenda: AgendaItem
    ): AgendaItem[] => {
        if (path.length === 0) {
            // Add at root level
            return [...agendas, newAgenda];
        }
        return updateAgendaAtPath(agendas, path, (parent) => ({
            ...parent,
            subAgenda: [...parent.subAgenda, newAgenda],
        }));
    };

    // ========================================================================
    // Import/Export
    // ========================================================================

    const handleExport = () => {
        if (!agendas) return;
        const blob = new Blob([JSON.stringify(agendas, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'research-agendas.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        showNotification('Agendas exported successfully', 'success');
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const text = await file.text();
            const data = JSON.parse(text) as AgendasData;

            // Validate structure
            if (!data.institutionalAgenda?.agenda || !data.departmentalAgendas) {
                throw new Error('Invalid agendas file structure');
            }

            setAgendas(data);
            showNotification('Agendas imported successfully', 'success');
        } catch (error) {
            console.error('Failed to import agendas:', error);
            showNotification('Failed to import agendas. Please check the file format.', 'error');
        }

        event.target.value = '';
    };

    const handleResetToDefault = async () => {
        try {
            const defaultData = await import('../../../config/agendas.json');
            const data = defaultData.default as unknown as AgendasData;
            // Save default data to Firestore (overwrites existing)
            await saveFullAgendasData(DEFAULT_YEAR, data);
            setAgendas(data);
            showNotification('Agendas reset to default', 'success');
        } catch (error) {
            console.error('Failed to reset agendas:', error);
            showNotification('Failed to reset agendas', 'error');
        }
    };

    // ========================================================================
    // Agenda CRUD
    // ========================================================================

    const openAddAgendaDialog = (
        type: 'institutional' | 'department',
        path: number[],
        departmentIndex?: number
    ) => {
        setEditingAgenda({
            type,
            departmentIndex,
            path,
            agenda: null,
        });
        setAgendaDialogOpen(true);
    };

    const openEditAgendaDialog = (
        type: 'institutional' | 'department',
        path: number[],
        agenda: AgendaItem,
        departmentIndex?: number
    ) => {
        setEditingAgenda({
            type,
            departmentIndex,
            path,
            agenda: { ...agenda },
        });
        setAgendaDialogOpen(true);
    };

    const handleSaveAgenda = (title: string, description?: string) => {
        if (!agendas || !editingAgenda) return;

        const newAgenda: AgendaItem = {
            title,
            description: description || undefined,
            subAgenda: editingAgenda.agenda?.subAgenda ?? [],
        };

        const newAgendas = { ...agendas };

        if (editingAgenda.type === 'institutional') {
            if (editingAgenda.agenda) {
                // Edit existing
                newAgendas.institutionalAgenda.agenda = updateAgendaAtPath(
                    newAgendas.institutionalAgenda.agenda,
                    editingAgenda.path,
                    () => newAgenda
                );
            } else {
                // Add new
                newAgendas.institutionalAgenda.agenda = addAgendaAtPath(
                    newAgendas.institutionalAgenda.agenda,
                    editingAgenda.path,
                    newAgenda
                );
            }
        } else if (editingAgenda.departmentIndex !== undefined) {
            if (editingAgenda.agenda) {
                // Edit existing
                newAgendas.departmentalAgendas[editingAgenda.departmentIndex].agenda =
                    updateAgendaAtPath(
                        newAgendas.departmentalAgendas[editingAgenda.departmentIndex].agenda,
                        editingAgenda.path,
                        () => newAgenda
                    );
            } else {
                // Add new
                newAgendas.departmentalAgendas[editingAgenda.departmentIndex].agenda =
                    addAgendaAtPath(
                        newAgendas.departmentalAgendas[editingAgenda.departmentIndex].agenda,
                        editingAgenda.path,
                        newAgenda
                    );
            }
        }

        setAgendas(newAgendas);
        setAgendaDialogOpen(false);
        setEditingAgenda(null);
        showNotification(
            editingAgenda.agenda ? 'Agenda updated' : 'Agenda added',
            'success'
        );
    };

    const handleDeleteAgenda = (
        type: 'institutional' | 'department',
        path: number[],
        title: string,
        departmentIndex?: number
    ) => {
        setDeleteTarget({
            label: title,
            onConfirm: () => {
                if (!agendas) return;
                const newAgendas = { ...agendas };

                if (type === 'institutional') {
                    newAgendas.institutionalAgenda.agenda = deleteAgendaAtPath(
                        newAgendas.institutionalAgenda.agenda,
                        path
                    );
                } else if (departmentIndex !== undefined) {
                    newAgendas.departmentalAgendas[departmentIndex].agenda =
                        deleteAgendaAtPath(
                            newAgendas.departmentalAgendas[departmentIndex].agenda,
                            path
                        );
                }

                setAgendas(newAgendas);
                showNotification('Agenda deleted', 'success');
            },
        });
        setDeleteDialogOpen(true);
    };

    // ========================================================================
    // Render
    // ========================================================================

    if (loading || isSeeding) {
        return (
            <AnimatedPage variant="slideUp">
                {isSeeding ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 10, gap: 2 }}>
                        <Typography variant="h6" color="text.secondary">
                            Pushing default agendas to database...
                        </Typography>
                        <Box sx={{ width: '100%', maxWidth: 400 }}>
                            <LinearProgress />
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                            Setting up institutional and departmental research agendas
                        </Typography>
                    </Box>
                ) : (
                    <Stack spacing={3}>
                        <Skeleton variant="text" width={300} height={50} />
                        <Skeleton variant="rounded" height={200} />
                        <Skeleton variant="rounded" height={200} />
                    </Stack>
                )}
            </AnimatedPage>
        );
    }

    if (!agendas) {
        return (
            <AnimatedPage variant="slideUp">
                <Alert severity="error">Failed to load agendas data</Alert>
            </AnimatedPage>
        );
    }

    return (
        <AnimatedPage variant="slideUp">
            <Stack spacing={3}>
                {/* Header */}
                <Box sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    justifyContent: 'space-between',
                    alignItems: { xs: 'stretch', sm: 'center' },
                    gap: 2,
                }}>
                    <Typography variant="h4" fontWeight={600}>
                        Research Agendas Management
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                        <Button
                            variant="outlined"
                            startIcon={<UploadIcon />}
                            onClick={handleImportClick}
                        >
                            Import
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<DownloadIcon />}
                            onClick={handleExport}
                        >
                            Export
                        </Button>
                        <Button
                            variant="outlined"
                            color="warning"
                            onClick={handleResetToDefault}
                        >
                            Reset to Default
                        </Button>
                    </Stack>
                </Box>

                {/* Hidden file input */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                />

                {/* Institutional Research Agenda */}
                <Card sx={{ borderRadius: 3 }}>
                    <CardContent>
                        <Stack spacing={2}>
                            <Box sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                            }}>
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <SchoolIcon color="primary" />
                                    <Typography variant="h6">
                                        {agendas.institutionalAgenda.title}
                                    </Typography>
                                    <Chip
                                        label={`${countSubAgendas(agendas.institutionalAgenda.agenda)} items`}
                                        size="small"
                                        variant="outlined"
                                        color="primary"
                                    />
                                </Stack>
                                <Button
                                    variant="contained"
                                    size="small"
                                    startIcon={<AddIcon />}
                                    onClick={() => openAddAgendaDialog('institutional', [])}
                                >
                                    Add Agenda
                                </Button>
                            </Box>

                            <List disablePadding>
                                {agendas.institutionalAgenda.agenda.map((agenda, index) => (
                                    <RecursiveAgendaItem
                                        key={index}
                                        agenda={agenda}
                                        path={[index]}
                                        depth={0}
                                        expanded={expandedInstitutional.has(index)}
                                        onToggle={() => toggleInstitutionalAgenda(index)}
                                        onAdd={(path) => openAddAgendaDialog('institutional', path)}
                                        onEdit={(path, a) => openEditAgendaDialog('institutional', path, a)}
                                        onDelete={(path, title) => handleDeleteAgenda('institutional', path, title)}
                                        chipColor="primary"
                                    />
                                ))}
                                {agendas.institutionalAgenda.agenda.length === 0 && (
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{ fontStyle: 'italic', py: 1 }}
                                    >
                                        No agendas added yet
                                    </Typography>
                                )}
                            </List>
                        </Stack>
                    </CardContent>
                </Card>

                {/* Department Research Agendas */}
                <Card sx={{ borderRadius: 3 }}>
                    <CardContent>
                        <Stack spacing={2}>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <BusinessIcon color="secondary" />
                                <Typography variant="h6">
                                    Departmental Research Agendas
                                </Typography>
                                <Chip
                                    label={`${departments.length} departments`}
                                    size="small"
                                    variant="outlined"
                                    color="secondary"
                                />
                            </Stack>

                            {departments.length === 0 && (
                                <Alert severity="info">
                                    No departments found. Departments are automatically
                                    detected from existing thesis groups.
                                </Alert>
                            )}

                            {agendas.departmentalAgendas
                                .filter((dept) => departments.includes(dept.department))
                                .map((dept) => {
                                    const deptIndex = agendas.departmentalAgendas.findIndex(
                                        (d) => d.department === dept.department
                                    );
                                    return (
                                        <Card
                                            key={dept.department}
                                            variant="outlined"
                                            sx={{ borderRadius: 2 }}
                                        >
                                            <CardContent sx={{ pb: '16px !important' }}>
                                                <Box sx={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    mb: 1,
                                                }}>
                                                    <Stack direction="row" spacing={1} alignItems="center">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => toggleDepartment(dept.department)}
                                                        >
                                                            {expandedDepartments.has(dept.department)
                                                                ? <ExpandLessIcon />
                                                                : <ExpandMoreIcon />}
                                                        </IconButton>
                                                        <Typography variant="subtitle1" fontWeight={500}>
                                                            {dept.department}
                                                        </Typography>
                                                        <Chip
                                                            label={`${countSubAgendas(dept.agenda)} items`}
                                                            size="small"
                                                            variant="outlined"
                                                        />
                                                    </Stack>
                                                    <Button
                                                        size="small"
                                                        startIcon={<AddIcon />}
                                                        onClick={() => openAddAgendaDialog('department', [], deptIndex)}
                                                    >
                                                        Add Agenda
                                                    </Button>
                                                </Box>

                                                <Collapse in={expandedDepartments.has(dept.department)}>
                                                    <Divider sx={{ my: 1 }} />
                                                    <List disablePadding>
                                                        {dept.agenda.map((agenda, agendaIndex) => {
                                                            const key = `${dept.department}-${agendaIndex}`;
                                                            return (
                                                                <RecursiveAgendaItem
                                                                    key={agendaIndex}
                                                                    agenda={agenda}
                                                                    path={[agendaIndex]}
                                                                    depth={0}
                                                                    expanded={expandedDeptAgendas.has(key)}
                                                                    onToggle={() => toggleDeptAgenda(key)}
                                                                    onAdd={(path) => openAddAgendaDialog(
                                                                        'department', path, deptIndex
                                                                    )}
                                                                    onEdit={(path, a) => openEditAgendaDialog(
                                                                        'department', path, a, deptIndex
                                                                    )}
                                                                    onDelete={(path, title) => handleDeleteAgenda(
                                                                        'department', path, title, deptIndex
                                                                    )}
                                                                    chipColor="secondary"
                                                                />
                                                            );
                                                        })}
                                                        {dept.agenda.length === 0 && (
                                                            <Typography
                                                                variant="body2"
                                                                color="text.secondary"
                                                                sx={{ fontStyle: 'italic', py: 1 }}
                                                            >
                                                                No agendas added yet
                                                            </Typography>
                                                        )}
                                                    </List>
                                                </Collapse>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                        </Stack>
                    </CardContent>
                </Card>
            </Stack>

            {/* Agenda Dialog */}
            <Dialog
                open={agendaDialogOpen}
                onClose={() => setAgendaDialogOpen(false)}
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle>
                    {editingAgenda?.agenda ? 'Edit Agenda' : 'Add Agenda'}
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <TextField
                            autoFocus
                            fullWidth
                            label="Agenda Title"
                            defaultValue={editingAgenda?.agenda?.title ?? ''}
                            id="agenda-title-input"
                        />
                        <TextField
                            fullWidth
                            label="Description (optional)"
                            defaultValue={editingAgenda?.agenda?.description ?? ''}
                            multiline
                            rows={2}
                            id="agenda-description-input"
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAgendaDialogOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={() => {
                            const titleInput = document.getElementById(
                                'agenda-title-input'
                            ) as HTMLInputElement;
                            const descInput = document.getElementById(
                                'agenda-description-input'
                            ) as HTMLTextAreaElement;
                            if (titleInput?.value.trim()) {
                                handleSaveAgenda(
                                    titleInput.value.trim(),
                                    descInput?.value.trim() || undefined
                                );
                            }
                        }}
                    >
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
            >
                <DialogTitle>Confirm Delete</DialogTitle>
                <DialogContent>
                    <Typography>
                        Are you sure you want to delete{' '}
                        <strong>{deleteTarget?.label}</strong>?
                        This will also delete all nested sub-agendas.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        color="error"
                        onClick={() => {
                            deleteTarget?.onConfirm();
                            setDeleteDialogOpen(false);
                            setDeleteTarget(null);
                        }}
                    >
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </AnimatedPage>
    );
}
