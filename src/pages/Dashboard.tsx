import * as React from 'react';
import Typography from '@mui/material/Typography';
import {
    Alert, Box, Chip, Card, CardContent, CircularProgress, FormControl,
    InputLabel, LinearProgress, MenuItem, Paper, Select,
} from '@mui/material';
import { PieChart } from '@mui/x-charts/PieChart';
import { BarChart } from '@mui/x-charts/BarChart';
import { useSession } from '@toolpad/core';
import type { NavigationItem } from '../types/navigation';
import type { Session } from '../types/session';
import DashboardIcon from '@mui/icons-material/Dashboard';
import { AnimatedPage } from '../components/Animate';
import type { ThesisChapter, ThesisData } from '../types/thesis';
import { CheckCircle, Schedule, Warning, Block } from '@mui/icons-material';
import { listenTheses } from '../utils/firebase/firestore/thesis';
import type { UserProfile } from '../types/profile';
import { getUsersByIds } from '../utils/firebase/firestore/user';

type ThesisRecord = ThesisData & { id: string };

type ChapterAggregate = {
    chapter: string;
    approved: number;
    underReview: number;
    revisionRequired: number;
    notSubmitted: number;
    total: number;
};

export const metadata: NavigationItem = {
    group: 'main',
    index: 0,
    title: 'Dashboard',
    segment: 'dashboard',
    icon: <DashboardIcon />,
    children: [],
};

/**
 * Type for defense stage filter
 */
type DefenseStage = 'all' | 'pre-title' | 'pre-thesis';

/**
 * Type for group filter
 */
type GroupFilter = 'all' | string; // 'all' or specific thesis title

/**
 * Get chapter status icon and color
 */
function getChapterStatusInfo(status: ThesisChapter['status']) {
    switch (status) {
        case 'approved':
            return { icon: <CheckCircle />, color: 'success' as const, label: 'Approved' };
        case 'under_review':
            return { icon: <Schedule />, color: 'info' as const, label: 'Under Review' };
        case 'revision_required':
            return { icon: <Warning />, color: 'warning' as const, label: 'Revision Required' };
        case 'not_submitted':
            return { icon: <Block />, color: 'default' as const, label: 'Not Submitted' };
    }
}

/**
 * Calculate progress percentage for a thesis
 */
function calculateProgress(chapters: ThesisChapter[]): number {
    if (!chapters || chapters.length === 0) {
        return 0;
    }
    const completedChapters = chapters.filter(ch => ch.status === 'approved').length;
    return Math.round((completedChapters / chapters.length) * 100);
}

/**
 * Home dashboard page displaying charts, statistics, and thesis progress
 */
