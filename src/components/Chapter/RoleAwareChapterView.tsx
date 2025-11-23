import * as React from 'react';
import {
    Alert, Box, Skeleton, Stack, Tab, Tabs, Typography
} from '@mui/material';
import { where } from 'firebase/firestore';
import type { UserRole } from '../../types/profile';
import type { ThesisData } from '../../types/thesis';
import type { ChapterStage } from '../../types/chapter';
import ChapterAccordion from '../../layouts/ChapterAccordion/ChapterAccordion';
import { listenThesesForMentor, listenTheses } from '../../utils/firebase/firestore/thesis';

/**
 * Props for RoleAwareChapterView component
 */
export interface RoleAwareChapterViewProps {
    /** User's system role */
    role: UserRole;

    /** User's Firebase UID */
    userUid?: string;

    /** Optional thesis ID for direct thesis viewing (student view) */
    thesisId?: string;

    /** Optional department filter (for moderator/head/admin) */
    department?: string;

    /** Optional course filter (for moderator/head) */
    course?: string;

    /** Optional group ID filter (for specific group view) */
    groupId?: string;

    /** Component title */
    title?: string;

    /** Component description */
    description?: string;

    /** Empty state message */
    emptyStateMessage?: string;

    /** Whether to show stage tabs */
    showStageTabs?: boolean;

    /** Upload button labels */
    uploadLabels?: {
        empty: string;
        existing: string;
    };
}

/**
 * Role-aware chapter view component
 * 
 * Renders chapter submissions based on user role:
 * - Student: Own thesis chapters
 * - Adviser/Editor: Assigned thesis chapters
 * - Moderator: Course-specific chapters
 * - Head: Department-specific chapters
 * - Admin: All chapters (filterable by department/course)
 */
export default function RoleAwareChapterView({
    role,
    userUid,
    thesisId,
    department,
    course,
    groupId,
    title = 'Chapters',
    description,
    emptyStateMessage = 'No chapters found',
    showStageTabs = true,
    uploadLabels = { empty: 'Upload', existing: 'Update' },
}: RoleAwareChapterViewProps) {
    const [theses, setTheses] = React.useState<ThesisData[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [selectedStage, setSelectedStage] = React.useState<ChapterStage>('Pre-Proposal');

    // Load theses based on role
    React.useEffect(() => {
        if (!userUid && !thesisId && !department && !course && !groupId) {
            setError('Missing required filters for chapter view');
            setLoading(false);
            return;
        }

        let unsubscribe: (() => void) | undefined;

        const loadTheses = async () => {
            setLoading(true);
            setError(null);

            try {
                // Student or direct thesis view
                if (thesisId) {
                    const constraints = [where('__name__', '==', thesisId)];
                    unsubscribe = listenTheses(constraints, {
                        onData: (allTheses: ThesisData[]) => {
                            setTheses(allTheses);
                            setLoading(false);
                        },
                        onError: (err: Error) => {
                            console.error('Error loading thesis:', err);
                            setError('Failed to load thesis');
                            setLoading(false);
                        },
                    });
                    return;
                }

                // Adviser/Editor/Statistician view
                if ((role === 'adviser' || role === 'editor' || role === 'statistician') && userUid) {
                    const mentorRole = role as 'adviser' | 'editor' | 'statistician';
                    unsubscribe = listenThesesForMentor(
                        mentorRole,
                        userUid,
                        {
                            onData: (mentorTheses: ThesisData[]) => {
                                let filtered = mentorTheses;

                                // FIX: ThesisData needs department and course fields
                                // Apply filters if provided - currently disabled until ThesisData extended
                                if (groupId) {
                                    filtered = filtered.filter((t: ThesisData) => t.groupId === groupId);
                                }

                                setTheses(filtered);
                                setLoading(false);
                            },
                        }
                    );
                    return;
                }

                // Moderator/Head/Admin view
                // FIX: Need to implement thesis queries by department/course
                // For now, show error
                setError('Moderator/Head/Admin chapter views require additional implementation');
                setLoading(false);
            } catch (err) {
                console.error('Error setting up chapter view:', err);
                setError('Failed to load chapters');
                setLoading(false);
            }
        };

        loadTheses();

        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, [role, userUid, thesisId, department, course, groupId]);

    // Handle stage tab change
    const handleStageChange = (_event: React.SyntheticEvent, newValue: ChapterStage) => {
        setSelectedStage(newValue);
    };

    // Loading state
    if (loading) {
        return (
            <Stack spacing={2}>
                {title && (
                    <Box>
                        <Skeleton variant="text" width="30%" height={40} />
                        {description && <Skeleton variant="text" width="60%" height={24} />}
                    </Box>
                )}
                {showStageTabs && <Skeleton variant="rectangular" height={48} />}
                <Skeleton variant="rectangular" height={200} />
                <Skeleton variant="rectangular" height={200} />
            </Stack>
        );
    }

    // Error state
    if (error) {
        return (
            <Alert severity="error" sx={{ mt: 2 }}>
                {error}
            </Alert>
        );
    }

    // Empty state
    if (theses.length === 0) {
        return (
            <Stack spacing={2}>
                {title && (
                    <Box>
                        <Typography variant="h5" gutterBottom>
                            {title}
                        </Typography>
                        {description && (
                            <Typography variant="body2" color="text.secondary">
                                {description}
                            </Typography>
                        )}
                    </Box>
                )}
                <Alert severity="info">{emptyStateMessage}</Alert>
            </Stack>
        );
    }

    return (
        <Stack spacing={3}>
            {/* Header */}
            {title && (
                <Box>
                    <Typography variant="h5" gutterBottom>
                        {title}
                    </Typography>
                    {description && (
                        <Typography variant="body2" color="text.secondary">
                            {description}
                        </Typography>
                    )}
                </Box>
            )}

            {/* Stage tabs */}
            {showStageTabs && (
                <Tabs
                    value={selectedStage}
                    onChange={handleStageChange}
                    variant="scrollable"
                    scrollButtons="auto"
                >
                    <Tab label="Pre-Proposal" value="Pre-Proposal" />
                    <Tab label="Post-Proposal" value="Post-Proposal" />
                    <Tab label="Pre Defense" value="Pre Defense" />
                    <Tab label="Post Defense" value="Post Defense" />
                </Tabs>
            )}

            {/* Chapter accordions for each thesis */}
            {theses.map((thesis) => {
                // Filter chapters by selected stage
                const chaptersForStage = thesis.chapters.filter(
                    (ch) => ch.stage === selectedStage || ch.stages?.includes(selectedStage)
                );

                if (chaptersForStage.length === 0) {
                    return (
                        <Alert key={thesis.id} severity="info">
                            No chapters for {selectedStage} stage in thesis: {thesis.title}
                        </Alert>
                    );
                }

                return (
                    <Stack key={thesis.id} spacing={2}>
                        {theses.length > 1 && (
                            <Typography variant="h6">
                                {thesis.title} ({thesis.groupId})
                            </Typography>
                        )}
                        {chaptersForStage.map((chapter) => (
                            <ChapterAccordion
                                key={chapter.id}
                                chapter={chapter}
                                uploadLabels={uploadLabels}
                            />
                        ))}
                    </Stack>
                );
            })}
        </Stack>
    );
}
