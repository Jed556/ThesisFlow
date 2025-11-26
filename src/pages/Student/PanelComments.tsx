import * as React from 'react';
import { Alert, Box, Chip, Skeleton, Stack, Tab, Tabs, Typography } from '@mui/material';
import CommentBankIcon from '@mui/icons-material/CommentBank';
import { useSession } from '@toolpad/core';
import type { Session } from '../../types/session';
import type { NavigationItem } from '../../types/navigation';
import type { ThesisData } from '../../types/thesis';
import {
    createDefaultPanelCommentReleaseMap, type PanelCommentEntry,
    type PanelCommentReleaseMap, type PanelCommentStage,
} from '../../types/panelComment';
import { AnimatedPage } from '../../components/Animate';
import { PanelCommentTable } from '../../components/PanelComments';
import { UnauthorizedNotice } from '../../layouts/UnauthorizedNotice';
import { useSnackbar } from '../../components/Snackbar';
import { listenThesesForParticipant } from '../../utils/firebase/firestore/thesis';
import {
    listenPanelCommentEntries, listenPanelCommentRelease, updatePanelCommentStudentFields
} from '../../utils/firebase/firestore/panelComments';
import { buildStageCompletionMap } from '../../utils/thesisStageUtils';
import {
    PANEL_COMMENT_STAGE_METADATA, canStudentAccessPanelStage, getPanelCommentStageLabel
} from '../../utils/panelCommentUtils';

export const metadata: NavigationItem = {
    group: 'thesis',
    index: 3,
    title: 'Panel Comments',
    segment: 'panel-comments',
    icon: <CommentBankIcon />,
    roles: ['student'],
};

type ThesisRecord = ThesisData & { id: string };

type StageStatusChip = {
    label: string;
    color: 'default' | 'success' | 'warning' | 'info';
};

function resolveStageStatus(
    stage: PanelCommentStage,
    completionMap: ReturnType<typeof buildStageCompletionMap>,
    releaseMap: PanelCommentReleaseMap,
): StageStatusChip {
    const meta = PANEL_COMMENT_STAGE_METADATA.find((item) => item.id === stage);
    if (!meta) {
        return { label: 'Unknown stage', color: 'default' };
    }
    const stageComplete = completionMap[meta.unlockStage] ?? false;
    const released = releaseMap[stage]?.sent ?? false;

    if (!stageComplete) {
        return { label: `Finish ${meta.unlockStage}`, color: 'warning' };
    }
    if (!released) {
        return { label: 'Waiting for release', color: 'info' };
    }
    return { label: 'Ready', color: 'success' };
}

