import * as React from 'react';
import {
    Alert, Box, Button, Card, CardContent, Chip, Divider, List, ListItem,
    ListItemText, Paper, Skeleton, Stack, Typography, type ChipProps,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { formatDateShort } from '../../utils/dateUtils';
import type { ThesisGroup } from '../../types/group';
import type { ThesisData } from '../../types/thesis';
import type { UserProfile } from '../../types/profile';
import { findGroupById } from '../../utils/firebase/firestore/groups';
import { getUsersByIds } from '../../utils/firebase/firestore/user';
import { findThesisById } from '../../utils/firebase/firestore/thesis';
import Avatar from '../Avatar';
import { GROUP_STATUS_COLORS, formatGroupStatus } from './constants';

export interface GroupViewHeaderContext {
    group: ThesisGroup | null;
    loading: boolean;
    error: string | null;
}

interface GroupViewProps {
    groupId: string;
    headerActions?: React.ReactNode | ((context: GroupViewHeaderContext) => React.ReactNode);
    hint?: string;
    refreshToken?: number;
    backButton?: {
        label?: string;
        onClick: () => void;
    };
}

interface GroupState {
    group: ThesisGroup | null;
    thesis: ThesisData | null;
    profiles: Map<string, UserProfile>;
    loading: boolean;
    error: string | null;
}

interface PersonEntry {
    uid: string;
    label?: string;
    context?: string;
}

const STATUS_COLOR_MAP: Record<ThesisGroup['status'], ChipProps['color']> = {
    ...GROUP_STATUS_COLORS,
    draft: 'default',
    review: 'warning',
    rejected: 'error',
};

function buildUserName(profile?: UserProfile | null, fallback?: string) {
    if (!profile) {
        return fallback ?? 'Unknown user';
    }
    const parts = [
        profile.name?.prefix,
        profile.name?.first,
        profile.name?.middle,
        profile.name?.last,
        profile.name?.suffix,
    ].filter((value): value is string => Boolean(value && value.trim()));
    if (parts.length === 0) {
        return profile.email ?? fallback ?? profile.uid;
    }
    return parts.join(' ');
}

function collectGroupUids(group: ThesisGroup): string[] {
    const registry = new Set<string>();
    const { members } = group;
    if (members.leader) registry.add(members.leader);
    members.members.forEach((uid) => registry.add(uid));
    if (members.adviser) registry.add(members.adviser);
    if (members.editor) registry.add(members.editor);
    if (members.statistician) registry.add(members.statistician);
    members.panels?.forEach((uid) => registry.add(uid));
    group.invites?.forEach((uid) => registry.add(uid));
    group.requests?.forEach((uid) => registry.add(uid));
    return Array.from(registry);
}

function MemberList({ title, entries, profiles }: { title: string; entries: PersonEntry[]; profiles: Map<string, UserProfile>; }) {
    if (entries.length === 0) {
        return null;
    }
    return (
        <Card variant="outlined">
            <CardContent>
                <Typography variant="h6" gutterBottom>{title}</Typography>
                <Divider sx={{ mb: 2 }} />
                <Stack spacing={2}>
                    {entries.map((entry) => {
                        const profile = profiles.get(entry.uid);
                        return (
                            <Stack key={entry.uid} direction="row" spacing={2} alignItems="center">
                                <Avatar uid={entry.uid} size={48} tooltip="full" loading={!profile} editable={false} />
                                <Box sx={{ flex: 1 }}>
                                    <Typography variant="subtitle1" fontWeight={600}>
                                        {buildUserName(profile, entry.label)}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {profile?.email ?? entry.context ?? entry.uid}
                                    </Typography>
                                </Box>
                            </Stack>
                        );
                    })}
                </Stack>
            </CardContent>
        </Card>
    );
}

function InfoList({ title, entries }: { title: string; entries: { label: string; value: React.ReactNode; }[]; }) {
    return (
        <Card variant="outlined">
            <CardContent>
                <Typography variant="h6" gutterBottom>{title}</Typography>
                <Divider sx={{ mb: 2 }} />
                <List disablePadding>
                    {entries.map((entry) => (
                        <ListItem key={entry.label} sx={{ px: 0, py: 1 }}>
                            <ListItemText
                                primary={(
                                    <Typography variant="body2" color="text.secondary">
                                        {entry.label}
                                    </Typography>
                                )}
                                secondary={(
                                    <Typography variant="body1" fontWeight={500}>
                                        {entry.value}
                                    </Typography>
                                )}
                            />
                        </ListItem>
                    ))}
                </List>
            </CardContent>
        </Card>
    );
}

async function fetchGroupState(groupId: string, signal: AbortSignal): Promise<Omit<GroupState, 'loading'>> {
    if (!groupId) {
        return { group: null, thesis: null, profiles: new Map(), error: 'Missing group ID.' };
    }
    const group = await findGroupById(groupId);
    if (!group) {
        return { group: null, thesis: null, profiles: new Map(), error: 'Group not found.' };
    }
    if (signal.aborted) {
        return { group: null, thesis: null, profiles: new Map(), error: null };
    }
    const profileIds = collectGroupUids(group);
    const [profiles, thesisRecord] = await Promise.all([
        profileIds.length > 0
            ? getUsersByIds(profileIds)
            : Promise.resolve<UserProfile[]>([]),
        // Thesis is now embedded in group, but fetch fresh if id exists
        group.thesis?.id
            ? findThesisById(group.thesis.id)
                .then((result) => (result ? { ...result, id: result.id ?? group.thesis?.id } : group.thesis ?? null))
                .catch((error) => {
                    console.error(`Failed to load thesis ${group.thesis?.id} for group ${group.id}:`, error);
                    return group.thesis ?? null;
                })
            : Promise.resolve(group.thesis ?? null),
    ]);
    if (signal.aborted) {
        return { group: null, thesis: null, profiles: new Map(), error: null };
    }
    return {
        group,
        thesis: thesisRecord,
        profiles: new Map(profiles.map((profile) => [profile.uid, profile])),
        error: null,
    };
}

export function GroupView({ groupId, headerActions, hint, refreshToken, backButton }: GroupViewProps) {
    const [state, setState] = React.useState<GroupState>(() => ({
        group: null,
        thesis: null,
        profiles: new Map(),
        loading: true,
        error: null,
    }));

    React.useEffect(() => {
        const abort = new AbortController();
        setState((prev) => ({ ...prev, loading: true, error: null }));
        void fetchGroupState(groupId, abort.signal)
            .then((next) => {
                if (abort.signal.aborted) {
                    return;
                }
                setState({ ...next, loading: false });
            })
            .catch((error) => {
                if (abort.signal.aborted) {
                    return;
                }
                console.error('Failed to load group details:', error);
                setState({ group: null, thesis: null, profiles: new Map(), loading: false, error: 'Unable to load group details.' });
            });
        return () => abort.abort();
    }, [groupId, refreshToken]);

    if (!groupId) {
        return <Alert severity="warning">A group ID is required to load this page.</Alert>;
    }

    if (state.loading) {
        return <GroupViewSkeleton />;
    }

    if (state.error) {
        return <Alert severity="error">{state.error}</Alert>;
    }

    if (!state.group) {
        return <Alert severity="info">Group not found.</Alert>;
    }

    const { group, thesis, profiles } = state;
    const resolvedHeaderActions = typeof headerActions === 'function'
        ? headerActions({ group, loading: state.loading, error: state.error })
        : headerActions;
    const thesisTitle = thesis?.title ?? group.thesis?.title ?? '—';
    const thesisIdDisplay = group.thesis?.id ?? thesis?.id ?? '—';
    // Compute thesis status from the latest stage or use group status as fallback
    const thesisStatus = thesis?.stages?.[thesis.stages.length - 1]?.name ?? '—';
    const statusColor = STATUS_COLOR_MAP[group.status] ?? 'default';
    const metadataItems = [
        { label: 'Group ID', value: group.id },
        { label: 'Department', value: group.department || '—' },
        { label: 'Course', value: group.course || '—' },
        { label: 'Status', value: <Chip label={formatGroupStatus(group.status)} color={statusColor} size="small" /> },
        { label: 'Created', value: formatDateShort(group.createdAt) },
        { label: 'Updated', value: formatDateShort(group.updatedAt) },
    ];

    const thesisItems = [
        { label: 'Thesis ID', value: thesisIdDisplay },
        { label: 'Thesis Title', value: thesisTitle },
        { label: 'Thesis Status', value: thesisStatus },
        { label: 'Description', value: group.description || 'No description provided.' },
    ];

    const leaderEntry: PersonEntry[] = group.members.leader
        ? [{ uid: group.members.leader, label: 'Group Leader' }]
        : [];
    const memberEntries: PersonEntry[] = group.members.members.map((uid, index) => ({
        uid,
        label: `Member ${index + 1}`,
    }));

    const mentorEntries: PersonEntry[] = [];
    if (group.members.adviser) {
        mentorEntries.push({ uid: group.members.adviser, label: 'Adviser' });
    }
    if (group.members.editor) {
        mentorEntries.push({ uid: group.members.editor, label: 'Editor' });
    }
    if (group.members.statistician) {
        mentorEntries.push({ uid: group.members.statistician, label: 'Statistician' });
    }

    const panelEntries: PersonEntry[] = (group.members.panels ?? []).map((uid, index) => ({
        uid,
        label: `Panel ${index + 1}`,
    }));

    const inviteEntries: PersonEntry[] = (group.invites ?? []).map((uid) => ({ uid, label: 'Invite Pending' }));
    const requestEntries: PersonEntry[] = (group.requests ?? []).map((uid) => ({ uid, label: 'Join Request' }));

    return (
        <Stack spacing={3}>
            <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }}>
                    <Box sx={{ flex: 1 }}>
                        <Stack spacing={1}>
                            {backButton ? (
                                <Button
                                    variant="text"
                                    color="inherit"
                                    startIcon={<ArrowBackIcon />}
                                    onClick={backButton.onClick}
                                    sx={{ alignSelf: 'flex-start', mb: 1, color: 'text.secondary' }}
                                >
                                    {backButton.label ?? 'Back'}
                                </Button>
                            ) : null}
                            <Typography variant="h4">
                                {group.name}
                            </Typography>
                        </Stack>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                            <Chip label={formatGroupStatus(group.status)} color={statusColor} size="small" />
                            {group.department && (
                                <Chip label={group.department} size="small" variant="outlined" />
                            )}
                            {group.course && (
                                <Chip label={group.course} size="small" variant="outlined" />
                            )}
                        </Stack>
                        {hint ? (
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                {hint}
                            </Typography>
                        ) : null}
                    </Box>
                    {resolvedHeaderActions ? (
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {resolvedHeaderActions}
                        </Box>
                    ) : null}
                </Stack>
            </Paper>

            <Box
                sx={{
                    display: 'grid',
                    gap: 2,
                    gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
                }}
            >
                <InfoList title="Group Summary" entries={thesisItems} />
                <InfoList title="Metadata" entries={metadataItems} />
                <MemberList title="Leader" entries={leaderEntry} profiles={profiles} />
                <MemberList title="Members" entries={memberEntries} profiles={profiles} />
                <MemberList title="Assigned Mentors" entries={mentorEntries} profiles={profiles} />
                <MemberList title="Panel Members" entries={panelEntries} profiles={profiles} />
                <MemberList title="Pending Invites" entries={inviteEntries} profiles={profiles} />
                <MemberList title="Join Requests" entries={requestEntries} profiles={profiles} />
            </Box>
        </Stack>
    );
}

export function GroupViewSkeleton() {
    return (
        <Stack spacing={3}>
            <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
                <Skeleton variant="text" width="40%" height={40} />
                <Skeleton variant="text" width="60%" />
            </Paper>
            <Box
                sx={{
                    display: 'grid',
                    gap: 2,
                    gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
                }}
            >
                {Array.from({ length: 6 }).map((_, index) => (
                    <Card variant="outlined" key={index}>
                        <CardContent>
                            <Skeleton variant="text" width="50%" />
                            <Skeleton variant="text" width="80%" />
                            <Skeleton variant="rectangular" height={80} sx={{ mt: 2 }} />
                        </CardContent>
                    </Card>
                ))}
            </Box>
        </Stack>
    );
}

export default GroupView;
