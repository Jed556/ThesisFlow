import * as React from 'react';
import {
    Alert, Box, Card, CardContent, Chip, CircularProgress,
    FormControl, InputLabel,
    MenuItem, Select, Stack, Typography, Grid
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { PieChart } from '@mui/x-charts/PieChart';
import { useSession } from '@toolpad/core';
import { Dashboard as DashboardIcon } from '@mui/icons-material';
import { AnimatedPage } from '../components/Animate';
import type { NavigationItem } from '../types/navigation';
import type { Session } from '../types/session';
import type { ThesisData, ThesisStageName } from '../types/thesis';
import type { UserProfile } from '../types/profile';
import { listenTheses } from '../utils/firebase/firestore/thesis';
import { getGroupDepartments, findGroupById } from '../utils/firebase/firestore/groups';
import type { ThesisGroup } from '../types/group';
import { THESIS_STAGE_METADATA, chapterHasStage } from '../utils/thesisStageUtils';
import { onUserProfile } from '../utils/firebase/firestore/user';

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

interface DashboardStats {
    totalTheses: number;
    defenseStageStats: DashboardStageBucket[];
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

/** Extended thesis record with group context for filtering */
interface ThesisWithGroupContext extends ThesisRecord {
    groupId?: string;
    department?: string;
}

const GROUP_FILTER_ALL = 'all';

function DashboardPage(): React.ReactElement {
    const session = useSession<Session>();
    const theme = useTheme();

    const userUid = session?.user?.uid ?? null;
    const userRole = session?.user?.role;

    const [profile, setProfile] = React.useState<UserProfile | null>(null);
    const [theses, setTheses] = React.useState<ThesisWithGroupContext[]>([]);
    const [loadingTheses, setLoadingTheses] = React.useState(true);
    const [thesisError, setThesisError] = React.useState<string | null>(null);
    const [departmentFilter, setDepartmentFilter] = React.useState<string>(GROUP_FILTER_ALL);
    const [departments, setDepartments] = React.useState<string[]>([]);
    const [stageFilter, setStageFilter] = React.useState<'all' | ThesisStageName>('all');
    const [groupMap, setGroupMap] = React.useState<Record<string, ThesisGroup>>({});

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
                setTheses(records as ThesisWithGroupContext[]);
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

    React.useEffect(() => {
        // Load department list for the filter
        let cancelled = false;
        const load = async () => {
            const managed = profile?.departments?.filter(Boolean)
                ?? (profile?.department ? [profile.department] : []);
            try {
                const groupDepartments = await getGroupDepartments().catch(() => []);
                if (cancelled) return;
                const merged = Array.from(
                    new Set([...(managed ?? []), ...(groupDepartments ?? [])])
                ).sort((a, b) => a.localeCompare(b));
                setDepartments(merged);
                if (
                    merged.length &&
                    departmentFilter !== GROUP_FILTER_ALL &&
                    !merged.includes(departmentFilter)
                ) {
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
        const groupIds = Array.from(
            new Set(
                theses
                    .map((t) => t.groupId)
                    .filter((id): id is string => Boolean(id))
            )
        );
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
                    } catch {
                        return [gid, null] as const;
                    }
                }));
                if (cancelled) return;
                const map: Record<string, ThesisGroup> = {};
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

    const filteredTheses = React.useMemo(() => {
        return theses.filter((record) => {
            const group = record.groupId ? groupMap[record.groupId] : undefined;
            const recordDepartment = record.department ?? group?.department ?? '';
            const matchesDepartment =
                departmentFilter === GROUP_FILTER_ALL ||
                departmentFilter === '' ||
                recordDepartment === departmentFilter;
            const matchesStage =
                stageFilter === 'all' ||
                (record.chapters ?? []).some((chapter) =>
                    chapterHasStage(chapter, stageFilter as ThesisStageName)
                );
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

    const defenseStageChartData = React.useMemo(() => (
        stats.defenseStageStats.map((bucket) => ({
            id: bucket.key,
            label: bucket.label,
            value: bucket.value ?? 0,
            color: bucket.color,
        }))
    ), [stats.defenseStageStats]);

    const snapshotMetrics = React.useMemo<SnapshotMetric[]>(() => {
        return [
            { label: 'Active Theses', value: stats.totalTheses, color: primaryColor },
        ];
    }, [primaryColor, stats.totalTheses]);

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
                <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 360,
                }}>
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
                            <Chip
                                label={departmentDisplay}
                                variant="outlined"
                                size="small"
                            />
                        )}
                        {courseDisplay && (
                            <Chip
                                label={courseDisplay}
                                variant="outlined"
                                size="small"
                                color="secondary"
                            />
                        )}
                    </Stack>
                </Box>

                <Grid container spacing={3} alignItems="stretch">
                    <Grid size={{ xs: 12 }}>
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
                                                    <Typography
                                                        variant="body2"
                                                        color="text.secondary"
                                                    >
                                                        {metric.label}
                                                    </Typography>
                                                    <Typography
                                                        variant="h4"
                                                        sx={{ color: metric.color }}
                                                    >
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
                                    <Stack
                                        direction={{ xs: 'column', sm: 'row' }}
                                        spacing={2}
                                        flexWrap="wrap"
                                    >
                                        <FormControl
                                            size="small"
                                            sx={{ minWidth: 220, flex: 1 }}
                                        >
                                            <InputLabel>Department</InputLabel>
                                            <Select
                                                value={departmentFilter}
                                                label="Department"
                                                onChange={(event) =>
                                                    setDepartmentFilter(event.target.value)
                                                }
                                            >
                                                <MenuItem value={GROUP_FILTER_ALL}>
                                                    All Departments
                                                </MenuItem>
                                                {departments.map((dept) => (
                                                    <MenuItem key={dept} value={dept}>
                                                        {dept}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                        <FormControl
                                            size="small"
                                            sx={{ minWidth: 220, flex: 1 }}
                                        >
                                            <InputLabel>Stage</InputLabel>
                                            <Select
                                                value={stageFilter}
                                                label="Stage"
                                                onChange={(event) =>
                                                    setStageFilter(
                                                        event.target.value as 'all' | ThesisStageName
                                                    )
                                                }
                                            >
                                                <MenuItem value="all">All Stages</MenuItem>
                                                {THESIS_STAGE_METADATA.map((meta) => (
                                                    <MenuItem key={meta.value} value={meta.value}>
                                                        {meta.label}
                                                    </MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                    </Stack>
                                </CardContent>
                            </Card>

                            <Card sx={{ borderRadius: 3 }}>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                        Theses by Defense Stage
                                    </Typography>
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                        sx={{ mb: 2 }}
                                    >
                                        Total Theses: {stats.totalTheses}
                                    </Typography>
                                    {defenseStageChartData.some((item) => item.value > 0) ? (
                                        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                                            <PieChart
                                                series={[{
                                                    data: defenseStageChartData,
                                                    highlightScope: {
                                                        fade: 'global',
                                                        highlight: 'item',
                                                    },
                                                    faded: {
                                                        innerRadius: 30,
                                                        additionalRadius: -30,
                                                        color: 'grey',
                                                    },
                                                }]}
                                                width={360}
                                                height={300}
                                                slotProps={{
                                                    legend: {
                                                        position: {
                                                            vertical: 'middle',
                                                            horizontal: 'end',
                                                        },
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
    theses: ThesisWithGroupContext[],
    stageBuckets: DashboardStageBucket[],
): DashboardStats {
    const stageTotals = new Map<DashboardStageKey, number>();
    stageBuckets.forEach((bucket) => {
        stageTotals.set(bucket.key, 0);
    });

    theses.forEach((record) => {
        // Determine stage from the thesis stages array
        const currentStage = record.stages?.[record.stages.length - 1]?.name;
        const stage = deriveDefenseStage(currentStage);
        stageTotals.set(stage, (stageTotals.get(stage) ?? 0) + 1);
    });

    const defenseStageStats = stageBuckets.map((bucket) => ({
        ...bucket,
        value: stageTotals.get(bucket.key) ?? 0,
    }));

    return {
        totalTheses: theses.length,
        defenseStageStats,
    };
}

/**
 * Normalize loosely formatted status labels into dashboard defense stages.
 */
function deriveDefenseStage(status: string | undefined): DashboardStageKey {
    const normalized = (status ?? '').toLowerCase();
    if (normalized.includes('pre-thesis') || normalized.includes('post-proposal')) {
        return 'pre-thesis';
    }
    if (
        normalized.includes('pre') &&
        (normalized.includes('title') || normalized.includes('proposal'))
    ) {
        return 'pre-title';
    }
    if (normalized.includes('final') || normalized.includes('defense')) {
        return 'final-defense';
    }
    if (
        normalized.includes('publish') ||
        normalized.includes('archive') ||
        normalized.includes('complete')
    ) {
        return 'publication';
    }
    return 'in-progress';
}
