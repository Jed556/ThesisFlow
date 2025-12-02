import * as React from 'react';
import {
    Alert, Box, Button, Card, CardContent, Chip, Collapse, Dialog, DialogActions,
    DialogContent, DialogTitle, Divider, IconButton, List, ListItem, ListItemIcon,
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
    title: 'Agendas',
    segment: 'agenda-management',
    icon: <ArticleIcon />,
    roles: ['admin', 'developer', 'head'],
};

/**
 * Theme structure from agendas.json
 */
interface AgendaTheme {
    id: string;
    title: string;
    subThemes: string[];
}

/**
 * Department agenda structure
 */
interface DepartmentAgenda {
    department: string;
    themes: AgendaTheme[];
}

/**
 * Full agendas data structure
 */
interface AgendasData {
    institutionalResearchAgenda: {
        title: string;
        themes: AgendaTheme[];
    };
    schoolResearchAgendas: DepartmentAgenda[];
}

const STORAGE_KEY = 'thesisflow_agendas';

/**
 * Load agendas from localStorage or use defaults from mock file
 */
async function loadAgendas(): Promise<AgendasData> {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            return JSON.parse(stored) as AgendasData;
        } catch {
            // Fall through to default
        }
    }
    // Import default data
    const defaultData = await import('../../../../mock/agendas.json');
    return defaultData.default as AgendasData;
}

/**
 * Save agendas to localStorage
 */
function saveAgendas(data: AgendasData): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * Generate next theme ID (A, B, C, ...)
 */
function getNextThemeId(themes: AgendaTheme[]): string {
    if (themes.length === 0) return 'A';
    const lastId = themes[themes.length - 1].id;
    return String.fromCharCode(lastId.charCodeAt(0) + 1);
}

// ============================================================================
// Reusable Components
// ============================================================================

interface SubThemeListProps {
    subThemes: string[];
    onEdit: (subIndex: number, value: string) => void;
    onDelete: (subIndex: number, value: string) => void;
}

/**
 * Renders a list of sub-themes with edit/delete actions
 */
function SubThemeList({ subThemes, onEdit, onDelete }: SubThemeListProps) {
    if (subThemes.length === 0) {
        return (
            <ListItem sx={{ py: 0.5, pl: 2 }}>
                <ListItemText
                    primary="No sub-themes yet"
                    slotProps={{
                        primary: {
                            variant: 'body2',
                            color: 'text.secondary',
                            fontStyle: 'italic',
                        },
                    }}
                />
            </ListItem>
        );
    }

    return (
        <>
            {subThemes.map((subTheme, subIndex) => (
                <ListItem
                    key={subIndex}
                    sx={{
                        py: 0.5,
                        borderLeft: '2px solid',
                        borderColor: 'divider',
                        pl: 2,
                    }}
                    secondaryAction={
                        <Stack direction="row" spacing={0.5}>
                            <IconButton
                                size="small"
                                onClick={() => onEdit(subIndex, subTheme)}
                            >
                                <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                                size="small"
                                color="error"
                                onClick={() => onDelete(subIndex, subTheme)}
                            >
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Stack>
                    }
                >
                    <ListItemText
                        primary={subTheme}
                        slotProps={{
                            primary: { variant: 'body2' },
                        }}
                    />
                </ListItem>
            ))}
        </>
    );
}

interface ThemeItemProps {
    theme: AgendaTheme;
    themeIndex: number;
    expanded: boolean;
    onToggle: () => void;
    onAddSubTheme: () => void;
    onEditTheme: () => void;
    onDeleteTheme: () => void;
    onEditSubTheme: (subIndex: number, value: string) => void;
    onDeleteSubTheme: (subIndex: number, value: string) => void;
    chipColor?: 'primary' | 'secondary';
}

/**
 * Renders a single theme item with expandable sub-themes
 */