export default function DashboardPage() {
    const session = useSession<Session>();
    const userUid = session?.user?.uid;
    const userRole = session?.user?.role;

    // Filters
    const [groupFilter, setGroupFilter] = React.useState<GroupFilter>('all');
    const [defenseStageFilter, setDefenseStageFilter] = React.useState<DefenseStage>('all');
    const [theses, setTheses] = React.useState<ThesisRecord[]>([]);
    const [loadingTheses, setLoadingTheses] = React.useState(true);
    const [thesisError, setThesisError] = React.useState<string | null>(null);
    const [leaderProfiles, setLeaderProfiles] = React.useState<Record<string, UserProfile>>({});

    React.useEffect(() => {
        setLoadingTheses(true);
        const unsubscribe = listenTheses(undefined, {
            onData: (records) => {
                setTheses(records);
                setThesisError(null);
                setLoadingTheses(false);
            },
            onError: (error) => {
                console.error('Failed to load theses for dashboard:', error);
                setTheses([]);
                setThesisError('Unable to load thesis data right now. Please try again later.');
                setLoadingTheses(false);
            },
        });

        return () => {
            unsubscribe();
        };
    }, []);

    const availableGroups = React.useMemo(() => {
        const titles = new Set<string>();
        theses.forEach((record) => {
            if (record.title) {
                titles.add(record.title);
            }
        });
        return Array.from(titles).sort((a, b) => a.localeCompare(b));
    }, [theses]);

    // Calculate statistics based on filters
    const stats = React.useMemo(() => {
        const defaultStats = {
            totalStudents: 0,
            totalTheses: 0,
            chapterStats: [] as ChapterAggregate[],
            defenseStageStats: [
                { label: 'Pre Title Defense', value: 0 },
                { label: 'Pre Thesis Defense', value: 0 },
            ],
        };

        if (theses.length === 0) {
            return defaultStats;
        }

        let filteredTheses = [...theses];

        if (groupFilter !== 'all') {
            filteredTheses = filteredTheses.filter((t) => t.title === groupFilter);
        }

        if (defenseStageFilter !== 'all') {
            const matcher = defenseStageFilter === 'pre-title' ? 'pre title' : 'pre thesis';
            filteredTheses = filteredTheses.filter((t) =>
                (t.overallStatus ?? '').toLowerCase().includes(matcher)
            );
        }

        if (filteredTheses.length === 0) {
            return defaultStats;
        }

        const totalStudents = filteredTheses.reduce((acc, t) => {
            const membersCount = Array.isArray(t.members) ? t.members.length : 0;
            return acc + 1 + membersCount;
        }, 0);

        const chapterStats = filteredTheses.reduce((acc, thesis) => {
            const chapters = thesis.chapters ?? [];
            chapters.forEach((chapter, idx) => {
                const chapterNum = idx + 1;
                if (!acc[chapterNum]) {
                    acc[chapterNum] = {
                        chapter: `Chapter ${chapterNum}`,
                        approved: 0,
                        underReview: 0,
                        revisionRequired: 0,
                        notSubmitted: 0,
                        total: 0,
                    } as ChapterAggregate;
                }

                const membersCount = Array.isArray(thesis.members) ? thesis.members.length : 0;
                const studentsInThesis = 1 + membersCount;
                acc[chapterNum].total += studentsInThesis;

                switch (chapter.status) {
                    case 'approved':
                        acc[chapterNum].approved += studentsInThesis;
                        break;
                    case 'under_review':
                        acc[chapterNum].underReview += studentsInThesis;
                        break;
                    case 'revision_required':
                        acc[chapterNum].revisionRequired += studentsInThesis;
                        break;
                    case 'not_submitted':
                    default:
                        acc[chapterNum].notSubmitted += studentsInThesis;
                        break;
                }
            });
            return acc;
        }, {} as Record<number, ChapterAggregate>);

        const defenseStageStats = filteredTheses.reduce(
            (acc, thesis) => {
                const status = (thesis.overallStatus ?? '').toLowerCase();
                if (status.includes('pre title')) {
                    acc[0].value += 1;
                } else if (status.includes('pre thesis')) {
                    acc[1].value += 1;
                }
                return acc;
            },
            [
                { label: 'Pre Title Defense', value: 0 },
                { label: 'Pre Thesis Defense', value: 0 },
            ]
        );

        return {
            totalStudents,
            totalTheses: filteredTheses.length,
            chapterStats: Object.values(chapterStats),
            defenseStageStats,
        };
    }, [theses, groupFilter, defenseStageFilter]);

    // Get user's thesis (for students)
    const userThesis = React.useMemo(() => {
        if (userRole === 'student' && userUid) {
            return theses.find((t) =>
                t.leader === userUid || (Array.isArray(t.members) && t.members.includes(userUid))
            ) ?? null;
        }
        return null;
    }, [theses, userUid, userRole]);

    // Get theses for advisers/editors
    const managedTheses = React.useMemo(() => {
        if ((userRole === 'adviser' || userRole === 'editor') && userUid) {
            return theses.filter((t) =>
                (userRole === 'adviser' && t.adviser === userUid) ||
                (userRole === 'editor' && t.editor === userUid)
            );
        }
        return [];
    }, [theses, userUid, userRole]);

    React.useEffect(() => {
        if (!(userRole === 'adviser' || userRole === 'editor')) {
            setLeaderProfiles({});
            return;
        }

        if (managedTheses.length === 0) {
            setLeaderProfiles({});
            return;
        }

        const leaderIds = new Set<string>();
        managedTheses.forEach((record) => {
            if (record.leader) {
                leaderIds.add(record.leader);
            }
        });

        if (leaderIds.size === 0) {
            setLeaderProfiles({});
            return;
        }

        let cancelled = false;

        void (async () => {
            try {
                const profiles = await getUsersByIds(Array.from(leaderIds));
                if (cancelled) {
                    return;
                }
                const profileMap: Record<string, UserProfile> = {};
                profiles.forEach((profile) => {
                    profileMap[profile.uid] = profile;
                });
                setLeaderProfiles(profileMap);
            } catch (error) {
                console.error('Failed to hydrate leader profiles for dashboard:', error);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [managedTheses, userRole]);

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
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" gutterBottom>Welcome to ThesisFlow!</Typography>
                <Typography variant="body1" color="text.secondary">
                    {userRole === 'student' && 'Track your thesis progress and stay on top of deadlines.'}
                    {userRole === 'adviser' && 'Monitor your students\' progress and provide guidance.'}
                    {userRole === 'editor' && 'Review submissions and provide editorial feedback.'}
                    {(userRole === 'admin' || userRole === 'developer') && 'Overview of all thesis activities.'}
                </Typography>
            </Box>

            {/* User Info Card */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>Current User</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <Typography variant="body1">
                            <strong>Name:</strong> {session?.user?.name || 'Unknown'}
                        </Typography>
                        <Typography variant="body1">
                            <strong>Email:</strong> {session?.user?.email || 'Unknown'}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <strong>Role:</strong>
                            <Chip
                                label={userRole}
                                color={
                                    userRole === 'admin' ? 'error' :
                                        userRole === 'developer' ? 'secondary' :
                                            userRole === 'editor' ? 'warning' :
                                                userRole === 'adviser' ? 'info' :
                                                    'primary'
                                }
                                size="small"
                            />
                        </Box>
                    </Box>
                </CardContent>
            </Card>

            {/* Student's Personal Thesis Progress Card */}
            {userRole === 'student' && userThesis && (
                <Card sx={{ mb: 3 }}>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>My Thesis Progress</Typography>
                        <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 2 }}>
                            {userThesis.title}
                        </Typography>
                        <Box sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="body2">Overall Progress</Typography>
                                <Typography variant="body2" fontWeight="bold">
                                    {calculateProgress(userThesis.chapters ?? [])}%
                                </Typography>
                            </Box>
                            <LinearProgress
                                variant="determinate"
                                value={calculateProgress(userThesis.chapters ?? [])}
                                sx={{ height: 8, borderRadius: 4 }}
                            />
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                            <Chip label={userThesis.overallStatus} color="primary" size="small" />
                            <Typography variant="body2" color="text.secondary">
                                Last updated: {userThesis.lastUpdated}
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {(userThesis.chapters ?? []).map(chapter => {
                                const statusInfo = getChapterStatusInfo(chapter.status);
                                return (
                                    <Box key={chapter.id} sx={{
                                        flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 8px)', md: '1 1 calc(33.333% - 8px)' },
                                        minWidth: 0
                                    }}>
                                        <Paper sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Box sx={{ color: `${statusInfo.color}.main` }}>
                                                {statusInfo.icon}
                                            </Box>
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Typography variant="body2" fontWeight={600} noWrap>
                                                    {chapter.title}
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {statusInfo.label}
                                                </Typography>
                                            </Box>
                                        </Paper>
                                    </Box>
                                );
                            })}
                        </Box>
                    </CardContent>
                </Card>
            )}

            {/* Adviser/Editor Managed Theses Cards */}
            {(userRole === 'adviser' || userRole === 'editor') && managedTheses.length > 0 && (
                <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        {userRole === 'adviser' ? 'Your Advised Groups' : 'Your Assigned Groups'}
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                        {managedTheses.map((thesis, idx) => {
                            const progress = calculateProgress(thesis.chapters ?? []);
                            const leaderProfile = leaderProfiles[thesis.leader];
                            const leaderName = leaderProfile
                                ? `${leaderProfile.name.first} ${leaderProfile.name.last}`
                                : thesis.leader;
                            return (
                                <Box key={idx} sx={{
                                    flex: { xs: '1 1 100%', md: '1 1 calc(50% - 16px)', lg: '1 1 calc(33.333% - 16px)' },
                                    minWidth: 0
                                }}>
                                    <Card sx={{ height: '100%' }}>
                                        <CardContent>
                                            <Typography variant="subtitle1" fontWeight={600} gutterBottom noWrap>
                                                {thesis.title}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                                Leader: {leaderName}
                                            </Typography>
                                            <Box sx={{ mb: 1 }}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                                    <Typography variant="caption">Progress</Typography>
                                                    <Typography variant="caption" fontWeight="bold">{progress}%</Typography>
                                                </Box>
                                                <LinearProgress variant="determinate" value={progress}
                                                    sx={{ height: 6, borderRadius: 3 }} />
                                            </Box>
                                            <Chip label={thesis.overallStatus} color="primary" size="small" />
                                        </CardContent>
                                    </Card>
                                </Box>
                            );
                        })}
                    </Box>
                </Box>
            )}

            {/* Filters */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>Statistics Filters</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                        <Box sx={{
                            flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 16px)', md: '1 1 calc(33.333% - 16px)' },
                            minWidth: 200
                        }}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Group</InputLabel>
                                <Select
                                    value={groupFilter}
                                    label="Group"
                                    onChange={(e) => setGroupFilter(e.target.value as GroupFilter)}
                                >
                                    <MenuItem value="all">All Groups</MenuItem>
                                    {availableGroups.map((title) => (
                                        <MenuItem key={title} value={title}>
                                            {title}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Box>
                        <Box sx={{
                            flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 16px)', md: '1 1 calc(33.333% - 16px)' },
                            minWidth: 200
                        }}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Defense Stage</InputLabel>
                                <Select
                                    value={defenseStageFilter}
                                    label="Defense Stage"
                                    onChange={(e) => setDefenseStageFilter(e.target.value as DefenseStage)}
                                >
                                    <MenuItem value="all">All Stages</MenuItem>
                                    <MenuItem value="pre-title">Pre Title Defense</MenuItem>
                                    <MenuItem value="pre-thesis">Pre Thesis Defense</MenuItem>
                                </Select>
                            </FormControl>
                        </Box>
                    </Box>
                </CardContent>
            </Card>

            {/* Charts */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                {/* Pie Chart: Students Conducting Theses */}
                <Box sx={{ flex: { xs: '1 1 100%', md: '1 1 calc(50% - 24px)' }, minWidth: 0 }}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>Students by Defense Stage</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Total Students: {stats.totalStudents} | Total Theses: {stats.totalTheses}
                            </Typography>
                            {stats.defenseStageStats.some(s => s.value > 0) ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', minHeight: 300 }}>
                                    <PieChart
                                        series={[
                                            {
                                                data: stats.defenseStageStats.map((item, index) => ({
                                                    id: index,
                                                    value: item.value,
                                                    label: item.label
                                                })),
                                                highlightScope: { fade: 'global', highlight: 'item' },
                                                faded: { innerRadius: 30, additionalRadius: -30, color: 'gray' },
                                            }
                                        ]}
                                        width={400}
                                        height={300}
                                        slotProps={{
                                            legend: {
                                                position: { vertical: 'middle', horizontal: 'end' }
                                            }
                                        }}
                                    />
                                </Box>
                            ) : (
                                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        No data available for current filters
                                    </Typography>
                                </Box>
                            )}
                        </CardContent>
                    </Card>
                </Box>

                {/* Bar Chart: Chapter Progress */}
                <Box sx={{ width: { xs: '100%', md: '50%' } }}>
                    <Card>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>Chapter Progress by Status</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                                Number of students working on each chapter
                            </Typography>
                            {stats.chapterStats.length > 0 ? (
                                <Box sx={{ width: '100%', minHeight: 300 }}>
                                    <BarChart
                                        dataset={stats.chapterStats}
                                        xAxis={[{ scaleType: 'band', dataKey: 'chapter' }]}
                                        series={[
                                            { dataKey: 'approved', label: 'Approved', color: '#4caf50' },
                                            { dataKey: 'underReview', label: 'Under Review', color: '#2196f3' },
                                            { dataKey: 'revisionRequired', label: 'Revision Required', color: '#ff9800' },
                                            { dataKey: 'notSubmitted', label: 'Not Submitted', color: '#9e9e9e' }
                                        ]}
                                        axisHighlight={{ x: 'none', y: 'none' }}
                                        width={500}
                                        height={300}
                                        slotProps={{
                                            legend: {
                                                position: { vertical: 'bottom', horizontal: 'center' }
                                            }
                                        }}
                                    />
                                </Box>
                            ) : (
                                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
                                    <Typography variant="body2" color="text.secondary">
                                        No data available for current filters
                                    </Typography>
                                </Box>
                            )}
                        </CardContent>
                    </Card>
                </Box>
            </Box>
        </AnimatedPage>
    );
}
