import * as React from 'react';
import {
    Alert, Box, Card, CardContent, Chip,
    FormControl, InputLabel,
    MenuItem, Select, Stack, Typography, Grid, Skeleton
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { PieChart } from '@mui/x-charts/PieChart';
import { useSession } from '@toolpad/core';
import { Dashboard as DashboardIcon } from '@mui/icons-material';
import { AnimatedPage } from '../components/Animate';
import type { NavigationItem } from '../types/navigation';
import type { Session } from '../types/session';
import type { ThesisStageName } from '../types/thesis';
import { SDG_VALUES, ESG_VALUES } from '../types/thesis';
import type { UserProfile } from '../types/profile';
import {
    listenTheses, type ThesisWithGroupContext, type ThesisRecord
} from '../utils/firebase/firestore/thesis';
import { findGroupById } from '../utils/firebase/firestore/groups';
import {
    getUserDepartments, getUserCoursesByDepartment
} from '../utils/firebase/firestore/user';
import type { ThesisGroup } from '../types/group';
import { THESIS_STAGE_METADATA, deriveCurrentStage } from '../utils/thesisStageUtils';
import { onUserProfile } from '../utils/firebase/firestore/user';
import { devLog, devError } from '../utils/devUtils';

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

interface SnapshotMetric {
    label: string;
    value: number;
    color: string;
}

const FILTER_ALL = 'all';

/** Agenda themes with their sub-themes extracted from institutional research agenda */
const AGENDA_THEMES_MAP: Record<string, string[]> = {
    'RESPONSIVE & CONTEXTUAL EDUCATION': [
        'Education in changing and transforming landscapes',
        'Education and quality assurance',
        'Education amid Industry 4.0 and internationalization Inclusive education',
        'Gender and development in relation to educational issues',
        'Educational theories in the contexts of teaching and learning practices',
    ],
    'CORE VALUES & DOMINICAN CHARISM': [
        'Culture and heritage',
        'Dominican philosophy',
        'Folk and popular religiosity',
        'Spiritual development',
        'Institutional identity',
        'Inclusive nation-building',
    ],
    'COMMUNITY DEVELOPMENT & HEALTH ISSUES': [
        'Environmental management',
        'Community impact',
        'Local responsiveness',
        'Socio-economic development',
        'Corporate social responsibility',
        'Family and migration',
        'Diversity in the workplace',
        'Sustainable communities',
        'Countryside development',
        'Responsive health systems / nutrition security',
        'Holistic approaches to health and wellness',
        'Health resiliency',
        'Innovation in healthcare',
        'Global competitiveness in healthcare',
    ],
    'BUSINESS MANAGEMENT AND QUALITY MANAGEMENT': [
        'Entrepreneurship and business management',
        'Leadership and governance',
        'Policy research and informed decision making',
        'Human Resource Development',
        'Social enterprise',
        'Community/Local-based enterprise management',
        'Tourism and hospitality management',
        'Quality management system',
        'Knowledge management',
        'Internal evaluation of certifications and accreditations',
    ],
    'INNOVATIVE & EMERGING TECHNOLOGIES': [
        'Engineering technologies across various sectors [Health; Agriculture, Aquatic and Natural Resources (AANR); and Disaster Risk Reduction and Climate Change Adaptation (DRR CCA)]',
        'Alternative and renewable energy',
        'Intelligent transportation solutions',
        'Data Science',
        'Robotics and automation',
        'Gaming and mobile technology',
        'Virtual and augmented reality',
        'Cloud computing, blockchain, cryptocurrency, and cybersecurity',
        'Software development and artificial intelligence',
        'Technical nuances of Industry 4.0',
    ],
};

/** Main agenda themes */
const AGENDA_MAIN_THEMES = Object.keys(AGENDA_THEMES_MAP);

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

    // Filter states
    const [departmentFilter, setDepartmentFilter] = React.useState<string>(FILTER_ALL);
    const [courseFilter, setCourseFilter] = React.useState<string>(FILTER_ALL);
    const [stageFilter, setStageFilter] = React.useState<string>(FILTER_ALL);
    const [sdgFilter, setSdgFilter] = React.useState<string>(FILTER_ALL);
    const [esgFilter, setEsgFilter] = React.useState<string>(FILTER_ALL);
    const [agendaFilter, setAgendaFilter] = React.useState<string>(FILTER_ALL);
    const [subAgendaFilter, setSubAgendaFilter] = React.useState<string>(FILTER_ALL);

    // Filter options
    const [departments, setDepartments] = React.useState<string[]>([]);
    const [courses, setCourses] = React.useState<string[]>([]);

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

    // Reset sub-agenda filter when agenda filter changes
    React.useEffect(() => {
        if (agendaFilter === FILTER_ALL) {
            setSubAgendaFilter(FILTER_ALL);
        } else if (
            subAgendaFilter !== FILTER_ALL &&
            !AGENDA_THEMES_MAP[agendaFilter]?.includes(subAgendaFilter)
        ) {
            setSubAgendaFilter(FILTER_ALL);
        }
    }, [agendaFilter, subAgendaFilter]);

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
            agendaFilter,
            subAgendaFilter,
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
                    chaptersCount: record.chapters?.length ?? 0,
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

            // Agenda filter (mainTheme)
            const matchesAgenda =
                agendaFilter === FILTER_ALL ||
                record.agenda?.mainTheme === agendaFilter;

            // Sub-agenda filter (subTheme)
            const matchesSubAgenda =
                subAgendaFilter === FILTER_ALL ||
                record.agenda?.subTheme === subAgendaFilter;

            return matchesDepartment && matchesCourse && matchesStage &&
                matchesSdg && matchesEsg && matchesAgenda && matchesSubAgenda;
        });

        devLog('[Dashboard] Filtered theses result:', result.length, 'of', theses.length);
        return result;
    }, [
        departmentFilter, courseFilter, stageFilter,
        sdgFilter, esgFilter, agendaFilter, subAgendaFilter, theses, groupMap
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

    const stageChartData = React.useMemo(() => (
        stats.stageStats.map((bucket) => ({
            id: bucket.key,
            label: bucket.label,
            value: bucket.value,
            color: bucket.color,
        }))
    ), [stats.stageStats]);

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
                <Card sx={{ borderRadius: 3 }}>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            Program Snapshot
                        </Typography>
                        <Grid container spacing={2}>
                            {snapshotMetrics.map((metric) => (
                                <Grid size={{ xs: 6, sm: 4, md: 2.4 }} key={metric.label}>
                                    <Box sx={{
                                        p: 2,
                                        borderRadius: 2,
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        textAlign: 'center',
                                    }}>
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                            noWrap
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

                {/* Filters */}
                <Card sx={{ borderRadius: 3 }}>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            Statistics Filters
                        </Typography>
                        <Grid container spacing={2}>
                            {/* Department Filter */}
                            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                                <FormControl size="small" fullWidth>
                                    <InputLabel>Department</InputLabel>
                                    <Select
                                        value={departmentFilter}
                                        label="Department"
                                        onChange={(e) => setDepartmentFilter(e.target.value)}
                                    >
                                        <MenuItem value={FILTER_ALL}>All Departments</MenuItem>
                                        {departments.map((dept) => (
                                            <MenuItem key={dept} value={dept}>
                                                {dept}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>

                            {/* Course Filter */}
                            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                                <FormControl
                                    size="small"
                                    fullWidth
                                    disabled={departmentFilter === FILTER_ALL}
                                >
                                    <InputLabel>Course</InputLabel>
                                    <Select
                                        value={courseFilter}
                                        label="Course"
                                        onChange={(e) => setCourseFilter(e.target.value)}
                                    >
                                        <MenuItem value={FILTER_ALL}>
                                            {departmentFilter === FILTER_ALL
                                                ? 'Select a department first'
                                                : 'All Courses'}
                                        </MenuItem>
                                        {courses.map((course) => (
                                            <MenuItem key={course} value={course}>
                                                {course}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>

                            {/* Stage Filter */}
                            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                                <FormControl size="small" fullWidth>
                                    <InputLabel>Stage</InputLabel>
                                    <Select
                                        value={stageFilter}
                                        label="Stage"
                                        onChange={(e) => setStageFilter(e.target.value)}
                                    >
                                        <MenuItem value={FILTER_ALL}>All Stages</MenuItem>
                                        {THESIS_STAGE_METADATA.map((meta) => (
                                            <MenuItem key={meta.value} value={meta.value}>
                                                {meta.label}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>

                            {/* SDG Filter */}
                            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                                <FormControl size="small" fullWidth>
                                    <InputLabel>SDG</InputLabel>
                                    <Select
                                        value={sdgFilter}
                                        label="SDG"
                                        onChange={(e) => setSdgFilter(e.target.value)}
                                    >
                                        <MenuItem value={FILTER_ALL}>All SDGs</MenuItem>
                                        {SDG_VALUES.map((sdg) => (
                                            <MenuItem key={sdg} value={sdg}>
                                                {sdg}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>

                            {/* ESG Filter */}
                            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                                <FormControl size="small" fullWidth>
                                    <InputLabel>ESG</InputLabel>
                                    <Select
                                        value={esgFilter}
                                        label="ESG"
                                        onChange={(e) => setEsgFilter(e.target.value)}
                                    >
                                        <MenuItem value={FILTER_ALL}>All ESG</MenuItem>
                                        {ESG_VALUES.map((esg) => (
                                            <MenuItem key={esg} value={esg}>
                                                {esg}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>

                            {/* Agenda Filter */}
                            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                                <FormControl size="small" fullWidth>
                                    <InputLabel>Agenda</InputLabel>
                                    <Select
                                        value={agendaFilter}
                                        label="Agenda"
                                        onChange={(e) => setAgendaFilter(e.target.value)}
                                    >
                                        <MenuItem value={FILTER_ALL}>All Agendas</MenuItem>
                                        {AGENDA_MAIN_THEMES.map((agendaTheme) => (
                                            <MenuItem key={agendaTheme} value={agendaTheme}>
                                                {agendaTheme}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>

                            {/* Sub-Agenda Filter */}
                            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                                <FormControl
                                    size="small"
                                    fullWidth
                                    disabled={agendaFilter === FILTER_ALL}
                                >
                                    <InputLabel>Sub-Agenda</InputLabel>
                                    <Select
                                        value={subAgendaFilter}
                                        label="Sub-Agenda"
                                        onChange={(e) => setSubAgendaFilter(e.target.value)}
                                    >
                                        <MenuItem value={FILTER_ALL}>
                                            {agendaFilter === FILTER_ALL
                                                ? 'Select an agenda first'
                                                : 'All Sub-Agendas'}
                                        </MenuItem>
                                        {agendaFilter !== FILTER_ALL &&
                                            AGENDA_THEMES_MAP[agendaFilter]?.map((subTheme) => (
                                                <MenuItem key={subTheme} value={subTheme}>
                                                    {subTheme}
                                                </MenuItem>
                                            ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                        </Grid>
                    </CardContent>
                </Card>

                {/* Pie Chart */}
                <Card sx={{ borderRadius: 3 }}>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            Theses by Stage
                        </Typography>
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mb: 2 }}
                        >
                            Filtered Total: {stats.totalTheses} theses
                        </Typography>
                        {stageChartData.some((item) => item.value > 0) ? (
                            <Box sx={{
                                display: 'flex',
                                justifyContent: 'center',
                                overflowX: 'auto',
                            }}>
                                <PieChart
                                    series={[{
                                        data: stageChartData,
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
                                    width={500}
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
