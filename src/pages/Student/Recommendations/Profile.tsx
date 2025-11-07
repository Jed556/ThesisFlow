import * as React from 'react';
import { Alert, Button, Skeleton, Stack } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import AnimatedPage from '../../../components/Animate/AnimatedPage/AnimatedPage';
import ProfileView from '../../../components/Profile/ProfileView';
import { getUserById } from '../../../utils/firebase/firestore/profile';
import { getAllTheses } from '../../../utils/firebase/firestore/thesis';
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
function deriveThesisHistory(
    allTheses: (ThesisData & { id: string })[],
    userUid: string,
    userRole: 'adviser' | 'editor'
): HistoricalThesisEntry[] {
    // Filter theses where user was adviser/editor and thesis is completed
    const completedStatuses = ['Completed', 'Defended', 'Published', 'Archived'];
    const userTheses = allTheses.filter((thesis) => {
        const isUserInvolved = userRole === 'adviser'
            ? thesis.adviser === userUid
            : thesis.editor === userUid;
        const isCompleted = completedStatuses.some(status =>
            thesis.overallStatus.toLowerCase().includes(status.toLowerCase())
        );
        return isUserInvolved && isCompleted;
    });

    // Map to HistoricalThesisEntry format
    return userTheses.map((thesis) => {
        const submissionYear = new Date(thesis.submissionDate).getFullYear().toString();
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

    // Load profile and thesis data
    React.useEffect(() => {
        let mounted = true;

        async function loadData() {
            try {
                setLoading(true);
                setError(null);

                // Fetch user profile by UID
                const userProfile = await getUserById(uid);
                if (!mounted) return;

                if (!userProfile) {
                    setError('Profile not found');
                    setLoading(false);
                    return;
                }

                setProfile(userProfile);

                // Fetch all theses
                const allTheses = await getAllTheses();
                if (!mounted) return;

                // Filter current assignments (active theses where user is adviser/editor)
                const activeTheses = allTheses.filter((thesis) => {
                    const isUserInvolved = userProfile.role === 'adviser'
                        ? thesis.adviser === userProfile.uid
                        : thesis.editor === userProfile.uid;

                    // Consider thesis active if not completed
                    const completedStatuses = ['Completed', 'Defended', 'Published', 'Archived'];
                    const isActive = !completedStatuses.some(status =>
                        thesis.overallStatus.toLowerCase().includes(status.toLowerCase())
                    );

                    return isUserInvolved && isActive;
                });

                setCurrentAssignments(activeTheses);

                // Derive historical thesis entries
                const roleForHistory = userProfile.role === 'adviser' ? 'adviser' : 'editor';
                const thesisHistory = deriveThesisHistory(allTheses, userProfile.uid, roleForHistory);
                setHistory(thesisHistory);

                setLoading(false);
            } catch (err) {
                if (!mounted) return;
                console.error('Error loading mentor profile:', err);
                setError('Failed to load profile data');
                setLoading(false);
            }
        }

        loadData();

        return () => {
            mounted = false;
        };
    }, [uid]);

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
