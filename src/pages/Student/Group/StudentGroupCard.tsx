import * as React from 'react';
import {
    Alert, Box, Button, Chip, Divider, IconButton, Paper, Skeleton, Stack, Typography,
} from '@mui/material';
import {
    Add as AddIcon, Delete as DeleteIcon, PersonAdd as PersonAddIcon, Search as SearchIcon, Send as SendIcon,
    Check as CheckIcon, Close as CloseIcon,
} from '@mui/icons-material';
import type { ThesisGroup } from '../../../types/group';
import type { UserProfile } from '../../../types/profile';
import { Avatar, Name } from '../../../components/Avatar';
import ProfileCard from '../../../components/Profile/ProfileCard';

type LabelFormatter = (uid: string | null | undefined) => string;

type UidCallback = (uid: string) => void;

type VoidCallback = () => void;

export interface StudentGroupCardProps {
    loading: boolean;
    group: ThesisGroup | null;
    isLeader: boolean;
    profiles: Map<string, UserProfile>;
    formatLabel: LabelFormatter;
    onOpenProfile: UidCallback;
    onOpenCreateDialog: VoidCallback;
    onOpenSearchDialog: VoidCallback;
    onOpenInviteDialog: VoidCallback;
    onSubmitForReview: VoidCallback;
    onDeleteGroup: VoidCallback;
    onAcceptJoinRequest: UidCallback;
    onRejectJoinRequest: UidCallback;
    inviteActionsDisabled: boolean;
}

function renderEmptyState(onOpenCreateDialog: VoidCallback, onOpenSearchDialog: VoidCallback) {
    return (
        <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                You are not part of any group yet. Create a new group or join an existing one.
            </Typography>
            <Stack direction="row" spacing={2}>
                <Button startIcon={<AddIcon />} variant="contained" onClick={onOpenCreateDialog}>
                    Create Group
                </Button>
                <Button startIcon={<SearchIcon />} variant="outlined" onClick={onOpenSearchDialog}>
                    Search Group by ID
                </Button>
            </Stack>
        </Paper>
    );
}

function renderSkeleton() {
    return (
        <Paper sx={{ p: 3, mb: 3 }}>
            <Skeleton variant="text" width={200} height={40} sx={{ mb: 2 }} />
            <Skeleton variant="rounded" height={120} />
        </Paper>
    );
}

/**
 * Displays the primary thesis group card with researcher roster and leader actions.
 */
