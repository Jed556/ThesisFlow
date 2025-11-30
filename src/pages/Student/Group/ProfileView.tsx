import * as React from 'react';
import { Alert, Box, Button, Skeleton, Stack } from '@mui/material';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import AnimatedPage from '../../../components/Animate/AnimatedPage/AnimatedPage';
import ProfileView from '../../../components/Profile/ProfileView';
import { getGroupsByMember } from '../../../utils/groupUtils';
import { buildGroupProfileMap } from '../../../utils/groupUtils';
import type { ThesisGroup } from '../../../types/group';
import type { NavigationItem } from '../../../types/navigation';
import type { UserProfile } from '../../../types/profile';
import { findUserById } from '../../../utils/firebase/firestore/user';

interface GroupProfileLocationState {
    profile?: UserProfile;
}

export const metadata: NavigationItem = {
    title: 'Group Member Profile',
    segment: 'group/profile/:uid',
    hidden: true,
    roles: ['student'],
};

export default function GroupMemberProfileViewPage() {
    const navigate = useNavigate();
    const { uid = '' } = useParams<{ uid: string }>();
    const location = useLocation();
    const locationState = location.state as GroupProfileLocationState | null;
    const prefetchedProfile = React.useMemo(() => {
        const profileRecord = locationState?.profile;
        if (profileRecord && profileRecord.uid === uid) {
            return profileRecord;
        }
        return null;
    }, [locationState, uid]);

    const [profile, setProfile] = React.useState<UserProfile | null>(prefetchedProfile);
    const [loading, setLoading] = React.useState(!prefetchedProfile);
    const [error, setError] = React.useState<string | null>(null);
    const [memberGroup, setMemberGroup] = React.useState<ThesisGroup | null>(null);
    const [groupUsers, setGroupUsers] = React.useState<Map<string, UserProfile> | null>(null);

    React.useEffect(() => {
        let cancelled = false;

        if (!uid) {
            setProfile(null);
            setError('Profile not found.');
            setLoading(false);
            return () => {
                cancelled = true;
            };
        }

        if (prefetchedProfile) {
            setProfile(prefetchedProfile);
            setError(null);
            setLoading(false);
            void (async () => {
                try {
                    const groups = await getGroupsByMember(prefetchedProfile.uid);
                    const target = (groups ?? [])[0] ?? null;
                    setMemberGroup(target);
                    if (target) {
                        const map = await buildGroupProfileMap(target);
                        setGroupUsers(map);
                    }
                } catch (err) {
                    console.error('Failed to load member groups:', err);
                }
            })();
            return () => {
                cancelled = true;
            };
        }

        setLoading(true);
        setError(null);
        void findUserById(uid)
            .then((profileData) => {
                if (cancelled) return;
                if (!profileData) {
                    setProfile(null);
                    setError('Profile not found.');
                } else {
                    setProfile(profileData);
                    setError(null);
                    void (async () => {
                        try {
                            const groups = await getGroupsByMember(uid);
                            const target = (groups ?? [])[0] ?? null;
                            setMemberGroup(target);
                            if (target) {
                                const map = await buildGroupProfileMap(target);
                                setGroupUsers(map);
                            }
                        } catch (err) {
                            console.error('Failed to load member groups:', err);
                        }
                    })();
                }
            })
            .catch((err) => {
                if (cancelled) return;
                console.error('Failed to load profile:', err);
                setProfile(null);
                setError('Unable to load this profile right now.');
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [prefetchedProfile, uid]);

    const handleBackToGroup = React.useCallback(() => {
        navigate('/group');
    }, [navigate]);

    const renderLoadingState = () => (
        <Box sx={{ p: 3 }}>
            <Stack spacing={2}>
                <Skeleton variant="text" width="60%" height={48} />
                <Skeleton variant="rectangular" height={320} />
            </Stack>
        </Box>
    );

    const renderErrorState = (message: string) => (
        <Stack spacing={2} alignItems="flex-start" sx={{ p: 3 }}>
            <Alert severity="error">{message}</Alert>
            <Button variant="contained" onClick={handleBackToGroup}>
                Back to My Group
            </Button>
        </Stack>
    );

    return (
        <AnimatedPage variant="slideUp">
            {loading && renderLoadingState()}
            {!loading && error && renderErrorState(error)}
            {!loading && !error && profile ? (
                <ProfileView
                    profile={profile}
                    backAction={{ label: 'Back to My Group', onClick: handleBackToGroup }}
                    floatingBackButton
                    group={memberGroup}
                    groupUsers={groupUsers}
                />
            ) : null}
        </AnimatedPage>
    );
}
