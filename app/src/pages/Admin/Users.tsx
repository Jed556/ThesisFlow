import * as React from 'react';
import { Box, Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Select, MenuItem, Typography } from '@mui/material';
import type { NavigationItem } from '../../types/navigation';
import { useSession } from '../../SessionContext';
import type { UserProfile, UserRole } from '../../types/profile';
import { getAllUsers, setUserProfile } from '../../utils/firestoreUtils';
import { Dialog, DialogTitle, DialogContent, DialogActions, List, ListItem, ListItemText, LinearProgress, FormControl, InputLabel } from '@mui/material';
import { Edit, People, Save, Cancel } from '@mui/icons-material';

export const metadata: NavigationItem = {
    group: 'management',
    index: 0,
    title: 'Users',
    segment: 'user-management',
    icon: <People />,
    roles: ['admin', 'developer'],
};

const ROLE_OPTIONS: UserRole[] = ['student', 'editor', 'adviser', 'admin'];

export default function AdminUsersPage() {
    const { session } = useSession();
    const userRole = session?.user?.role;

    const [users, setUsers] = React.useState<UserProfile[]>([]);
    const [editingId, setEditingId] = React.useState<number | null>(null);
    const [draft, setDraft] = React.useState<Partial<UserProfile>>({});
    const [loading, setLoading] = React.useState(true);
    const [csvImporting, setCsvImporting] = React.useState(false);
    const [csvParsed, setCsvParsed] = React.useState<Partial<UserProfile>[]>([]);
    const [duplicatePairs, setDuplicatePairs] = React.useState<Array<{ existing: UserProfile; incoming: Partial<UserProfile> }>>([]);
    const [previewOpen, setPreviewOpen] = React.useState(false);
    const [applyProgress, setApplyProgress] = React.useState<number | null>(null);

    React.useEffect(() => {
        let mounted = true;
        async function load() {
            setLoading(true);
            try {
                const all = await getAllUsers();
                if (mounted) setUsers(all);
            } catch (err) {
                console.error('Failed to load users', err);
            } finally {
                if (mounted) setLoading(false);
            }
        }
        load();
        return () => { mounted = false; };
    }, []);

    // CSV parsing utility (very small, expects header row)
    function parseCsv(text: string): Partial<UserProfile>[] {
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) return [];
        const headers = lines[0].split(',').map(h => h.trim());
        const rows = lines.slice(1).map(line => {
            const cols = line.split(',').map(c => c.trim());
            const obj: any = {};
            headers.forEach((h, i) => {
                obj[h] = cols[i] ?? '';
            });
            // Map CSV columns to UserProfile partial
            const partial: Partial<UserProfile> = {
                email: obj['email'] || obj['Email'] || '',
                firstName: obj['firstName'] || obj['first_name'] || obj['FirstName'] || obj['first'] || undefined,
                lastName: obj['lastName'] || obj['last_name'] || obj['LastName'] || obj['last'] || undefined,
                role: (obj['role'] || obj['Role']) as UserRole | undefined,
                department: obj['department'] || obj['dept'] || undefined,
                prefix: obj['prefix'] || undefined,
                middleName: obj['middleName'] || undefined,
                suffix: obj['suffix'] || undefined,
                avatar: obj['avatar'] || undefined,
            };
            return partial;
        });
        return rows;
    }

    async function handleCsvFile(file: File | null) {
        if (!file) return;
        setCsvImporting(true);
        try {
            const text = await file.text();
            const parsed = parseCsv(text).filter(r => r.email && r.email.length > 0);
            setCsvParsed(parsed);

            // Detect duplicates by email
            const byEmail = new Map(users.map(u => [u.email.toLowerCase(), u] as const));
            const dups: Array<{ existing: UserProfile; incoming: Partial<UserProfile> }> = [];
            parsed.forEach(incoming => {
                const ex = byEmail.get((incoming.email || '').toLowerCase());
                if (ex) dups.push({ existing: ex, incoming });
            });
            setDuplicatePairs(dups);
            setPreviewOpen(true);
        } catch (err) {
            console.error('Failed to parse CSV', err);
        } finally {
            setCsvImporting(false);
        }
    }

    async function applyCsvChanges(options?: { replaceDuplicates?: boolean }) {
        const toApply = [...csvParsed];
        const total = toApply.length;
        let applied = 0;
        setApplyProgress(0);
        for (const row of toApply) {
            try {
                if (!row.email) continue;
                const email = row.email;
                // If duplicates exist and replaceDuplicates is false, skip those
                const isDup = duplicatePairs.some(d => d.existing.email.toLowerCase() === email.toLowerCase());
                if (isDup && !options?.replaceDuplicates) {
                    applied++;
                    setApplyProgress(Math.round((applied / total) * 100));
                    continue;
                }

                // Build partial to set
                const partial: Partial<UserProfile> = {
                    firstName: row.firstName,
                    lastName: row.lastName,
                    role: row.role as UserRole | undefined,
                    department: row.department,
                    prefix: row.prefix,
                    middleName: row.middleName,
                    suffix: row.suffix,
                    avatar: row.avatar,
                };

                await setUserProfile(email, partial);
                applied++;
                setApplyProgress(Math.round((applied / total) * 100));
            } catch (err) {
                console.error('Failed to apply CSV row', row, err);
            }
        }

        // Refresh users list
        try {
            const all = await getAllUsers();
            setUsers(all);
        } catch (err) {
            console.error('Failed to refresh users', err);
        }

        setApplyProgress(null);
        setPreviewOpen(false);
        setCsvParsed([]);
        setDuplicatePairs([]);
    }


    if (userRole !== 'admin' && userRole !== 'developer') {
        return (
            <Box sx={{ p: 4 }}>
                <Typography variant="h5">Not authorized</Typography>
                <Typography variant="body1">You need to be an administrator or developer to manage users.</Typography>
            </Box>
        );
    }

    function startEdit(user: UserProfile) {
        setEditingId(user.id);
        setDraft({ ...user });
    }

    function cancelEdit() {
        setEditingId(null);
        setDraft({});
    }

    async function saveEdit() {
        if (editingId == null) return;
        // find the user being edited
        const orig = users.find(u => u.id === editingId);
        if (!orig) return;

        const email = draft.email || orig.email;
        // Build partial profile to save
        const toSave: Partial<UserProfile> = {
            firstName: draft.firstName ?? orig.firstName,
            middleName: draft.middleName ?? orig.middleName,
            lastName: draft.lastName ?? orig.lastName,
            prefix: draft.prefix ?? orig.prefix,
            suffix: draft.suffix ?? orig.suffix,
            department: draft.department ?? orig.department,
            role: (draft.role as UserRole) ?? orig.role,
            avatar: draft.avatar ?? orig.avatar,
        };

        try {
            await setUserProfile(email, toSave);
            // Update local UI
            setUsers(prev => prev.map(u => (u.id === editingId ? { ...u, ...toSave } as UserProfile : u)));
            cancelEdit();
        } catch (err) {
            console.error('Failed to save user profile', err);
        }
    }

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>Users</Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
                <Button variant="contained" component="label">Upload CSV<input hidden accept=".csv" type="file" onChange={e => handleCsvFile(e.target.files?.[0] ?? null)} /></Button>
                {csvImporting && <LinearProgress sx={{ flex: 1 }} />}
                <Button variant="outlined" onClick={() => { setPreviewOpen(true); }}>Preview Duplicates ({duplicatePairs.length})</Button>
            </Box>
            <TableContainer component={Paper}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>ID</TableCell>
                            <TableCell>Name</TableCell>
                            <TableCell>Email</TableCell>
                            <TableCell>Role</TableCell>
                            <TableCell>Department</TableCell>
                            <TableCell align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {users.map(user => (
                            <TableRow key={user.id}>
                                <TableCell>{user.id}</TableCell>
                                <TableCell>
                                    {editingId === user.id ? (
                                        <TextField
                                            size="small"
                                            value={draft.firstName ?? ''}
                                            onChange={e => setDraft(d => ({ ...d, firstName: e.target.value }))}
                                            placeholder="First name"
                                        />
                                    ) : (
                                        `${user.firstName} ${user.lastName || ''}`
                                    )}
                                </TableCell>
                                <TableCell>
                                    {editingId === user.id ? (
                                        <TextField
                                            size="small"
                                            value={draft.email ?? user.email}
                                            onChange={e => setDraft(d => ({ ...d, email: e.target.value }))}
                                        />
                                    ) : (
                                        user.email
                                    )}
                                </TableCell>
                                <TableCell>
                                    {editingId === user.id ? (
                                        <Select
                                            size="small"
                                            value={draft.role ?? user.role}
                                            onChange={e => setDraft(d => ({ ...d, role: e.target.value as UserRole }))}
                                        >
                                            {ROLE_OPTIONS.map(r => (
                                                <MenuItem key={r} value={r}>{r}</MenuItem>
                                            ))}
                                        </Select>
                                    ) : (
                                        user.role
                                    )}
                                </TableCell>
                                <TableCell>
                                    {editingId === user.id ? (
                                        <TextField
                                            size="small"
                                            value={draft.department ?? ''}
                                            onChange={e => setDraft(d => ({ ...d, department: e.target.value }))}
                                        />
                                    ) : (
                                        user.department || ''
                                    )}
                                </TableCell>
                                <TableCell align="right">
                                    {editingId === user.id ? (
                                        <>
                                            <Button startIcon={<Save />} size="small" onClick={saveEdit} sx={{ mr: 1 }}>Save</Button>
                                            <Button startIcon={<Cancel />} size="small" onClick={cancelEdit}>Cancel</Button>
                                        </>
                                    ) : (
                                        <Button startIcon={<Edit />} size="small" onClick={() => startEdit(user)}>Edit</Button>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
            <DuplicatesPreviewDialog
                open={previewOpen}
                pairs={duplicatePairs}
                onClose={() => setPreviewOpen(false)}
                onApply={(opts) => applyCsvChanges(opts)}
                progress={applyProgress}
            />
        </Box>
    );
}

// Preview dialog for duplicates and CSV changes
function DuplicatesPreviewDialog(props: {
    open: boolean;
    pairs: Array<{ existing: UserProfile; incoming: Partial<UserProfile> }>;
    onClose: () => void;
    onApply: (opts?: { replaceDuplicates?: boolean }) => void;
    progress: number | null;
}) {
    const { open, pairs, onClose, onApply, progress } = props;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>CSV Import Preview</DialogTitle>
            <DialogContent dividers>
                {pairs.length === 0 ? (
                    <Typography>No duplicates detected. Ready to apply CSV rows.</Typography>
                ) : (
                    <List>
                        {pairs.map((p, i) => (
                            <ListItem key={i} alignItems="flex-start">
                                <ListItemText
                                    primary={`${p.existing.email}`}
                                    secondary={
                                        <>
                                            <Typography component="div">Existing: {p.existing.firstName} {p.existing.lastName} — {p.existing.role} — {p.existing.department}</Typography>
                                            <Typography component="div">Incoming: {p.incoming.firstName || '-'} {p.incoming.lastName || '-'} — {p.incoming.role || '-'} — {p.incoming.department || '-'}</Typography>
                                        </>
                                    }
                                />
                            </ListItem>
                        ))}
                    </List>
                )}
                {progress != null && <Box sx={{ mt: 1 }}><LinearProgress variant="determinate" value={progress} /></Box>}
            </DialogContent>
            <DialogActions>
                <Button onClick={() => onApply({ replaceDuplicates: false })}>Apply (skip duplicates)</Button>
                <Button onClick={() => onApply({ replaceDuplicates: true })} variant="contained">Apply and replace duplicates</Button>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}
