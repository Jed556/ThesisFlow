import * as React from 'react';
import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import Avatar from '../Avatar/Avatar';
import ProfileBanner from './ProfileBanner';
import type { UserProfile } from '../../types/profile';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';

export interface ProfileHeaderProps {
    profile: UserProfile;
    /** Banner URL (falls back to profile.banner) */
    banner?: string | null;
    /** Accent color for gradient fallback */
    accentColor?: string;
    /** Whether the banner can be updated */
    bannerEditable?: boolean;
    /** Handler invoked when a new banner image is selected */
    onBannerChange?: (file: File) => void;
    /** Loading flag while a banner update is pending */
    bannerUploading?: boolean;
    /** Avatar size to render */
    avatarSize?: 'small' | 'medium' | 'large' | number;
    /** Whether avatar upload/edit button should be shown */
    avatarEditable?: boolean;
    /** Whether to render the name/caption meta area below the banner */
    showMeta?: boolean;
    /** Whether to show a role chip in the meta area */
    showRoleChip?: boolean;
    /** Avatar upload event handler */
    onAvatarChange?: (file: File) => void;
    /** Whether an avatar upload is in progress — shows a loading state on the edit control */
    avatarUploading?: boolean;
    /** Additional styles for the avatar */
    avatarSx?: SxProps<Theme>;
    /** Optional header caption (e.g., course or department) */
    headerCaption?: string;
    /** Optional header actions rendered in the lower-right corner */
    headerActions?: React.ReactNode;
    /** Optional back button metadata */
    backButton?: {
        label?: string;
        onClick: () => void;
    };
    /** Toggle for displaying the back button */
    showBackButton?: boolean;
    /** Optional extra content rendered under the name (e.g., chips) */
    metaChildren?: React.ReactNode;
}

/**
 * ProfileHeader — a combined header that composes ProfileBanner + Avatar and renders
 * basic profile meta (name, caption). The banner handles image validation and gradient
 * fallback; the avatar is layered on top and can show an edit/upload control when editable.
 */
export default function ProfileHeader({
    profile,
    banner,
    accentColor,

    bannerEditable = false,
    onBannerChange,
    bannerUploading = false,
    avatarSize = 112,
    avatarEditable = false,
    showMeta = false,
    showRoleChip = false,
    onAvatarChange,
    avatarUploading = false,
    avatarSx,
    headerCaption = '',
    headerActions,
    backButton,
    showBackButton = false,
    metaChildren,
}: ProfileHeaderProps) {
    const acct = profile.preferences?.themeColor ?? accentColor;
    const displayName = React.useMemo(() => {
        const prefix = profile.name.prefix ? `${profile.name.prefix} ` : '';
        return `${prefix}${profile.name.first} ${profile.name.last}`;
    }, [profile.name]);
    const roleLabel = React.useMemo(() => {
        if (!profile.role) return '';
        return profile.role.charAt(0).toUpperCase() + profile.role.slice(1);
    }, [profile.role]);
    const stackAlign = showMeta ? 'flex-start' : 'center';

    return (
        <Box>
            <ProfileBanner
                banner={banner ?? profile.banner}
                accentColor={acct}
                editable={bannerEditable}
                onBannerChange={onBannerChange}
                uploading={bannerUploading}
            />

            <Box sx={{ p: { xs: 2, md: 3 }, position: 'relative' }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={stackAlign}>
                    <Avatar
                        uid={profile.uid}
                        size={avatarSize}
                        sx={{
                            bgcolor: profile.avatar ? undefined : acct,
                            border: '4px solid',
                            borderColor: 'background.paper',
                            ...avatarSx,
                        }}
                        editable={avatarEditable}
                        onAvatarChange={onAvatarChange}
                        uploading={avatarUploading}
                    />

                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        {showMeta && (
                            <Stack spacing={0.5}>
                                <Typography variant="h4" component="h1" fontWeight={700} noWrap>
                                    {displayName}
                                </Typography>
                                {profile.email && (
                                    <Typography variant="body1" color="text.secondary" noWrap>
                                        {profile.email}
                                    </Typography>
                                )}
                                {headerCaption && (
                                    <Typography variant="body2" color="text.secondary">
                                        {headerCaption}
                                    </Typography>
                                )}
                                {showRoleChip && roleLabel && (
                                    <Stack direction="row" spacing={1}>
                                        <Chip label={roleLabel} size="small" />
                                    </Stack>
                                )}
                                {metaChildren}
                            </Stack>
                        )}
                    </Box>

                </Stack>

                {showBackButton && backButton ? (
                    <Box
                        sx={{
                            position: 'absolute',
                            left: { xs: 12, sm: 24 },
                            bottom: { xs: 12, sm: 20 },
                            display: 'flex',
                        }}
                    >
                        <Button
                            startIcon={<ArrowBackIcon />}
                            variant="text"
                            onClick={backButton.onClick}
                        >
                            {backButton.label ?? 'Back'}
                        </Button>
                    </Box>
                ) : null}

                {headerActions ? (
                    <Box
                        sx={{
                            position: 'absolute',
                            right: { xs: 12, sm: 24 },
                            bottom: { xs: 12, sm: 20 },
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                        }}
                    >
                        {headerActions}
                    </Box>
                ) : null}
            </Box>
        </Box>
    );
}
