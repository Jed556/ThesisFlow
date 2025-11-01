import * as React from 'react';
import { Alert, Button, Stack } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import AnimatedPage from '../../../components/Animate/AnimatedPage/AnimatedPage';
import ProfileView from '../../../components/Profile/ProfileView';
import { getMentorHistory, getMentorSkills } from '../../../data/mentorData';
import { mockAllTheses, mockUserProfiles } from '../../../data/mockData';
import type { NavigationItem } from '../../../types/navigation';
import type { ThesisData } from '../../../types/thesis';
import type { UserProfile } from '../../../types/profile';

export const metadata: NavigationItem = {
    group: 'adviser-editor',
    title: (params) => {
        const email = params?.email as string | undefined;
        if (!email) return 'User Profile';
        const decodedEmail = decodeURIComponent(email);
        const profile = mockUserProfiles.find((user) => user.email === decodedEmail);
        if (!profile) return 'User Profile';
        return `${profile.prefix ? `${profile.prefix} ` : ''}${profile.firstName} ${profile.lastName}`;
    },
    segment: 'profile/:email',
    hidden: true,
};

/**
 * Filter theses the mentor currently handles based on their role.
 */
function useCurrentAssignments(profile: UserProfile | undefined): ThesisData[] {
    return React.useMemo(() => {
        if (!profile) {
            return [];
        }
        return mockAllTheses.filter((thesis) => (
            profile.role === 'adviser' ? thesis.adviser === profile.email : thesis.editor === profile.email
        ));
    }, [profile]);
}

export default function MentorProfilePage() {
    const navigate = useNavigate();
    const { email = '' } = useParams<{ email: string }>();

    const decodedEmail = React.useMemo(() => decodeURIComponent(email), [email]);
    const profile = React.useMemo(
        () => mockUserProfiles.find((user) => user.email === decodedEmail),
        [decodedEmail]
    );
    const currentAssignments = useCurrentAssignments(profile);
    const skills = React.useMemo(
        () => (profile ? getMentorSkills(profile.email) : []),
        [profile?.email]
    );
    const history = React.useMemo(
        () => (profile ? getMentorHistory(profile.email) : []),
        [profile?.email]
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

    if (!profile) {
        return (
            <AnimatedPage variant="fade">
                <Stack spacing={2} alignItems="flex-start">
                    <Alert severity="warning" sx={{ maxWidth: 480 }}>
                        Mentor not found. Please return to the recommendations page and choose another profile.
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
