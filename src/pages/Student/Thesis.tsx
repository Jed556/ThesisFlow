import * as React from 'react';
import { Alert, Box, Card, CardContent, Chip, LinearProgress, Paper, Skeleton, Stack, Typography } from '@mui/material';
import { School } from '@mui/icons-material';
import { useSession } from '@toolpad/core';
import type { NavigationItem } from '../../types/navigation';
import type { Session } from '../../types/session';
import type { ThesisChapter, ThesisData } from '../../types/thesis';
import type { UserProfile } from '../../types/profile';
import { AnimatedList, AnimatedPage } from '../../components/Animate';
import { Avatar, Name } from '../../components/Avatar';
import { getThesisTeamMembers } from '../../utils/thesisUtils';
import { listenThesesForParticipant } from '../../utils/firebase/firestore/thesis';
import { normalizeDateInput } from '../../utils/dateUtils';

export const metadata: NavigationItem = {
    group: 'thesis',
    index: 0,
    title: 'My Thesis',
    segment: 'thesis',
    icon: <School />,
    roles: ['student'],
};

type ThesisRecord = ThesisData & { id: string };

type TeamMember = Awaited<ReturnType<typeof getThesisTeamMembers>> extends (infer Member)[]
    ? Member
    : never;

function formatUserName(name: UserProfile['name']): string {
    const parts = [name.prefix, name.first, name.middle, name.last, name.suffix].filter((value): value is string => Boolean(value));
    return parts.join(' ');
}

function getStatusColor(status: ThesisChapter['status']): 'success' | 'warning' | 'error' | 'default' {
    if (status === 'approved') return 'success';
    if (status === 'under_review') return 'warning';
    if (status === 'revision_required') return 'error';
    return 'default';
}

function formatDateLabel(value?: string | null): string {
    const date = normalizeDateInput(value ?? undefined);
    return date ? date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '—';
}

/**
 * Calculate the overall completion percentage for a thesis record.
 * @param record - Thesis document containing chapter progress information
 * @returns Completion percentage between 0 and 100
 */
function computeThesisProgressPercent(record: ThesisRecord): number {
    const chapters = record.chapters ?? [];
    if (chapters.length === 0) {
        return 0;
    }
    const approvedCount = chapters.filter((chapter) => chapter.status === 'approved').length;
    return (approvedCount / chapters.length) * 100;
}

/**
 * Main thesis overview page for students, showing progress, chapters, and team members.
 */
