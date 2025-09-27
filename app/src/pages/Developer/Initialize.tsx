import * as React from 'react';
import { Button, Typography, Paper, Box, List, ListItem, ListItemText, Alert } from '@mui/material';
import { firebaseAuth, firebaseFirestore } from '../../firebase/firebaseConfig';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { mockUserProfiles } from '../../data/mockData';
import csvParsers from '../../utils/csvParsers';
import DevConsole from '../../components/DevConsole';

import type { NavigationItem } from '../../types/navigation';
import type { UserProfile } from '../../types/profile';

import { Build } from '@mui/icons-material';

export const metadata: NavigationItem = {
    title: 'Initialize',
    segment: 'initialize',
    icon: <Build />,
    roles: ['admin', 'developer'],
    path: '/dev/init',
};

const DEFAULT_PASSWORD = import.meta.env.VITE_DEFAULT_USER_PASSWORD || 'Pas sword_123';

export default function DevHelperPage() {
    const [logs, setLogs] = React.useState<string[]>([]);
    const [running, setRunning] = React.useState(false);
    // Console is provided by DevConsole component below

    // CSV upload / parsing state (use shared parsers)
    const [csvRows, setCsvRows] = React.useState<UserProfile[]>([]);
    const [csvErrors, setCsvErrors] = React.useState<string[]>([]);

    const handleFile = async (file?: File | null) => {
        if (!file) return;
        try {
            const txt = await file.text();
            const { parsed, errors } = csvParsers.parseUsers(txt);
            setCsvRows(parsed);
            setCsvErrors(errors);
            append(`Loaded CSV with ${parsed.length} parsed users` + (errors.length ? ` — ${errors.length} errors` : ''));
        } catch (e: any) {
            console.error('Failed to read CSV', e);
            setCsvErrors([String(e?.message || e)]);
        }
    };

    const seedFromCsv = async () => {
        if (csvErrors.length > 0) {
            append('CSV parser reported errors; aborting seed');
            return;
        }
        if (csvRows.length === 0) {
            append('No parsed rows to seed');
            setCsvErrors(['No rows to import']);
            return;
        }

        setRunning(true);
        setLogs([]);
        append('Starting CSV seeder');
        for (const p of csvRows) {
            const email = p.email;
            if (!email) continue;
            const password = (p as any).password || DEFAULT_PASSWORD;
            append(`Processing ${email} ...`);

            const authRes = await createAuthUser(email, password as string);
            if (!authRes.ok) {
                append(`ERROR creating auth for ${email}: ${authRes.error}`);
            }

            const profileToWrite: UserProfile = {
                ...p,
                id: Number(p.id) || 0,
                role: p.role || 'student',
            } as UserProfile;

            const writeRes = await writeUserProfile(profileToWrite);
            if (!writeRes.ok) {
                append(`ERROR writing profile for ${email}: ${writeRes.error}`);
            }
        }
        append('CSV Seeder finished');
        setRunning(false);
    };

    // If a previous sign-in redirected here, allow sessionStorage to auto-auth
    React.useEffect(() => {
        try {
            const flag = sessionStorage.getItem('dev-helper-authed');
            if (flag === '1') {
                sessionStorage.removeItem('dev-helper-authed');
            }
        } catch (e) {
            // ignore storage failures
            console.warn('Unable to read sessionStorage for dev-helper', e);
        }
    }, []);

    const append = (msg: string) => setLogs(l => [...l, `${new Date().toISOString()} - ${msg}`]);

    const createAuthUser = async (email: string, password: string) => {
        try {
            await createUserWithEmailAndPassword(firebaseAuth, email, password);
            append(`Auth: created ${email}`);
            // sign out so the created account doesn't remain the active session
            await signOut(firebaseAuth);
            return { ok: true };
        } catch (err: any) {
            // common case: already exists
            const code = err?.code || err?.message || String(err);
            if (code && String(code).includes('auth/email-already-in-use')) {
                append(`Auth: ${email} already exists, skipping creation`);
                return { ok: true, skipped: true };
            }
            append(`Auth: failed to create ${email}: ${code}`);
            return { ok: false, error: String(code) };
        }
    };

    const writeUserProfile = async (profile: UserProfile) => {
        try {
            const id = encodeURIComponent(profile.email || '');
            const ref = doc(firebaseFirestore, 'users', id);
            // Firestore rejects `undefined` values inside objects. Strip undefineds before writing.
            const sanitize = (obj: any): any => {
                if (obj === null || obj === undefined) return obj;
                if (Array.isArray(obj)) return obj.map(sanitize);
                if (typeof obj === 'object') {
                    const out: any = {};
                    for (const [k, v] of Object.entries(obj)) {
                        if (v === undefined) continue; // skip undefined
                        const sv = sanitize(v);
                        if (sv === undefined) continue;
                        out[k] = sv;
                    }
                    return out;
                }
                return obj;
            };

            const safeProfile = sanitize(profile);
            await setDoc(ref, safeProfile, { merge: true });
            append(`Firestore: wrote profile for ${profile.email}`);
            return { ok: true };
        } catch (err: any) {
            append(`Firestore: failed to write profile for ${profile.email}: ${err?.message || String(err)}`);
            return { ok: false, error: String(err) };
        }
    };

    const seedAll = async () => {
        setRunning(true);
        setLogs([]);
        append('Starting seeder using default password in .env');

        const password = DEFAULT_PASSWORD;

        for (const p of mockUserProfiles) {
            const email = p.email;
            if (!email) continue;
            append(`Processing ${email} ...`);

            const authRes = await createAuthUser(email, password);
            if (!authRes.ok) {
                append(`ERROR creating auth for ${email}: ${authRes.error}`);
                // continue to attempt Firestore write anyway
            }

            const profileToWrite: UserProfile = {
                ...p,
                // ensure email field present and role/default fields set
                email: p.email,
                role: p.role || 'student',
            };

            const writeRes = await writeUserProfile(profileToWrite);
            if (!writeRes.ok) {
                append(`ERROR writing profile for ${email}: ${writeRes.error}`);
            }
        }

        append('Seeder finished');
        setRunning(false);
    };

    return (
        <Box sx={{ p: 3 }}>
            <Paper sx={{ p: 2, mb: 2 }} elevation={2}>
                <Typography variant="h6">Database Helper</Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>This page reads Firebase configuration from environment variables and will attempt to create the mock auth accounts and write their profiles to Firestore.</Typography>
                <Alert severity="info" sx={{ mt: 2 }}>
                    Default password used for created accounts: <strong>{DEFAULT_PASSWORD}</strong>
                </Alert>
                <Box sx={{ mt: 2 }}>
                    <Button variant="contained" color="primary" onClick={seedAll} disabled={running}>
                        {running ? 'Running...' : 'Create mock auth & firestore users'}
                    </Button>
                </Box>

                <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>Import users from CSV</Typography>
                    <input
                        aria-label="Upload CSV"
                        type="file"
                        accept="text/csv"
                        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                    />
                    <Box sx={{ mt: 1 }}>
                        <Button variant="outlined" color="secondary" onClick={seedFromCsv} disabled={running || csvRows.length === 0}>
                            Seed from CSV
                        </Button>
                    </Box>
                    {csvErrors.length > 0 && (
                        <Box sx={{ mt: 2 }}>
                            {csvErrors.map((err, i) => (
                                <Alert key={i} severity="error" sx={{ mb: 1 }}>{err}</Alert>
                            ))}
                        </Box>
                    )}
                    {csvRows.length > 0 && (
                        <Box sx={{ mt: 2 }}>
                            <Typography variant="subtitle2">Preview ({csvRows.length} rows)</Typography>
                            <Paper variant="outlined" sx={{ mt: 1, maxHeight: 180, overflow: 'auto' }}>
                                <List dense>
                                    {csvRows.slice(0, 200).map((r, i) => (
                                        <ListItem key={i}><ListItemText primary={`${r.email ?? ''} — ${r.firstName ?? ''} ${r.lastName ?? ''} — role=${r.role ?? ''}`} /></ListItem>
                                    ))}
                                </List>
                            </Paper>
                        </Box>
                    )}
                </Box>
            </Paper>

            {/* Main content spacer so console doesn't overlap */}
            <Box sx={{ height: { xs: 70, md: 90 } }} />

            {/* Reusable DevConsole component */}
            <DevConsole
                logs={logs}
                defaultExpanded={false}
                onClear={() => setLogs([])}
                onSend={(cmd) => {
                    if (cmd.trim().toLowerCase() === 'clear') {
                        setLogs([]);
                        return;
                    }
                    setLogs(l => [...l, `> ${cmd}`]);
                }}
                relativeShowSeconds={true}
            />
        </Box>
    );
}
