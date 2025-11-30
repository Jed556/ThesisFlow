import * as React from 'react';
import {
    Alert, Autocomplete, Button, CircularProgress, Paper, Skeleton, Stack, TextField, Typography,
} from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import type { NavigationItem } from '../../../../types/navigation';
import { AnimatedPage } from '../../../../components/Animate';
import GroupView from '../../../../components/Group/GroupView';
import { useSnackbar } from '../../../../contexts/SnackbarContext';
import { findGroupById, updateGroupById } from '../../../../utils/firebase/firestore/groups';
import { findUsersByFilter, findUsersByIds } from '../../../../utils/firebase/firestore/user';
import type { ThesisGroup } from '../../../../types/group';
import type { UserProfile } from '../../../../types/profile';

export const metadata: NavigationItem = {
    title: 'Group Details',
    segment: 'group-management/:groupId',
    roles: ['admin', 'developer'],
    hidden: true,
};

export default function AdminGroupViewPage() {
    const { groupId } = useParams<{ groupId: string }>();
    const navigate = useNavigate();
    const [refreshToken, setRefreshToken] = React.useState(0);

    const handleBack = React.useCallback(() => {
        navigate(-1);
    }, [navigate]);

    const handleAssignmentsUpdated = React.useCallback(() => {
        setRefreshToken((prev) => prev + 1);
    }, []);

    return (
        <AnimatedPage variant="fade">
            <Stack spacing={3}>
                <GroupView
                    groupId={groupId ?? ''}
                    backButton={{ onClick: handleBack, label: 'Back to list' }}
                    hint="Detailed group view for administrators."
                    refreshToken={refreshToken}
                />

                {groupId ? (
                    <PanelAssignmentManager
                        groupId={groupId}
                        onAssignmentsUpdated={handleAssignmentsUpdated}
                    />
                ) : null}
            </Stack>
        </AnimatedPage>
    );
}

interface PanelAssignmentManagerProps {
    groupId: string;
    onAssignmentsUpdated?: () => void;
}

/**
 * PanelAssignmentManager lets administrators assign or update panel members for a thesis group
 * via a searchable multi-select Autocomplete sourced from panel-role user profiles.
 */
