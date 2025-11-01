import { Typography, Paper, Box, Chip, Card, CardContent, LinearProgress, Stack } from '@mui/material';
import { School } from '@mui/icons-material';
import type { NavigationItem } from '../../types/navigation';
import type { ThesisChapter } from '../../types/thesis';
import { mockThesisData } from '../../data/mockData';
import { getThesisTeamMembers, getDisplayName } from '../../utils/dbUtils';
import { AnimatedPage, AnimatedList } from '../../components/Animate';
import { Avatar, Name } from '../../components/Avatar';

export const metadata: NavigationItem = {
    group: 'thesis',
    index: 0,
    title: 'My Thesis',
    segment: 'thesis',
    icon: <School />,
    roles: ['student', 'admin'],
}; const calculateProgress = () => {
    const total = mockThesisData.chapters.length;
    const approved = mockThesisData.chapters.filter((ch: ThesisChapter) => ch.status === 'approved').length;
    return (approved / total) * 100;
};

/**
 * Main thesis overview page for students, showing progress, chapters, and team members
 */
export default function ThesisPage() {
    const progress = calculateProgress();
    const teamMembers = getThesisTeamMembers(); return (
        <AnimatedPage variant="slideUp">
            {/* Thesis Header (with members section) */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h4" gutterBottom>
                    {mockThesisData.title}
                </Typography>

                {/* Group Members Section - moved below title */}
                <Box sx={{ mt: 2, mb: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        Research Group Members
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {teamMembers.map((member) => (
                            <Avatar
                                key={member.id}
                                email={member.email}
                                initials={[Name.FIRST]}
                                mode="chip"
                                tooltip="email"
                                label={`${getDisplayName(member.email)} (${member.thesisRole})`}
                                size="small"
                                chipProps={{ variant: 'outlined', size: 'small' }}
                            />
                        ))}
                    </Stack>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 4, mt: 2 }}>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="body1">
                            <strong>Submission Date:</strong> {mockThesisData.submissionDate}
                        </Typography>
                        <Typography variant="body1">
                            <strong>Last Updated:</strong> {mockThesisData.lastUpdated}
                        </Typography>
                    </Box>
                </Box>

                {/* Progress Bar */}
                <Box sx={{ mt: 3 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                        Overall Progress: {Math.round(progress)}% Complete
                    </Typography>
                    <LinearProgress
                        variant="determinate"
                        value={progress}
                        sx={{ height: 8, borderRadius: 4 }}
                    />
                </Box>
            </Paper>

            {/* Chapters Overview */}
            <Typography variant="h5" sx={{ mb: 2 }}>Chapters</Typography>

            <AnimatedList variant="slideUp" staggerDelay={50}>
                {mockThesisData.chapters.map((chapter: ThesisChapter) => (
                    <Card key={chapter.id} sx={{ mb: 2 }}>
                        <CardContent>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                <Typography variant="h6">{chapter.title}</Typography>
                                <Chip
                                    label={chapter.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                    color={
                                        chapter.status === 'approved' ? 'success' :
                                            chapter.status === 'under_review' ? 'warning' :
                                                chapter.status === 'revision_required' ? 'error' :
                                                    'default'
                                    }
                                    size="small"
                                />
                            </Box>

                            {chapter.submissionDate && (
                                <Typography variant="body2" color="text.secondary">
                                    Last submitted: {chapter.submissionDate}
                                </Typography>
                            )}

                            {chapter.comments.length > 0 && (
                                <Typography variant="body2" color="text.secondary">
                                    {chapter.comments.length} feedback(s) received
                                </Typography>
                            )}
                        </CardContent>
                    </Card>
                ))}
            </AnimatedList>
        </AnimatedPage>
    );
}
