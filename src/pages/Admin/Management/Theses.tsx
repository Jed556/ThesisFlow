import * as React from 'react';
import {
    Autocomplete, Box, Button, Chip, Dialog, DialogActions, DialogContent,
    DialogTitle, LinearProgress, Stack, TextField, Typography, type ChipProps,
} from '@mui/material';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import type { GridColDef, GridRowParams } from '@mui/x-data-grid';
import { GridActionsCellItem } from '@mui/x-data-grid';
import { AnimatedPage, GrowTransition } from '../../../components/Animate';
import { DataGrid } from '../../../components/DataGrid';
import { useSession } from '@toolpad/core';
import { useSnackbar } from '../../../contexts/SnackbarContext';
import UnauthorizedNotice from '../../../layouts/UnauthorizedNotice';
import { useBackgroundJobControls, useBackgroundJobFlag } from '../../../hooks/useBackgroundJobs';
import type { NavigationItem } from '../../../types/navigation';
import type { Session } from '../../../types/session';
import type { ThesisData, ThesisChapter } from '../../../types/thesis';
import type { UserProfile } from '../../../types/profile';
import type { ThesisGroup, ThesisGroupMembers } from '../../../types/group';
import {
    bulkDeleteTheses, deleteThesis, getAllTheses, listenTheses,
    setThesis, createThesisForGroup, computeThesisProgressRatio, type ThesisRecord,
} from '../../../utils/firebase/firestore/thesis';
import { getAllGroups, getGroupById, updateGroup } from '../../../utils/firebase/firestore/groups';
import { getUserById, getUsersByIds, listenUsersByFilter } from '../../../utils/firebase/firestore/user';
import { importThesesFromCsv, exportThesesToCsv } from '../../../utils/csv/thesis';
import { formatProfileLabel } from '../../../utils/userUtils';
import { formatDateShort, fromDateInputString, toDateInputString } from '../../../utils/dateUtils';

const STATUS_SUGGESTIONS = [
    'Not Submitted',
    'In Progress',
    'Under Review',
    'Revision Required',
    'Approved',
    'Archived',
    'Deferred',
];

const EMPTY_GROUP_MEMBERS: ThesisGroupMembers = {
    leader: '',
    members: [],
};

type AdminThesisRow = ThesisRecord & {
    groupName: string;
    groupMembers: ThesisGroupMembers;
    leaderUid: string;
    memberUids: string[];
    adviserUid?: string;
    editorUid?: string;
    leaderName: string;
    adviserName: string;
    editorName: string;
    memberNames: string[];
    progress: number;
};

interface ThesisFormState {
    title: string;
    groupId: string;
    leader: string;
    members: string[];
    adviser: string;
    editor: string;
    submissionDate: string;
    lastUpdated: string;
    overallStatus: string;
    chaptersText: string;
}

interface ThesisFormErrors {
    title?: string;
    groupId?: string;
    leader?: string;
    adviser?: string;
    editor?: string;
    chaptersText?: string;
}

export const metadata: NavigationItem = {
    group: 'management',
    index: 3,
    title: 'Theses',
    segment: 'thesis-management',
    icon: <MenuBookIcon />,
    roles: ['admin', 'developer'],
};

/**
 * Determine the Material UI chip color to use for a status label.
 */
function resolveStatusColor(status: string | undefined): ChipProps['color'] {
    if (!status) return 'default';
    const value = status.toLowerCase();
    if (value.includes('approved') || value.includes('completed')) return 'success';
    if (value.includes('progress') || value.includes('ongoing')) return 'info';
    if (value.includes('review') || value.includes('revision')) return 'warning';
    if (value.includes('hold') || value.includes('reject') || value.includes('withdraw')) return 'error';
    return 'default';
}

/**
 * Parse chapters JSON from a text area, ensuring a valid ThesisChapter array.
 */
function parseChapters(input: string): ThesisChapter[] {
    if (!input.trim()) {
        return [];
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(input);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid JSON string';
        throw new Error(`Chapters must be valid JSON. ${message}`);
    }

    if (!Array.isArray(parsed)) {
        throw new Error('Chapters JSON must be an array.');
    }

    return parsed.map((entry, index) => {
        const candidate = typeof entry === 'object' && entry !== null ? entry as Partial<ThesisChapter> : {};
        return {
            id: typeof candidate.id === 'number' ? candidate.id : index + 1,
            title: typeof candidate.title === 'string' && candidate.title.trim() ? candidate.title : `Chapter ${index + 1}`,
            status: typeof candidate.status === 'string' ? candidate.status : 'not_submitted',
            submissionDate: typeof candidate.submissionDate === 'string' ? candidate.submissionDate : null,
            lastModified: typeof candidate.lastModified === 'string' ? candidate.lastModified : null,
            submissions: Array.isArray(candidate.submissions)
                ? candidate.submissions.map((value) => String(value))
                : [],
            comments: Array.isArray(candidate.comments)
                ? candidate.comments as ThesisChapter['comments']
                : [],
        } satisfies ThesisChapter;
    });
}

