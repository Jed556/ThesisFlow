import * as React from 'react';
import {
    Alert,
    Button,
    Skeleton,
    Stack,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatedPage } from '../../components/Animate';
import ProfileView from '../../components/Profile/ProfileView';
import type { NavigationItem } from '../../types/navigation';
import type { UserProfile, UserRole, HistoricalThesisEntry } from '../../types/profile';
import type { ThesisData } from '../../types/thesis';
import { onUserProfile } from '../../utils/firebase/firestore/user';
import { listenThesesForMentor, listenThesesForParticipant } from '../../utils/firebase/firestore/thesis';
import { filterActiveMentorTheses, deriveMentorThesisHistory, isCompletedThesisStatus } from '../../utils/mentorProfileUtils';

export const metadata: NavigationItem = {
    title: 'User Profile',
    segment: 'user-management/:uid',
    roles: ['admin', 'developer'],
    hidden: true,
};

const MENTOR_ROLES = new Set<UserRole>(['adviser', 'editor', 'statistician']);

type MentorRole = 'adviser' | 'editor' | 'statistician';

function isMentorRole(role: UserRole | undefined): role is MentorRole {
    return Boolean(role && MENTOR_ROLES.has(role));
}

export default function AdminProfileViewPage() {
    const { uid = '' } = useParams<{ uid: string }>();
    const navigate = useNavigate();

    const [profile, setProfile] = React.useState<UserProfile | null>(null);
    const [assignments, setAssignments] = React.useState<(ThesisData & { id?: string })[]>([]);
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

    const mentorRole = React.useMemo<MentorRole | null>(() => (
        isMentorRole(profile?.role) ? profile.role : null
    ), [profile?.role]);

    React.useEffect(() => {
        // Only attach a listener for mentors or students (participants)
        if (!uid || (!mentorRole && profile?.role !== 'student')) {
            setAssignments([]);
            setAssignmentsLoading(false);
            return () => { /* no-op */ };
        }

        setAssignmentsLoading(true);
        let unsubscribe = () => { /* no-op */ };

        if (mentorRole) {
            unsubscribe = listenThesesForMentor(mentorRole, uid, {
                onData: (records) => {
                    setAssignments(records);
                    setAssignmentsLoading(false);
                },
                onError: (listenerError) => {
                    console.error('Failed to load assignments:', listenerError);
                    setAssignments([]);
                    setAssignmentsLoading(false);
                },
            });
        } else if (profile?.role === 'student') {
            unsubscribe = listenThesesForParticipant(uid, {
                onData: (records) => {
                    setAssignments(records as (ThesisData & { id?: string })[]);
                    setAssignmentsLoading(false);
                },
                onError: (listenerError) => {
                    console.error('Failed to load participant assignments:', listenerError);
                    setAssignments([]);
                    setAssignmentsLoading(false);
                },
            });
        }

        return () => unsubscribe();
    }, [mentorRole, uid, profile?.role]);

    const activeAssignments = React.useMemo(() => (
        (mentorRole || profile?.role === 'student') ? filterActiveMentorTheses(assignments) : []
    ), [assignments, mentorRole, profile?.role]);

    const history = React.useMemo<HistoricalThesisEntry[]>(() => {
        if (!profile) return [];

        if (mentorRole) {
            return deriveMentorThesisHistory(assignments, profile.uid, mentorRole);
        }

        // For student accounts treat participant theses as history once completed
        const completed = assignments.filter((t) => isCompletedThesisStatus(t.overallStatus));
        return completed.map((thesis) => {
            const rawDate = thesis.submissionDate ? new Date(thesis.submissionDate) : null;
            const year = rawDate && !Number.isNaN(rawDate.getTime()) ? rawDate.getFullYear().toString() : '—';
            return {
                year,
                title: thesis.title,
                role: 'Student',
                outcome: thesis.overallStatus ?? '—',
            } as HistoricalThesisEntry;
        }).sort((a, b) => (Number.parseInt(b.year, 10) || 0) - (Number.parseInt(a.year, 10) || 0));
    }, [assignments, mentorRole, profile]);

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
                skills={profile.skills}
                skillRatings={profile.skillRatings}
                currentTheses={(mentorRole || profile.role === 'student') ? activeAssignments : undefined}
                timeline={(mentorRole || profile.role === 'student') ? history : undefined}
                assignmentsEmptyMessage={mentorRole
                    ? assignmentsLoading
                        ? 'Loading mentor assignments…'
                        : 'No active theses for this mentor.'
                    : 'Mentor assignments hidden for this role.'}
                timelineEmptyMessage={mentorRole
                    ? assignmentsLoading
                        ? 'Loading previous theses…'
                        : 'Completed theses will appear once available.'
                    : 'Timeline hidden for this role.'}
                headerCaption={headerCaption}
                backAction={{ label: 'Back to users', onClick: handleBack }}
                floatingBackButton
                sectionVisibility={(mentorRole || profile.role === 'student') ? undefined : { currentTheses: false, timeline: false }}
            />
        </AnimatedPage>
    );
}
