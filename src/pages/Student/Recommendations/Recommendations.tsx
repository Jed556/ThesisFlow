import * as React from 'react';
import {
    Avatar as MuiAvatar, Box, Card, CardContent, Dialog, DialogContent, DialogTitle, Grid,
    Alert, IconButton, List, ListItem, ListItemAvatar, ListItemText, Skeleton, Tab, Tabs, Typography
} from '@mui/material';
import {
    PeopleAlt as PeopleAltIcon, School as SchoolIcon, EditNote as EditNoteIcon,
    StarRate as StarRateIcon, InfoOutlined as InfoOutlinedIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { AnimatedPage } from '../../../components/Animate';
import { useSession } from '@toolpad/core';
import { ExpertRecommendationCard } from '../../../components/Profile';
import UnauthorizedNotice from '../../../layouts/UnauthorizedNotice';
import type { NavigationItem } from '../../../types/navigation';
import { listenUsersByFilter } from '../../../utils/firebase/firestore/user';
import { findGroupById, getGroupsByLeader, getGroupsByMember, listenAllGroups } from '../../../utils/firebase/firestore/groups';
import { aggregateThesisStats, computeExpertCards, type ExpertCardData } from '../../../utils/recommendUtils';
import { isTopicApproved } from '../../../utils/thesisUtils';
import type { UserProfile } from '../../../types/profile';
import type { Session } from '../../../types/session';
import type { ThesisGroup } from '../../../types/group';

export const metadata: NavigationItem = {
    group: 'experts',
    index: 0,
    title: 'Pool of Experts',
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
    const [statisticianProfiles, setStatisticianProfiles] = React.useState<UserProfile[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [studentGroupId, setStudentGroupId] = React.useState<string | null>(null);
    const [studentGroup, setStudentGroup] = React.useState<ThesisGroup | null>(null);
    const [groupError, setGroupError] = React.useState<string | null>(null);
    const [allGroups, setAllGroups] = React.useState<ThesisGroup[]>([]);

    // Track whether we've completed initial group resolution (prevents flicker on re-renders)
    const [groupResolved, setGroupResolved] = React.useState(false);

    React.useEffect(() => {
        if (!studentGroupId) {
            setStudentGroup(null);
            setGroupError(null);
            return () => { /* no-op */ };
        }

        let cancelled = false;
        setGroupError(null);
        void findGroupById(studentGroupId)
            .then((groupRecord) => {
                if (!cancelled) {
                    setStudentGroup(groupRecord ?? null);
                    setGroupResolved(true);
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    console.error('Failed to load student group detail:', err);
                    setStudentGroup(null);
                    setGroupError('Unable to load your thesis group details.');
                    setGroupResolved(true);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [studentGroupId]);

    React.useEffect(() => {
        if (!studentUid) {
            setGroupResolved(true);
            return () => { /* no-op */ };
        }

        if (studentGroupId) {
            // Group ID already known, skip fallback
            return () => { /* no-op */ };
        }

        let cancelled = false;
        void (async () => {
            try {
                const [leaderGroups, memberGroups] = await Promise.all([
                    getGroupsByLeader(studentUid),
                    getGroupsByMember(studentUid),
                ]);

                if (cancelled) {
                    return;
                }

                const combined = [...leaderGroups, ...memberGroups];
                if (combined.length === 0) {
                    // No groups found - still mark as resolved
                    setGroupResolved(true);
                    return;
                }

                combined.sort((a, b) => (
                    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
                ));
                const primaryGroup = combined.find((groupRecord) => groupRecord.status !== 'archived') ?? combined[0];
                setStudentGroup((previous) => previous ?? primaryGroup);
                setStudentGroupId((previous) => previous ?? primaryGroup.id);
                setGroupResolved(true);
            } catch (fallbackError) {
                if (!cancelled) {
                    console.error('Failed to resolve thesis group fallback for recommendations:', fallbackError);
                    setGroupResolved(true);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [studentUid, studentGroupId]);

    // Derive the student's department from the group record (used for filtering experts)
    const studentDepartment = studentGroup?.department?.trim() ?? null;

    React.useEffect(() => {
        // Reset profiles when user logs out
        if (!studentUid) {
            setAdviserProfiles([]);
            setEditorProfiles([]);
            setStatisticianProfiles([]);
            setLoading(false);
            setError(null);
            return () => { /* no-op */ };
        }

        // Wait until group resolution is complete before querying experts by department
        // This avoids fetching all users and filtering client-side, and prevents flicker
        if (!groupResolved) {
            // Still resolving the student group - keep loading state
            setLoading(true);
            return () => { /* no-op */ };
        }

        let active = true;
        const loaded = { advisers: false, editors: false, statisticians: false };

        const tryResolveLoading = () => {
            if (!active) return;
            if (loaded.advisers && loaded.editors && loaded.statisticians) {
                setLoading(false);
            }
        };

        setLoading(true);
        setError(null);

        // Build filter for advisers: role + department (if available)
        // Query by department to reduce Firestore reads and data transfer
        const adviserFilter = studentDepartment
            ? { role: 'adviser' as const, department: studentDepartment }
            : { role: 'adviser' as const };

        const unsubscribeAdvisers = listenUsersByFilter(
            adviserFilter,
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

        return () => {
            active = false;
            unsubscribeAdvisers();
            unsubscribeEditors();
            unsubscribeStatisticians();
        };
    }, [studentUid, groupResolved, studentDepartment]);

    React.useEffect(() => {
        const unsubscribe = listenAllGroups({
            onData: (groups) => {
                setAllGroups(groups);
            },
            onError: (err) => {
                console.error('Failed to load groups for expert workloads:', err);
            },
        });

        return () => {
            unsubscribe();
        };
    }, []);

    const thesisStats = React.useMemo(
        () => aggregateThesisStats(allGroups),
        [allGroups]
    );

    // Advisers are now already filtered by department at query level
    // No additional client-side filtering needed
    const adviserCards = React.useMemo(
        () => computeExpertCards(adviserProfiles, 'adviser', thesisStats),
        [adviserProfiles, thesisStats]
    );
    const editorCards = React.useMemo(
        () => computeExpertCards(editorProfiles, 'editor', thesisStats),
        [editorProfiles, thesisStats]
    );
    const statisticianCards = React.useMemo(
        () => computeExpertCards(statisticianProfiles, 'statistician', thesisStats),
        [statisticianProfiles, thesisStats]
    );

    const topicApproved = React.useMemo(
        () => isTopicApproved(studentGroup?.thesis),
        [studentGroup?.thesis]
    );

    const hasThesisRecord = React.useMemo(() => (
        Boolean(studentGroup?.thesis?.id)
        || Boolean(studentGroup?.thesis?.title)
    ), [studentGroup?.thesis?.id, studentGroup?.thesis?.title]);

    const hasGroupRecord = Boolean(studentGroupId || studentGroup);
    const editorTabLocked = !hasGroupRecord;
    const adviserTabLocked = !(topicApproved || hasThesisRecord);
    const adviserAssigned = Boolean(studentGroup?.members?.adviser);
    const statisticianTabLocked = !adviserAssigned;

    const handleTabChange = React.useCallback((_event: React.SyntheticEvent, newValue: number) => {
        setActiveTab(newValue);
    }, []);

    const handleOpenProfile = React.useCallback((profile: UserProfile) => {
        navigate(`/expert/${profile.uid}`);
    }, [navigate]);

    const renderExpertCard = React.useCallback((model: ExpertCardData, roleLabel: 'Adviser' | 'Editor' | 'Statistician') => {
        const slotsFull = model.capacity > 0 && model.openSlots === 0;
        return (
            <ExpertRecommendationCard
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
                <Tabs value={activeTab} onChange={handleTabChange} aria-label="expert recommendations tabs">
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
                adviserTabLocked ? (
                    <UnauthorizedNotice
                        variant="box"
                        icon={SchoolIcon}
                        title="Topic approval required"
                        description="Wait for your thesis proposal to be approved before requesting a research adviser."
                        sx={{ minHeight: 'auto', py: 6 }}
                    />
                ) : (
                    <Grid container spacing={2}>
                        {adviserCards.map((card) => (
                            <Grid key={card.profile.uid} size={{ xs: 12, sm: 6, lg: 4 }}>
                                {renderExpertCard(card, 'Adviser')}
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
                )
            )}

            {/* Editors Tab */}
            {activeTab === 1 && (
                editorTabLocked ? (
                    <UnauthorizedNotice
                        variant="box"
                        icon={EditNoteIcon}
                        title="Create your research group first"
                        description="Set up your thesis group to browse and request a research editor."
                        sx={{ minHeight: 'auto', py: 6 }}
                    />
                ) : (
                    <Grid container spacing={2}>
                        {editorCards.map((card) => (
                            <Grid key={card.profile.uid} size={{ xs: 12, sm: 6, lg: 4 }}>
                                {renderExpertCard(card, 'Editor')}
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
                )
            )}

            {/* Statisticians Tab */}
            {activeTab === 2 && (
                statisticianTabLocked ? (
                    <UnauthorizedNotice
                        variant="box"
                        icon={StarRateIcon}
                        title="Confirm your adviser first"
                        description="Assign a research adviser so we can coordinate statistician availability for your team."
                        sx={{ minHeight: 'auto', py: 6 }}
                    />
                ) : (
                    <Grid container spacing={2}>
                        {statisticianCards.map((card) => (
                            <Grid key={card.profile.uid} size={{ xs: 12, sm: 6, lg: 4 }}>
                                {renderExpertCard(card, 'Statistician')}
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
                )
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
                                        Tap into curated data about a expert's expertise, departmental affiliation,
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
                                secondary="We highlight how many active theses each expert currently handles to match availability."
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
                                secondary="Select a expert to review their detailed profile, thesis history, and send a request."
                            />
                        </ListItem>
                    </List>
                </DialogContent>
            </Dialog>
        </AnimatedPage>
    );
}
