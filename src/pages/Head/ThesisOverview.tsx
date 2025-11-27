import * as React from 'react';
import { Alert, Box, Card, CardContent, Skeleton, Stack, Typography } from '@mui/material';
import { School as SchoolIcon } from '@mui/icons-material';
import { useSession } from '@toolpad/core';
import type { NavigationItem } from '../../types/navigation';
import type { Session } from '../../types/session';
import type { ThesisGroup } from '../../types/group';
import type { UserProfile } from '../../types/profile';
import type { ThesisData } from '../../types/thesis';
import type { ConversationParticipant } from '../../components/Conversation';
import { AnimatedPage } from '../../components/Animate';
import { ThesisWorkspace } from '../../components/ThesisWorkspace';
import type { WorkspaceFilterConfig } from '../../types/workspace';
import { getThesisByGroupId } from '../../utils/firebase/firestore/thesis';
import { getUserById } from '../../utils/firebase/firestore/user';
import { getGroupsByDepartment } from '../../utils/firebase/firestore/groups';
import { getDisplayName } from '../../utils/userUtils';

export const metadata: NavigationItem = {
    group: 'thesis',
    index: 3,
    title: 'Thesis Overview',
    segment: 'head-thesis-overview',
    icon: <SchoolIcon />,
    roles: ['head'],
};

