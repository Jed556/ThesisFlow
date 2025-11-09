import * as React from 'react';
import { Alert, Button, Skeleton, Stack } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import AnimatedPage from '../../../components/Animate/AnimatedPage/AnimatedPage';
import ProfileView from '../../../components/Profile/ProfileView';
import { onUserProfile } from '../../../utils/firebase/firestore/user';
import { listenThesesForMentor } from '../../../utils/firebase/firestore/thesis';
import type { NavigationItem } from '../../../types/navigation';
import type { ThesisData } from '../../../types/thesis';
import type { UserProfile, HistoricalThesisEntry } from '../../../types/profile';

export const metadata: NavigationItem = {
    group: 'adviser-editor',
    title: (params) => {
        const uid = params?.uid as string | undefined;
        if (!uid) return 'User Profile';
        return 'User Profile'; // Will be updated when profile loads
    },
    segment: 'profile/:uid',
    hidden: true,
};

/**
 * Derive historical thesis entries from completed theses
 */
const COMPLETED_STATUSES = ['completed', 'defended', 'published', 'archived'] as const;

function deriveThesisHistory(
    allTheses: (ThesisData & { id: string })[],
    userUid: string,
    userRole: 'adviser' | 'editor'
): HistoricalThesisEntry[] {
    // Filter theses where user was adviser/editor and thesis is completed
    const userTheses = allTheses.filter((thesis) => {
        const isUserInvolved = userRole === 'adviser'
            ? thesis.adviser === userUid
            : thesis.editor === userUid;
        const statusValue = (thesis.overallStatus ?? '').toLowerCase();
        const isCompleted = COMPLETED_STATUSES.some((status) => statusValue.includes(status));
        return isUserInvolved && isCompleted;
    });

    // Map to HistoricalThesisEntry format
    return userTheses.map((thesis) => {
        const rawDate = thesis.submissionDate ? new Date(thesis.submissionDate) : null;
        const submissionYear = rawDate && !Number.isNaN(rawDate.getTime())
            ? rawDate.getFullYear().toString()
            : '—';
        return {
            year: submissionYear,
            title: thesis.title,
            role: userRole === 'adviser' ? 'Adviser' : 'Editor',
            outcome: thesis.overallStatus,
        };
    }).sort((a, b) => parseInt(b.year) - parseInt(a.year)); // Sort by year descending
}

export default function MentorProfilePage() {
    const navigate = useNavigate();
    const { uid = '' } = useParams<{ uid: string }>();

    // State for async data
    const [profile, setProfile] = React.useState<UserProfile | null>(null);
    const [currentAssignments, setCurrentAssignments] = React.useState<ThesisData[]>([]);
    const [history, setHistory] = React.useState<HistoricalThesisEntry[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [profileLoaded, setProfileLoaded] = React.useState(false);
    const [thesesLoaded, setThesesLoaded] = React.useState(false);

    React.useEffect(() => {
        setLoading(!(profileLoaded && thesesLoaded));
    }, [profileLoaded, thesesLoaded]);

    // Load profile and thesis data
    React.useEffect(() => {
        setError(null);
        setProfile(null);
        setCurrentAssignments([]);
        setHistory([]);
        setProfileLoaded(false);
        setThesesLoaded(false);

        if (!uid) {
            setError('Profile not found');
            setProfileLoaded(true);
            setThesesLoaded(true);
            return () => { /* no-op */ };
        }

        const unsubscribeProfile = onUserProfile(uid, (profileData) => {
            if (!profileData) {
                setProfile(null);
                setError('Profile not found');
                setProfileLoaded(true);
                return;
            }

            setProfile(profileData);
            setProfileLoaded(true);
        });

        return () => {
            unsubscribeProfile();
        };
    }, [uid]);

    React.useEffect(() => {
        if (!profile || (profile.role !== 'adviser' && profile.role !== 'editor')) {
            setCurrentAssignments([]);
            setHistory([]);
            setThesesLoaded(true);
            return () => { /* no-op */ };
        }
 
        setThesesLoaded(false);

        const unsubscribe = listenThesesForMentor(profile.role, profile.uid, {
            onData: (records) => {
                setError(null);
                const activeTheses = records.filter((thesis) => {
                    const statusValue = (thesis.overallStatus ?? '').toLowerCase();
                    const isCompleted = COMPLETED_STATUSES.some((status) => statusValue.includes(status));
                    return !isCompleted;
                });

                setCurrentAssignments(activeTheses);
                // Narrow role to adviser|editor — this branch already ensures profile.role is one of those values
                const role = profile.role as 'adviser' | 'editor';
                const thesisHistory = deriveThesisHistory(records, profile.uid, role);
                setHistory(thesisHistory);
                setThesesLoaded(true);
            },
            onError: (listenerError) => {
                console.error('Failed to listen for mentor assignments:', listenerError);
                setError('Unable to load thesis assignments for this mentor at the moment.');
                setThesesLoaded(true);
            },
        });

        return () => {
            unsubscribe();
        };
    }, [profile]);

    const skills = React.useMemo(
        () => profile?.skills ?? [],
        [profile?.skills]
    );

    const roleLabel = React.useMemo(() => {
        if (!profile?.role) {
            return 'Mentor';
        }
        return profile.role.charAt(0).toUpperCase() + profile.role.slice(1);
    }, [profile?.role]);

    const handleBack = React.useCallback(() => {
        navigate('/advisers');
    }, [navigate]);

    const handleRequestMentor = React.useCallback(() => {
        window.alert(`Request sent! A coordinator will confirm ${roleLabel.toLowerCase()} availability shortly.`);
    }, [roleLabel]);

    // Loading state
    if (loading) {
        return (
            <AnimatedPage variant="fade">
                <Stack spacing={2}>
                    <Skeleton variant="text" width={300} height={60} />
                    <Skeleton variant="rectangular" width="100%" height={400} />
                </Stack>
            </AnimatedPage>
        );
    }

    // Error or not found state
    if (error || !profile) {
        return (
            <AnimatedPage variant="fade">
                <Stack spacing={2} alignItems="flex-start">
                    <Alert severity="warning" sx={{ maxWidth: 480 }}>
                        {error || 'Mentor not found. Please return to the recommendations page and choose another profile.'}
                    </Alert>
                    <Button onClick={handleBack}>Back to recommendations</Button>
                </Stack>
            </AnimatedPage>
        );
    }

    return (
        <AnimatedPage variant="slideUp">
            <ProfileView
                profile={profile}
                currentTheses={currentAssignments}
                skills={skills}
                timeline={history}
                assignmentsEmptyMessage={`No active theses assigned as ${roleLabel.toLowerCase()} yet.`}
                timelineEmptyMessage="Historical thesis records will appear here once available."
                primaryAction={{
                    label: `Request as ${roleLabel.toLowerCase()}`,
                    onClick: handleRequestMentor,
                }}
                backAction={{
                    label: 'Back to recommendations',
                    onClick: handleBack,
                }}
            />
        </AnimatedPage>
    );
}
