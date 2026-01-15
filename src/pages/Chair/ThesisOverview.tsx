import * as React from 'react';
import { Alert, Box, Card, CardContent, Skeleton, Stack, Typography } from '@mui/material';
import { School as SchoolIcon } from '@mui/icons-material';
import { useSession } from '@toolpad/core';
import type { NavigationItem } from '../../types/navigation';
import type { Session } from '../../types/session';
import type { ThesisGroup } from '../../types/group';
import type { UserProfile } from '../../types/profile';
import type { FileAttachment } from '../../types/file';
import type { ConversationParticipant } from '../../components/Conversation';
import { AnimatedPage } from '../../components/Animate';
import { ThesisWorkspace } from '../../components/ThesisWorkspace';
import type { WorkspaceCommentPayload, WorkspaceFilterConfig } from '../../types/workspace';
import {
    findThesisByGroupId,
    type ThesisWithGroupContext
} from '../../utils/firebase/firestore/thesis';
import { createChat } from '../../utils/firebase/firestore/chat';
import { findUserById } from '../../utils/firebase/firestore/user';
import { getGroupsByCourse, getGroupsByDepartment } from '../../utils/firebase/firestore/groups';
import { uploadConversationAttachments } from '../../utils/firebase/storage/conversation';
import { getDisplayName } from '../../utils/userUtils';
import { notifyNewChatMessage } from '../../utils/auditNotificationUtils';
import { getStageLabel } from '../../utils/thesisStageUtils';
import { useSegmentViewed } from '../../hooks';

function splitSectionList(value?: string | null): string[] {
    if (!value) {
        return [];
    }
    return value
        .split(/[;|\u007C]/)
        .map((section) => section.trim())
        .filter(Boolean);
}

export const metadata: NavigationItem = {
    group: 'thesis',
    index: 2,
    title: 'Thesis Overview',
    segment: 'chair-thesis-overview',
    icon: <SchoolIcon />,
    roles: ['chair'],
};

