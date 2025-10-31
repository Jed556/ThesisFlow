import * as React from 'react';
import {
    Avatar,
    Box,
    Card,
    CardContent,
    Grid,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Stack,
    Tab,
    Tabs,
    Typography,
} from '@mui/material';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import SchoolIcon from '@mui/icons-material/School';
import EditNoteIcon from '@mui/icons-material/EditNote';
import StarRateIcon from '@mui/icons-material/StarRate';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import { AnimatedPage } from '../../../components/Animate';
import { type ProfileCardStat, ProfileCard } from '../../../components/Profile';
import type { NavigationItem } from '../../../types/navigation';
import { mockAllTheses, mockUserProfiles } from '../../../data/mockData';
import type { UserProfile } from '../../../types/profile';

export const metadata: NavigationItem = {
    group: 'adviser-editor',
    index: 0,
    title: 'Recommendations',
    segment: 'advisers',
    icon: <PeopleAltIcon />,
    children: ['profile/:email'],
};

/**
 * Build helper lookup for quick thesis counts by mentor email.
 */
function useMentorStats() {
    return React.useMemo(() => {
        const stats = new Map<string, { adviserCount: number; editorCount: number }>();
        mockAllTheses.forEach((thesis) => {
            if (thesis.adviser) {
                const record = stats.get(thesis.adviser) ?? { adviserCount: 0, editorCount: 0 };
                record.adviserCount += 1;
                stats.set(thesis.adviser, record);
            }
            if (thesis.editor) {
                const record = stats.get(thesis.editor) ?? { adviserCount: 0, editorCount: 0 };
                record.editorCount += 1;
                stats.set(thesis.editor, record);
            }
        });
        return stats;
    }, []);
}

/**
 * Static mapping of expertise tags per mentor email.
 * In a real integration this would be backed by user-managed data.
 */
const mentorExpertise: Record<string, string[]> = {
    'jane.smith@university.edu': ['Machine Learning', 'UX Research', 'Educational Tech'],
    'david.kim@university.edu': ['IoT', 'Security', 'Data Ethics'],
    'lisa.wang@university.edu': ['NLP', 'Deep Learning', 'Model Evaluation'],
    'mike.johnson@university.edu': ['Technical Writing', 'APA Formatting', 'Copy Editing'],
    'emily.brown@university.edu': ['Academic Editing', 'Qualitative Review', 'Rubrics'],
    'olivia.martinez@university.edu': ['Instructional Design', 'Accessibility'],
};

/**
 * Static mapping of compatibility scores (0-100)
 * In a real integration this would be calculated based on student's thesis topic, methodology, etc.
 */
const mentorCompatibility: Record<string, number> = {
    'jane.smith@university.edu': 95,
    'david.kim@university.edu': 88,
    'lisa.wang@university.edu': 92,
    'mike.johnson@university.edu': 87,
    'emily.brown@university.edu': 90,
    'olivia.martinez@university.edu': 85,
};

/**
 * Draft recommendations page listing advisers and editors with quick stats.
 */
export default function AdviserEditorRecommendationsPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const mentorStats = useMentorStats();
    const [activeTab, setActiveTab] = React.useState(0);

    // Check if we're on a child route (profile page)
    const isProfileRoute = location.pathname.includes('/profile/');

    // If on profile route, render the nested route
    if (isProfileRoute) {
        return <Outlet />;
    }

    const advisers = React.useMemo(
        () => mockUserProfiles.filter((profile) => profile.role === 'adviser'),
        []
    );
    const editors = React.useMemo(
        () => mockUserProfiles.filter((profile) => profile.role === 'editor'),
        []
    );

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setActiveTab(newValue);
    };

    const handleOpenProfile = (profile: UserProfile) => {
        navigate(`profile/${encodeURIComponent(profile.email)}`);
    };

    const renderMentorCard = (profile: UserProfile, roleLabel: 'Adviser' | 'Editor') => {
        const stats = mentorStats.get(profile.email) ?? { adviserCount: 0, editorCount: 0 };
        const expertise = mentorExpertise[profile.email] ?? [];
        const compatibility = mentorCompatibility[profile.email] ?? 75;

        // Determine capacity limits
        const adviserLimit = profile.adviserCapacity ?? 0;
        const editorLimit = profile.editorCapacity ?? 0;

        // Only show stats if accepting (limit > 0)
        const showAdvising = adviserLimit > 0;
        const showEditing = editorLimit > 0;

        // Build stats array
        const cardStats: ProfileCardStat[] = [];

        if (showAdvising) {
            cardStats.push({
                label: 'Advising',
                value: `${stats.adviserCount}/${adviserLimit}`,
            });
        }

        if (showEditing) {
            cardStats.push({
                label: 'Editing',
                value: `${stats.editorCount}/${editorLimit}`,
            });
        }

        cardStats.push({
            label: 'Compatibility',
            value: `${compatibility}%`,
            color: 'primary.main',
        });

        cardStats.push({
            label: 'Rating',
            value: `4.${profile.id % 3 + 2}`,
            icon: <StarRateIcon sx={{ fontSize: 18, color: 'warning.main' }} />,
        });

        return (
            <ProfileCard
                key={profile.email}
                profile={profile}
                roleLabel={roleLabel}
                skills={expertise}
                stats={cardStats}
                cornerNumber={profile.id}
                showSkills={true}
                showDivider={true}
                onClick={() => handleOpenProfile(profile)}
            />
        );
    };

    return (
        <AnimatedPage variant="fade">
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs value={activeTab} onChange={handleTabChange} aria-label="mentor recommendations tabs">
                    <Tab label={`Advisers (${advisers.length})`} icon={<SchoolIcon />} iconPosition="start" />
                    <Tab label={`Editors (${editors.length})`} icon={<EditNoteIcon />} iconPosition="start" />
                </Tabs>
            </Box>

            {/* Advisers Tab */}
            {activeTab === 0 && (
                <Grid container spacing={2}>
                    {advisers.map((profile) => (
                        <Grid key={profile.email} size={{ xs: 12, sm: 6, lg: 4 }}>
                            {renderMentorCard(profile, 'Adviser')}
                        </Grid>
                    ))}
                    {advisers.length === 0 && (
                        <Grid size={{ xs: 12 }}>
                            <Card variant="outlined">
                                <CardContent>
                                    <Typography variant="body2" color="text.secondary">
                                        No advisers found. Update the directory to see recommendations.
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    )}
                </Grid>
            )}

            {/* Editors Tab */}
            {activeTab === 1 && (
                <Grid container spacing={2}>
                    {editors.map((profile) => (
                        <Grid key={profile.email} size={{ xs: 12, sm: 6, lg: 4 }}>
                            {renderMentorCard(profile, 'Editor')}
                        </Grid>
                    ))}
                    {editors.length === 0 && (
                        <Grid size={{ xs: 12 }}>
                            <Card variant="outlined">
                                <CardContent>
                                    <Typography variant="body2" color="text.secondary">
                                        No editors found. Update the directory to see recommendations.
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    )}
                </Grid>
            )}

            <Box sx={{ mt: 5 }}>
                <Typography variant="h6" gutterBottom>How recommendations work</Typography>
                <List dense>
                    <ListItem>
                        <ListItemAvatar>
                            <Avatar>
                                <PeopleAltIcon />
                            </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                            primary="Profile insights"
                            secondary="Tap into curated data about a mentor's expertise, departmental affiliation, and current engagements."
                        />
                    </ListItem>
                    <ListItem>
                        <ListItemAvatar>
                            <Avatar>
                                <SchoolIcon />
                            </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                            primary="Balanced workloads"
                            secondary="We highlight how many active theses each mentor currently handles to match availability."
                        />
                    </ListItem>
                    <ListItem>
                        <ListItemAvatar>
                            <Avatar>
                                <EditNoteIcon />
                            </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                            primary="One-click profile access"
                            secondary="Select a mentor to review their detailed profile, thesis history, and send a request."
                        />
                    </ListItem>
                </List>
            </Box>
        </AnimatedPage>
    );
}