export default function StudentPanelCommentsPage() {
    const session = useSession<Session>();
    const userUid = session?.user?.uid ?? null;
    const { showNotification } = useSnackbar();

    const [thesis, setThesis] = React.useState<ThesisRecord | null>(null);
    const [thesisLoading, setThesisLoading] = React.useState(true);
    const [thesisError, setThesisError] = React.useState<string | null>(null);
    const [activeStage, setActiveStage] = React.useState<PanelCommentStage>('proposal');
    const [entries, setEntries] = React.useState<PanelCommentEntry[]>([]);
    const [entriesLoading, setEntriesLoading] = React.useState(true);
    const [entriesError, setEntriesError] = React.useState<string | null>(null);
    const [releaseMap, setReleaseMap] = React.useState<PanelCommentReleaseMap>(createDefaultPanelCommentReleaseMap());
    const [studentSavingIds, setStudentSavingIds] = React.useState<Set<string>>(new Set());

    React.useEffect(() => {
        if (!userUid) {
            setThesis(null);
            setThesisLoading(false);
            setThesisError(null);
            return;
        }

        setThesisLoading(true);
        setThesisError(null);
        const unsubscribe = listenThesesForParticipant(userUid, {
            onData: (records) => {
                const preferred = records.find((record) => record.leader === userUid) ?? records[0] ?? null;
                setThesis(preferred ?? null);
                setThesisLoading(false);
            },
            onError: (error) => {
                console.error('Failed to fetch thesis for panel comments:', error);
                setThesis(null);
                setThesisLoading(false);
                setThesisError('Unable to load your thesis record right now.');
            },
        });

        return () => unsubscribe();
    }, [userUid]);

    const groupId = thesis?.groupId ?? null;

    React.useEffect(() => {
        if (!groupId) {
            setReleaseMap(createDefaultPanelCommentReleaseMap());
            return;
        }
        const unsubscribe = listenPanelCommentRelease(groupId, {
            onData: (next) => setReleaseMap(next),
            onError: (error) => console.error('Panel comment release listener error:', error),
        });
        return () => unsubscribe();
    }, [groupId]);

    React.useEffect(() => {
        if (!groupId) {
            setEntries([]);
            setEntriesLoading(false);
            return;
        }
        setEntriesLoading(true);
        setEntriesError(null);
        const unsubscribe = listenPanelCommentEntries(groupId, activeStage, {
            onData: (next) => {
                setEntries(next);
                setEntriesLoading(false);
            },
            onError: (error) => {
                console.error('Panel comment entries listener error:', error);
                setEntries([]);
                setEntriesLoading(false);
                setEntriesError('Unable to load comments for this tab.');
            },
        });
        return () => unsubscribe();
    }, [groupId, activeStage]);

    const stageCompletionMap = React.useMemo(() => (
        buildStageCompletionMap(thesis?.chapters ?? [], { treatEmptyAsComplete: false })
    ), [thesis?.chapters]);

    const stageAccessible = canStudentAccessPanelStage(activeStage, stageCompletionMap, releaseMap);
    const stageMeta = PANEL_COMMENT_STAGE_METADATA.find((item) => item.id === activeStage);
    const lockedDescription = React.useMemo(() => {
        if (!stageMeta) {
            return 'Stage metadata missing.';
        }
        const stageReady = stageCompletionMap[stageMeta.unlockStage] ?? false;
        if (!stageReady) {
            return `Complete every chapter tagged ${stageMeta.unlockStage} to unlock this tab.`;
        }
        if (!(releaseMap[activeStage]?.sent ?? false)) {
            return 'Waiting for the admin to release the panel comments for viewing.';
        }
        return 'Panel comments are not available yet.';
    }, [activeStage, releaseMap, stageCompletionMap, stageMeta]);

    const handleStageChange = React.useCallback((_: React.SyntheticEvent, value: PanelCommentStage) => {
        setActiveStage(value);
    }, []);

    const handleStudentFieldChange = React.useCallback(async (
        entry: PanelCommentEntry,
        field: 'studentPage' | 'studentStatus',
        value: string,
    ) => {
        if (!groupId || !userUid) {
            showNotification('Sign in to update your notes.', 'error');
            return;
        }
        setStudentSavingIds((prev) => new Set(prev).add(entry.id));
        try {
            await updatePanelCommentStudentFields(groupId, entry.id, {
                [field]: value,
                updatedBy: userUid,
            });
        } catch (error) {
            console.error('Failed to update student fields for panel comment:', error);
            showNotification('Unable to save your changes. Please try again.', 'error');
        } finally {
            setStudentSavingIds((prev) => {
                const next = new Set(prev);
                next.delete(entry.id);
                return next;
            });
        }
    }, [groupId, userUid, showNotification]);

    const renderTabs = () => (
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs
                value={activeStage}
                onChange={handleStageChange}
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
            >
                {PANEL_COMMENT_STAGE_METADATA.map((stage) => {
                    const chip = resolveStageStatus(stage.id, stageCompletionMap, releaseMap);
                    return (
                        <Tab
                            key={stage.id}
                            value={stage.id}
                            label={(
                                <Stack spacing={0.5} alignItems="center">
                                    <Typography variant="body2" fontWeight={600}>
                                        {stage.studentLabel}
                                    </Typography>
                                    <Chip label={chip.label} size="small" color={chip.color} variant="outlined" />
                                </Stack>
                            )}
                        />
                    );
                })}
            </Tabs>
        </Box>
    );

    if (session?.loading) {
        return (
            <AnimatedPage variant="slideUp">
                <Skeleton variant="text" height={48} width="40%" sx={{ mb: 2 }} />
                <Skeleton variant="rectangular" height={96} />
            </AnimatedPage>
        );
    }

    if (!userUid) {
        return (
            <AnimatedPage variant="slideUp">
                <Alert severity="info">Sign in to view panel comments shared with your group.</Alert>
            </AnimatedPage>
        );
    }

    if (thesisError) {
        return (
            <AnimatedPage variant="slideUp">
                <Alert severity="error">{thesisError}</Alert>
            </AnimatedPage>
        );
    }

    if (thesisLoading) {
        return (
            <AnimatedPage variant="slideUp">
                <Stack spacing={3}>
                    <Skeleton variant="text" width="60%" height={48} />
                    <Skeleton variant="rectangular" height={64} />
                    <Skeleton variant="rectangular" height={320} />
                </Stack>
            </AnimatedPage>
        );
    }

    if (!thesis || !groupId) {
        return (
            <AnimatedPage variant="slideUp">
                <Alert severity="info">
                    Panel comment sheets will appear here once your thesis record and group are active.
                </Alert>
            </AnimatedPage>
        );
    }

    return (
        <AnimatedPage variant="slideUp">
            <Stack spacing={3}>
                <Box>
                    <Typography variant="h4" gutterBottom>
                        Panel Comments
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Track every remark from your proposal and defense hearings, then document the page and status once addressed.
                    </Typography>
                </Box>

                {renderTabs()}

                {!stageAccessible ? (
                    <UnauthorizedNotice
                        title={`${getPanelCommentStageLabel(activeStage)} tab locked`}
                        description={lockedDescription}
                        variant="box"
                    />
                ) : (
                    <Stack spacing={2}>
                        <Alert severity="info">
                            Update the <strong>Page</strong> column with the exact location of your revision and describe the action taken under <strong>Status</strong>.
                        </Alert>
                        {entriesError && (
                            <Alert severity="error">{entriesError}</Alert>
                        )}
                        <PanelCommentTable
                            entries={entries}
                            variant="student"
                            loading={entriesLoading}
                            busyEntryIds={studentSavingIds}
                            onStudentFieldChange={(entry, field, value) => handleStudentFieldChange(entry, field, value)}
                        />
                    </Stack>
                )}
            </Stack>
        </AnimatedPage>
    );
}