function PanelAssignmentManager({ groupId, onAssignmentsUpdated }: PanelAssignmentManagerProps) {
    const { showNotification } = useSnackbar();
    const [panelOptions, setPanelOptions] = React.useState<UserProfile[]>([]);
    const [selectedPanelUids, setSelectedPanelUids] = React.useState<string[]>([]);
    const [initialPanelUids, setInitialPanelUids] = React.useState<string[]>([]);
    const [currentMembers, setCurrentMembers] = React.useState<ThesisGroup['members'] | null>(null);
    const [loadingOptions, setLoadingOptions] = React.useState(true);
    const [loadingAssignments, setLoadingAssignments] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const loadPanelOptions = React.useCallback(async () => {
        try {
            setLoadingOptions(true);
            const panels = await findUsersByFilter({ role: 'panel' });
            setPanelOptions((prev) => {
                const merged = new Map(prev.map((profile) => [profile.uid, profile]));
                panels.forEach((profile) => {
                    if (profile.uid) {
                        merged.set(profile.uid, profile);
                    }
                });
                return Array.from(merged.values()).sort((a, b) => getProfileLabel(a).localeCompare(getProfileLabel(b)));
            });
        } catch (loadError) {
            console.error('Failed to load panel users', loadError);
            showNotification('Failed to load panel users', 'error');
        } finally {
            setLoadingOptions(false);
        }
    }, [showNotification]);

    const mergeProfiles = React.useCallback((profiles: UserProfile[]) => {
        setPanelOptions((prev) => {
            const merged = new Map(prev.map((profile) => [profile.uid, profile]));
            profiles.forEach((profile) => {
                if (profile.uid) {
                    merged.set(profile.uid, profile);
                }
            });
            return Array.from(merged.values()).sort((a, b) =>
                getProfileLabel(a).localeCompare(getProfileLabel(b))
            );
        });
    }, []);

    const loadAssignments = React.useCallback(async () => {
        setLoadingAssignments(true);
        try {
            const group = await findGroupById(groupId);
            if (!group) {
                setError('Group not found.');
                setSelectedPanelUids([]);
                setInitialPanelUids([]);
                setCurrentMembers(null);
                return;
            }

            const panels = Array.from(new Set(group.members.panels ?? []));
            setSelectedPanelUids(panels);
            setInitialPanelUids(panels);
            setCurrentMembers(group.members);
            setError(null);

            if (panels.length > 0) {
                const panelProfiles = await findUsersByIds(panels);
                mergeProfiles(panelProfiles);
            }
        } catch (assignmentError) {
            console.error('Failed to load panel assignments', assignmentError);
            setError('Unable to load current panel assignments.');
        } finally {
            setLoadingAssignments(false);
        }
    }, [groupId, mergeProfiles]);

    React.useEffect(() => {
        void loadPanelOptions();
    }, [loadPanelOptions]);

    React.useEffect(() => {
        void loadAssignments();
    }, [loadAssignments]);

    const selectedProfiles = React.useMemo(() => {
        const lookup = new Map(panelOptions.map((profile) => [profile.uid, profile]));
        return selectedPanelUids
            .map((uid) => lookup.get(uid))
            .filter((profile): profile is UserProfile => Boolean(profile));
    }, [panelOptions, selectedPanelUids]);

    const hasChanges = React.useMemo(() => {
        if (selectedPanelUids.length !== initialPanelUids.length) {
            return true;
        }
        const nextSorted = [...selectedPanelUids].sort();
        const initialSorted = [...initialPanelUids].sort();
        return nextSorted.some((uid, index) => uid !== initialSorted[index]);
    }, [initialPanelUids, selectedPanelUids]);

    const handleSelectionChange = React.useCallback((_: unknown, value: UserProfile[]) => {
        const uids = value
            .map((profile) => profile.uid)
            .filter((uid): uid is string => Boolean(uid));
        setSelectedPanelUids(Array.from(new Set(uids)));
    }, []);

    const handleSave = React.useCallback(async () => {
        try {
            setSaving(true);
            const nextMembers: ThesisGroup['members'] = {
                ...(currentMembers ?? { leader: '', members: [] }),
                panels: selectedPanelUids,
            };
            await updateGroupById(groupId, {
                panels: selectedPanelUids,
            });
            setInitialPanelUids(selectedPanelUids);
            setCurrentMembers(nextMembers);
            showNotification('Panel assignments updated', 'success');
            onAssignmentsUpdated?.();
            await loadAssignments();
        } catch (saveError) {
            console.error('Failed to update panel assignments', saveError);
            showNotification('Failed to update panel assignments', 'error');
        } finally {
            setSaving(false);
        }
    }, [groupId, loadAssignments, onAssignmentsUpdated, selectedPanelUids, showNotification]);

    if (!groupId) {
        return <Alert severity="warning">A valid group ID is required to manage panel assignments.</Alert>;
    }

    return (
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
            <Stack spacing={2}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }}>
                    <BoxHeading title="Panel assignments" description="Select which panelists are assigned to this group." />
                    <Button
                        variant="contained"
                        onClick={handleSave}
                        disabled={!hasChanges || saving || loadingAssignments}
                        sx={{ alignSelf: { xs: 'stretch', md: 'flex-start' }, ml: { md: 'auto' } }}
                    >
                        {saving ? 'Saving…' : 'Save assignments'}
                    </Button>
                </Stack>

                {error ? (
                    <Alert severity="error">{error}</Alert>
                ) : null}

                {loadingAssignments ? (
                    <Skeleton variant="rectangular" height={64} sx={{ borderRadius: 1 }} />
                ) : (
                    <Autocomplete
                        multiple
                        options={panelOptions}
                        value={selectedProfiles}
                        onChange={handleSelectionChange}
                        loading={loadingOptions}
                        disableCloseOnSelect
                        getOptionLabel={getProfileLabel}
                        isOptionEqualToValue={(option, value) => option.uid === value.uid}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Assigned panels"
                                placeholder="Search panel members"
                                slotProps={{
                                    input: {
                                        ...params.InputProps,
                                        endAdornment: (
                                            <>
                                                {loadingOptions ? <CircularProgress color="inherit" size={16} /> : null}
                                                {params.InputProps.endAdornment}
                                            </>
                                        ),
                                    },
                                }}
                            />
                        )}
                    />
                )}
            </Stack>
        </Paper>
    );
}

/** Simple helper that renders a stacked heading + description block with consistent spacing. */
function BoxHeading({ title, description }: { title: string; description: string; }) {
    return (
        <Stack spacing={0.5} sx={{ flex: 1 }}>
            <Typography variant="h6">{title}</Typography>
            <Typography variant="body2" color="text.secondary">{description}</Typography>
        </Stack>
    );
}

/** Format a user profile into a concise display label for autocomplete and chips. */
function getProfileLabel(profile: UserProfile): string {
    const nameParts = [
        profile.name?.prefix,
        profile.name?.first,
        profile.name?.middle,
        profile.name?.last,
        profile.name?.suffix,
    ].filter((value): value is string => Boolean(value && value.trim()));

    if (nameParts.length > 0) {
        return nameParts.join(' ');
    }

    return profile.email ?? profile.uid ?? 'Unknown user';
}
