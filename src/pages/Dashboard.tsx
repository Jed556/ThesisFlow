import * as React from 'react';
import {
    Alert, Box, Card, CardContent, CardHeader, Chip, CircularProgress, Divider,
    FormControl, InputLabel, LinearProgress, List, ListItem, ListItemText,
    MenuItem, Paper, Select, Skeleton, Stack, Typography, Grid
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { PieChart } from '@mui/x-charts/PieChart';
import { BarChart } from '@mui/x-charts/BarChart';
import { useSession } from '@toolpad/core';
import {
    Block as BlockIcon, CheckCircle as CheckCircleIcon, Dashboard as DashboardIcon, EventAvailable as EventAvailableIcon,
    Notifications as NotificationsIcon, Schedule as ScheduleIcon, Warning as WarningIcon
} from '@mui/icons-material';
import { AnimatedPage } from '../components/Animate';
import type { NavigationItem } from '../types/navigation';
import type { Session } from '../types/session';
import type { ThesisChapter, ThesisData, ThesisStageName } from '../types/thesis';
import type { UserProfile } from '../types/profile';
import type { ScheduleEvent } from '../types/schedule';
import type { GroupNotificationDoc, GroupNotificationEntry } from '../types/notification';
import { listenTheses } from '../utils/firebase/firestore/thesis';
import { getGroupDepartments, findGroupById } from '../utils/firebase/firestore/groups';
import type { ThesisGroup } from '../types/group';
import { THESIS_STAGE_METADATA, chapterHasStage } from '../utils/thesisStageUtils';
import { findUsersByIds, onUserProfile } from '../utils/firebase/firestore/user';
import { listenEventsByThesisIds } from '../utils/firebase/firestore/events';
import { ensureGroupNotificationDocument, listenGroupNotifications } from '../utils/firebase/firestore/groupNotifications';

export const metadata: NavigationItem = {
    group: 'main',
    index: 0,
    title: 'Dashboard',
    segment: 'dashboard',
    icon: <DashboardIcon />,
    requiresLayout: true,
};

type ThesisRecord = ThesisData & { id: string };

type DashboardStageKey = 'pre-title' | 'pre-thesis' | 'final-defense' | 'publication' | 'in-progress';

interface ChapterAggregate extends Record<string, number | string> {
    chapter: string;
    approved: number;
    underReview: number;
    revisionRequired: number;
    notSubmitted: number;
    total: number;
}

interface DashboardStats {
    totalTheses: number;
    totalStudents: number;
    defenseStageStats: DashboardStageBucket[];
    chapterStats: ChapterAggregate[];
}

interface DashboardStageBucket {
    key: DashboardStageKey;
    label: string;
    color: string;
    value?: number;
}

interface SnapshotMetric {
    label: string;
    value: number;
    color: string;
}

interface DashboardUpdate extends GroupNotificationEntry {
    groupId: string;
}

const GROUP_FILTER_ALL = 'all';
const MAX_UPCOMING_EVENTS = 4;
const MAX_RECENT_UPDATES = 5;

function DashboardPage(): React.ReactElement {
    const session = useSession<Session>();
    const theme = useTheme();

    const userUid = session?.user?.uid ?? null;
    const userRole = session?.user?.role;

    const [profile, setProfile] = React.useState<UserProfile | null>(null);
    const [theses, setTheses] = React.useState<ThesisRecord[]>([]);
    const [loadingTheses, setLoadingTheses] = React.useState(true);
    const [thesisError, setThesisError] = React.useState<string | null>(null);
    const [leaderProfiles, setLeaderProfiles] = React.useState<Record<string, UserProfile>>({});
    const [departmentFilter, setDepartmentFilter] = React.useState<string>(GROUP_FILTER_ALL);
    const [departments, setDepartments] = React.useState<string[]>([]);
    const [stageFilter, setStageFilter] = React.useState<'all' | ThesisStageName>('all');
    const [groupMap, setGroupMap] = React.useState<Record<string, any>>({});
    const [upcomingEvents, setUpcomingEvents] = React.useState<ScheduleEvent[]>([]);
    const [eventsLoading, setEventsLoading] = React.useState(false);
    const [groupNotifications, setGroupNotifications] = React.useState<GroupNotificationDoc[]>([]);
    const [notificationsLoading, setNotificationsLoading] = React.useState(false);

    const ensuredGroupNotifications = React.useRef<Set<string>>(new Set());

    const primaryColor = theme.palette.primary.main;
    const secondaryColor = theme.palette.secondary.main;
    const infoColor = theme.palette.info.main;
    const successColor = theme.palette.success.main;
    const warningColor = theme.palette.warning.main;

    React.useEffect(() => {
        if (!userUid) {
            setProfile(null);
            return () => { /* no-op */ };
        }

        const unsubscribe = onUserProfile(userUid, (profileData) => {
            setProfile(profileData);
        });

        return () => {
            unsubscribe();
        };
    }, [userUid]);

    React.useEffect(() => {
        setLoadingTheses(true);
        const unsubscribe = listenTheses({
            onData: (records: ThesisRecord[]) => {
                setTheses(records);
                setLoadingTheses(false);
                setThesisError(null);
            },
            onError: (error: Error) => {
                console.error('Failed to load theses for dashboard:', error);
                setThesisError('Unable to load thesis data right now. Please try again later.');
                setLoadingTheses(false);
            },
        });

        return () => {
            unsubscribe();
        };
    }, []);

    const userThesis = React.useMemo(() => {
        if (userRole !== 'student' || !userUid) {
            return null;
        }

        return theses.find((record) =>
            record.leader === userUid || (Array.isArray(record.members) && record.members.includes(userUid))
        ) ?? null;
    }, [theses, userRole, userUid]);

    const managedTheses = React.useMemo(() => {
        if (!userUid || (userRole !== 'adviser' && userRole !== 'editor')) {
            return [] as ThesisRecord[];
        }

        return theses.filter((record) =>
            (userRole === 'adviser' && record.adviser === userUid) ||
            (userRole === 'editor' && record.editor === userUid)
        );
    }, [theses, userRole, userUid]);

    // NOTE: department and stage filters are used instead of per-group filtering

    React.useEffect(() => {
        if (userRole !== 'adviser' && userRole !== 'editor') {
            setLeaderProfiles({});
            return;
        }

        const leaderIds = managedTheses
            .map((record) => record.leader)
            .filter((uid): uid is string => Boolean(uid));

        if (leaderIds.length === 0) {
            setLeaderProfiles({});
            return;
        }

        let cancelled = false;
        void (async () => {
            try {
                const profiles = await findUsersByIds(Array.from(new Set(leaderIds)));
                if (cancelled) {
                    return;
                }
                const map: Record<string, UserProfile> = {};
                profiles.forEach((entry) => {
                    map[entry.uid] = entry;
                });
                setLeaderProfiles(map);
            } catch (error) {
                if (!cancelled) {
                    console.error('Failed to hydrate leader profiles for dashboard:', error);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [managedTheses, userRole]);

    React.useEffect(() => {
        // Load department list for the filter; combine profile-managed with known group departments
        let cancelled = false;
        const load = async () => {
            const managed = profile?.departments?.filter(Boolean) ?? (profile?.department ? [profile.department] : []);
            try {
                const groupDepartments = await getGroupDepartments().catch(() => []);
                if (cancelled) return;
                const merged = Array.from(
                    new Set([...(managed ?? []), ...(groupDepartments ?? [])])).sort((a, b) => a.localeCompare(b));
                setDepartments(merged);
                if (merged.length && !merged.includes(departmentFilter)) {
                    setDepartmentFilter(merged[0]);
                }
                if (!merged.length) {
                    setDepartmentFilter(GROUP_FILTER_ALL);
                }
            } catch (error) {
                console.error('Failed to load departments for dashboard:', error);
                setDepartments([]);
                setDepartmentFilter(GROUP_FILTER_ALL);
            }
        };
        void load();
        return () => { cancelled = true; };
    }, [profile, departmentFilter]);

    React.useEffect(() => {
        // hydrate group map for theses so we can resolve department from groupId
        const groupIds = Array.from(new Set(theses.map((t) => t.groupId).filter((id): id is string => Boolean(id))));
        if (groupIds.length === 0) {
            setGroupMap({});
            return;
        }
        let cancelled = false;
        const load = async () => {
            try {
                const entries = await Promise.all(groupIds.map(async (gid) => {
                    try {
                        const group = await findGroupById(gid);
                        return [gid, group] as const;
                    } catch (err) {
                        return [gid, null] as const;
                    }
                }));
                if (cancelled) return;
                const map: Record<string, ThesisGroup | null> = {};
                entries.forEach(([gid, group]) => {
                    if (group && gid) {
                        map[gid] = group;
                    }
                });
                setGroupMap(map);
            } catch (error) {
                console.error('Failed to hydrate group map for dashboard:', error);
            }
        };
        void load();
        return () => { cancelled = true; };
    }, [theses]);

    const relevantThesisIds = React.useMemo(() => {
        if (userRole === 'student' && userThesis?.id) {
            return [userThesis.id];
        }

        if ((userRole === 'adviser' || userRole === 'editor') && managedTheses.length > 0) {
            return managedTheses
                .map((record) => record.id)
                .filter((id): id is string => Boolean(id));
        }

        return theses.map((record) => record.id).filter((id): id is string => Boolean(id));
    }, [managedTheses, theses, userRole, userThesis?.id]);

    const relevantGroupIds = React.useMemo(() => {
        if (userRole === 'student' && userThesis?.groupId) {
            return [userThesis.groupId];
        }

        if ((userRole === 'adviser' || userRole === 'editor') && managedTheses.length > 0) {
            return managedTheses
                .map((record) => record.groupId)
                .filter((groupId): groupId is string => Boolean(groupId));
        }

        return theses
            .map((record) => record.groupId)
            .filter((groupId): groupId is string => Boolean(groupId));
    }, [managedTheses, theses, userRole, userThesis?.groupId]);

    React.useEffect(() => {
        const pending = relevantGroupIds.filter((id) => !ensuredGroupNotifications.current.has(id));
        if (pending.length === 0) {
            return;
        }

        pending.forEach((id) => ensuredGroupNotifications.current.add(id));
        void Promise.all(pending.map(async (groupId) => {
            try {
                await ensureGroupNotificationDocument(groupId);
            } catch (error) {
                console.error('Failed to ensure notification document:', error);
            }
        }));
    }, [relevantGroupIds]);

    React.useEffect(() => {
        if (relevantThesisIds.length === 0) {
            setUpcomingEvents([]);
            return;
        }

        setEventsLoading(true);
        const unsubscribe = listenEventsByThesisIds(relevantThesisIds, {
            onData: (records) => {
                setUpcomingEvents(records);
                setEventsLoading(false);
            },
            onError: (error) => {
                console.error('Failed to load events for dashboard:', error);
                setUpcomingEvents([]);
                setEventsLoading(false);
            },
        });

        return () => {
            unsubscribe();
        };
    }, [relevantThesisIds]);

    React.useEffect(() => {
        if (relevantGroupIds.length === 0) {
            setGroupNotifications([]);
            return;
        }

        setNotificationsLoading(true);
        const unsubscribe = listenGroupNotifications(relevantGroupIds, {
            onData: (records) => {
                setGroupNotifications(records);
                setNotificationsLoading(false);
            },
            onError: (error) => {
                console.error('Failed to load group notifications:', error);
                setGroupNotifications([]);
                setNotificationsLoading(false);
            },
        });

        return () => {
            unsubscribe();
        };
    }, [relevantGroupIds]);

    const filteredTheses = React.useMemo(() => {
        return theses.filter((record) => {
            const group = record.groupId ? groupMap[record.groupId] : undefined;
            const recordDepartment = group?.department ?? '';
            const matchesDepartment = departmentFilter === GROUP_FILTER_ALL || departmentFilter === '' || recordDepartment === departmentFilter;
            const matchesStage = stageFilter === 'all' || (record.chapters ?? []).some((chapter) => chapterHasStage(chapter, stageFilter as ThesisStageName));
            return matchesDepartment && matchesStage;
        });
    }, [departmentFilter, stageFilter, theses, groupMap]);

    const defenseStageBuckets = React.useMemo<DashboardStageBucket[]>(() => ([
        { key: 'pre-title', label: 'Pre-Title Defense', color: primaryColor },
        { key: 'pre-thesis', label: 'Pre-Thesis Defense', color: secondaryColor },
        { key: 'final-defense', label: 'Final Defense', color: infoColor },
        { key: 'publication', label: 'Publication / Archive', color: successColor },
        { key: 'in-progress', label: 'In Progress', color: warningColor },
    ]), [infoColor, primaryColor, secondaryColor, successColor, warningColor]);

    const stats = React.useMemo<DashboardStats>(() => {
        return deriveDashboardStats(filteredTheses, defenseStageBuckets);
    }, [defenseStageBuckets, filteredTheses]);

    const chapterStatusColors = React.useMemo(() => ({
        approved: theme.palette.success.main,
        underReview: theme.palette.info.main,
        revisionRequired: theme.palette.warning.main,
        notSubmitted: theme.palette.grey[500],
    }), [theme.palette.grey, theme.palette.info.main, theme.palette.success.main, theme.palette.warning.main]);

    const defenseStageChartData = React.useMemo(() => (
        stats.defenseStageStats.map((bucket) => ({
            id: bucket.key,
            label: bucket.label,
            value: bucket.value ?? 0,
            color: bucket.color,
        }))
    ), [stats.defenseStageStats]);

    const upcomingEventsList = React.useMemo(() => {
        const now = Date.now();
        return upcomingEvents
            .filter((event) => {
                const start = new Date(event.startDate ?? '').getTime();
                return !Number.isNaN(start) && start >= now;
            })
            .sort((a, b) => new Date(a.startDate ?? '').getTime() - new Date(b.startDate ?? '').getTime())
            .slice(0, MAX_UPCOMING_EVENTS);
    }, [upcomingEvents]);

    const recentUpdates = React.useMemo<DashboardUpdate[]>(() => {
        return groupNotifications
            .flatMap((doc) => (doc.notifications ?? []).map((entry) => ({
                ...entry,
                groupId: doc.groupId,
            })))
            .sort((a, b) => {
                const first = new Date(a.createdAt ?? '').getTime();
                const second = new Date(b.createdAt ?? '').getTime();
                return second - first;
            })
            .slice(0, MAX_RECENT_UPDATES);
    }, [groupNotifications]);

    const thesisTitleByGroupId = React.useMemo(() => {
        const map = new Map<string, string>();
        theses.forEach((record) => {
            if (record.groupId) {
                map.set(record.groupId, record.title);
            }
        });
        return map;
    }, [theses]);

    const snapshotMetrics = React.useMemo<SnapshotMetric[]>(() => {
        const managedLabel = userRole === 'student' ? 'My Active Deadlines' : 'Managed Groups';
        const managedValue = userRole === 'student' ? upcomingEventsList.length : managedTheses.length;

        return [
            { label: 'Active Theses', value: stats.totalTheses, color: primaryColor },
            { label: 'Students Covered', value: stats.totalStudents, color: secondaryColor },
            { label: managedLabel, value: managedValue, color: infoColor },
            { label: 'New Updates', value: recentUpdates.length, color: warningColor },
        ];
    }, [
        infoColor,
        managedTheses.length,
        primaryColor,
        recentUpdates.length,
        secondaryColor,
        stats.totalStudents,
        stats.totalTheses,
        upcomingEventsList.length,
        userRole,
        warningColor,
    ]);

    const greetingName = React.useMemo(() => {
        if (profile?.name?.first) {
            return profile.name.first;
        }
        if (session?.user?.name) {
            const [first] = session.user.name.split(' ');
            if (first) {
                return first;
            }
        }
        return 'there';
    }, [profile?.name?.first, session?.user?.name]);

    const roleDisplay = profile?.role ?? userRole ?? 'Contributor';
    const departmentDisplay = profile?.department ?? '';
    const courseDisplay = profile?.course ?? '';

    if (loadingTheses) {
        return (
            <AnimatedPage variant="slideUp">
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 360 }}>
                    <CircularProgress />
                </Box>
            </AnimatedPage>
        );
    }

    if (thesisError) {
        return (
            <AnimatedPage variant="slideUp">
                <Alert severity="error">{thesisError}</Alert>
            </AnimatedPage>
        );
    }

    return (
        <AnimatedPage variant="slideUp">
            <Stack spacing={3}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Typography variant="h3" fontWeight={600}>
                        Hello {greetingName}!
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                        <Chip label={roleDisplay} color="primary" size="small" />
                        {departmentDisplay && (
                            <Chip label={departmentDisplay} variant="outlined" size="small" />
                        )}
                        {courseDisplay && (
                            <Chip label={courseDisplay} variant="outlined" size="small" color="secondary" />
                        )}
                    </Stack>
                </Box>

                {userRole === 'student' && userThesis && (
                    <Card sx={{ borderRadius: 3 }}>
                        <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <Typography variant="h6">My Thesis Progress</Typography>
                            <Typography variant="subtitle1" color="text.secondary">
                                {userThesis.title}
                            </Typography>
                            <Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        Overall Progress
                                    </Typography>
                                    <Typography variant="body2" fontWeight={600}>
                                        {calculateProgress(userThesis.chapters ?? [])}%
                                    </Typography>
                                </Box>
                                <LinearProgress
                                    variant="determinate"
                                    value={calculateProgress(userThesis.chapters ?? [])}
                                    sx={{ height: 8, borderRadius: 4 }}
                                />
                            </Box>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                <Chip label={userThesis.overallStatus} color="primary" size="small" />
                                <Typography variant="body2" color="text.secondary">
                                    Last updated: {formatDateTime(typeof userThesis.lastUpdated === 'string' ? userThesis.lastUpdated : userThesis.lastUpdated?.toISOString())}
                                </Typography>
                            </Stack>
                            <Grid container spacing={1.5}>
                                {(userThesis.chapters ?? []).map((chapter) => {
                                    const statusInfo = getChapterStatusInfo(chapter.status);
                                    return (
                                        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={chapter.id}>
                                            <Paper sx={{
                                                p: 1.5,
                                                borderRadius: 2,
                                                display: 'flex',
                                                gap: 1,
                                                alignItems: 'center',
                                            }}>
                                                <Box sx={{ color: theme.palette[statusInfo.color].main }}>
                                                    {statusInfo.icon}
                                                </Box>
                                                <Box sx={{ minWidth: 0 }}>
                                                    <Typography variant="body2" fontWeight={600} noWrap>
                                                        {chapter.title}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {statusInfo.label}
                                                    </Typography>
                                                </Box>
                                            </Paper>
                                        </Grid>
                                    );
                                })}
                            </Grid>
                        </CardContent>
                    </Card>
                )}

                {(userRole === 'adviser' || userRole === 'editor') && managedTheses.length > 0 && (
                    <Card sx={{ borderRadius: 3 }}>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                {userRole === 'adviser' ? 'Your Advised Groups' : 'Your Assigned Groups'}
                            </Typography>
                            <Grid container spacing={2}>
                                {managedTheses.map((record) => {
                                    const progress = calculateProgress(record.chapters ?? []);
                                    const leaderProfile = record.leader ? leaderProfiles[record.leader] : undefined;
                                    const leaderName = leaderProfile
                                        ? `${leaderProfile.name.first} ${leaderProfile.name.last}`
                                        : record.leader ?? 'Unassigned';
                                    return (
                                        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={record.id}>
                                            <Paper sx={{
                                                p: 2,
                                                borderRadius: 2,
                                                border: '1px solid',
                                                borderColor: 'divider',
                                                height: '100%',
                                            }}>
                                                <Typography variant="subtitle1" fontWeight={600} noWrap>
                                                    {record.title}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                                    Leader: {leaderName}
                                                </Typography>
                                                <Box sx={{ mb: 1 }}>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                                        <Typography variant="caption" color="text.secondary">
                                                            Progress
                                                        </Typography>
                                                        <Typography variant="caption" fontWeight={600}>
                                                            {progress}%
                                                        </Typography>
                                                    </Box>
                                                    <LinearProgress
                                                        variant="determinate"
                                                        value={progress}
                                                        sx={{ height: 6, borderRadius: 3 }}
                                                    />
                                                </Box>
                                                <Chip label={record.overallStatus} color="primary" size="small" />
                                            </Paper>
                                        </Grid>
                                    );
                                })}
                            </Grid>
                        </CardContent>
                    </Card>
                )}

                <Grid container spacing={3} alignItems="stretch">
                    <Grid size={{ xs: 12, lg: 8 }}>
                        <Stack spacing={3} sx={{ height: '100%' }}>
                            <Card sx={{ borderRadius: 3 }}>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                        Program Snapshot
                                    </Typography>
                                    <Grid container spacing={2}>
                                        {snapshotMetrics.map((metric) => (
                                            <Grid size={{ xs: 12, sm: 6 }} key={metric.label}>
                                                <Box sx={{
                                                    p: 2,
                                                    borderRadius: 2,
                                                    border: '1px solid',
                                                    borderColor: 'divider',
                                                }}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        {metric.label}
                                                    </Typography>
                                                    <Typography variant="h4" sx={{ color: metric.color }}>
                                                        {metric.value}
                                                    </Typography>
                                                </Box>
                                            </Grid>
                                        ))}
                                    </Grid>
                                </CardContent>
                            </Card>

                            <Card sx={{ borderRadius: 3 }}>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                        Statistics Filters
                                    </Typography>
                                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} flexWrap="wrap">
                                        <FormControl size="small" sx={{ minWidth: 220, flex: 1 }}>
                                            <InputLabel>Department</InputLabel>
                                            <Select
                                                value={departmentFilter}
                                                label="Department"
                                                onChange={(event) => setDepartmentFilter(event.target.value)}
                                            >
                                                <MenuItem value={GROUP_FILTER_ALL}>All Departments</MenuItem>
                                                {departments.map((dept) => (
                                                    <MenuItem key={dept} value={dept}>
                                                        {dept}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                        <FormControl size="small" sx={{ minWidth: 220, flex: 1 }}>
                                            <InputLabel>Stage</InputLabel>
                                            <Select
                                                value={stageFilter}
                                                label="Stage"
                                                onChange={(event) => setStageFilter(event.target.value)}
                                            >
                                                <MenuItem value="all">All Stages</MenuItem>
                                                {THESIS_STAGE_METADATA.map((meta) => (
                                                    <MenuItem key={meta.value} value={meta.value}>{meta.label}</MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </Stack>
                                </CardContent>
                            </Card>

                            <Grid container spacing={3}>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <Card sx={{ borderRadius: 3, height: '100%' }}>
                                        <CardContent>
                                            <Typography variant="h6" gutterBottom>
                                                Students by Defense Stage
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                                Total Students: {stats.totalStudents} • Total Theses: {stats.totalTheses}
                                            </Typography>
                                            {defenseStageChartData.some((item) => item.value > 0) ? (
                                                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                                                    <PieChart
                                                        series={[{
                                                            data: defenseStageChartData,
                                                            highlightScope: { fade: 'global', highlight: 'item' },
                                                            faded: { innerRadius: 30, additionalRadius: -30, color: 'grey' },
                                                        }]}
                                                        width={360}
                                                        height={300}
                                                        slotProps={{
                                                            legend: {
                                                                position: { vertical: 'middle', horizontal: 'end' },
                                                            },
                                                        }}
                                                    />
                                                </Box>
                                            ) : (
                                                <Box sx={{
                                                    minHeight: 300,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        No data available for current filters
                                                    </Typography>
                                                </Box>
                                            )}
                                        </CardContent>
                                    </Card>
                                </Grid>
                                <Grid size={{ xs: 12, md: 6 }}>
                                    <Card sx={{ borderRadius: 3, height: '100%' }}>
                                        <CardContent>
                                            <Typography variant="h6" gutterBottom>
                                                Chapter Progress by Status
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                                Students per chapter status
                                            </Typography>
                                            {stats.chapterStats.length > 0 ? (
                                                <Box sx={{ width: '100%', minHeight: 300 }}>
                                                    <BarChart
                                                        dataset={stats.chapterStats}
                                                        xAxis={[{ scaleType: 'band', dataKey: 'chapter' }]}
                                                        series={[
                                                            {
                                                                dataKey: 'approved',
                                                                label: 'Approved',
                                                                color: chapterStatusColors.approved,
                                                            },
                                                            {
                                                                dataKey: 'underReview',
                                                                label: 'Under Review',
                                                                color: chapterStatusColors.underReview,
                                                            },
                                                            {
                                                                dataKey: 'revisionRequired',
                                                                label: 'Revision Required',
                                                                color: chapterStatusColors.revisionRequired,
                                                            },
                                                            {
                                                                dataKey: 'notSubmitted',
                                                                label: 'Not Submitted',
                                                                color: chapterStatusColors.notSubmitted,
                                                            },
                                                        ]}
                                                        axisHighlight={{ x: 'none', y: 'none' }}
                                                        width={360}
                                                        height={300}
                                                        slotProps={{
                                                            legend: {
                                                                position: { vertical: 'bottom', horizontal: 'center' },
                                                            },
                                                        }}
                                                    />
                                                </Box>
                                            ) : (
                                                <Box sx={{
                                                    minHeight: 300,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}>
                                                    <Typography variant="body2" color="text.secondary">
                                                        No data available for current filters
                                                    </Typography>
                                                </Box>
                                            )}
                                        </CardContent>
                                    </Card>
                                </Grid>
                            </Grid>
                        </Stack>
                    </Grid>
                    <Grid size={{ xs: 12, lg: 4 }}>
                        <Stack spacing={3} sx={{ height: '100%' }}>
                            <Card sx={{ borderRadius: 3 }}>
                                <CardHeader
                                    avatar={<EventAvailableIcon color="primary" />}
                                    title="Upcoming Events"
                                    subheader="Next milestones"
                                />
                                <CardContent>
                                    {eventsLoading ? (
                                        <Stack spacing={1.5}>
                                            {[0, 1, 2].map((index) => (
                                                <Skeleton key={index} height={32} variant="rounded" />
                                            ))}
                                        </Stack>
                                    ) : upcomingEventsList.length > 0 ? (
                                        <List disablePadding>
                                            {upcomingEventsList.map((event, index) => (
                                                <React.Fragment key={event.id}>
                                                    <ListItem disableGutters sx={{ alignItems: 'flex-start', py: 1 }}>
                                                        <ListItemText
                                                            primary={event.title}
                                                            secondary={`${event.status} • ${formatDateTime(event.startDate)}`}
                                                        />
                                                    </ListItem>
                                                    {index < upcomingEventsList.length - 1 && <Divider component="li" />}
                                                </React.Fragment>
                                            ))}
                                        </List>
                                    ) : (
                                        <Typography variant="body2" color="text.secondary">
                                            No upcoming events for your groups yet.
                                        </Typography>
                                    )}
                                </CardContent>
                            </Card>

                            <Card sx={{ borderRadius: 3 }}>
                                <CardHeader
                                    avatar={<NotificationsIcon color="warning" />}
                                    title="Recent Updates"
                                    subheader="Latest group notifications"
                                />
                                <CardContent>
                                    {notificationsLoading ? (
                                        <Stack spacing={1.5}>
                                            {[0, 1, 2].map((index) => (
                                                <Skeleton key={index} height={32} variant="rounded" />
                                            ))}
                                        </Stack>
                                    ) : recentUpdates.length > 0 ? (
                                        <List disablePadding>
                                            {recentUpdates.map((update, index) => (
                                                <React.Fragment key={update.id}>
                                                    <ListItem disableGutters sx={{ alignItems: 'flex-start', py: 1 }}>
                                                        <ListItemText
                                                            primary={update.title}
                                                            secondary={(
                                                                <Stack spacing={0.5}>
                                                                    <Typography variant="body2" color="text.secondary">
                                                                        {update.message}
                                                                    </Typography>
                                                                    <Typography variant="caption" color="text.secondary">
                                                                        {thesisTitleByGroupId.get(update.groupId) ?? update.groupId}
                                                                        {' '}
                                                                        •
                                                                        {' '}
                                                                        {formatDateTime(update.createdAt)}
                                                                    </Typography>
                                                                </Stack>
                                                            )}
                                                        />
                                                    </ListItem>
                                                    {index < recentUpdates.length - 1 && <Divider component="li" />}
                                                </React.Fragment>
                                            ))}
                                        </List>
                                    ) : (
                                        <Typography variant="body2" color="text.secondary">
                                            No updates have been posted for your groups yet.
                                        </Typography>
                                    )}
                                </CardContent>
                            </Card>
                        </Stack>
                    </Grid>
                </Grid>
            </Stack>
        </AnimatedPage>
    );
}

export default DashboardPage;

/**
 * Aggregate dashboard statistics derived from thesis records.
 */
function deriveDashboardStats(
    theses: ThesisRecord[],
    stageBuckets: DashboardStageBucket[],
): DashboardStats {
    const stageTotals = new Map<DashboardStageKey, number>();
    stageBuckets.forEach((bucket) => {
        stageTotals.set(bucket.key, 0);
    });

    let totalStudents = 0;

    theses.forEach((record) => {
        const stage = deriveDefenseStage(record.overallStatus);
        stageTotals.set(stage, (stageTotals.get(stage) ?? 0) + 1);
        totalStudents += 1 + (record.members?.length ?? 0);
    });

    const defenseStageStats = stageBuckets.map((bucket) => ({
        ...bucket,
        value: stageTotals.get(bucket.key) ?? 0,
    }));

    return {
        totalTheses: theses.length,
        totalStudents,
        defenseStageStats,
        chapterStats: buildChapterAggregates(theses),
    };
}

/**
 * Build aggregate chapter statistics for the stacked bar chart.
 */
function buildChapterAggregates(theses: ThesisRecord[]): ChapterAggregate[] {
    const aggregates = new Map<string, ChapterAggregate>();

    theses.forEach((record) => {
        (record.chapters ?? []).forEach((chapter) => {
            const label = chapter.title || `Chapter ${chapter.id}`;
            if (!aggregates.has(label)) {
                aggregates.set(label, {
                    chapter: label,
                    approved: 0,
                    underReview: 0,
                    revisionRequired: 0,
                    notSubmitted: 0,
                    total: 0,
                });
            }
            const aggregate = aggregates.get(label)!;
            switch (chapter.status) {
                case 'approved':
                    aggregate.approved += 1;
                    break;
                case 'under_review':
                    aggregate.underReview += 1;
                    break;
                case 'revision_required':
                    aggregate.revisionRequired += 1;
                    break;
                default:
                    aggregate.notSubmitted += 1;
                    break;
            }
            aggregate.total += 1;
        });
    });

    return Array.from(aggregates.values()).sort((a, b) => a.chapter.localeCompare(b.chapter));
}

/**
 * Calculate thesis progress percentage based on approved chapters.
 */
function calculateProgress(chapters: ThesisChapter[]): number {
    if (!chapters || chapters.length === 0) {
        return 0;
    }
    const approved = chapters.filter((chapter) => chapter.status === 'approved').length;
    return Math.round((approved / chapters.length) * 100);
}

/**
 * Resolve chapter status display metadata for cards.
 */
function getChapterStatusInfo(
    status: ThesisChapter['status']
): { label: string; icon: React.ReactNode; color: 'success' | 'info' | 'warning' | 'error' } {
    switch (status) {
        case 'approved':
            return { label: 'Approved', icon: <CheckCircleIcon fontSize="small" />, color: 'success' };
        case 'under_review':
            return { label: 'Under Review', icon: <ScheduleIcon fontSize="small" />, color: 'info' };
        case 'revision_required':
            return { label: 'Needs Revision', icon: <WarningIcon fontSize="small" />, color: 'warning' };
        default:
            return { label: 'Not Submitted', icon: <BlockIcon fontSize="small" />, color: 'error' };
    }
}

/**
 * Normalize loosely formatted status labels into dashboard defense stages.
 */
function deriveDefenseStage(status: string | undefined): DashboardStageKey {
    const normalized = (status ?? '').toLowerCase();
    if (normalized.includes('pre-thesis')) {
        return 'pre-thesis';
    }
    if (normalized.includes('pre') && normalized.includes('title')) {
        return 'pre-title';
    }
    if (normalized.includes('final')) {
        return 'final-defense';
    }
    if (normalized.includes('publish') || normalized.includes('archive') || normalized.includes('complete')) {
        return 'publication';
    }
    return 'in-progress';
}

/**
 * Human-readable fallback date formatter for dashboard cards.
 */
function formatDateTime(value: string | undefined): string {
    if (!value) {
        return 'TBD';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }
    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
    }).format(date);
}
