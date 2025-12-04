import * as React from 'react';
import { Alert, Box, Card, CardContent, Skeleton, Stack, Typography } from '@mui/material';
import { School as SchoolIcon } from '@mui/icons-material';
import { useSession } from '@toolpad/core';
import type { NavigationItem } from '../../types/navigation';
import type { Session } from '../../types/session';
import type { ThesisGroup } from '../../types/group';
import type { ConversationParticipant } from '../../components/Conversation';
import { AnimatedPage } from '../../components/Animate';
import { ThesisWorkspace } from '../../components/ThesisWorkspace';
import type { WorkspaceFilterConfig } from '../../types/workspace';
import { findThesisByGroupId, type ThesisWithGroupContext } from '../../utils/firebase/firestore/thesis';
import { getAllGroups } from '../../utils/firebase/firestore/groups';
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

    // All groups fetched once
    const [allGroups, setAllGroups] = React.useState<ThesisGroup[]>([]);
    const [groupsLoading, setGroupsLoading] = React.useState(true);

    // Cascading filter selections
    const [selectedDepartment, setSelectedDepartment] = React.useState('');
    const [selectedCourse, setSelectedCourse] = React.useState('');
    const [selectedGroupId, setSelectedGroupId] = React.useState('');

    const [thesis, setThesis] = React.useState<ThesisWithGroupContext | null>(null);
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

    // Fetch all groups once on mount
    React.useEffect(() => {
        let cancelled = false;
        setGroupsLoading(true);
        setError(null);

        void getAllGroups()
            .then((groups) => {
                if (cancelled) return;
                setAllGroups(groups);
            })
            .catch((fetchError) => {
                console.error('Failed to load groups:', fetchError);
                if (!cancelled) {
                    setAllGroups([]);
                    setError('Unable to load thesis groups.');
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
    }, []);

    // Derive unique departments from all groups
    const departments = React.useMemo(() => {
        const uniqueDepts = new Set<string>();
        allGroups.forEach((group) => {
            if (group.department) {
                uniqueDepts.add(group.department);
            }
        });
        return Array.from(uniqueDepts).sort((a, b) => a.localeCompare(b));
    }, [allGroups]);

    // Derive courses for the selected department
    const courses = React.useMemo(() => {
        if (!selectedDepartment) return [];
        const uniqueCourses = new Set<string>();
        allGroups
            .filter((group) => group.department === selectedDepartment)
            .forEach((group) => {
                if (group.course) {
                    uniqueCourses.add(group.course);
                }
            });
        return Array.from(uniqueCourses).sort((a, b) => a.localeCompare(b));
    }, [allGroups, selectedDepartment]);

    // Filter groups by selected department and course
    const filteredGroups = React.useMemo(() => {
        return allGroups.filter((group) => {
            if (selectedDepartment && group.department !== selectedDepartment) return false;
            if (selectedCourse && group.course !== selectedCourse) return false;
            return true;
        });
    }, [allGroups, selectedDepartment, selectedCourse]);

    // Handlers for cascading filter changes
    const handleSelectDepartment = React.useCallback((value: string) => {
        setSelectedDepartment(value);
        setSelectedCourse('');
        setSelectedGroupId('');
        setThesis(null);
    }, []);

    const handleSelectCourse = React.useCallback((value: string) => {
        setSelectedCourse(value);
        setSelectedGroupId('');
        setThesis(null);
    }, []);

    // Auto-select first department if only one exists
    React.useEffect(() => {
        if (departments.length === 1 && !selectedDepartment) {
            setSelectedDepartment(departments[0]);
        }
    }, [departments, selectedDepartment]);

    // Auto-select first course if only one exists for the department
    React.useEffect(() => {
        if (courses.length === 1 && !selectedCourse) {
            setSelectedCourse(courses[0]);
        }
    }, [courses, selectedCourse]);

    // Auto-select first group if only one exists for the course
    React.useEffect(() => {
        if (filteredGroups.length === 1 && !selectedGroupId) {
            setSelectedGroupId(filteredGroups[0].id);
        }
    }, [filteredGroups, selectedGroupId]);

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
                const record = await findThesisByGroupId(selectedGroupId);
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
                onChange: handleSelectDepartment,
                disabled: departments.length === 0 || groupsLoading,
                loading: groupsLoading,
                placeholder: groupsLoading
                    ? 'Loading departments...'
                    : (departments.length === 0 ? 'No departments available' : undefined),
            },
            {
                id: 'course',
                label: 'Course',
                value: selectedCourse,
                options: courses.map((course) => ({ value: course, label: course })),
                onChange: handleSelectCourse,
                disabled: courses.length === 0 || !selectedDepartment,
                placeholder: !selectedDepartment
                    ? 'Select a department first'
                    : (courses.length === 0 ? 'No courses in department' : undefined),
            },
            {
                id: 'group',
                label: 'Group',
                value: selectedGroupId,
                options: filteredGroups.map((group) => ({
                    value: group.id,
                    label: group.name,
                    description: group.status,
                })),
                onChange: (value) => setSelectedGroupId(value),
                disabled: filteredGroups.length === 0 || !selectedCourse,
                placeholder: !selectedCourse
                    ? 'Select a course first'
                    : (filteredGroups.length === 0 ? 'No groups in course' : undefined),
            },
        ];
    }, [
        departments, selectedDepartment, courses, selectedCourse,
        filteredGroups, selectedGroupId, groupsLoading,
        handleSelectDepartment, handleSelectCourse,
    ]);

    const isLoading = groupsLoading || thesisLoading;
    const noGroups = !groupsLoading && allGroups.length === 0;

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

            {noGroups ? (
                <Card>
                    <CardContent>
                        <Typography variant="body2" color="text.secondary">
                            No thesis groups found in the system.
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
                    groupId={selectedGroupId}
                    year={thesis?.year}
                    department={thesis?.department ?? selectedDepartment}
                    course={thesis?.course ?? selectedCourse}
                    thesis={thesis}
                    participants={participants}
                    currentUserId={adminUid}
                    filters={filters}
                    isLoading={isLoading}
                    allowCommenting={false}
                    emptyStateMessage={
                        selectedGroupId
                            ? 'No thesis data available for this group yet.'
                            : 'Select a department, course, and group to begin.'
                    }
                />
            )}
        </AnimatedPage>
    );
}
