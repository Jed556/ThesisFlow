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
    index: 4,
    title: 'Thesis Overview',
    segment: 'admin-thesis-overview',
    icon: <SchoolIcon />,
    roles: ['admin'],
};

export default function AdminThesisOverviewPage() {
    const session = useSession<Session>();
    const adminUid = session?.user?.uid ?? '';

    const [profile, setProfile] = React.useState<UserProfile | null>(null);
    const [profileLoading, setProfileLoading] = React.useState(true);

    const [departments, setDepartments] = React.useState<string[]>([]);
    const [selectedDepartment, setSelectedDepartment] = React.useState('');

    const [departmentGroups, setDepartmentGroups] = React.useState<ThesisGroup[]>([]);
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
        if (!adminUid) {
            setProfile(null);
            setProfileLoading(false);
            return;
        }

        let cancelled = false;
        setProfileLoading(true);
        setError(null);

        void getUserById(adminUid)
            .then((userProfile) => {
                if (cancelled) {
                    return;
                }
                setProfile(userProfile ?? null);
                const managedDepartments = userProfile?.departments?.filter(Boolean)
                    ?? (userProfile?.department ? [userProfile.department] : []);
                setDepartments(managedDepartments);
                if (managedDepartments.length > 0) {
                    setSelectedDepartment((current) =>
                        current && managedDepartments.includes(current) ? current : managedDepartments[0]
                    );
                } else {
                    setSelectedDepartment('');
                }
            })
            .catch((fetchError) => {
                console.error('Failed to load admin profile:', fetchError);
                if (!cancelled) {
                    setProfile(null);
                    setDepartments([]);
                    setSelectedDepartment('');
                    setError('Unable to load your admin profile.');
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
    }, [adminUid]);

    React.useEffect(() => {
        if (!selectedDepartment) {
            setDepartmentGroups([]);
            setCourses([]);
            setSelectedCourse('');
            setSelectedGroupId('');
            return;
        }

        let cancelled = false;
        setGroupsLoading(true);
        setError(null);

        void getGroupsByDepartment(selectedDepartment)
            .then((groups) => {
                if (cancelled) {
                    return;
                }
                setDepartmentGroups(groups);
                const uniqueCourses = Array.from(new Set(
                    groups
                        .map((group) => group.course)
                        .filter((course): course is string => Boolean(course))
                ));
                setCourses(uniqueCourses);
                setSelectedCourse((current) => {
                    if (current && uniqueCourses.includes(current)) {
                        return current;
                    }
                    setSelectedGroupId('');
                    return uniqueCourses[0] ?? '';
                });
                if (!uniqueCourses.length) {
                    setSelectedGroupId('');
                }
            })
            .catch((fetchError) => {
                console.error('Failed to load department groups:', fetchError);
                if (!cancelled) {
                    setDepartmentGroups([]);
                    setCourses([]);
                    setSelectedCourse('');
                    setSelectedGroupId('');
                    setError('Unable to load groups for the selected department.');
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
    }, [selectedDepartment]);

    const courseGroups = React.useMemo(() => {
        if (!selectedCourse) {
            return [];
        }
        return departmentGroups.filter((group) => group.course === selectedCourse);
    }, [departmentGroups, selectedCourse]);

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
                console.error('Failed to load thesis for admin view:', err);
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
                id: 'department',
                label: 'Department',
                value: selectedDepartment,
                options: departments.map((dept) => ({ value: dept, label: dept })),
                onChange: (value) => {
                    setSelectedDepartment(value);
                    setSelectedCourse('');
                    setSelectedGroupId('');
                    setThesis(null);
                },
                disabled: departments.length === 0,
                placeholder: departments.length === 0 ? 'No departments assigned' : undefined,
            },
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
                placeholder: courses.length === 0 ? 'Select a department first' : undefined,
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
    }, [departments, selectedDepartment, courses, selectedCourse, courseGroups, selectedGroupId, groupsLoading]);

    const isLoading = profileLoading || groupsLoading || thesisLoading;
    const noDepartments = !profileLoading && departments.length === 0;

    return (
        <AnimatedPage variant="slideUp">
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" gutterBottom>
                    Administrative workspace
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Drill into any department, course, and group to audit thesis progress and commentary.
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
                            Add at least one department to your profile to start reviewing theses.
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
                    currentUserId={adminUid}
                    filters={filters}
                    isLoading={isLoading}
                    allowCommenting={false}
                    emptyStateMessage={selectedGroupId ? 'No thesis data available for this group yet.' : 'Select a department, course, and group to begin.'}
                />
            )}
        </AnimatedPage>
    );
}