export default function HeadThesisOverviewPage() {
    const session = useSession<Session>();
    const headUid = session?.user?.uid ?? '';

    const [profile, setProfile] = React.useState<UserProfile | null>(null);
    const [profileLoading, setProfileLoading] = React.useState(true);

    const [allGroups, setAllGroups] = React.useState<ThesisGroup[]>([]);
    const [groupsLoading, setGroupsLoading] = React.useState(false);

    const [courses, setCourses] = React.useState<string[]>([]);
    const [selectedCourse, setSelectedCourse] = React.useState('');
    const [selectedGroupId, setSelectedGroupId] = React.useState('');

    const [thesis, setThesis] = React.useState<ThesisData | null>(null);
    const [selectedThesisId, setSelectedThesisId] = React.useState('');
    const [thesisLoading, setThesisLoading] = React.useState(false);

    const [displayNames, setDisplayNames] = React.useState<Record<string, string>>({});
    const [error, setError] = React.useState<string | null>(null);

    const resolveDisplayName = React.useCallback((uid?: string | null) => {
        if (!uid) {
            return 'Unknown user';
        }
        return displayNames[uid] ?? uid;
    }, [displayNames]);

    const hydrateDisplayNames = React.useCallback(async (uids: (string | undefined | null)[]) => {
        const unique = Array.from(new Set(
            uids.filter((uid): uid is string => Boolean(uid && !displayNames[uid]))
        ));
        if (!unique.length) {
            return;
        }
        const results = await Promise.all(unique.map(async (uid) => {
            try {
                const name = await getDisplayName(uid);
                return [uid, name] as const;
            } catch (err) {
                console.error('Failed to resolve display name:', err);
                return [uid, uid] as const;
            }
        }));
        setDisplayNames((prev) => {
            const next = { ...prev };
            results.forEach(([uid, name]) => {
                next[uid] = name;
            });
            return next;
        });
    }, [displayNames]);

    React.useEffect(() => {
        if (!headUid) {
            setProfile(null);
            setProfileLoading(false);
            return;
        }

        let cancelled = false;
        setProfileLoading(true);
        setError(null);

        void getUserById(headUid)
            .then((userProfile) => {
                if (cancelled) {
                    return;
                }
                setProfile(userProfile ?? null);
            })
            .catch((fetchError) => {
                console.error('Failed to load head profile:', fetchError);
                if (!cancelled) {
                    setProfile(null);
                    setError('Unable to load your profile right now.');
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setProfileLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [headUid]);

    React.useEffect(() => {
        const departments = profile?.departments?.filter(Boolean) ?? (profile?.department ? [profile.department] : []);
        if (departments.length === 0) {
            setAllGroups([]);
            setCourses([]);
            setSelectedCourse('');
            setSelectedGroupId('');
            return;
        }

        let cancelled = false;
        setGroupsLoading(true);
        setError(null);

        void Promise.all(departments.map((dept) => getGroupsByDepartment(dept)))
            .then((groupSets) => {
                if (cancelled) {
                    return;
                }
                const merged = groupSets.flat();
                setAllGroups(merged);
                const uniqueCourses = Array.from(new Set(
                    merged
                        .map((group) => group.course)
                        .filter((course): course is string => Boolean(course))
                ));
                setCourses(uniqueCourses);
                if (uniqueCourses.length === 0) {
                    setSelectedCourse('');
                    setSelectedGroupId('');
                } else if (!uniqueCourses.includes(selectedCourse)) {
                    setSelectedCourse(uniqueCourses[0]);
                    setSelectedGroupId('');
                }
            })
            .catch((fetchError) => {
                console.error('Failed to load department groups:', fetchError);
                if (!cancelled) {
                    setAllGroups([]);
                    setCourses([]);
                    setSelectedCourse('');
                    setSelectedGroupId('');
                    setError('Unable to load courses for your department.');
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setGroupsLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [profile]);

    const courseGroups = React.useMemo(() => {
        if (!selectedCourse) {
            return [];
        }
        return allGroups.filter((group) => group.course === selectedCourse);
    }, [allGroups, selectedCourse]);

    React.useEffect(() => {
        if (courseGroups.length === 0) {
            setSelectedGroupId('');
            return;
        }
        if (!courseGroups.some((group) => group.id === selectedGroupId)) {
            setSelectedGroupId(courseGroups[0].id);
        }
    }, [courseGroups, selectedGroupId]);

    React.useEffect(() => {
        let cancelled = false;

        const loadThesis = async () => {
            if (!selectedGroupId) {
                setThesis(null);
                setSelectedThesisId('');
                return;
            }
            setThesisLoading(true);
            setError(null);
            try {
                const record = await getThesisByGroupId(selectedGroupId);
                if (!cancelled) {
                    setSelectedThesisId(record?.id ?? '');
                    setThesis(record ?? null);
                    await hydrateDisplayNames([
                        record?.leader,
                        ...(record?.members ?? []),
                        record?.adviser,
                        record?.editor,
                        record?.statistician,
                    ]);
                }
            } catch (err) {
                console.error('Failed to load thesis for head view:', err);
                if (!cancelled) {
                    setThesis(null);
                    setSelectedThesisId('');
                    setError('Failed to load thesis information for the selected group.');
                }
            } finally {
                if (!cancelled) {
                    setThesisLoading(false);
                }
            }
        };

        void loadThesis();
        return () => {
            cancelled = true;
        };
    }, [selectedGroupId, hydrateDisplayNames]);

    const participants = React.useMemo(() => {
        if (!thesis) {
            return undefined;
        }
        const map: Record<string, ConversationParticipant> = {};
        const register = (uid?: string | null, roleLabel?: string) => {
            if (!uid) {
                return;
            }
            map[uid] = {
                uid,
                displayName: resolveDisplayName(uid),
                roleLabel,
            };
        };
        register(thesis.leader, 'Leader');
        thesis.members?.forEach((uid) => register(uid, 'Member'));
        register(thesis.adviser, 'Adviser');
        register(thesis.editor, 'Editor');
        register(thesis.statistician, 'Statistician');
        return map;
    }, [thesis, resolveDisplayName]);

    const filters: WorkspaceFilterConfig[] = React.useMemo(() => {
        return [
            {
                id: 'course',
                label: 'Course',
                value: selectedCourse,
                options: courses.map((course) => ({ value: course, label: course })),
                onChange: (value) => {
                    setSelectedCourse(value);
                    setSelectedGroupId('');
                    setThesis(null);
                },
                disabled: courses.length === 0,
                placeholder: courses.length === 0 ? 'No courses available' : undefined,
            },
            {
                id: 'group',
                label: 'Group',
                value: selectedGroupId,
                options: courseGroups.map((group) => ({
                    value: group.id,
                    label: group.name,
                    description: group.status,
                })),
                onChange: (value) => setSelectedGroupId(value),
                disabled: courseGroups.length === 0,
                loading: groupsLoading,
                placeholder: courseGroups.length === 0 ? 'Select a course first' : undefined,
            },
        ];
    }, [selectedCourse, courses, courseGroups, selectedGroupId, groupsLoading]);

    const isLoading = profileLoading || groupsLoading || thesisLoading;
    const hasDepartment = Boolean(profile?.department || (profile?.departments?.length ?? 0) > 0);
    const noDepartments = !profileLoading && !hasDepartment;

    return (
        <AnimatedPage variant="slideUp">
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" gutterBottom>
                    Department workspace
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Review thesis progress across your courses. Select a course and group to drill into versioned feedback.
                </Typography>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {noDepartments ? (
                <Card>
                    <CardContent>
                        <Typography variant="body2" color="text.secondary">
                            No department assignments detected for your profile yet.
                        </Typography>
                    </CardContent>
                </Card>
            ) : isLoading && !thesis ? (
                <Stack spacing={2}>
                    <Skeleton variant="text" width="50%" height={32} />
                    <Skeleton variant="rounded" height={420} />
                </Stack>
            ) : (
                <ThesisWorkspace
                    thesisId={selectedThesisId}
                    thesis={thesis}
                    participants={participants}
                    currentUserId={headUid}
                    filters={filters}
                    isLoading={isLoading}
                    allowCommenting={false}
                    emptyStateMessage={selectedGroupId ? 'No thesis data available for this group yet.' : 'Select a course and group to begin.'}
                />
            )}
        </AnimatedPage>
    );
}
