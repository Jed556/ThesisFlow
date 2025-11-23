import * as React from 'react';
import {
    Alert,
    Box,
    Card,
    CardContent,
    CircularProgress,
    MenuItem,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import type { UploadChapterFilesOptions } from '../../utils/firebase/storage/chapterFiles';
import { AnimatedList, AnimatedPage } from '../Animate';
import ChapterAccordion, { type ChapterAccordionUploadLabels } from '../../layouts/ChapterAccordion/ChapterAccordion';
import { FileUploadDialog } from '../FileUploadDialog';
import { listenThesesForMentor, type ThesisRecord } from '../../utils/firebase/firestore/thesis';
import { getGroupById } from '../../utils/firebase/firestore/groups';
import type { ThesisGroup } from '../../types/group';
import type { ThesisChapter } from '../../types/thesis';
import type { ChapterStage } from '../../types/chapter';
import { validateThesisDocument } from '../../utils/firebase/storage/thesis';
import { useSnackbar } from '../../contexts/SnackbarContext';

interface MentorChapterWorkspaceProps {
    role: 'adviser' | 'editor';
    mentorUid?: string | null;
    title: string;
    description?: string;
    emptyStateMessage?: string;
    uploadLabels?: ChapterAccordionUploadLabels;
    uploadCategory?: UploadChapterFilesOptions['category'];
    validator?: UploadChapterFilesOptions['validator'];
}

interface UploadContext {
    department: string;
    course: string;
    groupId: string;
    chapterId: number;
    chapterTitle: string;
}

const DEFAULT_EMPTY_STATE = 'No theses are currently assigned to you.';

export default function MentorChapterWorkspace({
    role,
    mentorUid,
    title,
    description,
    emptyStateMessage = DEFAULT_EMPTY_STATE,
    uploadLabels,
    uploadCategory = 'attachment',
    validator = validateThesisDocument,
}: MentorChapterWorkspaceProps) {
    const { showNotification } = useSnackbar();
    const [assignments, setAssignments] = React.useState<ThesisRecord[]>([]);
    const [loadingAssignments, setLoadingAssignments] = React.useState(true);
    const [assignmentsError, setAssignmentsError] = React.useState<string | null>(null);
    const [activeThesisId, setActiveThesisId] = React.useState<string | null>(null);
    const [groupInfo, setGroupInfo] = React.useState<ThesisGroup | null>(null);
    const [groupLoading, setGroupLoading] = React.useState(false);
    const [groupError, setGroupError] = React.useState<string | null>(null);
    const [selectedChapter, setSelectedChapter] = React.useState<ThesisChapter | null>(null);
    const [uploadDialogOpen, setUploadDialogOpen] = React.useState(false);

    React.useEffect(() => {
        if (!mentorUid) {
            setAssignments([]);
            setLoadingAssignments(false);
            setAssignmentsError('Sign in to view your assigned theses.');
            return () => { /* no-op */ };
        }

        setLoadingAssignments(true);
        setAssignmentsError(null);

        const unsubscribe = listenThesesForMentor(role, mentorUid, {
            onData: (records) => {
                setAssignments(records);
                setLoadingAssignments(false);
                setAssignmentsError(null);
            },
            onError: (error) => {
                console.error('Failed to listen for mentor theses:', error);
                setAssignments([]);
                setAssignmentsError('Unable to load assigned theses. Please try again later.');
                setLoadingAssignments(false);
            },
        });

        return () => {
            unsubscribe();
        };
    }, [mentorUid, role]);

    React.useEffect(() => {
        if (assignments.length === 0) {
            setActiveThesisId(null);
            return;
        }
        setActiveThesisId((prev) => {
            if (prev && assignments.some((record) => record.id === prev)) {
                return prev;
            }
            return assignments[0].id;
        });
    }, [assignments]);

    const activeThesis = React.useMemo(
        () => assignments.find((record) => record.id === activeThesisId) ?? null,
        [activeThesisId, assignments]
    );

    React.useEffect(() => {
        let cancelled = false;
        if (!activeThesis?.groupId) {
            setGroupInfo(null);
            setGroupError('Thesis is not linked to any group yet.');
            setGroupLoading(false);
            return () => {
                cancelled = true;
            };
        }

        setGroupLoading(true);
        setGroupError(null);

        void getGroupById(activeThesis.groupId)
            .then((group) => {
                if (cancelled) {
                    return;
                }
                setGroupInfo(group);
                if (!group) {
                    setGroupError('Unable to determine the group details for this thesis.');
                }
            })
            .catch((error) => {
                if (!cancelled) {
                    console.error('Failed to load group details:', error);
                    setGroupInfo(null);
                    setGroupError('Unable to load group details. Uploads may be unavailable.');
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setGroupLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [activeThesis?.groupId]);

    const handleUploadClick = React.useCallback(
        (chapter: ThesisChapter) => {
            if (!groupInfo?.department || !groupInfo?.course) {
                showNotification('Group department or course is missing. Please try again later.', 'error');
                return;
            }
            setSelectedChapter(chapter);
            setUploadDialogOpen(true);
        },
        [groupInfo?.course, groupInfo?.department, showNotification]
    );

    const handleCloseDialog = React.useCallback(() => {
        setUploadDialogOpen(false);
        setSelectedChapter(null);
    }, []);

    const uploadContext = React.useMemo<UploadContext | null>(() => {
        if (!selectedChapter || !activeThesis || !groupInfo?.department || !groupInfo?.course) {
            return null;
        }
        return {
            department: groupInfo.department,
            course: groupInfo.course,
            groupId: activeThesis.groupId,
            chapterId: selectedChapter.id,
            chapterTitle: selectedChapter.title,
        };
    }, [activeThesis, groupInfo, selectedChapter]);

    const chapterStageOptions = React.useMemo(() => {
        if (!selectedChapter) {
            return undefined;
        }
        if (selectedChapter.stages && selectedChapter.stages.length > 0) {
            return selectedChapter.stages;
        }
        return selectedChapter.stage ? [selectedChapter.stage] : undefined;
    }, [selectedChapter]);

    const fixedStage: ChapterStage | undefined = React.useMemo(() => (
        chapterStageOptions && chapterStageOptions.length === 1
            ? chapterStageOptions[0]
            : undefined
    ), [chapterStageOptions]);

    const chapters = activeThesis?.chapters ?? [];
    const assignmentsReady = !loadingAssignments && assignmentsError == null;
    const showEmptyState = assignmentsReady && assignments.length === 0;

    return (
        <AnimatedPage variant="fade">
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" gutterBottom>
                    {title}
                </Typography>
                {description && (
                    <Typography variant="body1" color="text.secondary">
                        {description}
                    </Typography>
                )}
            </Box>

            {assignmentsError && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    {assignmentsError}
                </Alert>
            )}

            {groupError && !groupLoading && (
                <Alert severity="warning" sx={{ mb: 3 }}>
                    {groupError}
                </Alert>
            )}

            {loadingAssignments ? (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 260 }}>
                    <CircularProgress />
                </Box>
            ) : showEmptyState ? (
                <Card>
                    <CardContent>
                        <Typography variant="body1" color="text.secondary">
                            {emptyStateMessage}
                        </Typography>
                    </CardContent>
                </Card>
            ) : !activeThesis ? (
                <Card>
                    <CardContent>
                        <Typography variant="body1" color="text.secondary">
                            Select a thesis to view its chapter submissions.
                        </Typography>
                    </CardContent>
                </Card>
            ) : (
                <Stack spacing={3}>
                    <Card>
                        <CardContent>
                            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
                                <TextField
                                    select
                                    label="Active thesis"
                                    value={activeThesisId ?? ''}
                                    onChange={(event) => setActiveThesisId(event.target.value || null)}
                                    size="small"
                                    sx={{ minWidth: 280 }}
                                >
                                    {assignments.map((record) => (
                                        <MenuItem key={record.id} value={record.id}>
                                            {record.title}
                                        </MenuItem>
                                    ))}
                                </TextField>
                                <Box sx={{ flexGrow: 1 }}>
                                    <Typography variant="subtitle1">{activeThesis.title}</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Stage: {activeThesis.overallStatus || 'In Progress'}
                                    </Typography>
                                </Box>
                                <Typography variant="body2" color="text.secondary">
                                    {groupLoading ? 'Loading group details…' : groupInfo?.name || 'Unknown group'}
                                </Typography>
                            </Stack>
                        </CardContent>
                    </Card>

                    {chapters.length === 0 ? (
                        <Alert severity="info">No chapters have been configured for this thesis.</Alert>
                    ) : (
                        <AnimatedList variant="slideUp" staggerDelay={60}>
                            {chapters.map((chapter) => (
                                <ChapterAccordion
                                    key={chapter.id}
                                    chapter={chapter}
                                    onUploadClick={handleUploadClick}
                                    uploadLabels={uploadLabels}
                                />
                            ))}
                        </AnimatedList>
                    )}
                </Stack>
            )}

            {selectedChapter && uploadContext && mentorUid && (
                <FileUploadDialog
                    open={uploadDialogOpen}
                    onClose={handleCloseDialog}
                    context={{
                        department: uploadContext.department,
                        course: uploadContext.course,
                        groupId: uploadContext.groupId,
                        chapterId: uploadContext.chapterId,
                        chapterTitle: uploadContext.chapterTitle,
                    }}
                    authorUid={mentorUid}
                    allowedStages={chapterStageOptions}
                    fixedStage={fixedStage}
                    validator={validator}
                    category={uploadCategory}
                    onCompleted={(results) => {
                        showNotification(
                            `${results.length} file${results.length === 1 ? '' : 's'} attached for ${selectedChapter.title}.`,
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
