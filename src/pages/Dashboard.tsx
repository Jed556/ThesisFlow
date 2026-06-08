import * as React from 'react';
import {
    Alert, Box, Card, CardContent, Chip, Collapse, FormControl, IconButton, InputLabel, MenuItem,
    Select, Stack, Typography, Grid, Skeleton, ToggleButton, ToggleButtonGroup
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { PieChart } from '@mui/x-charts/PieChart';
import { BarChart } from '@mui/x-charts/BarChart';
import { LineChart } from '@mui/x-charts/LineChart';
import { useSession } from '@toolpad/core';
import { Dashboard as DashboardIcon, ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon } from '@mui/icons-material';
import { AnimatedPage } from '../components/Animate';
import { DepartmentCourseFilter, SelectFilter } from '../components/Filters';
import type { NavigationItem } from '../types/navigation';
import type { Session } from '../types/session';
import type { ThesisStageName, AgendaType } from '../types/thesis';
import { SDG_VALUES, ESG_VALUES } from '../types/thesis';
import type { UserProfile } from '../types/profile';
import { listenTheses, type ThesisWithGroupContext, type ThesisRecord } from '../utils/firebase/firestore/thesis';
import { findGroupById } from '../utils/firebase/firestore/groups';
import { getUserDepartments, getUserCoursesByDepartment } from '../utils/firebase/firestore/user';
import type { ThesisGroup } from '../types/group';
import { THESIS_STAGE_METADATA, deriveCurrentStage } from '../utils/thesisStageUtils';
import { onUserProfile } from '../utils/firebase/firestore/user';
import { devLog, devError } from '../utils/devUtils';
import {
    getFullAgendasData, type FullAgendasData, type FullDepartmentAgenda, type FullAgendaItem
} from '../utils/firebase/firestore/agendas';
import { DEFAULT_YEAR } from '../config/firestore';

export const metadata: NavigationItem = {
    group: 'main',
    index: 0,
    title: 'Dashboard',
    segment: 'dashboard',
    icon: <DashboardIcon />,
    requiresLayout: true,
};

interface DashboardStats {
    totalTheses: number;
    stageStats: StageBucket[];
}

interface StageBucket {
    key: ThesisStageName;
    label: string;
    color: string;
    value: number;
}

/** Generic chart bucket for dynamic legends */
interface ChartBucket {
    id: string;
    label: string;
    value: number;
    color: string;
}

interface SnapshotMetric {
    label: string;
    value: number;
    color: string;
}

const FILTER_ALL = 'all';

const SDG_COLORS: Record<string, string> = {
    'No Poverty': '#E5243B',
    'Zero Hunger': '#DDA63A',
    'Good Health and Well-being': '#4C9F38',
    'Quality Education': '#C5192D',
    'Gender Equality': '#FF3A21',
    'Clean Water and Sanitation': '#26BDE2',
    'Affordable and Clean Energy': '#FCC30B',
    'Decent Work and Economic Growth': '#A21942',
    'Industry, Innovation and Infrastructure': '#FD6925',
    'Reduced Inequalities': '#DD1367',
    'Sustainable Cities and Communities': '#FD9D24',
    'Responsible Consumption and Production': '#BF8B2E',
    'Climate Action': '#3F7E44',
    'Life Below Water': '#0A97D9',
    'Life on Land': '#56C02B',
    'Peace, Justice and Strong Institutions': '#00689D',
    'Partnerships for the Goals': '#19486A',
};

const ESG_COLORS: Record<string, string> = {
    Environment: '#00AD53',
    Social: '#F78F2D',
    Governance: '#009BD8',
};

/**
 * Dashboard page component displaying thesis statistics and filters.
 */
function DashboardPage(): React.ReactElement {
    const session = useSession<Session>();
    const theme = useTheme();

    const userUid = session?.user?.uid ?? null;
    const userRole = session?.user?.role;

    const [profile, setProfile] = React.useState<UserProfile | null>(null);
    const [theses, setTheses] = React.useState<ThesisWithGroupContext[]>([]);
    const [loadingTheses, setLoadingTheses] = React.useState(true);
    const [thesisError, setThesisError] = React.useState<string | null>(null);
    const [groupMap, setGroupMap] = React.useState<Record<string, ThesisGroup>>({});

    // Agendas data from Firestore
    const [agendasData, setAgendasData] = React.useState<FullAgendasData | null>(null);
    const [loadingAgendas, setLoadingAgendas] = React.useState(true);

    // Filter states
    const [departmentFilter, setDepartmentFilter] = React.useState<string>(FILTER_ALL);
    const [courseFilter, setCourseFilter] = React.useState<string>(FILTER_ALL);
    const [stageFilter, _setStageFilter] = React.useState<string>(FILTER_ALL);
    const [sdgFilter, setSdgFilter] = React.useState<string>(FILTER_ALL);
    const [esgFilter, setEsgFilter] = React.useState<string>(FILTER_ALL);

    // Trend chart state
    const [trendGrouping, setTrendGrouping] = React.useState<'monthly' | 'yearly'>('monthly');

    // Agenda filter states
    const [agendaType, setAgendaType] = React.useState<AgendaType>('institutional');
    const [agendaDepartment, setAgendaDepartment] = React.useState<string>(FILTER_ALL);
    const [agendaPath, setAgendaPath] = React.useState<string[]>([]);

    // Filter options
    const [departments, setDepartments] = React.useState<string[]>([]);
    const [courses, setCourses] = React.useState<string[]>([]);

    // Filter visibility state (default collapsed)
    const [filtersExpanded, setFiltersExpanded] = React.useState(false);

    // Theme colors for charts
    const primaryColor = theme.palette.primary.main;
    const secondaryColor = theme.palette.secondary.main;
    const infoColor = theme.palette.info.main;
    const successColor = theme.palette.success.main;

    // ========================================================================
    // Effects
    // ========================================================================

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

    // Load agendas from Firestore
    React.useEffect(() => {
        let cancelled = false;
        const loadAgendas = async () => {
            try {
                setLoadingAgendas(true);
                const data = await getFullAgendasData(DEFAULT_YEAR);
                if (!cancelled) {
                    setAgendasData(data);
                    setLoadingAgendas(false);
                }
            } catch (error) {
                devError('[Dashboard] Failed to load agendas:', error);
                console.error('Failed to load agendas:', error);
                if (!cancelled) {
                    setLoadingAgendas(false);
                }
            }
        };
        void loadAgendas();
        return () => { cancelled = true; };
    }, []);

    React.useEffect(() => {
        devLog('[Dashboard] Setting up thesis listener');
        setLoadingTheses(true);
        const unsubscribe = listenTheses({
            onData: (records: ThesisRecord[]) => {
                devLog('[Dashboard] Received thesis records:', records.length);
                devLog('[Dashboard] Sample thesis records:', records.slice(0, 3).map(r => ({
                    id: r.id,
                    title: r.title,
                    groupId: (r as ThesisWithGroupContext).groupId,
                    department: (r as ThesisWithGroupContext).department,
                    course: (r as ThesisWithGroupContext).course,
                    agenda: (r as ThesisWithGroupContext).agenda,
                    ESG: (r as ThesisWithGroupContext).ESG,
                    SDG: (r as ThesisWithGroupContext).SDG,
                    stagesCount: r.stages?.length ?? 0,
                    lastStageName: r.stages?.[r.stages.length - 1]?.name,
                })));
                setTheses(records as ThesisWithGroupContext[]);
                setLoadingTheses(false);
                setThesisError(null);
            },
            onError: (error: Error) => {
                devError('[Dashboard] Failed to load theses:', error);
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
        // Load department list for filters
        let cancelled = false;
        const load = async () => {
            const managed = profile?.departments?.filter(Boolean)
                ?? (profile?.department ? [profile.department] : []);
            try {
                const userDepartments = await getUserDepartments().catch(() => []);
                if (cancelled) return;

                // Merge departments
                const mergedDepartments = Array.from(
                    new Set([...(managed ?? []), ...(userDepartments ?? [])])
                ).sort((a, b) => a.localeCompare(b));
                setDepartments(mergedDepartments);

                // Reset department filter if current value is not in the list
                if (
                    mergedDepartments.length &&
                    departmentFilter !== FILTER_ALL &&
                    !mergedDepartments.includes(departmentFilter)
                ) {
                    setDepartmentFilter(FILTER_ALL);
                }
            } catch (error) {
                console.error('Failed to load departments for dashboard:', error);
                setDepartments([]);
            }
        };
        void load();
        return () => { cancelled = true; };
    }, [profile, departmentFilter]);

    // Load courses based on selected department
    React.useEffect(() => {
        let cancelled = false;
        const load = async () => {
            // When "All Departments" is selected, disable course filter
            if (departmentFilter === FILTER_ALL) {
                setCourses([]);
                setCourseFilter(FILTER_ALL);
                return;
            }

            try {
                const deptCourses = await getUserCoursesByDepartment(departmentFilter)
                    .catch((): string[] => []);
                if (cancelled) return;

                setCourses(deptCourses);

                // Reset course filter if current value is not in the list
                if (
                    deptCourses.length &&
                    courseFilter !== FILTER_ALL &&
                    !deptCourses.includes(courseFilter)
                ) {
                    setCourseFilter(FILTER_ALL);
                }
            } catch (error) {
                console.error('Failed to load courses for dashboard:', error);
                setCourses([]);
            }
        };
        void load();
        return () => { cancelled = true; };
    }, [departmentFilter, courseFilter]);

    React.useEffect(() => {
        // Hydrate group map for theses to resolve department/course from groupId
        const groupIds = Array.from(
            new Set(
                theses
                    .map((t) => t.groupId)
                    .filter((id): id is string => Boolean(id))
            )
        );
        devLog('[Dashboard] Hydrating group map for groupIds:', groupIds);
        if (groupIds.length === 0) {
            devLog('[Dashboard] No groupIds found in theses, skipping group hydration');
            setGroupMap({});
            return;
        }
        let cancelled = false;
        const load = async () => {
            try {
                const entries = await Promise.all(groupIds.map(async (gid) => {
                    try {
                        const group = await findGroupById(gid);
                        devLog('[Dashboard] Found group for', gid, ':', group ? {
                            id: group.id,
                            name: group.name,
                            department: group.department,
                            course: group.course,
                        } : null);
                        return [gid, group] as const;
                    } catch (err) {
                        devError('[Dashboard] Error finding group', gid, ':', err);
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
                devLog('[Dashboard] Group map hydrated:', Object.keys(map).length, 'groups');
                setGroupMap(map);
            } catch (error) {
                devError('[Dashboard] Failed to hydrate group map:', error);
                console.error('Failed to hydrate group map for dashboard:', error);
            }
        };
        void load();
        return () => { cancelled = true; };
    }, [theses]);

    // ========================================================================
    // Memoized Values
    // ========================================================================

    const filteredTheses = React.useMemo(() => {
        devLog('[Dashboard] Filtering theses with filters:', {
            departmentFilter,
            courseFilter,
            stageFilter,
            sdgFilter,
            esgFilter,
            agendaType,
            agendaDepartment,
            agendaPath,
            totalTheses: theses.length,
            groupMapSize: Object.keys(groupMap).length,
        });

        const result = theses.filter((record) => {
            const group = record.groupId ? groupMap[record.groupId] : undefined;
            // Prioritize group's human-readable department/course over path-extracted (sanitized) values
            const recordDepartment = group?.department ?? record.department ?? '';
            const recordCourse = group?.course ?? record.course ?? '';

            // Log first record's resolution for debugging
            if (theses.indexOf(record) === 0) {
                devLog('[Dashboard] Filter value resolution for first record:', {
                    thesisId: record.id,
                    groupId: record.groupId,
                    hasGroup: !!group,
                    pathDepartment: record.department,
                    groupDepartment: group?.department,
                    resolvedDepartment: recordDepartment,
                    pathCourse: record.course,
                    groupCourse: group?.course,
                    resolvedCourse: recordCourse,
                    // Stage debugging
                    stagesArray: record.stages,
                    stagesLength: record.stages?.length,
                    lastStage: record.stages?.[record.stages.length - 1],
                    lastStageName: record.stages?.[record.stages.length - 1]?.name,
                    stageFilter,
                });
            }

            // Department filter
            const matchesDepartment =
                departmentFilter === FILTER_ALL || recordDepartment === departmentFilter;

            // Course filter
            const matchesCourse =
                courseFilter === FILTER_ALL || recordCourse === courseFilter;

            // Stage filter - derive current stage from thesis data (stages array or chapters)
            const currentStageName = deriveCurrentStage(record);
            const matchesStage =
                stageFilter === FILTER_ALL || currentStageName === stageFilter;

            // Log stage derivation for first record
            if (theses.indexOf(record) === 0) {
                devLog('[Dashboard] Stage derivation for first record:', {
                    thesisId: record.id,
                    stagesArray: record.stages,
                    derivedStage: currentStageName,
                    stageFilter,
                    matchesStage,
                });
            }

            // SDG filter
            const matchesSdg =
                sdgFilter === FILTER_ALL || record.SDG === sdgFilter;

            // ESG filter
            const matchesEsg =
                esgFilter === FILTER_ALL || record.ESG === esgFilter;

            // Agenda filter - match based on agenda type and path
            let matchesAgenda = true;
            if (agendaPath.length > 0) {
                // Check if thesis agenda type matches
                if (record.agenda?.type !== agendaType) {
                    matchesAgenda = false;
                } else {
                    // For departmental, also check department
                    if (agendaType === 'departmental' && agendaDepartment !== FILTER_ALL) {
                        if (record.agenda?.department !== agendaDepartment) {
                            matchesAgenda = false;
                        }
                    }
                    // Check if the thesis agendaPath matches our filter path
                    if (matchesAgenda && record.agenda?.agendaPath) {
                        for (let i = 0; i < agendaPath.length; i++) {
                            if (record.agenda.agendaPath[i] !== agendaPath[i]) {
                                matchesAgenda = false;
                                break;
                            }
                        }
                    }
                }
            }

            return matchesDepartment && matchesCourse && matchesStage &&
                matchesSdg && matchesEsg && matchesAgenda;
        });

        devLog('[Dashboard] Filtered theses result:', result.length, 'of', theses.length);
        return result;
    }, [
        departmentFilter, courseFilter, stageFilter,
        sdgFilter, esgFilter, agendaType, agendaDepartment, agendaPath, theses, groupMap
    ]);

    const stageBuckets = React.useMemo<StageBucket[]>(() => {
        const colors = [primaryColor, secondaryColor, infoColor, successColor];
        return THESIS_STAGE_METADATA.map((meta, index) => ({
            key: meta.value,
            label: meta.label,
            color: colors[index % colors.length],
            value: 0,
        }));
    }, [primaryColor, secondaryColor, infoColor, successColor]);

    const stats = React.useMemo<DashboardStats>(() => {
        return deriveDashboardStats(filteredTheses, stageBuckets);
    }, [stageBuckets, filteredTheses]);

    /**
     * Generate chart colors dynamically
     */
    const generateChartColors = React.useCallback((count: number): string[] => {
        const baseColors = [
            primaryColor, secondaryColor, infoColor, successColor,
            theme.palette.warning.main, theme.palette.error.main,
            theme.palette.tertiary?.main ?? '#7c4dff',
        ];
        const colors: string[] = [];
        for (let i = 0; i < count; i++) {
            colors.push(baseColors[i % baseColors.length]);
        }
        return colors;
    }, [primaryColor, secondaryColor, infoColor, successColor, theme.palette]);

    /**
     * Dynamic chart data based on filter state:
     * - No filter: Show departments
     * - Department selected: Show courses
     * - Course selected: Show groups
     */
    const dynamicChartData = React.useMemo<ChartBucket[]>(() => {
        if (courseFilter !== FILTER_ALL) {
            // Course is selected -> show groups
            const groupCounts = new Map<string, { name: string; count: number }>();
            filteredTheses.forEach((thesis) => {
                if (thesis.groupId) {
                    const group = groupMap[thesis.groupId];
                    const groupName = group?.name ?? thesis.groupId;
                    const existing = groupCounts.get(thesis.groupId);
                    if (existing) {
                        existing.count++;
                    } else {
                        groupCounts.set(thesis.groupId, { name: groupName, count: 1 });
                    }
                }
            });
            const entries = Array.from(groupCounts.entries());
            const colors = generateChartColors(entries.length);
            return entries.map(([id, data], index) => ({
                id,
                label: data.name,
                value: data.count,
                color: colors[index],
            }));
        } else if (departmentFilter !== FILTER_ALL) {
            // Department is selected -> show courses
            const courseCounts = new Map<string, number>();
            filteredTheses.forEach((thesis) => {
                const group = thesis.groupId ? groupMap[thesis.groupId] : undefined;
                const thesisCourse = group?.course ?? thesis.course ?? 'Unknown';
                courseCounts.set(thesisCourse, (courseCounts.get(thesisCourse) ?? 0) + 1);
            });
            const entries = Array.from(courseCounts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
            const colors = generateChartColors(entries.length);
            return entries.map(([course, count], index) => ({
                id: course,
                label: course,
                value: count,
                color: colors[index],
            }));
        } else {
            // No filter -> show departments
            const deptCounts = new Map<string, number>();
            filteredTheses.forEach((thesis) => {
                const group = thesis.groupId ? groupMap[thesis.groupId] : undefined;
                const thesisDept = group?.department ?? thesis.department ?? 'Unknown';
                deptCounts.set(thesisDept, (deptCounts.get(thesisDept) ?? 0) + 1);
            });
            const entries = Array.from(deptCounts.entries()).sort((a, b) => a[0].localeCompare(b[0]));
            const colors = generateChartColors(entries.length);
            return entries.map(([dept, count], index) => ({
                id: dept,
                label: dept,
                value: count,
                color: colors[index],
            }));
        }
    }, [filteredTheses, departmentFilter, courseFilter, groupMap, generateChartColors]);

    /**
     * Chart title based on current filter state
     */
    const chartTitle = React.useMemo(() => {
        if (courseFilter !== FILTER_ALL) {
            return 'Theses by Group';
        } else if (departmentFilter !== FILTER_ALL) {
            return 'Theses by Course';
        }
        return 'Theses by Department';
    }, [departmentFilter, courseFilter]);

    const snapshotMetrics = React.useMemo<SnapshotMetric[]>(() => {
        // Show metrics for each stage count
        const stageMetrics = stats.stageStats.map((bucket) => ({
            label: bucket.label,
            value: bucket.value,
            color: bucket.color,
        }));

        return [
            { label: 'Total Theses', value: stats.totalTheses, color: primaryColor },
            ...stageMetrics,
        ];
    }, [primaryColor, stats.totalTheses, stats.stageStats]);

    const sdgData = React.useMemo(() => {
        const counts = new Map<string, number>();
        filteredTheses.forEach((t) => {
            if (t.SDG) {
                counts.set(t.SDG, (counts.get(t.SDG) ?? 0) + 1);
            }
        });
        return Array.from(counts.entries())
            .map(([label, value]) => ({
                id: label,
                label,
                value,
                color: SDG_COLORS[label] || primaryColor,
            }))
            .sort((a, b) => b.value - a.value); // Sort by count descending
    }, [filteredTheses, primaryColor]);

    const esgData = React.useMemo(() => {
        const counts = new Map<string, number>();
        filteredTheses.forEach((t) => {
            if (t.ESG) {
                counts.set(t.ESG, (counts.get(t.ESG) ?? 0) + 1);
            }
        });
        return Array.from(counts.entries())
            .map(([label, value]) => ({
                id: label,
                label,
                value,
                color: ESG_COLORS[label] || secondaryColor,
            }))
            .sort((a, b) => b.value - a.value);
    }, [filteredTheses, secondaryColor]);

    const agendaData = React.useMemo(() => {
        const counts = new Map<string, number>();
        filteredTheses.forEach((t) => {
            const agendaVal = t.agenda?.agendaPath?.[0] || t.agenda?.type || 'No Agenda';
            counts.set(agendaVal, (counts.get(agendaVal) ?? 0) + 1);
        });
        const entries = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
        const colors = generateChartColors(entries.length);
        return entries.map(([label, value], index) => ({
            id: label,
            label,
            value,
            color: colors[index],
        }));
    }, [filteredTheses, generateChartColors]);

    const trendData = React.useMemo(() => {
        const counts = new Map<string, number>();

        // Sort theses chronologically
        const sortedTheses = [...filteredTheses].sort((a, b) => {
            const dateA = new Date(a.submissionDate || a.lastUpdated).getTime();
            const dateB = new Date(b.submissionDate || b.lastUpdated).getTime();
            return dateA - dateB;
        });

        sortedTheses.forEach((t) => {
            const dateObj = new Date(t.submissionDate || t.lastUpdated);
            if (isNaN(dateObj.getTime())) return; // skip invalid dates

            let key = '';
            if (trendGrouping === 'yearly') {
                key = dateObj.getFullYear().toString();
            } else {
                // Monthly grouping: e.g., "Jan 2026"
                const monthName = dateObj.toLocaleString('default', { month: 'short' });
                key = `${monthName} ${dateObj.getFullYear()}`;
            }
            counts.set(key, (counts.get(key) ?? 0) + 1);
        });

        return Array.from(counts.entries()).map(([label, value]) => ({
            label,
            value,
        }));
    }, [filteredTheses, trendGrouping]);

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
    const courseDisplayProfile = profile?.course ?? '';

    // ========================================================================
    // Render
    // ========================================================================

    if (loadingTheses) {
        return (
            <AnimatedPage variant="slideUp">
                <Stack spacing={3}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Skeleton variant="text" width={300} height={50} />
                        <Stack direction="row" spacing={1}>
                            <Skeleton variant="rounded" width={80} height={24} />
                            <Skeleton variant="rounded" width={120} height={24} />
                        </Stack>
                    </Box>
                    <Card sx={{ borderRadius: 3 }}>
                        <CardContent>
                            <Skeleton variant="text" width={150} height={32} />
                            <Grid container spacing={2} sx={{ mt: 1 }}>
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
                                        <Skeleton variant="rounded" height={80} />
                                    </Grid>
                                ))}
                            </Grid>
                        </CardContent>
                    </Card>
                    <Card sx={{ borderRadius: 3 }}>
                        <CardContent>
                            <Skeleton variant="text" width={150} height={32} />
                            <Skeleton variant="rounded" height={300} sx={{ mt: 2 }} />
                        </CardContent>
                    </Card>
                </Stack>
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
                {/* Header */}
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Typography variant="h3" sx={{
                        fontWeight: 600
                    }}>
                        Hello {greetingName}!
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{
                        flexWrap: 'wrap'
                    }}>
                        <Chip label={roleDisplay} color="primary" size="small" />
                        {departmentDisplay && (
                            <Chip
                                label={departmentDisplay}
                                variant="outlined"
                                size="small"
                            />
                        )}
                        {courseDisplayProfile && (
                            <Chip
                                label={courseDisplayProfile}
                                variant="outlined"
                                size="small"
                                color="secondary"
                            />
                        )}
                    </Stack>
                </Box>

                {/* Snapshot Metrics */}
                <Grid container spacing={2}>
                    {snapshotMetrics.map((metric) => (
                        <Grid size={{ xs: 6, sm: 4, md: 2.4 }} key={metric.label}>
                            <Card sx={{ borderRadius: 3, height: '100%' }}>
                                <CardContent sx={{ textAlign: 'center', py: 3, '&:last-child': { pb: 3 } }}>
                                    <Typography
                                        variant="body2"
                                        noWrap
                                        sx={{ color: 'text.secondary', mb: 1 }}
                                    >
                                        {metric.label}
                                    </Typography>
                                    <Typography
                                        variant="h4"
                                        sx={{ color: metric.color }}
                                    >
                                        {metric.value}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>

                {/* Filters */}
                <Card sx={{ borderRadius: 3 }}>
                    <CardContent>
                        <Box sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}>
                            <Typography variant="h6">
                                Statistics Filters
                            </Typography>
                            <IconButton
                                size="small"
                                onClick={() => setFiltersExpanded(!filtersExpanded)}
                                aria-label={filtersExpanded ? 'Collapse filters' : 'Expand filters'}
                            >
                                {filtersExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            </IconButton>
                        </Box>
                        <Collapse in={filtersExpanded}>
                            <Stack spacing={2} sx={{ mt: 2 }}>
                                {/* Row 1: Department + Course */}
                                <Box sx={{
                                    border: 1,
                                    borderColor: 'divider',
                                    borderRadius: 2,
                                    p: 2,
                                }}>
                                    <DepartmentCourseFilter
                                        department={departmentFilter}
                                        departments={departments}
                                        onDepartmentChange={(dept) => {
                                            setDepartmentFilter(dept);
                                            if (dept === FILTER_ALL) {
                                                setCourseFilter(FILTER_ALL);
                                            }
                                        }}
                                        course={courseFilter}
                                        courses={courses}
                                        onCourseChange={setCourseFilter}
                                        allValue={FILTER_ALL}
                                        size="small"
                                        fullWidth
                                    />
                                </Box>

                                {/* Row 2: Agenda Type Toggle + Dynamic Agenda Filters */}
                                <Box sx={{
                                    border: 1,
                                    borderColor: 'divider',
                                    borderRadius: 2,
                                    p: 2,
                                }}>
                                    <Stack spacing={2}>
                                        {/* Agenda Type Toggle */}
                                        <ToggleButtonGroup
                                            value={agendaType}
                                            exclusive
                                            onChange={(_, value) => {
                                                if (value) {
                                                    setAgendaType(value);
                                                    setAgendaDepartment(FILTER_ALL);
                                                    setAgendaPath([]);
                                                }
                                            }}
                                            size="small"
                                            disabled={loadingAgendas}
                                            fullWidth
                                        >
                                            <ToggleButton value="institutional">
                                                Institutional
                                            </ToggleButton>
                                            <ToggleButton value="departmental">
                                                Collegiate & Departmental
                                            </ToggleButton>
                                        </ToggleButtonGroup>

                                        {/* Dynamic Agenda Selectors */}
                                        <Grid container spacing={2}>
                                            {/* For Departmental: Show department selector first */}
                                            {agendaType === 'departmental' && (
                                                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                                                    <FormControl
                                                        size="small"
                                                        fullWidth
                                                        disabled={loadingAgendas || !agendasData}
                                                    >
                                                        <InputLabel>Department</InputLabel>
                                                        <Select
                                                            value={agendaDepartment}
                                                            label="Department"
                                                            onChange={(e) => {
                                                                setAgendaDepartment(e.target.value);
                                                                setAgendaPath([]);
                                                            }}
                                                        >
                                                            <MenuItem value={FILTER_ALL}>All Departments</MenuItem>
                                                            {(agendasData?.departmentalAgendas ?? []).map(
                                                                (dept: FullDepartmentAgenda) => (
                                                                    <MenuItem
                                                                        key={dept.department}
                                                                        value={dept.department}
                                                                    >
                                                                        {dept.department}
                                                                    </MenuItem>
                                                                )
                                                            )}
                                                        </Select>
                                                    </FormControl>
                                                </Grid>
                                            )}

                                            {/* Dynamic agenda path selectors */}
                                            {(() => {
                                                // Get root agendas based on type
                                                const rootAgendas: FullAgendaItem[] = agendaType === 'institutional'
                                                    ? (agendasData?.institutionalAgenda?.agenda ?? [])
                                                    : agendaDepartment !== FILTER_ALL
                                                        ? (agendasData?.departmentalAgendas ?? [])
                                                            .find((d) => d.department === agendaDepartment)?.agenda ?? []
                                                        : [];

                                                // Calculate how many levels to show
                                                const selectors: React.ReactNode[] = [];
                                                let currentAgendas = rootAgendas;
                                                let depth = 0;
                                                const maxDepth = 10; // Safety limit

                                                // Always show at least the first selector if we have agendas
                                                while (depth < maxDepth) {
                                                    const currentDepth = depth;
                                                    const hasOptions = currentAgendas.length > 0;
                                                    const currentValue = agendaPath[currentDepth] ?? '';
                                                    const isEnabled = !loadingAgendas && hasOptions && (
                                                        currentDepth === 0 || agendaPath[currentDepth - 1]
                                                    );

                                                    // Only render if there are options or it's the first selector
                                                    if (!hasOptions && currentDepth > 0) break;

                                                    selectors.push(
                                                        <Grid
                                                            key={`agenda-${currentDepth}`}
                                                            size={{ xs: 12, sm: 6, md: 3 }}
                                                        >
                                                            <FormControl
                                                                size="small"
                                                                fullWidth
                                                                disabled={!isEnabled}
                                                            >
                                                                <InputLabel>
                                                                    {currentDepth === 0 ? 'Agenda' : 'Subagenda'}
                                                                </InputLabel>
                                                                <Select
                                                                    value={currentValue}
                                                                    label={currentDepth === 0 ? 'Agenda' : 'Subagenda'}
                                                                    onChange={(e) => {
                                                                        const newPath = [
                                                                            ...agendaPath.slice(0, currentDepth),
                                                                            e.target.value,
                                                                        ];
                                                                        setAgendaPath(newPath);
                                                                    }}
                                                                >
                                                                    <MenuItem value="">
                                                                        {!isEnabled
                                                                            ? 'Select previous first'
                                                                            : currentDepth === 0
                                                                                ? 'All Agendas'
                                                                                : 'All Subagendas'}
                                                                    </MenuItem>
                                                                    {currentAgendas.map((item) => (
                                                                        <MenuItem key={item.title} value={item.title}>
                                                                            {item.title}
                                                                        </MenuItem>
                                                                    ))}
                                                                </Select>
                                                            </FormControl>
                                                        </Grid>
                                                    );

                                                    // Move to next level if there's a selection
                                                    if (currentValue) {
                                                        const selected = currentAgendas.find((a) => a.title === currentValue);
                                                        if (selected && selected.subAgenda.length > 0) {
                                                            currentAgendas = selected.subAgenda;
                                                            depth++;
                                                            continue;
                                                        }
                                                    }
                                                    break;
                                                }

                                                return selectors;
                                            })()}
                                        </Grid>
                                    </Stack>
                                </Box>

                                {/* Row 3: ESG + SDG */}
                                <Box sx={{
                                    border: 1,
                                    borderColor: 'divider',
                                    borderRadius: 2,
                                    p: 2,
                                }}>
                                    <Grid container spacing={2}>
                                        <Grid size={{ xs: 12, sm: 6 }}>
                                            <SelectFilter
                                                id="esg-filter"
                                                label="ESG"
                                                value={esgFilter}
                                                options={ESG_VALUES.map((esg) => ({
                                                    value: esg,
                                                    label: esg,
                                                }))}
                                                onChange={setEsgFilter}
                                                allValue={FILTER_ALL}
                                                allLabel="All ESG"
                                                size="small"
                                                fullWidth
                                            />
                                        </Grid>
                                        <Grid size={{ xs: 12, sm: 6 }}>
                                            <SelectFilter
                                                id="sdg-filter"
                                                label="SDG"
                                                value={sdgFilter}
                                                options={SDG_VALUES.map((sdg) => ({
                                                    value: sdg,
                                                    label: sdg,
                                                }))}
                                                onChange={setSdgFilter}
                                                allValue={FILTER_ALL}
                                                allLabel="All SDGs"
                                                size="small"
                                                fullWidth
                                            />
                                        </Grid>
                                    </Grid>
                                </Box>
                            </Stack>
                        </Collapse>
                    </CardContent>
                </Card>

                {/* Hero Section: Main Chart & Trends */}
                <Grid container spacing={3}>
                    {/* Main Distribution Chart (Left, 40%) */}
                    <Grid size={{ xs: 12, md: 5 }}>
                        <Card sx={{ borderRadius: 3, height: '100%' }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    {chartTitle}
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                                    Filtered Total: {stats.totalTheses} theses
                                </Typography>
                                {dynamicChartData.some((item) => item.value > 0) ? (
                                    <Box sx={{ display: 'flex', justifyContent: 'center', overflowX: 'auto' }}>
                                        <PieChart
                                            series={[{
                                                data: dynamicChartData,
                                                highlightScope: { fade: 'global', highlight: 'item' },
                                                faded: { innerRadius: 30, additionalRadius: -30, color: 'grey' },
                                            }]}
                                            width={400}
                                            height={300}
                                            slotProps={{ legend: { direction: 'row', position: { vertical: 'bottom', horizontal: 'middle' }, padding: -5 } }}
                                        />
                                    </Box>
                                ) : (
                                    <Box sx={{ minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>No data available for current filters</Typography>
                                    </Box>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Trend Chart (Right, 60%) */}
                    <Grid size={{ xs: 12, md: 7 }}>
                        <Card sx={{ borderRadius: 3, height: '100%' }}>
                            <CardContent>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                    <Box>
                                        <Typography variant="h6" gutterBottom>
                                            Submission Trends
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                            Theses {trendGrouping === 'monthly' ? 'per Month' : 'per Year'}
                                        </Typography>
                                    </Box>
                                    <ToggleButtonGroup
                                        value={trendGrouping}
                                        exclusive
                                        onChange={(_, newVal) => { if (newVal) setTrendGrouping(newVal); }}
                                        size="small"
                                    >
                                        <ToggleButton value="monthly">Monthly</ToggleButton>
                                        <ToggleButton value="yearly">Yearly</ToggleButton>
                                    </ToggleButtonGroup>
                                </Box>
                                {trendData.length > 0 ? (
                                    <Box sx={{ display: 'flex', justifyContent: 'center', overflowX: 'auto', mt: 2 }}>
                                        <LineChart
                                            xAxis={[{ 
                                                scaleType: 'point', 
                                                data: trendData.map(d => d.label) 
                                            }]}
                                            series={[{ 
                                                data: trendData.map(d => d.value),
                                                color: primaryColor,
                                                area: true,
                                                showMark: true,
                                            }]}
                                            height={250}
                                            margin={{ left: 40, right: 20, top: 20, bottom: 30 }}
                                        />
                                    </Box>
                                ) : (
                                    <Box sx={{ minHeight: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>No data available</Typography>
                                    </Box>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

                {/* Categorical Breakdowns */}
                <Grid container spacing={3}>
                    {/* SDG Bar Chart */}
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Card sx={{ borderRadius: 3, height: '100%' }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    SDG Alignment
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                                    Sustainable Development Goals
                                </Typography>
                                {sdgData.length > 0 ? (
                                    <Box sx={{ display: 'flex', justifyContent: 'center', overflowX: 'auto' }}>
                                        <BarChart
                                            dataset={sdgData}
                                            yAxis={[{ scaleType: 'band', dataKey: 'label' }]}
                                            series={[{ dataKey: 'value' }]}
                                            colors={sdgData.map(d => d.color)}
                                            layout="horizontal"
                                            width={500}
                                            height={300}
                                            margin={{ left: 150 }}
                                        />
                                    </Box>
                                ) : (
                                    <Box sx={{ minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>No data available</Typography>
                                    </Box>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* ESG Distribution Chart */}
                    <Grid size={{ xs: 12, md: 6 }}>
                        <Card sx={{ borderRadius: 3, height: '100%' }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    ESG Breakdown
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                                    Environmental, Social, and Governance
                                </Typography>
                                {esgData.length > 0 ? (
                                    <Box sx={{ display: 'flex', justifyContent: 'center', overflowX: 'auto' }}>
                                        <PieChart
                                            series={[{
                                                data: esgData,
                                                innerRadius: 60,
                                                highlightScope: { fade: 'global', highlight: 'item' },
                                                faded: { innerRadius: 30, additionalRadius: -30, color: 'grey' },
                                            }]}
                                            width={500}
                                            height={300}
                                            slotProps={{ legend: { hidden: true } }}
                                        />
                                    </Box>
                                ) : (
                                    <Box sx={{ minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>No data available</Typography>
                                    </Box>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

                {/* Agendas (Full Width) */}
                <Grid container spacing={3}>
                    <Grid size={12}>
                        <Card sx={{ borderRadius: 3 }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    Research Agendas
                                </Typography>
                                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                                    By Root Agenda Category
                                </Typography>
                                {agendaData.length > 0 ? (
                                    <Box sx={{ display: 'flex', justifyContent: 'center', overflowX: 'auto' }}>
                                        <BarChart
                                            dataset={agendaData}
                                            yAxis={[{ scaleType: 'band', dataKey: 'label' }]}
                                            series={[{ dataKey: 'value', color: secondaryColor }]}
                                            layout="horizontal"
                                            width={1000}
                                            height={300}
                                            margin={{ left: 250 }}
                                        />
                                    </Box>
                                ) : (
                                    <Box sx={{ minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>No data available</Typography>
                                    </Box>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            </Stack>
        </AnimatedPage>
    );
}

export default DashboardPage;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Aggregate dashboard statistics derived from thesis records.
 * @param theses - Filtered thesis records
 * @param stageBuckets - Stage bucket definitions
 * @returns Dashboard statistics with stage counts
 */
function deriveDashboardStats(
    theses: ThesisWithGroupContext[],
    stageBuckets: StageBucket[],
): DashboardStats {
    const stageTotals = new Map<ThesisStageName, number>();
    stageBuckets.forEach((bucket) => {
        stageTotals.set(bucket.key, 0);
    });

    theses.forEach((record) => {
        // Derive current stage using the utility function
        const currentStage = deriveCurrentStage(record);
        if (stageTotals.has(currentStage)) {
            stageTotals.set(currentStage, (stageTotals.get(currentStage) ?? 0) + 1);
        }
    });

    const stageStats = stageBuckets.map((bucket) => ({
        ...bucket,
        value: stageTotals.get(bucket.key) ?? 0,
    }));

    return {
        totalTheses: theses.length,
        stageStats,
    };
}
