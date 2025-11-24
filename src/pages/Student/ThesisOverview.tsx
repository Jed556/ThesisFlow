import * as React from 'react';
import {
    Alert,
    Card,
    CardContent,
    Skeleton,
    Stack,
    Typography,
} from '@mui/material';
import SchoolIcon from '@mui/icons-material/School';
import { useSession } from '@toolpad/core';
import type { Session } from '../../types/session';
import type { NavigationItem } from '../../types/navigation';
import type { ThesisData } from '../../types/thesis';
import type { ConversationParticipant } from '../../components/Conversation';
import type { WorkspaceUploadPayload } from '../../components/ThesisWorkspace';
import type { UserProfile } from '../../types/profile';
import { AnimatedPage } from '../../components/Animate';
import { ThesisWorkspace } from '../../components/ThesisWorkspace';
import { listenThesesForParticipant } from '../../utils/firebase/firestore/thesis';
import { appendChapterSubmission } from '../../utils/firebase/firestore/chapterSubmissions';
import { uploadThesisFile } from '../../utils/firebase/storage/thesis';
import { getThesisTeamMembers } from '../../utils/thesisUtils';

export const metadata: NavigationItem = {
    group: 'thesis',
    index: 1,
    title: 'Thesis Workspace',
    segment: 'student-thesis-workspace',
    icon: <SchoolIcon />,
    roles: ['student'],
};

type ThesisRecord = ThesisData & { id: string };

type TeamMember = Awaited<ReturnType<typeof getThesisTeamMembers>> extends (infer Member)[]
    ? Member
    : never;

const formatUserName = (name: UserProfile['name']) => (
    [name.prefix, name.first, name.middle, name.last, name.suffix]
        .filter((part): part is string => Boolean(part))
        .join(' ')
);

export default function StudentThesisOverviewPage() {
    const session = useSession<Session>();
    const userUid = session?.user?.uid ?? null;

    const [thesis, setThesis] = React.useState<ThesisRecord | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [participants, setParticipants] = React.useState<Record<string, ConversationParticipant>>();

    React.useEffect(() => {
        if (!userUid) {
            setThesis(null);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        const unsubscribe = listenThesesForParticipant(userUid, {
            onData: (records) => {
                const preferred = records.find((record) => record.leader === userUid) ?? records[0] ?? null;
                setThesis(preferred ?? null);
                setIsLoading(false);
            },
            onError: (listenerError) => {
                console.error('Failed to load student thesis:', listenerError);
                setError('Unable to load your thesis workspace right now.');
                setIsLoading(false);
            },
        });

        return () => {
            unsubscribe();
        };
    }, [userUid]);

    React.useEffect(() => {
        if (!thesis?.id) {
            setParticipants(undefined);
            return;
        }

        let cancelled = false;
        void (async () => {
            try {
                const members: TeamMember[] = await getThesisTeamMembers(thesis.id!);
                if (cancelled) {
                    return;
                }
                const roster: Record<string, ConversationParticipant> = {};
                members.forEach((member) => {
                    roster[member.uid] = {
                        uid: member.uid,
                        displayName: formatUserName(member.name) || member.email,
                        roleLabel: member.thesisRole,
                    };
                });
                setParticipants(roster);
            } catch (teamError) {
                if (!cancelled) {
                    console.error('Failed to load thesis team members:', teamError);
                    setParticipants(undefined);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [thesis?.id]);

    const handleUploadChapter = React.useCallback(async ({ thesisId, chapterId, file }: WorkspaceUploadPayload) => {
        if (!userUid) {
            throw new Error('You must be signed in to upload a chapter.');
        }

        const result = await uploadThesisFile({
            file,
            userUid,
            thesisId,
            chapterId,
            category: 'submission',
            metadata: { scope: 'student-workspace' },
        });

        const submissionId = result.fileAttachment.id ?? result.fileAttachment.url;
        if (!submissionId) {
            throw new Error('Upload failed to return a submission identifier.');
        }

        await appendChapterSubmission({
            thesisId,
            chapterId,
            submissionId,
            submittedAt: result.fileAttachment.uploadDate,
        });
    }, [userUid]);

    return (
        <AnimatedPage variant="slideUp">
            <Stack spacing={2} sx={{ mb: 3 }}>
                <Typography variant="h4">My Thesis Workspace</Typography>
                <Typography variant="body1" color="text.secondary">
                    Upload new chapter versions and review mentor feedback organized per submission.
                </Typography>
            </Stack>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {isLoading ? (
                <Stack spacing={2}>
                    <Skeleton variant="text" width="50%" height={32} />
                    <Skeleton variant="rounded" height={420} />
                </Stack>
            ) : !thesis ? (
                <Card>
                    <CardContent>
                        <Typography variant="body2" color="text.secondary">
                            Your thesis workspace will appear here once your research group is approved.
                        </Typography>
                    </CardContent>
                </Card>
            ) : (
                <ThesisWorkspace
                    thesisId={thesis.id}
                    thesis={thesis}
                    participants={participants}
                    currentUserId={userUid ?? undefined}
                    isLoading={false}
                    allowCommenting={false}
                    emptyStateMessage="Select a chapter to upload your first version and unlock feedback."
                    onUploadChapter={handleUploadChapter}
                />
            )}
        </AnimatedPage>
    );
}
