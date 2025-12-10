import * as React from 'react';
import { Alert, Button, Skeleton, Stack } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatedPage } from '../../components/Animate';
import ProfileView from '../../components/Profile/ProfileView';
import type { NavigationItem } from '../../types/navigation';
import type { UserProfile, UserRole, HistoricalThesisEntry } from '../../types/profile';
import type { ThesisGroup } from '../../types/group';
import { onUserProfile } from '../../utils/firebase/firestore/user';
import {
    listenGroupsByExpertRole, getGroupsByLeader, getGroupsByMember,
} from '../../utils/firebase/firestore/groups';
import {
    filterActiveGroups, deriveExpertThesisHistory, isCompletedGroupStatus,
} from '../../utils/expertProfileUtils';

export const metadata: NavigationItem = {
    title: 'User Profile',
    segment: 'user-management/:uid',
    roles: ['admin', 'developer'],
    hidden: true,
};

const EXPERT_ROLES = new Set<UserRole>(['adviser', 'editor', 'statistician']);

type ExpertRole = 'adviser' | 'editor' | 'statistician';

function isExpertRole(role: UserRole | undefined): role is ExpertRole {
    return Boolean(role && EXPERT_ROLES.has(role));
}

export default function AdminProfileViewPage() {
    const { uid = '' } = useParams<{ uid: string }>();
    const navigate = useNavigate();

    const [profile, setProfile] = React.useState<UserProfile | null>(null);
    const [assignments, setAssignments] = React.useState<ThesisGroup[]>([]);
    const [profileLoading, setProfileLoading] = React.useState(true);
    const [assignmentsLoading, setAssignmentsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (!uid) {
            setProfile(null);
            setError('Missing user identifier.');
            setProfileLoading(false);
            return () => { /* no-op */ };
        }

        setProfileLoading(true);
        const unsubscribe = onUserProfile(uid, (data) => {
            setProfile(data);
            setError(data ? null : 'Profile not found.');
            setProfileLoading(false);
        }, (listenerError) => {
            console.error('Failed to load profile:', listenerError);
            setProfile(null);
            setError('Failed to load profile.');
            setProfileLoading(false);
        });

        return () => {
            unsubscribe();
        };
    }, [uid]);

    const expertRole = React.useMemo<ExpertRole | null>(() => (
        isExpertRole(profile?.role) ? profile.role : null
    ), [profile?.role]);

    React.useEffect(() => {
        // Only attach a listener for experts or students (participants)
        if (!uid || (!expertRole && profile?.role !== 'student')) {
            setAssignments([]);
            setAssignmentsLoading(false);
            return () => { /* no-op */ };
        }

        setAssignmentsLoading(true);
        let unsubscribe = () => { /* no-op */ };

        if (expertRole) {
            unsubscribe = listenGroupsByExpertRole(expertRole, uid, {
                onData: (groups: ThesisGroup[]) => {
                    setAssignments(groups);
                    setAssignmentsLoading(false);
                },
                onError: (listenerError: Error) => {
                    console.error('Failed to load assignments:', listenerError);
                    setAssignments([]);
                    setAssignmentsLoading(false);
                },
            });
        } else if (profile?.role === 'student') {
            // For students, fetch groups where they are leader or member
            (async () => {
                try {
                    const leaderGroups = await getGroupsByLeader(uid);
                    const memberGroups = await getGroupsByMember(uid);
                    // Combine and deduplicate by group id
                    const allGroups = [...leaderGroups];
                    for (const group of memberGroups) {
                        if (!allGroups.some((g) => g.id === group.id)) {
                            allGroups.push(group);
                        }
                    }
                    setAssignments(allGroups);
                    setAssignmentsLoading(false);
                } catch (listenerError) {
                    console.error('Failed to load participant assignments:', listenerError);
                    setAssignments([]);
                    setAssignmentsLoading(false);
                }
            })();
            // No unsubscribe needed for async fetch
        }

        return () => unsubscribe();
    }, [expertRole, uid, profile?.role]);

    const activeAssignments = React.useMemo(() => (
        (expertRole || profile?.role === 'student') ? filterActiveGroups(assignments) : []
    ), [assignments, expertRole, profile?.role]);

    const history = React.useMemo<HistoricalThesisEntry[]>(() => {
        if (!profile) return [];

        if (expertRole) {
            // Pass empty map - deriveExpertThesisHistory falls back to group.name if thesis not found
            // TODO: Consider fetching theses for completed groups if accurate title is needed
            return deriveExpertThesisHistory(assignments, new Map(), profile.uid, expertRole);
        }

        // For student accounts treat participant groups as history once completed
        const completed = assignments.filter((g) => isCompletedGroupStatus(g.status));
        return completed.map((group) => {
            // Thesis data is in subcollection, fall back to group name for display
            // TODO: Fetch theses if accurate title/date is needed
            return {
                year: '—',
                title: group.name,
                role: 'Student',
                outcome: group.status ?? '—',
            } as HistoricalThesisEntry;
        }).sort((a, b) => (Number.parseInt(b.year, 10) || 0) - (Number.parseInt(a.year, 10) || 0));
    }, [assignments, expertRole, profile]);

    const handleBack = React.useCallback(() => {
        navigate(-1);
    }, [navigate]);

    const headerCaption = React.useMemo(() => {
        if (!profile) return undefined;
        return profile.role === 'student'
            ? profile.course ?? undefined
            : profile.department ?? undefined;
    }, [profile]);

    if (profileLoading) {
        return (
            <AnimatedPage variant="fade">
                <Stack spacing={2}>
                    <Skeleton variant="text" width={280} height={48} />
                    <Skeleton variant="rectangular" height={320} />
                    <Skeleton variant="rectangular" height={320} />
                </Stack>
            </AnimatedPage>
        );
    }

    if (error || !profile) {
        return (
            <AnimatedPage variant="fade">
                <Stack spacing={2} alignItems="flex-start">
                    <Alert severity="warning">
                        {error || 'Unable to load profile details right now.'}
                    </Alert>
                    <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={handleBack}>
                        Back to users
                    </Button>
                </Stack>
            </AnimatedPage>
        );
    }

    return (
        <AnimatedPage variant="fade">
            <ProfileView
                profile={profile}
                skills={profile.skillRatings?.map((s) => s.name)}
                skillRatings={profile.skillRatings}
                currentGroups={(expertRole || profile.role === 'student') ? activeAssignments : undefined}
                timeline={(expertRole || profile.role === 'student') ? history : undefined}
                assignmentsEmptyMessage={expertRole
                    ? assignmentsLoading
                        ? 'Loading expert assignments…'
                        : 'No active theses for this expert.'
                    : 'Expert assignments hidden for this role.'}
                timelineEmptyMessage={expertRole
                    ? assignmentsLoading
                        ? 'Loading previous theses…'
                        : 'Completed theses will appear once available.'
                    : 'Timeline hidden for this role.'}
                headerCaption={headerCaption}
                backAction={{ label: 'Back to users', onClick: handleBack }}
                floatingBackButton
                sectionVisibility={(expertRole || profile.role === 'student') ? undefined : { currentTheses: false, timeline: false }}
            />
        </AnimatedPage>
    );
}
