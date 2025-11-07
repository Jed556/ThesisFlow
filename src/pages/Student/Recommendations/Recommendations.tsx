import * as React from 'react';
import {
    Avatar as MuiAvatar, Box, Card, CardContent, Dialog, DialogContent, DialogTitle, Grid, Alert,
    IconButton, List, ListItem, ListItemAvatar, ListItemText, Tab, Tabs, Typography, Skeleton
} from '@mui/material';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import SchoolIcon from '@mui/icons-material/School';
import EditNoteIcon from '@mui/icons-material/EditNote';
import StarRateIcon from '@mui/icons-material/StarRate';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useNavigate, Outlet, useLocation } from 'react-router-dom';
import { AnimatedPage } from '../../../components/Animate';
import { type ProfileCardStat, ProfileCard } from '../../../components/Profile';
import type { NavigationItem } from '../../../types/navigation';
import { getAllUsers } from '../../../utils/firebase/firestore/profile';
import { getAllTheses } from '../../../utils/firebase/firestore/thesis';
import { aggregateThesisStats, computeMentorCards, type MentorCardData } from '../../../utils/recommendUtils';
import type { UserProfile } from '../../../types/profile';
import type { ThesisData } from '../../../types/thesis';

export const metadata: NavigationItem = {
    group: 'adviser-editor',
    index: 0,
    title: 'Recommendations',
    segment: 'recommendation',
    icon: <PeopleAltIcon />,
    children: ['profile/:uid'],
    roles: ['student', 'admin'],
};

/**
 * Draft recommendations page listing advisers and editors with quick stats.
 */
export default function AdviserEditorRecommendationsPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [activeTab, setActiveTab] = React.useState(0);
    const [infoDialogOpen, setInfoDialogOpen] = React.useState(false);
    const [profiles, setProfiles] = React.useState<UserProfile[]>([]);
    const [theses, setTheses] = React.useState<(ThesisData & { id: string })[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        let mounted = true;

        async function loadData() {
            try {
                setLoading(true);
                setError(null);
                const [userProfiles, thesisData] = await Promise.all([
                    getAllUsers(),
                    getAllTheses(),
                ]);
                if (!mounted) return;
                setProfiles(userProfiles);
                setTheses(thesisData);
            } catch (err) {
                if (!mounted) return;
                console.error('Error loading mentor recommendations:', err);
                setError('Failed to load mentor recommendations. Please try again later.');
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        loadData();

        return () => {
            mounted = false;
        };
    }, []);

    const thesisStats = React.useMemo(() => aggregateThesisStats(theses), [theses]);
    const advisers = React.useMemo(
        () => profiles.filter((profile) => profile.role === 'adviser'),
        [profiles]
    );
    const editors = React.useMemo(
        () => profiles.filter((profile) => profile.role === 'editor'),
        [profiles]
    );

    const adviserCards = React.useMemo(
        () => computeMentorCards(advisers, 'adviser', thesisStats),
        [advisers, thesisStats]
    );
    const editorCards = React.useMemo(
        () => computeMentorCards(editors, 'editor', thesisStats),
        [editors, thesisStats]
    );

    // Check if we're on a child route (profile page)
    const isProfileRoute = location.pathname.includes('/profile/');

    // If on profile route, render the nested route
    if (isProfileRoute) {
        return <Outlet />;
    }

    if (loading) {
        return (
            <AnimatedPage variant="fade">
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <Skeleton variant="text" width={220} height={42} />
                    <Grid container spacing={2}>
                        {Array.from({ length: 6 }).map((_, idx) => (
                            <Grid key={idx} size={{ xs: 12, sm: 6, lg: 4 }}>
                                <Card variant="outlined" sx={{ height: '100%' }}>
                                    <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        <Skeleton variant="circular" width={48} height={48} />
                                        <Skeleton variant="text" width="70%" />
                                        <Skeleton variant="rectangular" width="100%" height={80} />
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                </Box>
            </AnimatedPage>
        );
    }

    if (error) {
        return (
            <AnimatedPage variant="fade">
                <Alert severity="error" sx={{ maxWidth: 520 }}>
                    {error}
                </Alert>
            </AnimatedPage>
        );
    }

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setActiveTab(newValue);
    };

    const handleOpenProfile = React.useCallback((profile: UserProfile) => {
        navigate(`profile/${profile.uid}`);
    }, [navigate]);

    const renderMentorCard = React.useCallback((model: MentorCardData, roleLabel: 'Adviser' | 'Editor') => {
        const cardStats: ProfileCardStat[] = [
            {
                label: 'Active Teams',
                value: model.activeCount,
            },
            {
                label: 'Open Slots',
                value: model.capacity > 0 ? `${model.openSlots}/${model.capacity}` : 'Not accepting',
            },
            {
                label: 'Compatibility',
                value: `${model.compatibility}%`,
                icon: <StarRateIcon sx={{ fontSize: 18, color: 'warning.main' }} />,
                color: 'primary.main',
            },
        ];

        return (
            <ProfileCard
                key={model.profile.uid}
                profile={model.profile}
                roleLabel={roleLabel}
                skills={model.profile.skills ?? []}
                stats={cardStats}
                cornerNumber={model.rank}
                showDivider
                showSkills={(model.profile.skills?.length ?? 0) > 0}
                onClick={() => handleOpenProfile(model.profile)}
            />
        );
    }, [handleOpenProfile]);

    return (
        <AnimatedPage variant="fade">
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2, position: 'relative' }}>
                <Tabs value={activeTab} onChange={handleTabChange} aria-label="mentor recommendations tabs">
                    <Tab label={`Advisers (${adviserCards.length})`} icon={<SchoolIcon />} iconPosition="start" />
                    <Tab label={`Editors (${editorCards.length})`} icon={<EditNoteIcon />} iconPosition="start" />
                </Tabs>
                <IconButton
                    onClick={() => setInfoDialogOpen(true)}
                    sx={{
                        position: 'absolute',
                        right: 8,
                        top: '30%',
                    }}
                    aria-label="How recommendations work"
                >
                    <InfoOutlinedIcon />
                </IconButton>
            </Box>

            {/* Advisers Tab */}
            {activeTab === 0 && (
                <Grid container spacing={2}>
                    {adviserCards.map((card) => (
                        <Grid key={card.profile.uid} size={{ xs: 12, sm: 6, lg: 4 }}>
                            {renderMentorCard(card, 'Adviser')}
                        </Grid>
                    ))}
                    {adviserCards.length === 0 && (
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
                    {editorCards.map((card) => (
                        <Grid key={card.profile.uid} size={{ xs: 12, sm: 6, lg: 4 }}>
                            {renderMentorCard(card, 'Editor')}
                        </Grid>
                    ))}
                    {editorCards.length === 0 && (
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

            <Dialog
                open={infoDialogOpen}
                onClose={() => setInfoDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>How recommendations work</DialogTitle>
                <DialogContent>
                    <List dense>
                        <ListItem>
                            <ListItemAvatar>
                                <MuiAvatar>
                                    <PeopleAltIcon />
                                </MuiAvatar>
                            </ListItemAvatar>
                            <ListItemText
                                primary="Profile insights"
                                secondary={(
                                    <Typography variant="body2" color="text.secondary">
                                        Tap into curated data about a mentor's expertise, departmental affiliation,
                                        and current engagements.
                                    </Typography>
                                )}
                            />
                        </ListItem>
                        <ListItem>
                            <ListItemAvatar>
                                <MuiAvatar>
                                    <SchoolIcon />
                                </MuiAvatar>
                            </ListItemAvatar>
                            <ListItemText
                                primary="Balanced workloads"
                                secondary="We highlight how many active theses each mentor currently handles to match availability."
                            />
                        </ListItem>
                        <ListItem>
                            <ListItemAvatar>
                                <MuiAvatar>
                                    <EditNoteIcon />
                                </MuiAvatar>
                            </ListItemAvatar>
                            <ListItemText
                                primary="One-click profile access"
                                secondary="Select a mentor to review their detailed profile, thesis history, and send a request."
                            />
                        </ListItem>
                    </List>
                </DialogContent>
            </Dialog>
        </AnimatedPage>
    );
}