export default function ThesisPage() {
    const session = useSession<Session>();
    const userUid = session?.user?.uid;

    const [thesis, setThesis] = React.useState<ThesisRecord | null>(null);
    const [userTheses, setUserTheses] = React.useState<ThesisRecord[]>([]);
    const [teamMembers, setTeamMembers] = React.useState<TeamMember[]>([]);
    const [progress, setProgress] = React.useState<number>(0);
    const [loading, setLoading] = React.useState<boolean>(true);
    const [error, setError] = React.useState<string | null>(null);
    const [hasNoThesis, setHasNoThesis] = React.useState<boolean>(false);

    React.useEffect(() => {
        if (!userUid) {
            setThesis(null);
            setUserTheses([]);
            setTeamMembers([]);
            setProgress(0);
            setHasNoThesis(false);
            setLoading(false);
            setError(null);
            return;
        }

        setLoading(true);
        setError(null);
        setHasNoThesis(false);
        setUserTheses([]);

        const unsubscribe = listenThesesForParticipant(userUid, {
            onData: (records) => {
                setUserTheses(records);
                setLoading(false);
                setError(null);
            },
            onError: (listenerError) => {
                console.error('Failed to subscribe to thesis data:', listenerError);
                setError('Unable to load thesis data right now. Please try again later.');
                setLoading(false);
            },
        });

        return () => {
            unsubscribe();
        };
    }, [userUid]);

    React.useEffect(() => {
        if (!userUid) {
            return;
        }

        if (userTheses.length === 0) {
            setThesis(null);
            setTeamMembers([]);
            setProgress(0);
            setHasNoThesis(true);
            return;
        }

        const candidate = userTheses.find((record) => record.leader === userUid) ?? userTheses[0];
        setThesis(candidate);
        setProgress(computeThesisProgressPercent(candidate));
        setHasNoThesis(false);
    }, [userTheses, userUid]);

    React.useEffect(() => {
        if (!thesis) {
            setTeamMembers([]);
            return;
        }

        let cancelled = false;

        const loadTeam = async () => {
            try {
                const members = await getThesisTeamMembers(thesis.id);
                if (!cancelled) {
                    setTeamMembers(members);
                }
            } catch (teamError) {
                console.error('Failed to load thesis team members:', teamError);
            }
        };

        void loadTeam();

        return () => {
            cancelled = true;
        };
    }, [thesis]);


    if (session?.loading) {
        return (
            <AnimatedPage variant="slideUp">
                <Paper sx={{ p: 3, mb: 3 }}>
                    <Skeleton variant="text" width={260} height={42} sx={{ mb: 2 }} />
                    <Skeleton variant="rectangular" height={32} sx={{ mb: 2 }} />
                    <Skeleton variant="rectangular" height={16} sx={{ mb: 2 }} />
                    <Skeleton variant="rectangular" height={16} sx={{ mb: 2 }} />
                    <Skeleton variant="rectangular" height={10} sx={{ mt: 2 }} />
                </Paper>
            </AnimatedPage>
        );
    }

    if (loading) {
        return (
            <AnimatedPage variant="slideUp">
                <Paper sx={{ p: 3, mb: 3 }}>
                    <Skeleton variant="text" width={260} height={42} sx={{ mb: 2 }} />
                    <Skeleton variant="rectangular" height={32} sx={{ mb: 2 }} />
                    <Skeleton variant="rectangular" height={16} sx={{ mb: 2 }} />
                    <Skeleton variant="rectangular" height={16} sx={{ mb: 2 }} />
                    <Skeleton variant="rectangular" height={10} sx={{ mt: 2 }} />
                </Paper>
                <Skeleton variant="text" width={180} height={32} sx={{ mb: 2 }} />
                <Stack spacing={2}>
                    {Array.from({ length: 3 }).map((_, idx) => (
                        <Skeleton key={idx} variant="rectangular" height={96} />
                    ))}
                </Stack>
            </AnimatedPage>
        );
    }

    if (!userUid) {
        return (
            <AnimatedPage variant="slideUp">
                <Alert severity="info">Sign in to view your thesis details.</Alert>
            </AnimatedPage>
        );
    }

    if (error) {
        return (
            <AnimatedPage variant="slideUp">
                <Alert severity="error">{error}</Alert>
            </AnimatedPage>
        );
    }

    if (hasNoThesis || !thesis) {
        return (
            <AnimatedPage variant="slideUp">
                <Alert severity="info">No thesis record found for your account yet.</Alert>
            </AnimatedPage>
        );
    }

    const formattedSubmissionDate = formatDateLabel(thesis.submissionDate);
    const formattedLastUpdated = formatDateLabel(thesis.lastUpdated);

    return (
        <AnimatedPage variant="slideUp">
            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h4" gutterBottom>
                    {thesis.title}
                </Typography>

                <Box sx={{ mt: 2, mb: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        Research Group Members
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {teamMembers.map((member) => (
                            <Avatar
                                key={member.uid}
                                uid={member.uid}
                                initials={[Name.FIRST]}
                                mode="chip"
                                tooltip="email"
                                label={`${formatUserName(member.name)} (${member.thesisRole})`}
                                size="small"
                                chipProps={{ variant: 'outlined', size: 'small' }}
                            />
                        ))}
                        {teamMembers.length === 0 && (
                            <Typography variant="body2" color="text.secondary">
                                No team members listed yet.
                            </Typography>
                        )}
                    </Stack>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 4, mt: 2 }}>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="body1">
                            <strong>Submission Date:</strong> {formattedSubmissionDate}
                        </Typography>
                        <Typography variant="body1">
                            <strong>Last Updated:</strong> {formattedLastUpdated}
                        </Typography>
                        <Typography variant="body1">
                            <strong>Status:</strong> {thesis.overallStatus ?? 'In Progress'}
                        </Typography>
                    </Box>
                </Box>

                <Box sx={{ mt: 3 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                        Overall Progress: {Math.round(progress)}% Complete
                    </Typography>
                    <LinearProgress
                        variant="determinate"
                        value={progress}
                        sx={{ height: 8, borderRadius: 4 }}
                    />
                </Box>
            </Paper>

            <Typography variant="h5" sx={{ mb: 2 }}>
                Chapters
            </Typography>

            <AnimatedList variant="slideUp" staggerDelay={50}>
                {(thesis.chapters ?? []).map((chapter) => {
                    const commentsCount = chapter.comments?.length ?? 0;
                    return (
                        <Card key={chapter.id} sx={{ mb: 2 }}>
                            <CardContent>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                    <Typography variant="h6">{chapter.title}</Typography>
                                    <Chip
                                        label={chapter.status.replace('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())}
                                        color={getStatusColor(chapter.status)}
                                        size="small"
                                    />
                                </Box>

                                {chapter.submissionDate && (
                                    <Typography variant="body2" color="text.secondary">
                                        Last submitted: {formatDateLabel(chapter.submissionDate)}
                                    </Typography>
                                )}

                                {commentsCount > 0 && (
                                    <Typography variant="body2" color="text.secondary">
                                        {commentsCount} feedback(s) received
                                    </Typography>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}

                {(thesis.chapters ?? []).length === 0 && (
                    <Card variant="outlined" sx={{ mb: 2 }}>
                        <CardContent>
                            <Typography variant="body2" color="text.secondary">
                                No chapters have been added yet.
                            </Typography>
                        </CardContent>
                    </Card>
                )}
            </AnimatedList>
        </AnimatedPage>
    );
}