const defaultFormState: ThesisFormState = {
    title: '',
    groupId: '',
    leader: '',
    members: [],
    adviser: '',
    editor: '',
    submissionDate: toDateInputString(new Date()),
    lastUpdated: toDateInputString(new Date()),
    overallStatus: 'In Progress',
    chaptersText: '[]',
};

/**
 * Admin page for managing thesis records with CSV import/export and real-time updates.
 */
export default function AdminThesisManagementPage() {
    const session = useSession<Session>();
    const { showNotification } = useSnackbar();
    const { startJob } = useBackgroundJobControls();

    const [rows, setRows] = React.useState<AdminThesisRow[]>([]);
    const [students, setStudents] = React.useState<UserProfile[]>([]);
    const [advisers, setAdvisers] = React.useState<UserProfile[]>([]);
    const [editors, setEditors] = React.useState<UserProfile[]>([]);
    const [groups, setGroups] = React.useState<ThesisGroup[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [dialogOpen, setDialogOpen] = React.useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
    const [editMode, setEditMode] = React.useState(false);
    const [formState, setFormState] = React.useState<ThesisFormState>(defaultFormState);
    const [formErrors, setFormErrors] = React.useState<ThesisFormErrors>({});
    const [selectedThesis, setSelectedThesis] = React.useState<AdminThesisRow | null>(null);
    const [saving, setSaving] = React.useState(false);

    const userRole = session?.user?.role;
    const isMountedRef = React.useRef(true);
    const profileCacheRef = React.useRef(new Map<string, UserProfile>());
    const groupCacheRef = React.useRef(new Map<string, ThesisGroup>());
    const latestRecordsRef = React.useRef<ThesisRecord[]>([]);

    React.useEffect(() => () => {
        isMountedRef.current = false;
    }, []);

    const hasActiveImport = useBackgroundJobFlag(
        React.useCallback((job) => {
            if (job.status !== 'pending' && job.status !== 'running') {
                return false;
            }
            const jobType = job.metadata?.jobType as string | undefined;
            return jobType === 'theses-import';
        }, [])
    );

    /**
     * Map thesis records to grid rows, hydrating user profiles as needed.
     */
    const mapThesisRecords = React.useCallback(async (records: ThesisRecord[]): Promise<AdminThesisRow[]> => {
        const profileCache = profileCacheRef.current;
        const groupCache = groupCacheRef.current;

        const groupIds = new Set<string>();
        records.forEach((record) => {
            if (record.groupId) {
                groupIds.add(record.groupId);
            }
        });

        const missingGroupIds = Array.from(groupIds).filter((groupId) => !groupCache.has(groupId));
        if (missingGroupIds.length > 0) {
            const fetchedGroups = await Promise.all(missingGroupIds.map(async (groupId) => {
                try {
                    return await getGroupById(groupId);
                } catch (error) {
                    console.error(`Failed to fetch thesis group ${groupId}:`, error);
                    return null;
                }
            }));

            fetchedGroups.forEach((group, index) => {
                if (group) {
                    groupCache.set(missingGroupIds[index], group);
                }
            });
        }

        const uids = new Set<string>();
        records.forEach((record) => {
            const group = record.groupId ? groupCache.get(record.groupId) : undefined;
            if (!group) {
                return;
            }

            const { leader, members, adviser, editor } = group.members;
            if (leader) {
                uids.add(leader);
            }
            members.forEach((uid) => {
                if (uid) {
                    uids.add(uid);
                }
            });
            if (adviser) {
                uids.add(adviser);
            }
            if (editor) {
                uids.add(editor);
            }
        });

        const missingProfiles = Array.from(uids).filter((uid) => !profileCache.has(uid));
        if (missingProfiles.length > 0) {
            try {
                const fetchedProfiles = await getUsersByIds(missingProfiles);
                fetchedProfiles.forEach((profile) => {
                    profileCache.set(profile.uid, profile);
                });

                const unresolved = missingProfiles.filter((uid) => !profileCache.has(uid));
                if (unresolved.length > 0) {
                    const fallbackProfiles = await Promise.all(unresolved.map(async (uid) => getUserById(uid)));
                    fallbackProfiles.forEach((profile) => {
                        if (profile) {
                            profileCache.set(profile.uid, profile);
                        }
                    });
                }
            } catch (error) {
                console.error('Failed hydrating thesis user profiles:', error);
                throw error;
            }
        }

        return records.map((record) => {
            const group = record.groupId ? groupCache.get(record.groupId) ?? null : null;
            const groupMembers: ThesisGroupMembers = group
                ? {
                    leader: group.members.leader ?? '',
                    members: [...(group.members.members ?? [])],
                    adviser: group.members.adviser,
                    editor: group.members.editor,
                    panels: group.members.panels,
                }
                : { ...EMPTY_GROUP_MEMBERS };

            const leaderUid = groupMembers.leader ?? '';
            const memberUids = groupMembers.members ?? [];
            const adviserUid = groupMembers.adviser ?? '';
            const editorUid = groupMembers.editor ?? '';

            const leaderProfile = leaderUid ? profileCache.get(leaderUid) : undefined;
            const adviserProfile = adviserUid ? profileCache.get(adviserUid) : undefined;
            const editorProfile = editorUid ? profileCache.get(editorUid) : undefined;
            const memberNames = memberUids.map((uid) => {
                const profile = profileCache.get(uid);
                const label = formatProfileLabel(profile);
                return label || profile?.email || uid;
            });

            const leaderLabel = formatProfileLabel(leaderProfile);
            const adviserLabel = formatProfileLabel(adviserProfile);
            const editorLabel = formatProfileLabel(editorProfile);
            const progressRatio = computeThesisProgressRatio(record);
            const progressPercent = Math.round(Math.min(1, Math.max(0, progressRatio)) * 100);

            return {
                ...record,
                groupName: group?.name ?? 'Unassigned',
                groupMembers,
                leaderUid,
                memberUids,
                adviserUid: adviserUid || undefined,
                editorUid: editorUid || undefined,
                leaderName: leaderLabel || leaderUid || '—',
                adviserName: adviserLabel || adviserUid || '—',
                editorName: editorLabel || editorUid || '—',
                memberNames,
                progress: progressPercent,
            } satisfies AdminThesisRow;
        });
    }, []);

    const reloadTheses = React.useCallback(async () => {
        try {
            setLoading(true);
            const all = await getAllTheses();
            latestRecordsRef.current = all;
            const mapped = await mapThesisRecords(all);
            if (isMountedRef.current) {
                setRows(mapped);
            }
        } catch (error) {
            console.error('Failed to refresh theses:', error);
            showNotification('Failed to refresh theses. Please try again.', 'error');
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
            }
        }
    }, [mapThesisRecords, showNotification]);

    React.useEffect(() => {
        if (userRole !== 'admin' && userRole !== 'developer') {
            return undefined;
        }

        let isActive = true;

        (async () => {
            try {
                const allGroups = await getAllGroups();
                if (!isActive) {
                    return;
                }
                setGroups(allGroups);
                const cache = groupCacheRef.current;
                allGroups.forEach((group) => {
                    cache.set(group.id, group);
                });
            } catch (error) {
                console.error('Failed to load thesis groups:', error);
                showNotification('Failed to load thesis groups for thesis management.', 'error');
            }
        })();

        return () => {
            isActive = false;
        };
    }, [showNotification, userRole]);

    React.useEffect(() => {
        if (userRole !== 'admin' && userRole !== 'developer') {
            setLoading(false);
            return undefined;
        }

        const unsubscribe = listenTheses(undefined, {
            onData: (records) => {
                latestRecordsRef.current = records;
                void (async () => {
                    try {
                        const mapped = await mapThesisRecords(records);
                        if (isMountedRef.current) {
                            setRows(mapped);
                            setLoading(false);
                        }
                    } catch (error) {
                        if (error instanceof Error) {
                            showNotification(`Failed to load theses: ${error.message}`, 'error');
                        } else {
                            showNotification('Failed to load theses due to an unknown error.', 'error');
                        }
                        if (isMountedRef.current) {
                            setLoading(false);
                        }
                    }
                })();
            },
            onError: (error) => {
                console.error('Thesis listener error:', error);
                showNotification('Realtime thesis updates failed. Trying a manual refresh might help.', 'error');
                if (isMountedRef.current) {
                    setLoading(false);
                }
            },
        });

        return () => {
            unsubscribe();
        };
    }, [mapThesisRecords, showNotification, userRole]);

    React.useEffect(() => {
        if (userRole !== 'admin' && userRole !== 'developer') {
            return undefined;
        }

        const unsubscribeStudents = listenUsersByFilter(
            { role: 'student' },
            {
                onData: (profiles) => {
                    if (isMountedRef.current) {
                        setStudents(profiles);
                    }
                },
                onError: (error) => {
                    console.error('Student listener error:', error);
                    showNotification('Failed to load students for thesis management.', 'error');
                },
            }
        );

        const unsubscribeAdvisers = listenUsersByFilter(
            { role: 'adviser' },
            {
                onData: (profiles) => {
                    if (isMountedRef.current) {
                        setAdvisers(profiles);
                    }
                },
                onError: (error) => {
                    console.error('Adviser listener error:', error);
                    showNotification('Failed to load advisers for thesis management.', 'error');
                },
            }
        );

        const unsubscribeEditors = listenUsersByFilter(
            { role: 'editor' },
            {
                onData: (profiles) => {
                    if (isMountedRef.current) {
                        setEditors(profiles);
                    }
                },
                onError: (error) => {
                    console.error('Editor listener error:', error);
                    showNotification('Failed to load editors for thesis management.', 'error');
                },
            }
        );

        return () => {
            unsubscribeStudents();
            unsubscribeAdvisers();
            unsubscribeEditors();
        };
    }, [showNotification, userRole]);

    const validateForm = React.useCallback((): boolean => {
        const errors: ThesisFormErrors = {};
        if (!formState.title.trim()) {
            errors.title = 'Title is required';
        }
        if (!formState.groupId) {
            errors.groupId = 'Thesis group is required';
        }
        if (!formState.leader) {
            errors.leader = 'Leader is required';
        }
        if (!formState.adviser) {
            errors.adviser = 'Adviser is required';
        }
        if (!formState.editor) {
            errors.editor = 'Editor is required';
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    }, [formState.adviser, formState.editor, formState.groupId, formState.leader, formState.title]);

    /**
     * Reset the dialog state to defaults.
     */
    const handleCloseDialog = React.useCallback(() => {
        setDialogOpen(false);
        setDeleteDialogOpen(false);
        setSelectedThesis(null);
        const now = new Date();
        setFormState({
            ...defaultFormState,
            submissionDate: toDateInputString(now),
            lastUpdated: toDateInputString(now),
        });
        setFormErrors({});
        setSaving(false);
    }, []);

    const handleOpenCreateDialog = React.useCallback(() => {
        setEditMode(false);
        const now = new Date();
        setFormState({
            ...defaultFormState,
            submissionDate: toDateInputString(now),
            lastUpdated: toDateInputString(now),
        });
        setFormErrors({});
        setSelectedThesis(null);
        setDialogOpen(true);
    }, []);

    const handleOpenEditDialog = React.useCallback((thesis: AdminThesisRow) => {
        setEditMode(true);
        setSelectedThesis(thesis);
        setFormState({
            title: thesis.title,
            groupId: thesis.groupId,
            leader: thesis.leaderUid,
            members: thesis.memberUids ?? [],
            adviser: thesis.adviserUid ?? '',
            editor: thesis.editorUid ?? '',
            submissionDate: toDateInputString(thesis.submissionDate),
            lastUpdated: toDateInputString(thesis.lastUpdated),
            overallStatus: thesis.overallStatus ?? '',
            chaptersText: JSON.stringify(thesis.chapters ?? [], null, 2),
        });
        setFormErrors({});
        setDialogOpen(true);
    }, []);

    const handleOpenDeleteDialog = React.useCallback((thesis: AdminThesisRow) => {
        setSelectedThesis(thesis);
        setDeleteDialogOpen(true);
    }, []);

    const handleDelete = React.useCallback(async () => {
        if (!selectedThesis) return;
        try {
            await deleteThesis(selectedThesis.id);
            showNotification(`Thesis "${selectedThesis.title}" deleted successfully`, 'success');
        } catch (error) {
            console.error('Failed to delete thesis:', error);
            showNotification('Failed to delete thesis. Please try again.', 'error');
        } finally {
            handleCloseDialog();
        }
    }, [handleCloseDialog, selectedThesis, showNotification]);

    const handleMultiDelete = React.useCallback(async (thesesToDelete: AdminThesisRow[]) => {
        if (thesesToDelete.length === 0) return;
        try {
            await bulkDeleteTheses(thesesToDelete.map((row) => row.id));
            showNotification(`Deleted ${thesesToDelete.length} thesis record(s)`, 'success');
        } catch (error) {
            console.error('Failed to delete multiple theses:', error);
            showNotification('Failed to delete selected theses. Please try again.', 'error');
            throw error;
        }
    }, [showNotification]);

    const handleExport = React.useCallback((selected: AdminThesisRow[]) => {
        try {
            const source = selected.length > 0 ? selected : rows;
            const csv = exportThesesToCsv(source.map((row) => ({
                title: row.title,
                groupId: row.groupId,
                submissionDate: row.submissionDate,
                lastUpdated: row.lastUpdated,
                overallStatus: row.overallStatus,
                chapters: row.chapters,
                leader: row.leaderUid,
                members: row.memberUids,
                adviser: row.adviserUid ?? '',
                editor: row.editorUid ?? '',
            })));
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.href = url;
            link.setAttribute('download', `theses-export-${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            showNotification(`Exported ${source.length} thesis record(s) to CSV`, 'success');
        } catch (error) {
            console.error('Failed to export theses:', error);
            showNotification('Failed to export theses. Please try again.', 'error');
        }
    }, [rows, showNotification]);

    const handleImport = React.useCallback(async (file: File) => {
        startJob(
            `Importing theses from ${file.name}`,
            async (updateProgress, signal) => {
                const text = await file.text();
                if (signal.aborted) {
                    throw new Error('Import cancelled');
                }

                const { parsed, errors: parseErrors } = importThesesFromCsv(text);
                const errors: string[] = parseErrors.map((message) => `Parse: ${message}`);
                const total = parsed.length;
                let successCount = 0;

                for (let index = 0; index < parsed.length; index += 1) {
                    if (signal.aborted) {
                        throw new Error('Import cancelled');
                    }

                    const thesis = parsed[index];
                    updateProgress({
                        current: index + 1,
                        total,
                        message: `Importing thesis ${thesis.title || `#${index + 1}`}`,
                    });

                    try {
                        const groupCache = groupCacheRef.current;
                        let group = groupCache.get(thesis.groupId);
                        if (!group) {
                            const fetchedGroup = await getGroupById(thesis.groupId);
                            if (fetchedGroup) {
                                groupCache.set(fetchedGroup.id, fetchedGroup);
                            }
                            group = fetchedGroup ?? undefined;
                        }

                        if (!group) {
                            errors.push(`Failed to import thesis "${thesis.title}": group ${thesis.groupId} not found`);
                            continue;
                        }

                        const uniqueMembers = Array.from(new Set(thesis.members.filter((uid) => uid)));

                        const thesisPayload: Omit<ThesisData, 'id'> = {
                            title: thesis.title,
                            groupId: thesis.groupId,
                            leader: thesis.leader,
                            members: uniqueMembers,
                            adviser: thesis.adviser,
                            editor: thesis.editor,
                            submissionDate: thesis.submissionDate || new Date().toISOString(),
                            lastUpdated: thesis.lastUpdated || new Date().toISOString(),
                            overallStatus: thesis.overallStatus || 'not_submitted',
                            chapters: thesis.chapters ?? [],
                        };

                        await createThesisForGroup(thesis.groupId, thesisPayload as ThesisData);

                        await updateGroup(thesis.groupId, {
                            members: {
                                leader: thesis.leader,
                                members: uniqueMembers,
                                adviser: thesis.adviser || undefined,
                                editor: thesis.editor || undefined,
                                panels: group.members.panels,
                            },
                        });

                        const updatedGroup: ThesisGroup = {
                            ...group,
                            members: {
                                leader: thesis.leader,
                                members: uniqueMembers,
                                adviser: thesis.adviser || undefined,
                                editor: thesis.editor || undefined,
                                panels: group.members.panels,
                            },
                            updatedAt: new Date().toISOString(),
                        };

                        groupCache.set(updatedGroup.id, updatedGroup);
                        setGroups((prev) => {
                            const indexToReplace = prev.findIndex((entry) => entry.id === updatedGroup.id);
                            if (indexToReplace === -1) {
                                return [...prev, updatedGroup];
                            }
                            const next = [...prev];
                            next[indexToReplace] = updatedGroup;
                            return next;
                        });

                        successCount += 1;
                    } catch (error) {
                        const detail = error instanceof Error ? error.message : 'Unknown error';
                        errors.push(`Failed to import thesis "${thesis.title || `row ${index + 2}`}": ${detail}`);
                    }
                }

                return { count: successCount, total, errors };
            },
            { fileName: file.name, fileSize: file.size, jobType: 'theses-import' },
            (job) => {
                if (job.status === 'completed' && job.result) {
                    const result = job.result as { count: number; total: number; errors: string[] };
                    if (result.errors.length > 0) {
                        showNotification(
                            `Imported ${result.count} of ${result.total} thesis record(s) with warnings`,
                            'warning',
                            6000,
                            {
                                label: 'View details',
                                onClick: () => showNotification(result.errors.join('\n'), 'info', 0),
                            }
                        );
                    } else {
                        showNotification(`Successfully imported ${result.count} thesis record(s)`, 'success');
                    }
                } else if (job.status === 'failed') {
                    showNotification(`Thesis import failed: ${job.error}`, 'error');
                }
            }
        );

        showNotification('Thesis import started in the background.', 'info', 5000);
    }, [showNotification, startJob]);

    const handleSave = React.useCallback(async () => {
        if (!validateForm()) return;

        let chapters: ThesisChapter[] = [];
        try {
            chapters = parseChapters(formState.chaptersText);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Chapters value is invalid';
            setFormErrors((prev) => ({ ...prev, chaptersText: message }));
            return;
        }

        const uniqueMembers = Array.from(new Set(formState.members.filter((uid) => uid && uid !== formState.leader)));

        const thesisPayload: Omit<ThesisData, 'id'> = {
            title: formState.title.trim(),
            groupId: formState.groupId,
            leader: formState.leader,
            members: uniqueMembers,
            adviser: formState.adviser,
            editor: formState.editor,
            submissionDate: fromDateInputString(formState.submissionDate),
            lastUpdated: fromDateInputString(formState.lastUpdated),
            overallStatus: formState.overallStatus || 'In Progress',
            chapters,
        };

        const memberSnapshot: ThesisGroupMembers = {
            leader: formState.leader,
            members: uniqueMembers,
            adviser: formState.adviser || undefined,
            editor: formState.editor || undefined,
        };

        const targetGroup = groupCacheRef.current.get(formState.groupId)
            ?? groups.find((group) => group.id === formState.groupId)
            ?? null;

        if (!targetGroup) {
            showNotification('Selected thesis group was not found. Please refresh and try again.', 'error');
            return;
        }

        setSaving(true);
        try {
            if (editMode && selectedThesis) {
                await setThesis(selectedThesis.id, thesisPayload as ThesisData);
            } else {
                await createThesisForGroup(formState.groupId, thesisPayload as ThesisData);
            }

            const panels = targetGroup?.members.panels;
            await updateGroup(formState.groupId, {
                members: {
                    leader: memberSnapshot.leader,
                    members: memberSnapshot.members,
                    adviser: memberSnapshot.adviser ?? undefined,
                    editor: memberSnapshot.editor ?? undefined,
                    panels,
                },
            });

            const updatedGroup: ThesisGroup = {
                ...targetGroup,
                members: {
                    leader: memberSnapshot.leader,
                    members: memberSnapshot.members,
                    adviser: memberSnapshot.adviser,
                    editor: memberSnapshot.editor,
                    panels,
                },
                updatedAt: new Date().toISOString(),
            };

            groupCacheRef.current.set(formState.groupId, updatedGroup);
            setGroups((prev) => {
                const index = prev.findIndex((group) => group.id === formState.groupId);
                if (index === -1) {
                    return [...prev, updatedGroup];
                }
                const next = [...prev];
                next[index] = {
                    ...next[index],
                    members: updatedGroup.members,
                    updatedAt: updatedGroup.updatedAt,
                };
                return next;
            });

            const finalTitle = thesisPayload.title;
            if (editMode && selectedThesis) {
                showNotification(`Thesis "${finalTitle}" updated successfully`, 'success');
            } else {
                showNotification(`Thesis "${finalTitle}" created successfully`, 'success');
            }

            handleCloseDialog();
        } catch (error) {
            console.error('Failed to save thesis:', error);
            showNotification('Failed to save thesis. Please try again.', 'error');
        } finally {
            setSaving(false);
        }
    }, [editMode, formState, handleCloseDialog, groups, selectedThesis, showNotification, validateForm]);

    const columns = React.useMemo<GridColDef<AdminThesisRow>[]>(() => [
        {
            field: 'title',
            headerName: 'Title',
            flex: 1.4,
            minWidth: 220,
        },
        {
            field: 'leaderName',
            headerName: 'Leader',
            flex: 1,
            minWidth: 200,
        },
        {
            field: 'memberNames',
            headerName: 'Members',
            flex: 1.2,
            minWidth: 220,
            renderCell: (params) => (
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    {params.value?.length ? (
                        params.value.map((label: string) => (
                            <Chip key={label} label={label} size="small" sx={{ maxWidth: '100%' }} />
                        ))
                    ) : (
                        <Typography variant="body2" color="text.secondary">—</Typography>
                    )}
                </Stack>
            ),
            sortable: false,
        },
        {
            field: 'adviserName',
            headerName: 'Adviser',
            flex: 1,
            minWidth: 200,
        },
        {
            field: 'editorName',
            headerName: 'Editor',
            flex: 1,
            minWidth: 200,
        },
        {
            field: 'overallStatus',
            headerName: 'Status',
            flex: 0.8,
            minWidth: 160,
            renderCell: (params) => (
                <Chip
                    label={params.value ?? '—'}
                    color={resolveStatusColor(params.value)}
                    size="small"
                    sx={{ textTransform: 'capitalize' }}
                />
            ),
        },
        {
            field: 'progress',
            headerName: 'Progress',
            flex: 0.7,
            minWidth: 150,
            renderCell: (params) => (
                <Stack sx={{ width: '100%' }} spacing={1}>
                    <LinearProgress variant="determinate" value={params.value ?? 0} />
                    <Typography variant="caption" color="text.secondary">
                        {`${params.value ?? 0}%`}
                    </Typography>
                </Stack>
            ),
            sortable: false,
        },
        {
            field: 'submissionDate',
            headerName: 'Submitted',
            flex: 0.7,
            minWidth: 150,
            valueFormatter: ({ value }) => formatDateShort(value as string | undefined),
        },
        {
            field: 'lastUpdated',
            headerName: 'Last Updated',
            flex: 0.7,
            minWidth: 150,
            valueFormatter: ({ value }) => formatDateShort(value as string | undefined),
        },
    ], []);

    const getAdditionalActions = React.useCallback((params: GridRowParams<AdminThesisRow>) => [
        <GridActionsCellItem
            key="edit"
            icon={<EditIcon />}
            label="Edit"
            onClick={() => handleOpenEditDialog(params.row)}
            showInMenu={false}
        />,
        <GridActionsCellItem
            key="delete"
            icon={<DeleteIcon />}
            label="Delete"
            onClick={() => handleOpenDeleteDialog(params.row)}
            showInMenu={false}
        />,
    ], [handleOpenDeleteDialog, handleOpenEditDialog]);

    if (session?.loading) {
        return (
            <AnimatedPage variant="fade">
                <Box sx={{ p: 4 }}>
                    <Typography variant="h5">Loading thesis management</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Please wait while we verify your access.
                    </Typography>
                </Box>
            </AnimatedPage>
        );
    }

    if (userRole !== 'admin' && userRole !== 'developer') {
        return (
            <AnimatedPage variant="fade">
                <UnauthorizedNotice description="You need to be an administrator or developer to manage theses." variant="box" />
            </AnimatedPage>
        );
    }

    return (
        <AnimatedPage variant="fade">
            <Box sx={{ width: '100%' }}>
                <DataGrid
                    rows={rows}
                    columns={columns}
                    loading={loading}
                    initialPage={0}
                    initialPageSize={10}
                    pageSizeOptions={[5, 10, 25, 50]}
                    checkboxSelection
                    disableRowSelectionOnClick
                    height={600}
                    additionalActions={getAdditionalActions}
                    enableMultiDelete
                    enableExport
                    enableImport
                    enableRefresh
                    enableAdd
                    enableQuickFilter
                    importDisabled={hasActiveImport}
                    onRowsDelete={handleMultiDelete}
                    onExport={handleExport}
                    onImport={handleImport}
                    onRefresh={reloadTheses}
                    onAdd={handleOpenCreateDialog}
                />

                <Dialog
                    open={dialogOpen}
                    onClose={handleCloseDialog}
                    maxWidth="md"
                    fullWidth
                    slots={{ transition: GrowTransition }}
                >
                    <DialogTitle>{editMode ? 'Edit Thesis' : 'Create Thesis'}</DialogTitle>
                    <DialogContent dividers>
                        <Stack spacing={2.5} sx={{ mt: 1 }}>
                            <TextField
                                label="Title"
                                value={formState.title}
                                onChange={(event) => setFormState((prev) => ({ ...prev, title: event.target.value }))}
                                required
                                error={Boolean(formErrors.title)}
                                helperText={formErrors.title}
                                fullWidth
                            />

                            <Autocomplete
                                options={groups}
                                getOptionLabel={(option) => option.name || option.id}
                                value={groups.find((group) => group.id === formState.groupId) ?? null}
                                onChange={(_, value) => setFormState((prev) => ({
                                    ...prev,
                                    groupId: value?.id ?? '',
                                    leader: value?.members.leader ?? prev.leader,
                                    members: value?.members.members ?? prev.members,
                                    adviser: value?.members.adviser ?? prev.adviser,
                                    editor: value?.members.editor ?? prev.editor,
                                }))}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Thesis Group"
                                        required
                                        error={Boolean(formErrors.groupId)}
                                        helperText={formErrors.groupId}
                                    />
                                )}
                            />

                            <Autocomplete
                                options={students}
                                getOptionLabel={(option) => formatProfileLabel(option)}
                                value={students.find((user) => user.uid === formState.leader) ?? null}
                                onChange={(_, value) => setFormState((prev) => ({ ...prev, leader: value?.uid ?? '' }))}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Leader"
                                        required
                                        error={Boolean(formErrors.leader)}
                                        helperText={formErrors.leader}
                                    />
                                )}
                            />

                            <Autocomplete
                                multiple
                                options={students}
                                getOptionLabel={(option) => formatProfileLabel(option)}
                                value={students.filter((user) => formState.members.includes(user.uid))}
                                onChange={(_, value) => setFormState((prev) => ({
                                    ...prev,
                                    members: value.map((user) => user.uid),
                                }))}
                                renderInput={(params) => (
                                    <TextField {...params} label="Members" placeholder="Select members" />
                                )}
                            />

                            <Autocomplete
                                options={advisers}
                                getOptionLabel={(option) => formatProfileLabel(option)}
                                value={advisers.find((user) => user.uid === formState.adviser) ?? null}
                                onChange={(_, value) => setFormState((prev) => ({ ...prev, adviser: value?.uid ?? '' }))}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Adviser"
                                        required
                                        error={Boolean(formErrors.adviser)}
                                        helperText={formErrors.adviser}
                                    />
                                )}
                            />

                            <Autocomplete
                                options={editors}
                                getOptionLabel={(option) => formatProfileLabel(option)}
                                value={editors.find((user) => user.uid === formState.editor) ?? null}
                                onChange={(_, value) => setFormState((prev) => ({ ...prev, editor: value?.uid ?? '' }))}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Editor"
                                        required
                                        error={Boolean(formErrors.editor)}
                                        helperText={formErrors.editor}
                                    />
                                )}
                            />

                            <Autocomplete
                                freeSolo
                                options={STATUS_SUGGESTIONS}
                                value={formState.overallStatus}
                                onInputChange={(_, value) => setFormState((prev) => ({ ...prev, overallStatus: value }))}
                                renderInput={(params) => (
                                    <TextField {...params} label="Overall Status" placeholder="Enter status" />
                                )}
                            />

                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                <TextField
                                    label="Submission Date"
                                    type="date"
                                    value={formState.submissionDate}
                                    onChange={(event) => setFormState((prev) => ({ ...prev, submissionDate: event.target.value }))}
                                    slotProps={{ inputLabel: { shrink: true } }}
                                    fullWidth
                                />
                                <TextField
                                    label="Last Updated"
                                    type="date"
                                    value={formState.lastUpdated}
                                    onChange={(event) => setFormState((prev) => ({ ...prev, lastUpdated: event.target.value }))}
                                    slotProps={{ inputLabel: { shrink: true } }}
                                    fullWidth
                                />
                            </Stack>

                            <TextField
                                label="Chapters (JSON)"
                                value={formState.chaptersText}
                                onChange={(event) => setFormState((prev) => ({ ...prev, chaptersText: event.target.value }))}
                                multiline
                                minRows={4}
                                maxRows={12}
                                error={Boolean(formErrors.chaptersText)}
                                helperText={formErrors.chaptersText ?? 'Provide an array of chapter objects or leave blank for none.'}
                                fullWidth
                            />
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseDialog} disabled={saving}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} variant="contained" disabled={saving}>
                            {saving ? 'Saving…' : 'Save'}
                        </Button>
                    </DialogActions>
                </Dialog>

                <Dialog
                    open={deleteDialogOpen}
                    onClose={handleCloseDialog}
                    maxWidth="sm"
                    fullWidth
                    slots={{ transition: GrowTransition }}
                >
                    <DialogTitle>Delete Thesis</DialogTitle>
                    <DialogContent>
                        <Typography>
                            Are you sure you want to delete "{selectedThesis?.title}"? This action cannot be undone.
                        </Typography>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseDialog}>Cancel</Button>
                        <Button onClick={handleDelete} color="error" variant="contained">
                            Delete
                        </Button>
                    </DialogActions>
                </Dialog>
            </Box>
        </AnimatedPage>
    );
}