export default function StudentGroupCard({
    loading,
    group,
    isLeader,
    profiles,
    formatLabel,
    onOpenProfile,
    onOpenCreateDialog,
    onOpenSearchDialog,
    onOpenInviteDialog,
    onSubmitForReview,
    onDeleteGroup,
    onAcceptJoinRequest,
    onRejectJoinRequest,
    inviteActionsDisabled,
}: StudentGroupCardProps) {
    const renderPersonCard = React.useCallback((uid: string, roleLabel: string) => {
        if (!uid) return null;
        const profile = profiles.get(uid);

        if (!profile) {
            const displayName = formatLabel(uid);
            return (
                <Paper
                    key={`${roleLabel}-${uid}`}
                    variant="outlined"
                    sx={{
                        p: 2,
                        borderRadius: 2,
                        bgcolor: 'background.default',
                        borderColor: 'divider',
                        width: '100%',
                    }}
                >
                    <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar uid={uid} size={48} tooltip="full" editable={false} />
                        <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                {displayName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {roleLabel}
                            </Typography>
                        </Box>
                    </Stack>
                </Paper>
            );
        }

        return (
            <ProfileCard
                key={`${roleLabel}-${uid}`}
                profile={profile}
                chips={[roleLabel]}
                showEmail
                showSkills={false}
                onClick={() => onOpenProfile(uid)}
                elevation={0}
                variant="outlined"
            />
        );
    }, [formatLabel, onOpenProfile, profiles]);

    const renderRoleSection = React.useCallback((
        title: string,
        people: { uid: string; role: string }[],
    ) => {
        const cards = people
            .filter(({ uid }) => Boolean(uid))
            .map(({ uid, role }) => renderPersonCard(uid, role))
            .filter(Boolean) as React.ReactNode[];

        if (cards.length === 0) {
            return null;
        }

        return (
            <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                    {title}
                </Typography>
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                            xs: '1fr',
                            sm: 'repeat(2, minmax(0, 1fr))',
                            lg: 'repeat(3, minmax(0, 1fr))',
                        },
                        gap: 2,
                    }}
                >
                    {cards}
                </Box>
            </Box>
        );
    }, [renderPersonCard]);

    if (loading) {
        return renderSkeleton();
    }

    if (!group) {
        return renderEmptyState(onOpenCreateDialog, onOpenSearchDialog);
    }

    const researcherEntries = [
        { uid: group.members.leader, role: 'Lead Researcher' },
        ...group.members.members.map((uid) => ({ uid, role: 'Researcher' })),
    ];
    // Combine advisers, editors and statisticians into a single 'Mentors' section
    const mentorEntries = [
        ...(group.members.adviser ? [{ uid: group.members.adviser, role: 'Adviser' }] : []),
        ...(group.members.editor ? [{ uid: group.members.editor, role: 'Editor' }] : []),
        ...(group.members.statistician ? [{ uid: group.members.statistician, role: 'Statistician' }] : []),
    ];
    const panelEntries = (group.members.panels ?? []).map((uid) => ({ uid, role: 'Panelist' }));

    return (
        <Paper sx={{ p: 3, mb: 3 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Box>
                    <Typography variant="overline" color="text.secondary">
                        Thesis Group
                    </Typography>
                    <Typography variant="h5">{group.name}</Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                    <Chip
                        label={group.status.toUpperCase()}
                        color={
                            group.status === 'active' ? 'success'
                                : group.status === 'review' ? 'warning'
                                    : group.status === 'rejected' ? 'error' : 'default'
                        }
                        size="small"
                    />
                    {isLeader && <Chip label="LEADER" color="primary" size="small" />}
                </Stack>
            </Stack>

            {group.description && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {group.description}
                </Typography>
            )}

            {group.status === 'rejected' && group.rejectionReason && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    <strong>Rejection Reason:</strong> {group.rejectionReason}
                </Alert>
            )}

            <Divider sx={{ my: 3 }} />

            {renderRoleSection('Researchers', researcherEntries)}
            {renderRoleSection('Mentors', mentorEntries)}
            {renderRoleSection('Panelists', panelEntries)}

            {isLeader && (
                <>
                    {(group.invites ?? []).length > 0 && (
                        <>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                                Pending Invites
                            </Typography>
                            <Stack spacing={1} sx={{ mb: 2 }}>
                                {group.invites!.map((uid) => (
                                    <Chip key={uid} label={uid} size="small" variant="outlined" />
                                ))}
                            </Stack>
                        </>
                    )}

                    {(group.requests ?? []).length > 0 && (
                        <>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                                Join Requests
                            </Typography>
                            <Stack spacing={1} sx={{ mb: 2 }}>
                                {group.requests!.map((uid) => (
                                    <Stack key={uid} direction="row" spacing={1} alignItems="center">
                                        <Avatar
                                            uid={uid}
                                            initials={[Name.FIRST]}
                                            mode="chip"
                                            tooltip="email"
                                            size="small"
                                            chipProps={{ variant: 'outlined', size: 'small' }}
                                            editable={false}
                                            onClick={() => onOpenProfile(uid)}
                                        />
                                        <IconButton size="small" color="success" onClick={() => onAcceptJoinRequest(uid)}>
                                            <CheckIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton size="small" color="error" onClick={() => onRejectJoinRequest(uid)}>
                                            <CloseIcon fontSize="small" />
                                        </IconButton>
                                    </Stack>
                                ))}
                            </Stack>
                        </>
                    )}

                    <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                        <Button
                            startIcon={<PersonAddIcon />}
                            variant="outlined"
                            onClick={onOpenInviteDialog}
                            disabled={inviteActionsDisabled}
                        >
                            Invite Member
                        </Button>

                        {group.status === 'draft' && (
                            <>
                                <Button startIcon={<SendIcon />} variant="contained" onClick={onSubmitForReview}>
                                    Submit for Review
                                </Button>
                                <Button startIcon={<DeleteIcon />} variant="outlined" color="error" onClick={onDeleteGroup}>
                                    Delete Group
                                </Button>
                            </>
                        )}
                    </Stack>
                </>
            )}
        </Paper>
    );
}
