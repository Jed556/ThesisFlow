import * as React from 'react';
import {
    Alert,
    Box,
    Card,
    CardContent,
    Skeleton,
    Stack,
    Typography,
} from '@mui/material';
import GavelIcon from '@mui/icons-material/Gavel';
import { useSession } from '@toolpad/core';
import type { NavigationItem } from '../../types/navigation';
import type { Session } from '../../types/session';
import type { ThesisGroup } from '../../types/group';
import type { UserProfile } from '../../types/profile';
import type { ThesisData } from '../../types/thesis';
import type { FileAttachment } from '../../types/file';
import type { ConversationParticipant } from '../../components/Conversation';
import { AnimatedPage } from '../../components/Animate';
import { ThesisWorkspace } from '../../components/ThesisWorkspace';
import type { WorkspaceFilterConfig } from '../../components/ThesisWorkspace';
import {
    getThesisByGroupId,
} from '../../utils/firebase/firestore/thesis';
import { appendChapterComment } from '../../utils/firebase/firestore/conversation';
import { getUserById } from '../../utils/firebase/firestore/user';
import { getGroupsByCourse } from '../../utils/firebase/firestore/groups';
import { uploadConversationAttachments } from '../../utils/firebase/storage/conversation';
import { getDisplayName } from '../../utils/userUtils';

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
    segment: 'moderator-thesis-overview',
    icon: <GavelIcon />,
    roles: ['moderator'],
};

export default function ModeratorThesisOverviewPage() {
    const session = useSession<Session>();
    const moderatorUid = session?.user?.uid ?? '';

    const [profile, setProfile] = React.useState<UserProfile | null>(null);
    const [profileLoading, setProfileLoading] = React.useState(true);

    const [courses, setCourses] = React.useState<string[]>([]);
    const [selectedCourse, setSelectedCourse] = React.useState('');

    const [groups, setGroups] = React.useState<ThesisGroup[]>([]);
    const [groupsLoading, setGroupsLoading] = React.useState(false);
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
        if (!moderatorUid) {
            setProfile(null);
            setProfileLoading(false);
            setCourses([]);
            return;
        }

        let cancelled = false;
        setProfileLoading(true);
        setError(null);

        void getUserById(moderatorUid)
            .then((userProfile) => {
                if (cancelled) {
                    return;
                }
                setProfile(userProfile ?? null);
                const derived = userProfile
                    ? (userProfile.moderatedCourses?.filter(Boolean) ?? splitSectionList(userProfile.course))
                    : [];
                setCourses(derived);
            })
            .catch((fetchError) => {
                console.error('Failed to load moderator profile:', fetchError);
                if (!cancelled) {
                    setProfile(null);
                    setCourses([]);
                    setError('Unable to load your moderator profile.');
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
    }, [moderatorUid]);

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
                const result = await getThesisByGroupId(selectedGroupId);
                if (!cancelled) {
                    setSelectedThesisId(result?.id ?? '');
                    setThesis(result ?? null);
                    await hydrateDisplayNames([
                        result?.leader,
                        ...(result?.members ?? []),
                        result?.adviser,
                        result?.editor,
                        result?.statistician,
                        moderatorUid,
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
    }, [selectedGroupId, hydrateDisplayNames, moderatorUid]);

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
        if (moderatorUid && !map[moderatorUid]) {
            register(moderatorUid, 'Moderator');
        }
        return map;
    }, [thesis, resolveDisplayName, moderatorUid]);

    const filters: WorkspaceFilterConfig[] = React.useMemo(() => {
        const filterList: WorkspaceFilterConfig[] = [];
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
                description: group.status,
            })),
            onChange: (value) => setSelectedGroupId(value),
            disabled: groups.length === 0,
            loading: groupsLoading,
            placeholder: groupsLoading ? 'Loading groups…' : 'Select a group',
        });

        return filterList;
    }, [courses, selectedCourse, groups, selectedGroupId, groupsLoading]);

    const handleCreateComment = React.useCallback(async ({
        chapterId,
        versionIndex,
        content,
        files,
    }: {
        chapterId: number;
        versionIndex: number | null;
        content: string;
        files: File[];
    }) => {
        if (!moderatorUid || !selectedThesisId) {
            throw new Error('Missing moderator context.');
        }

        let attachments: FileAttachment[] = [];
        if (files.length) {
            attachments = await uploadConversationAttachments(files, {
                userUid: moderatorUid,
                thesisId: selectedThesisId,
                chapterId,
            });
        }

        const savedComment = await appendChapterComment({
            thesisId: selectedThesisId,
            chapterId,
            comment: {
                author: moderatorUid,
                comment: content,
                attachments,
                version: typeof versionIndex === 'number' ? versionIndex : undefined,
            },
        });

        setThesis((prev) => {
            if (!prev) {
                return prev;
            }
            return {
                ...prev,
                chapters: prev.chapters.map((chapter) =>
                    chapter.id === chapterId
                        ? { ...chapter, comments: [...(chapter.comments ?? []), savedComment] }
                        : chapter
                ),
            };
        });
    }, [moderatorUid, selectedThesisId]);

    const isLoading = profileLoading || groupsLoading || thesisLoading;
    const noCourses = !profileLoading && courses.length === 0;

    return (
        <AnimatedPage variant="slideUp">
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" gutterBottom>
                    Moderator workspace
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Choose a course, pick a group, and leave chapter-specific moderation notes.
                </Typography>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {noCourses ? (
                <Card>
                    <CardContent>
                        <Typography variant="body2" color="text.secondary">
                            Your profile does not list any courses to moderate yet.
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
                    currentUserId={moderatorUid}
                    filters={filters}
                    isLoading={isLoading}
                    allowCommenting={Boolean(thesis)}
                    emptyStateMessage={selectedGroupId ? 'No thesis data available for this group yet.' : 'Select a course and group to begin.'}
                    onCreateComment={({ chapterId, versionIndex, content, files }) =>
                        handleCreateComment({ chapterId, versionIndex, content, files })
                    }
                />
            )}
        </AnimatedPage>
    );
}
