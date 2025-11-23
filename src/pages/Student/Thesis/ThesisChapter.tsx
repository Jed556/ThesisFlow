import { useEffect, useMemo, useState } from 'react';
import { Box, Alert, CircularProgress } from '@mui/material';
import { Article } from '@mui/icons-material';
import { useSession } from '@toolpad/core';
import type { NavigationItem } from '../../../types/navigation';
import type { ThesisChapter, ThesisData } from '../../../types/thesis';
import type { ThesisGroup } from '../../../types/group';
import type { Session } from '../../../types/session';
import { AnimatedPage, AnimatedList } from '../../../components/Animate';
import ChapterAccordion from '../../../layouts/ChapterAccordion/ChapterAccordion';
import { FileUploadDialog } from '../../../components/FileUploadDialog';
import { validateThesisDocument } from '../../../utils/firebase/storage/thesis';
import { listenThesesForParticipant } from '../../../utils/firebase/firestore/thesis';
import { getGroupById } from '../../../utils/firebase/firestore/groups';
import { useSnackbar } from '../../../contexts/SnackbarContext';
import UnauthorizedNotice from '../../../layouts/UnauthorizedNotice';

type ThesisRecord = ThesisData & { id: string };

export const metadata: NavigationItem = {
    group: 'thesis',
    index: 2,
    title: 'Chapters',
    segment: 'thesis-chapters',
    icon: <Article />,
    children: [],
    // path: '/thesis',
    roles: ['student'],
    // hidden: false,
};

/**
 * Page for managing and uploading thesis chapter submissions and feedback
 */
export default function ThesisChaptersPage() {
    const session = useSession() as Session;
    const userUid = session?.user?.uid;
    const { showNotification } = useSnackbar();
    const [uploadDialog, setUploadDialog] = useState(false);
    const [selectedChapter, setSelectedChapter] = useState<ThesisChapter | null>(null);
    const [thesis, setThesis] = useState<ThesisRecord | null>(null);
    const [loadingThesis, setLoadingThesis] = useState(true);
    const [thesisError, setThesisError] = useState<string | null>(null);
    const [hasNoThesis, setHasNoThesis] = useState(false);
    const [groupInfo, setGroupInfo] = useState<ThesisGroup | null>(null);
    const [groupInfoError, setGroupInfoError] = useState<string | null>(null);

    useEffect(() => {
        if (!userUid) {
            setThesis(null);
            setThesisError(null);
            setHasNoThesis(false);
            setLoadingThesis(false);
            return;
        }

        setLoadingThesis(true);
        setThesisError(null);
        setHasNoThesis(false);

        const unsubscribe = listenThesesForParticipant(userUid, {
            onData: (records) => {
                if (records.length === 0) {
                    setThesis(null);
                    setHasNoThesis(true);
                } else {
                    const candidate = records.find((record) => record.leader === userUid) ?? records[0];
                    setThesis(candidate ?? null);
                    setHasNoThesis(false);
                }
                setLoadingThesis(false);
            },
            onError: (error) => {
                console.error('Failed to subscribe to thesis chapters:', error);
                setThesis(null);
                setThesisError('Unable to load thesis chapters right now. Please try again later.');
                setHasNoThesis(false);
                setLoadingThesis(false);
            },
        });

        return () => {
            unsubscribe();
        };
    }, [userUid]);

    useEffect(() => {
        if (!thesis?.groupId) {
            setGroupInfo(null);
            setGroupInfoError(null);
            return;
        }

        let cancelled = false;
        setGroupInfoError(null);

        void (async () => {
            try {
                const group = await getGroupById(thesis.groupId);
                if (cancelled) {
                    return;
                }
                setGroupInfo(group);
                if (!group) {
                    setGroupInfoError('Unable to load group details. Uploads may be temporarily unavailable.');
                }
            } catch (error) {
                if (!cancelled) {
                    console.error('Failed to load group information:', error);
                    setGroupInfo(null);
                    setGroupInfoError('Unable to determine your group department and course.');
                }
            } finally {
                // no-op
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [thesis?.groupId]);

    const handleUploadClick = (chapter: ThesisChapter) => {
        if (!groupInfo?.department || !groupInfo?.course) {
            showNotification('Group department or course is missing. Please try again later.', 'error');
            return;
        }

        setSelectedChapter(chapter);
        setUploadDialog(true);
    };

    const handleCloseDialog = () => {
        setUploadDialog(false);
        setSelectedChapter(null);
    };

    if (session?.loading) {
        return (
            <AnimatedPage variant="fade">
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
                    <CircularProgress />
                </Box>
            </AnimatedPage>
        );
    }

    if (!userUid) {
        return (
            <AnimatedPage variant="fade">
                <Alert severity="info">Sign in to manage your thesis submissions.</Alert>
            </AnimatedPage>
        );
    }

    if (hasNoThesis || !thesis) {
        return (
            <AnimatedPage variant="slideUp">
                <UnauthorizedNotice
                    variant='box'
                    title="Chapters locked"
                    description="No approved thesis proposal found for your group yet."
                />
            </AnimatedPage>
        );
    }

    if (loadingThesis) {
        return (
            <AnimatedPage variant="fade">
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
                    <CircularProgress />
                </Box>
            </AnimatedPage>
        );
    }

    if (thesisError) {
        return (
            <AnimatedPage variant="fade">
                <Alert severity="error">{thesisError}</Alert>
            </AnimatedPage>
        );
    }

    const uploadContext = useMemo(() => {
        if (!selectedChapter || !thesis || !groupInfo?.department || !groupInfo?.course) {
            return null;
        }

        return {
            department: groupInfo.department,
            course: groupInfo.course,
            groupId: thesis.groupId,
            chapterId: selectedChapter.id,
            chapterTitle: selectedChapter.title,
        };
    }, [groupInfo, selectedChapter, thesis]);

    const chapterStageOptions = useMemo(() => {
        if (!selectedChapter) {
            return undefined;
        }

        if (selectedChapter.stages && selectedChapter.stages.length > 0) {
            return selectedChapter.stages;
        }

        return selectedChapter.stage ? [selectedChapter.stage] : undefined;
    }, [selectedChapter]);

    const fixedStage = chapterStageOptions && chapterStageOptions.length === 1 ? chapterStageOptions[0] : undefined;

    const chapters = thesis.chapters ?? [];

    return (
        <AnimatedPage variant="fade">
            {groupInfoError && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    {groupInfoError}
                </Alert>
            )}

            {/* Chapter Submissions */}
            <AnimatedList variant="slideUp" staggerDelay={60}>
                {
                    chapters.map((chapter: ThesisChapter) => (
                        <ChapterAccordion
                            key={chapter.id}
                            chapter={chapter}
                            onUploadClick={handleUploadClick}
                        />
                    ))
                }
                {chapters.length === 0 && (
                    <Alert severity="info">No chapters have been added yet.</Alert>
                )}
            </AnimatedList>
            <Box sx={{ mb: 2 }}></Box>

            {selectedChapter && uploadContext && session?.user?.uid && (
                <FileUploadDialog
                    open={uploadDialog}
                    onClose={handleCloseDialog}
                    context={uploadContext}
                    authorUid={session.user.uid}
                    allowedStages={chapterStageOptions}
                    fixedStage={fixedStage}
                    validator={validateThesisDocument}
                    onCompleted={(results) => {
                        showNotification(
                            `${results.length} file${results.length === 1 ? '' : 's'} uploaded for ${selectedChapter.title}.`,
                            'success'
                        );
                    }}
                    onError={(error) => {
                        showNotification(error.message, 'error');
                    }}
                />
            )}
        </AnimatedPage>
    );
}
