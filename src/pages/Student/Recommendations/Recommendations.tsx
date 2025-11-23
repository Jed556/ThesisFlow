import * as React from 'react';
import {
    Avatar as MuiAvatar, Box, Card, CardContent, Dialog, DialogContent, DialogTitle,
    Grid, Alert, IconButton, List, ListItem, ListItemAvatar, ListItemText, Skeleton, Tab,
    Tabs, Typography
} from '@mui/material';
import {
    PeopleAlt as PeopleAltIcon,
    School as SchoolIcon,
    EditNote as EditNoteIcon,
    StarRate as StarRateIcon,
    InfoOutlined as InfoOutlinedIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { AnimatedPage } from '../../../components/Animate';
import { useSession } from '@toolpad/core';
import { MentorRecommendationCard } from '../../../components/Profile';
import type { NavigationItem } from '../../../types/navigation';
import { listenUsersByFilter } from '../../../utils/firebase/firestore/user';
import { listenTheses, listenThesesForParticipant } from '../../../utils/firebase/firestore/thesis';
import { getGroupById } from '../../../utils/firebase/firestore/groups';
import { aggregateThesisStats, computeMentorCards, type MentorCardData } from '../../../utils/recommendUtils';
import type { UserProfile } from '../../../types/profile';
import type { ThesisData } from '../../../types/thesis';
import type { Session } from '../../../types/session';
import type { ThesisGroup } from '../../../types/group';

export const metadata: NavigationItem = {
    group: 'mentors',
    index: 0,
    title: 'Recommendations',
    segment: 'recommendation',
    icon: <PeopleAltIcon />,
    roles: ['student'],
};

/**
 * Draft recommendations page listing advisers and editors with quick stats.
 */
export default function AdviserEditorRecommendationsPage() {
    const session = useSession<Session>();
    const studentUid = session?.user?.uid ?? null;
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = React.useState(0);
    const [infoDialogOpen, setInfoDialogOpen] = React.useState(false);
    const [adviserProfiles, setAdviserProfiles] = React.useState<UserProfile[]>([]);
    const [editorProfiles, setEditorProfiles] = React.useState<UserProfile[]>([]);
    const [theses, setTheses] = React.useState<(ThesisData & { id: string })[]>([]);
    const [statisticianProfiles, setStatisticianProfiles] = React.useState<UserProfile[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [studentGroupId, setStudentGroupId] = React.useState<string | null>(null);
    const [studentGroup, setStudentGroup] = React.useState<ThesisGroup | null>(null);
    const [groupError, setGroupError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!studentUid) {
            setStudentGroupId(null);
            setStudentGroup(null);
            setGroupError(null);
            return () => { /* no-op */ };
        }

        const unsubscribe = listenThesesForParticipant(studentUid, {
            onData: (records) => {
                if (records.length === 0) {
                    setStudentGroupId(null);
                    return;
                }
                const prioritized = [...records].sort((a, b) => (
                    new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
                ));
                const primary = prioritized.find((record) => record.leader === studentUid) ?? prioritized[0];
                setStudentGroupId(primary?.groupId ?? null);
            },
            onError: (listenerError) => {
                console.error('Failed to resolve student group for recommendations:', listenerError);
                setStudentGroupId(null);
                setGroupError('Unable to determine your thesis group right now.');
            },
        });

        return () => {
            unsubscribe();
        };
    }, [studentUid]);

    React.useEffect(() => {
        if (!studentGroupId) {
            setStudentGroup(null);
            setGroupError(null);
            return () => { /* no-op */ };
        }

        let cancelled = false;
        setGroupError(null);
        void getGroupById(studentGroupId)
            .then((groupRecord) => {
                if (!cancelled) {
                    setStudentGroup(groupRecord ?? null);
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    console.error('Failed to load student group detail:', err);
                    setStudentGroup(null);
                    setGroupError('Unable to load your thesis group details.');
                }
            });

        return () => {
            cancelled = true;
        };
    }, [studentGroupId]);

    React.useEffect(() => {
        if (!studentUid) {
            setAdviserProfiles([]);
            setEditorProfiles([]);
            setStatisticianProfiles([]);
            setTheses([]);
            setLoading(false);
            setError(null);
            return () => { /* no-op */ };
        }

        let active = true;
        const loaded = { advisers: false, editors: false, statisticians: false, theses: false };

        const tryResolveLoading = () => {
            if (!active) return;
            if (loaded.advisers && loaded.editors && loaded.statisticians && loaded.theses) {
                setLoading(false);
            }
        };

        setLoading(true);
        setError(null);

        const unsubscribeAdvisers = listenUsersByFilter(
            { role: 'adviser' },
            {
                onData: (profilesData) => {
                    if (!active) return;
                    setError(null);
                    setAdviserProfiles(profilesData);
                    loaded.advisers = true;
                    tryResolveLoading();
                },
                onError: (err) => {
                    if (!active) return;
                    console.error('Failed to load adviser recommendations:', err);
                    setError('Unable to load adviser recommendations right now.');
                    setLoading(false);
                },
            }
        );

        const unsubscribeEditors = listenUsersByFilter(
            { role: 'editor' },
            {
                onData: (profilesData) => {
                    if (!active) return;
                    setError(null);
                    setEditorProfiles(profilesData);
                    loaded.editors = true;
                    tryResolveLoading();
                },
                onError: (err) => {
                    if (!active) return;
                    console.error('Failed to load editor recommendations:', err);
                    setError('Unable to load editor recommendations right now.');
                    setLoading(false);
                },
            }
        );

        const unsubscribeStatisticians = listenUsersByFilter(
            { role: 'statistician' },
            {
                onData: (profilesData) => {
                    if (!active) return;
                    setError(null);
                    setStatisticianProfiles(profilesData);
                    loaded.statisticians = true;
                    tryResolveLoading();
                },
                onError: (err) => {
                    if (!active) return;
                    console.error('Failed to load statistician recommendations:', err);
                    setError('Unable to load statistician recommendations right now.');
                    setLoading(false);
                },
            }
        );

        const unsubscribeTheses = listenTheses(undefined, {
            onData: (thesisData) => {
                if (!active) return;
                setError(null);
                setTheses(thesisData);
                loaded.theses = true;
                tryResolveLoading();
            },
            onError: (err) => {
                if (!active) return;
                console.error('Failed to load thesis data for recommendations:', err);
                setError('Unable to load thesis data for recommendations.');
                setLoading(false);
            },
        });

        return () => {
            active = false;
            unsubscribeAdvisers();
            unsubscribeEditors();
            unsubscribeTheses();
            unsubscribeStatisticians();
        };
    }, [studentUid]);

    const thesisStats = React.useMemo(() => aggregateThesisStats(theses), [theses]);
    const filteredAdviserProfiles = React.useMemo(() => {
        const department = studentGroup?.department?.trim();
        if (!department) {
            return adviserProfiles;
        }
        return adviserProfiles.filter((profile) => profile.department?.trim().toLowerCase() === department.toLowerCase());
    }, [adviserProfiles, studentGroup?.department]);

    const adviserCards = React.useMemo(
        () => computeMentorCards(filteredAdviserProfiles, 'adviser', thesisStats),
        [filteredAdviserProfiles, thesisStats]
    );
    const editorCards = React.useMemo(
        () => computeMentorCards(editorProfiles, 'editor', thesisStats),
        [editorProfiles, thesisStats]
    );
    const statisticianCards = React.useMemo(
        () => computeMentorCards(statisticianProfiles, 'statistician', thesisStats),
        [statisticianProfiles, thesisStats]
    );

    const handleTabChange = React.useCallback((_event: React.SyntheticEvent, newValue: number) => {
        setActiveTab(newValue);
    }, []);

    const handleOpenProfile = React.useCallback((profile: UserProfile) => {
        navigate(`/mentor/${profile.uid}`);
    }, [navigate]);

    const renderMentorCard = React.useCallback((model: MentorCardData, roleLabel: 'Adviser' | 'Editor' | 'Statistician') => {
        const slotsFull = model.capacity <= 0 || model.openSlots === 0;
        return (
            <MentorRecommendationCard
                card={model}
                roleLabel={roleLabel}
                onSelect={handleOpenProfile}
                disabled={slotsFull}
            />
        );
    }, [handleOpenProfile]);

    const showLoading = loading;

    if (!session?.user && session?.loading) {
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

    if (showLoading) {
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

    if (!studentUid) {
        return (
            <AnimatedPage variant="fade">
                <Alert severity="info" sx={{ maxWidth: 520 }}>
                    Sign in to view adviser and editor recommendations.
                </Alert>
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

    const departmentHint = studentGroup?.department ? `Department focus: ${studentGroup.department}` : null;

    return (
        <AnimatedPage variant="fade">
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2, position: 'relative' }}>
                <Tabs value={activeTab} onChange={handleTabChange} aria-label="mentor recommendations tabs">
                    <Tab label={`Advisers (${adviserCards.length})`} icon={<SchoolIcon />} iconPosition="start" />
                    <Tab label={`Editors (${editorCards.length})`} icon={<EditNoteIcon />} iconPosition="start" />
                    <Tab label={`Statisticians (${statisticianCards.length})`} icon={<StarRateIcon />} iconPosition="start" />
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
            {departmentHint && (
                <Alert severity="info" sx={{ mb: 2 }}>
                    {departmentHint}
                </Alert>
            )}
            {groupError && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    {groupError}
                </Alert>
            )}

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
                                        {studentGroup?.department
                                            ? 'No advisers in your department are available right now.'
                                            : 'No advisers found. Update the directory to see recommendations.'}
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

            {/* Statisticians Tab */}
            {activeTab === 2 && (
                <Grid container spacing={2}>
                    {statisticianCards.map((card) => (
                        <Grid key={card.profile.uid} size={{ xs: 12, sm: 6, lg: 4 }}>
                            {renderMentorCard(card, 'Statistician')}
                        </Grid>
                    ))}
                    {statisticianCards.length === 0 && (
                        <Grid size={{ xs: 12 }}>
                            <Card variant="outlined">
                                <CardContent>
                                    <Typography variant="body2" color="text.secondary">
                                        No statisticians found. Update the directory to see recommendations.
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