function ThemeItem({
    theme,
    expanded,
    onToggle,
    onAddSubTheme,
    onEditTheme,
    onDeleteTheme,
    onEditSubTheme,
    onDeleteSubTheme,
    chipColor = 'primary',
}: ThemeItemProps) {
    return (
        <React.Fragment>
            <ListItem
                sx={{
                    bgcolor: 'action.hover',
                    borderRadius: 1,
                    mb: 1,
                }}
                secondaryAction={
                    <Stack direction="row" spacing={0.5}>
                        <Tooltip title="Add Sub-theme">
                            <IconButton size="small" onClick={onAddSubTheme}>
                                <AddIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit Theme">
                            <IconButton size="small" onClick={onEditTheme}>
                                <EditIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Theme">
                            <IconButton size="small" color="error" onClick={onDeleteTheme}>
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Stack>
                }
            >
                <ListItemIcon sx={{ minWidth: 'auto', mr: 1 }}>
                    <IconButton size="small" onClick={onToggle}>
                        {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                </ListItemIcon>
                <ListItemText
                    primary={
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Chip label={theme.id} size="small" color={chipColor} />
                            <Typography variant="subtitle1" fontWeight={500}>
                                {theme.title}
                            </Typography>
                        </Stack>
                    }
                    secondary={`${theme.subThemes.length} sub-themes`}
                />
            </ListItem>
            <Collapse in={expanded}>
                <List disablePadding sx={{ pl: 6, mb: 1 }}>
                    <SubThemeList
                        subThemes={theme.subThemes}
                        onEdit={onEditSubTheme}
                        onDelete={onDeleteSubTheme}
                    />
                </List>
            </Collapse>
        </React.Fragment>
    );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Admin page for managing research agendas.
 */
export default function AgendasManagementPage() {
    const { showNotification } = useSnackbar();

    const [agendas, setAgendas] = React.useState<AgendasData | null>(null);
    const [departments, setDepartments] = React.useState<string[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [expandedInstitutional, setExpandedInstitutional] = React.useState<string[]>([]);
    const [expandedDepartments, setExpandedDepartments] = React.useState<string[]>([]);
    const [expandedDeptThemes, setExpandedDeptThemes] = React.useState<string[]>([]);

    // Dialog states
    const [themeDialogOpen, setThemeDialogOpen] = React.useState(false);
    const [subThemeDialogOpen, setSubThemeDialogOpen] = React.useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);

    // Form states
    const [editingTheme, setEditingTheme] = React.useState<{
        type: 'institutional' | 'department';
        departmentIndex?: number;
        themeIndex?: number;
        theme: AgendaTheme | null;
    } | null>(null);
    const [editingSubTheme, setEditingSubTheme] = React.useState<{
        type: 'institutional' | 'department';
        departmentIndex?: number;
        themeIndex: number;
        subThemeIndex?: number;
        value: string;
    } | null>(null);
    const [deleteTarget, setDeleteTarget] = React.useState<{
        type: 'theme' | 'subTheme';
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
                const [data, depts] = await Promise.all([
                    loadAgendas(),
                    getUserDepartments().catch(() => []),
                ]);
                if (!cancelled) {
                    // Ensure all departments have an entry in schoolResearchAgendas
                    const existingDepts = new Set(
                        data.schoolResearchAgendas.map((d) => d.department)
                    );
                    for (const dept of depts) {
                        if (!existingDepts.has(dept)) {
                            data.schoolResearchAgendas.push({
                                department: dept,
                                themes: [],
                            });
                        }
                    }
                    // Sort departments alphabetically
                    data.schoolResearchAgendas.sort((a, b) =>
                        a.department.localeCompare(b.department)
                    );
                    setAgendas(data);
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
    }, []);

    // Save agendas whenever they change
    React.useEffect(() => {
        if (agendas) {
            saveAgendas(agendas);
        }
    }, [agendas]);

    // ========================================================================
    // Toggle expansion
    // ========================================================================

    const toggleInstitutionalTheme = (themeId: string) => {
        setExpandedInstitutional((prev) =>
            prev.includes(themeId)
                ? prev.filter((id) => id !== themeId)
                : [...prev, themeId]
        );
    };

    const toggleDepartment = (department: string) => {
        setExpandedDepartments((prev) =>
            prev.includes(department)
                ? prev.filter((d) => d !== department)
                : [...prev, department]
        );
    };

    const toggleDeptTheme = (deptThemeKey: string) => {
        setExpandedDeptThemes((prev) =>
            prev.includes(deptThemeKey)
                ? prev.filter((k) => k !== deptThemeKey)
                : [...prev, deptThemeKey]
        );
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
            if (!data.institutionalResearchAgenda?.themes || !data.schoolResearchAgendas) {
                throw new Error('Invalid agendas file structure');
            }

            setAgendas(data);
            showNotification('Agendas imported successfully', 'success');
        } catch (error) {
            console.error('Failed to import agendas:', error);
            showNotification('Failed to import agendas. Please check the file format.', 'error');
        }

        // Reset input
        event.target.value = '';
    };

    const handleResetToDefault = async () => {
        try {
            localStorage.removeItem(STORAGE_KEY);
            const defaultData = await import('../../../../mock/agendas.json');
            setAgendas(defaultData.default as AgendasData);
            showNotification('Agendas reset to default', 'success');
        } catch (error) {
            console.error('Failed to reset agendas:', error);
            showNotification('Failed to reset agendas', 'error');
        }
    };

    // ========================================================================
    // Theme CRUD
    // ========================================================================

    const openAddThemeDialog = (type: 'institutional' | 'department', departmentIndex?: number) => {
        setEditingTheme({
            type,
            departmentIndex,
            theme: null,
        });
        setThemeDialogOpen(true);
    };

    const openEditThemeDialog = (
        type: 'institutional' | 'department',
        themeIndex: number,
        theme: AgendaTheme,
        departmentIndex?: number
    ) => {
        setEditingTheme({
            type,
            departmentIndex,
            themeIndex,
            theme: { ...theme },
        });
        setThemeDialogOpen(true);
    };

    const handleSaveTheme = (title: string) => {
        if (!agendas || !editingTheme) return;

        const newAgendas = { ...agendas };

        if (editingTheme.type === 'institutional') {
            const themes = newAgendas.institutionalResearchAgenda.themes;
            if (editingTheme.themeIndex !== undefined) {
                // Edit existing
                themes[editingTheme.themeIndex] = {
                    ...themes[editingTheme.themeIndex],
                    title,
                };
            } else {
                // Add new
                themes.push({
                    id: getNextThemeId(themes),
                    title,
                    subThemes: [],
                });
            }
        } else if (editingTheme.departmentIndex !== undefined) {
            const themes = newAgendas.schoolResearchAgendas[editingTheme.departmentIndex].themes;
            if (editingTheme.themeIndex !== undefined) {
                // Edit existing
                themes[editingTheme.themeIndex] = {
                    ...themes[editingTheme.themeIndex],
                    title,
                };
            } else {
                // Add new
                themes.push({
                    id: getNextThemeId(themes),
                    title,
                    subThemes: [],
                });
            }
        }

        setAgendas(newAgendas);
        setThemeDialogOpen(false);
        setEditingTheme(null);
        showNotification(
            editingTheme.themeIndex !== undefined ? 'Theme updated' : 'Theme added',
            'success'
        );
    };

    const handleDeleteTheme = (
        type: 'institutional' | 'department',
        themeIndex: number,
        themeTitle: string,
        departmentIndex?: number
    ) => {
        setDeleteTarget({
            type: 'theme',
            label: themeTitle,
            onConfirm: () => {
                if (!agendas) return;
                const newAgendas = { ...agendas };

                if (type === 'institutional') {
                    newAgendas.institutionalResearchAgenda.themes.splice(themeIndex, 1);
                } else if (departmentIndex !== undefined) {
                    newAgendas.schoolResearchAgendas[departmentIndex].themes.splice(themeIndex, 1);
                }

                setAgendas(newAgendas);
                showNotification('Theme deleted', 'success');
            },
        });
        setDeleteDialogOpen(true);
    };

    // ========================================================================
    // Sub-theme CRUD
    // ========================================================================

    const openAddSubThemeDialog = (
        type: 'institutional' | 'department',
        themeIndex: number,
        departmentIndex?: number
    ) => {
        setEditingSubTheme({
            type,
            departmentIndex,
            themeIndex,
            value: '',
        });
        setSubThemeDialogOpen(true);
    };

    const openEditSubThemeDialog = (
        type: 'institutional' | 'department',
        themeIndex: number,
        subThemeIndex: number,
        value: string,
        departmentIndex?: number
    ) => {
        setEditingSubTheme({
            type,
            departmentIndex,
            themeIndex,
            subThemeIndex,
            value,
        });
        setSubThemeDialogOpen(true);
    };

    const handleSaveSubTheme = (value: string) => {
        if (!agendas || !editingSubTheme) return;

        const newAgendas = { ...agendas };

        const getThemes = () => {
            if (editingSubTheme.type === 'institutional') {
                return newAgendas.institutionalResearchAgenda.themes;
            }
            if (editingSubTheme.departmentIndex !== undefined) {
                return newAgendas.schoolResearchAgendas[editingSubTheme.departmentIndex].themes;
            }
            return null;
        };

        const themes = getThemes();
        if (!themes) return;

        const subThemes = themes[editingSubTheme.themeIndex].subThemes;

        if (editingSubTheme.subThemeIndex !== undefined) {
            // Edit existing
            subThemes[editingSubTheme.subThemeIndex] = value;
        } else {
            // Add new
            subThemes.push(value);
        }

        setAgendas(newAgendas);
        setSubThemeDialogOpen(false);
        setEditingSubTheme(null);
        showNotification(
            editingSubTheme.subThemeIndex !== undefined ? 'Sub-theme updated' : 'Sub-theme added',
            'success'
        );
    };

    const handleDeleteSubTheme = (
        type: 'institutional' | 'department',
        themeIndex: number,
        subThemeIndex: number,
        subThemeValue: string,
        departmentIndex?: number
    ) => {
        setDeleteTarget({
            type: 'subTheme',
            label: subThemeValue,
            onConfirm: () => {
                if (!agendas) return;
                const newAgendas = { ...agendas };

                if (type === 'institutional') {
                    newAgendas.institutionalResearchAgenda.themes[themeIndex].subThemes.splice(
                        subThemeIndex, 1
                    );
                } else if (departmentIndex !== undefined) {
                    newAgendas.schoolResearchAgendas[departmentIndex].themes[themeIndex].subThemes
                        .splice(subThemeIndex, 1);
                }

                setAgendas(newAgendas);
                showNotification('Sub-theme deleted', 'success');
            },
        });
        setDeleteDialogOpen(true);
    };

    // ========================================================================
    // Render
    // ========================================================================

    if (loading) {
        return (
            <AnimatedPage variant="slideUp">
                <Stack spacing={3}>
                    <Skeleton variant="text" width={300} height={50} />
                    <Skeleton variant="rounded" height={200} />
                    <Skeleton variant="rounded" height={200} />
                </Stack>
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
                                        {agendas.institutionalResearchAgenda.title}
                                    </Typography>
                                </Stack>
                                <Button
                                    variant="contained"
                                    size="small"
                                    startIcon={<AddIcon />}
                                    onClick={() => openAddThemeDialog('institutional')}
                                >
                                    Add Theme
                                </Button>
                            </Box>

                            <List disablePadding>
                                {agendas.institutionalResearchAgenda.themes.map((theme, themeIndex) => (
                                    <ThemeItem
                                        key={theme.id}
                                        theme={theme}
                                        themeIndex={themeIndex}
                                        expanded={expandedInstitutional.includes(theme.id)}
                                        onToggle={() => toggleInstitutionalTheme(theme.id)}
                                        onAddSubTheme={() => openAddSubThemeDialog(
                                            'institutional', themeIndex
                                        )}
                                        onEditTheme={() => openEditThemeDialog(
                                            'institutional', themeIndex, theme
                                        )}
                                        onDeleteTheme={() => handleDeleteTheme(
                                            'institutional', themeIndex, theme.title
                                        )}
                                        onEditSubTheme={(subIndex, value) => openEditSubThemeDialog(
                                            'institutional', themeIndex, subIndex, value
                                        )}
                                        onDeleteSubTheme={(subIndex, value) => handleDeleteSubTheme(
                                            'institutional', themeIndex, subIndex, value
                                        )}
                                        chipColor="primary"
                                    />
                                ))}
                            </List>
                        </Stack>
                    </CardContent>
                </Card>

                {/* School/Department Research Agendas */}
                <Card sx={{ borderRadius: 3 }}>
                    <CardContent>
                        <Stack spacing={2}>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <BusinessIcon color="secondary" />
                                <Typography variant="h6">
                                    School/Department Research Agendas
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

                            {agendas.schoolResearchAgendas
                                .filter((dept) => departments.includes(dept.department))
                                .map((dept) => {
                                    const deptIndex = agendas.schoolResearchAgendas.findIndex(
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
                                                            {expandedDepartments.includes(dept.department)
                                                                ? <ExpandLessIcon />
                                                                : <ExpandMoreIcon />}
                                                        </IconButton>
                                                        <Typography variant="subtitle1" fontWeight={500}>
                                                            {dept.department}
                                                        </Typography>
                                                        <Chip
                                                            label={`${dept.themes.length} themes`}
                                                            size="small"
                                                            variant="outlined"
                                                        />
                                                    </Stack>
                                                    <Button
                                                        size="small"
                                                        startIcon={<AddIcon />}
                                                        onClick={() => openAddThemeDialog('department', deptIndex)}
                                                    >
                                                        Add Theme
                                                    </Button>
                                                </Box>

                                                <Collapse in={expandedDepartments.includes(dept.department)}>
                                                    <Divider sx={{ my: 1 }} />
                                                    <List disablePadding>
                                                        {dept.themes.map((theme, themeIndex) => {
                                                            const deptThemeKey = `${dept.department}-${theme.id}`;
                                                            return (
                                                                <ThemeItem
                                                                    key={theme.id}
                                                                    theme={theme}
                                                                    themeIndex={themeIndex}
                                                                    expanded={expandedDeptThemes.includes(deptThemeKey)}
                                                                    onToggle={() => toggleDeptTheme(deptThemeKey)}
                                                                    onAddSubTheme={() => openAddSubThemeDialog(
                                                                        'department', themeIndex, deptIndex
                                                                    )}
                                                                    onEditTheme={() => openEditThemeDialog(
                                                                        'department', themeIndex, theme, deptIndex
                                                                    )}
                                                                    onDeleteTheme={() => handleDeleteTheme(
                                                                        'department', themeIndex, theme.title, deptIndex
                                                                    )}
                                                                    onEditSubTheme={(subIndex, value) =>
                                                                        openEditSubThemeDialog(
                                                                            'department', themeIndex, subIndex, value,
                                                                            deptIndex
                                                                        )
                                                                    }
                                                                    onDeleteSubTheme={(subIndex, value) =>
                                                                        handleDeleteSubTheme(
                                                                            'department', themeIndex, subIndex, value,
                                                                            deptIndex
                                                                        )
                                                                    }
                                                                    chipColor="secondary"
                                                                />
                                                            );
                                                        })}
                                                        {dept.themes.length === 0 && (
                                                            <Typography
                                                                variant="body2"
                                                                color="text.secondary"
                                                                sx={{ fontStyle: 'italic', py: 1 }}
                                                            >
                                                                No themes added yet
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

            {/* Theme Dialog */}
            <Dialog
                open={themeDialogOpen}
                onClose={() => setThemeDialogOpen(false)}
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle>
                    {editingTheme?.themeIndex !== undefined ? 'Edit Theme' : 'Add Theme'}
                </DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        fullWidth
                        label="Theme Title"
                        defaultValue={editingTheme?.theme?.title ?? ''}
                        sx={{ mt: 1 }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                const input = e.target as HTMLInputElement;
                                if (input.value.trim()) {
                                    handleSaveTheme(input.value.trim());
                                }
                            }
                        }}
                        id="theme-title-input"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setThemeDialogOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={() => {
                            const input = document.getElementById(
                                'theme-title-input'
                            ) as HTMLInputElement;
                            if (input?.value.trim()) {
                                handleSaveTheme(input.value.trim());
                            }
                        }}
                    >
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Sub-theme Dialog */}
            <Dialog
                open={subThemeDialogOpen}
                onClose={() => setSubThemeDialogOpen(false)}
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle>
                    {editingSubTheme?.subThemeIndex !== undefined
                        ? 'Edit Sub-theme'
                        : 'Add Sub-theme'}
                </DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        fullWidth
                        label="Sub-theme"
                        defaultValue={editingSubTheme?.value ?? ''}
                        sx={{ mt: 1 }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                const input = e.target as HTMLInputElement;
                                if (input.value.trim()) {
                                    handleSaveSubTheme(input.value.trim());
                                }
                            }
                        }}
                        id="subtheme-input"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSubThemeDialogOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={() => {
                            const input = document.getElementById('subtheme-input') as HTMLInputElement;
                            if (input?.value.trim()) {
                                handleSaveSubTheme(input.value.trim());
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
                        {deleteTarget?.type === 'theme' && (
                            <> This will also delete all its sub-themes.</>
                        )}
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