export default function ChairThesisOverviewPage() {
    useSegmentViewed({ segment: 'chair-thesis-overview' });
    const session = useSession<Session>();
    const chairUid = session?.user?.uid ?? '';

    const [profile, setProfile] = React.useState<UserProfile | null>(null);
    const [profileLoading, setProfileLoading] = React.useState(true);

    // Scope configuration for chair - can be course-based or department-based
    const [_scopeType, setScopeType] = React.useState<'courses' | 'department' | null>(null);
    const [scopeDepartment, setScopeDepartment] = React.useState<string | null>(null);

    const [courses, setCourses] = React.useState<string[]>([]);
    const [selectedCourse, setSelectedCourse] = React.useState('');

    const [groups, setGroups] = React.useState<ThesisGroup[]>([]);
    const [groupsLoading, setGroupsLoading] = React.useState(false);
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

    React.useEffect(() => {
        if (!chairUid) {
            setProfile(null);
            setProfileLoading(false);
            setCourses([]);
            return;
        }

        let cancelled = false;
        setProfileLoading(true);
        setError(null);

        void findUserById(chairUid)
            .then(async (userProfile) => {
                if (cancelled) {
                    return;
                }
                setProfile(userProfile ?? null);

                // Determine scope type and derive courses
                const explicitCourses = userProfile?.moderatedCourses?.filter(Boolean) ?? [];
                const fallbackCourses = splitSectionList(userProfile?.course);

                if (explicitCourses.length > 0 || fallbackCourses.length > 0) {
                    // Course-based scope
                    setScopeType('courses');
                    setScopeDepartment(null);
                    setCourses(explicitCourses.length > 0 ? explicitCourses : fallbackCourses);
                } else if (userProfile?.department) {
                    // Department-based scope - fetch all groups in department to get course list
                    setScopeType('department');
                    setScopeDepartment(userProfile.department);
                    try {
                        const deptGroups = await getGroupsByDepartment(userProfile.department);
                        const uniqueCourses = [...new Set(
                            deptGroups.map(g => g.course).filter((c): c is string => Boolean(c))
                        )];
                        setCourses(uniqueCourses.sort());
                    } catch (err) {
                        console.error('Failed to fetch department courses:', err);
                        setCourses([]);
                    }
                } else {
                    setScopeType(null);
                    setScopeDepartment(null);
                    setCourses([]);
                }
            })
            .catch((fetchError) => {
                console.error('Failed to load chair profile:', fetchError);
                if (!cancelled) {
                    setProfile(null);
                    setCourses([]);
                    setError('Unable to load your program chair profile.');
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
    }, [chairUid]);

    React.useEffect(() => {
        if (!selectedCourse && courses.length) {
            setSelectedCourse(courses[0]);
            return;
        }
        if (selectedCourse && !courses.includes(selectedCourse)) {
            setSelectedCourse(courses[0] ?? '');
        }
    }, [courses, selectedCourse]);

    React.useEffect(() => {
        if (!selectedCourse) {
            setGroups([]);
            setSelectedGroupId('');
            return;
        }

        let cancelled = false;
        setGroupsLoading(true);
        setError(null);

        void getGroupsByCourse(selectedCourse)
            .then((fetchedGroups) => {
                if (cancelled) {
                    return;
                }
                setGroups(fetchedGroups);
                if (fetchedGroups.length === 0) {
                    setSelectedGroupId('');
                } else if (!fetchedGroups.some((group) => group.id === selectedGroupId)) {
                    setSelectedGroupId(fetchedGroups[0].id);
                }
            })
            .catch((fetchError) => {
                console.error('Failed to load groups for course:', fetchError);
                if (!cancelled) {
                    setGroups([]);
                    setSelectedGroupId('');
                    setError('Unable to load groups for the selected course.');
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
    }, [selectedCourse]);

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
                const result = await findThesisByGroupId(selectedGroupId);
                if (!cancelled) {
                    setSelectedThesisId(result?.id ?? '');
                    setThesis(result ?? null);
                    await hydrateDisplayNames([
                        result?.leader,
                        ...(result?.members ?? []),
                        result?.adviser,
                        result?.editor,
                        result?.statistician,
                        chairUid,
                    ]);
                }
            } catch (err) {
                console.error('Failed to load thesis by group:', err);
                if (!cancelled) {
                    setThesis(null);
                    setSelectedThesisId('');
                    setError('Failed to load thesis details for the selected group.');
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
    }, [selectedGroupId, hydrateDisplayNames, chairUid]);

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
        if (chairUid && !map[chairUid]) {
            register(chairUid, 'Program Chair');
        }
        return map;
    }, [thesis, resolveDisplayName, chairUid]);

    const filters: WorkspaceFilterConfig[] = React.useMemo(() => {
        const filterList: WorkspaceFilterConfig[] = [];

        // Show department scope if department-based access
        if (scopeDepartment) {
            filterList.push({
                id: 'department',
                label: 'Department',
                value: scopeDepartment,
                options: [{ value: scopeDepartment, label: scopeDepartment }],
                onChange: () => { /* read-only */ },
                disabled: true,
            });
        }

        filterList.push({
            id: 'course',
            label: 'Course',
            value: selectedCourse,
            options: courses.map((course) => ({
                value: course,
                label: course,
            })),
            onChange: (value) => {
                setSelectedCourse(value);
                setSelectedGroupId('');
                setSelectedThesisId('');
                setThesis(null);
            },
            disabled: courses.length === 0,
            placeholder: courses.length === 0 ? 'No courses assigned' : undefined,
        });

        filterList.push({
            id: 'group',
            label: 'Group',
            value: selectedGroupId,
            options: groups.map((group) => ({
                value: group.id,
                label: group.name,
                description: group.id,
            })),
            onChange: (value) => setSelectedGroupId(value),
            disabled: groups.length === 0,
            loading: groupsLoading,
            placeholder: groupsLoading ? 'Loading groups…' : 'Select a group',
        });

        return filterList;
    }, [courses, selectedCourse, groups, selectedGroupId, groupsLoading, scopeDepartment]);

    const handleCreateComment = React.useCallback(async ({
        chapterId,
        chapterStage,
        submissionId,
        content,
        files,
    }: WorkspaceCommentPayload) => {
        if (!chairUid || !selectedThesisId || !thesis?.groupId || !thesis.year ||
            !thesis.department || !thesis.course || !submissionId) {
            throw new Error('Missing chair context or submission ID.');
        }

        let attachments: FileAttachment[] = [];
        if (files.length) {
            attachments = await uploadConversationAttachments(files, {
                userUid: chairUid,
                thesisId: selectedThesisId,
                groupId: thesis.groupId,
                chapterId,
                chapterStage,
            });
        }

        await createChat({
            year: thesis.year,
            department: thesis.department,
            course: thesis.course,
            groupId: thesis.groupId,
            thesisId: selectedThesisId,
            stage: chapterStage,
            chapterId: String(chapterId),
            submissionId,
        }, {
            author: chairUid,
            comment: content,
            date: new Date().toISOString(),
            attachments,
        });

        // Send notification for the new chat message
        try {
            const group = groups.find((g) => g.id === thesis.groupId);
            if (group) {
                await notifyNewChatMessage({
                    group,
                    senderId: chairUid,
                    senderRole: 'chair',
                    chapterName: `Chapter ${chapterId}`,
                    stageName: getStageLabel(chapterStage),
                });
            }
        } catch (notifyError) {
            console.error('Failed to send chat notification:', notifyError);
        }
    }, [chairUid, selectedThesisId, thesis, groups]);

    if (profileLoading) {
        return (
            <AnimatedPage variant="slideUp">
                <Stack spacing={2}>
                    <Skeleton variant="rectangular" height={48} />
                    <Skeleton variant="rectangular" height={400} />
                </Stack>
            </AnimatedPage>
        );
    }

    if (!profile) {
        return (
            <AnimatedPage variant="slideUp">
                <Alert severity="warning">
                    Unable to load your profile. Please try refreshing the page.
                </Alert>
            </AnimatedPage>
        );
    }

    if (courses.length === 0) {
        return (
            <AnimatedPage variant="slideUp">
                <Card>
                    <CardContent>
                        <Stack spacing={2} alignItems="center" justifyContent="center" sx={{ minHeight: 240 }}>
                            <SchoolIcon sx={{ fontSize: 64, color: 'text.disabled' }} />
                            <Typography variant="h6" color="text.secondary">
                                No Courses Assigned
                            </Typography>
                            <Typography color="text.secondary" textAlign="center">
                                You haven&apos;t been assigned to any courses yet. Contact an administrator to
                                update your profile with course assignments.
                            </Typography>
                        </Stack>
                    </CardContent>
                </Card>
            </AnimatedPage>
        );
    }

    return (
        <AnimatedPage variant="slideUp">
            <Stack spacing={2}>
                {error && <Alert severity="error">{error}</Alert>}

                <Box>
                    <Typography variant="body1" color="text.secondary">
                        Monitor thesis progress for groups in your assigned courses. You can view submissions,
                        leave comments, and track group progress.
                    </Typography>
                </Box>

                <ThesisWorkspace
                    thesis={thesis ?? undefined}
                    isLoading={thesisLoading || groupsLoading}
                    currentUserId={chairUid}
                    filters={filters}
                    participants={participants}
                    onCreateComment={handleCreateComment}
                    allowCommenting={Boolean(thesis)}
                    emptyStateMessage={
                        selectedGroupId
                            ? 'No thesis data available for this group yet.'
                            : 'Select a course and group to begin.'
                    }
                />
            </Stack>
        </AnimatedPage>
    );
}
