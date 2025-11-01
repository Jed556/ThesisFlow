import * as React from 'react';
import Typography from '@mui/material/Typography';
import {
    Box, Chip, Card, CardContent, Grid, FormControl, InputLabel, Select, MenuItem, LinearProgress, Skeleton, Paper
} from '@mui/material';
import { PieChart } from '@mui/x-charts/PieChart';
import { BarChart } from '@mui/x-charts/BarChart';
import { useSession } from '@toolpad/core';
import type { NavigationItem } from '../types/navigation';
import type { Session } from '../types/session';
import DashboardIcon from '@mui/icons-material/Dashboard';
import { AnimatedPage } from '../components/Animate';
import { mockAllTheses, mockUserProfiles } from '../data/mockData';
import type { ThesisData, ThesisChapter } from '../types/thesis';
import { CheckCircle, Schedule, Warning, Block } from '@mui/icons-material';

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
    const completedChapters = chapters.filter(ch => ch.status === 'approved').length;
    return Math.round((completedChapters / chapters.length) * 100);
}

/**
 * Home dashboard page displaying charts, statistics, and thesis progress
 */
export default function DashboardPage() {
    const session = useSession<Session>();
    const userEmail = session?.user?.email;
    const userRole = session?.user?.role;

    // Filters
    const [groupFilter, setGroupFilter] = React.useState<GroupFilter>('all');
    const [defenseStageFilter, setDefenseStageFilter] = React.useState<DefenseStage>('all');

    // Calculate statistics based on filters
    const stats = React.useMemo(() => {
        let filteredTheses = [...mockAllTheses];

        // Apply group filter
        if (groupFilter !== 'all') {
            filteredTheses = filteredTheses.filter(t => t.title === groupFilter);
        }

        // Apply defense stage filter
        if (defenseStageFilter !== 'all') {
            filteredTheses = filteredTheses.filter(t => {
                if (defenseStageFilter === 'pre-title') {
                    return t.overallStatus === 'Pre Title Defense';
                } else {
                    return t.overallStatus === 'Pre Thesis Defense';
                }
            });
        }

        // Calculate total students
        const totalStudents = filteredTheses.reduce((acc, t) => {
            return acc + 1 + t.members.length; // Leader + members
        }, 0);

        // Calculate students per chapter
        const chapterStats = filteredTheses.reduce((acc, thesis) => {
            thesis.chapters.forEach((chapter, idx) => {
                const chapterNum = idx + 1;
                if (!acc[chapterNum]) {
                    acc[chapterNum] = {
                        chapter: `Chapter ${chapterNum}`,
                        approved: 0,
                        underReview: 0,
                        revisionRequired: 0,
                        notSubmitted: 0,
                        total: 0
                    };
                }

                const studentsInThesis = 1 + thesis.members.length;
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
                        acc[chapterNum].notSubmitted += studentsInThesis;
                        break;
                }
            });
            return acc;
        }, {} as Record<number, {
            chapter: string; approved: number; underReview: number; revisionRequired: number; notSubmitted: number; total: number
        }>);

        // Calculate defense stage distribution
        const preTitle = filteredTheses.filter(t => t.overallStatus === 'Pre Title Defense').length;
        const preThesis = filteredTheses.filter(t => t.overallStatus === 'Pre Thesis Defense').length;

        return {
            totalStudents,
            totalTheses: filteredTheses.length,
            chapterStats: Object.values(chapterStats),
            defenseStageStats: [
                { label: 'Pre Title Defense', value: preTitle },
                { label: 'Pre Thesis Defense', value: preThesis }
            ]
        };
    }, [groupFilter, defenseStageFilter]);

    // Get user's thesis (for students)
    const userThesis = React.useMemo(() => {
        if (userRole === 'student' && userEmail) {
            return mockAllTheses.find(t =>
                t.leader === userEmail || t.members.includes(userEmail)
            );
        }
        return null;
    }, [userEmail, userRole]);

    // Get theses for advisers/editors
    const managedTheses = React.useMemo(() => {
        if ((userRole === 'adviser' || userRole === 'editor') && userEmail) {
            return mockAllTheses.filter(t =>
                (userRole === 'adviser' && t.adviser === userEmail) ||
                (userRole === 'editor' && t.editor === userEmail)
            );
        }
        return [];
    }, [userEmail, userRole]);

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
                                    {calculateProgress(userThesis.chapters)}%
                                </Typography>
                            </Box>
                            <LinearProgress
                                variant="determinate"
                                value={calculateProgress(userThesis.chapters)}
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
                            {userThesis.chapters.map(chapter => {
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
                            const progress = calculateProgress(thesis.chapters);
                            const leader = mockUserProfiles.find(u => u.email === thesis.leader);
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
                                                Leader: {leader ? `${leader.firstName} ${leader.lastName}` : thesis.leader}
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
                                    {mockAllTheses.map((thesis, idx) => (
                                        <MenuItem key={idx} value={thesis.title}>
                                            {thesis.title}
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
