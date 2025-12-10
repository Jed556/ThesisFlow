import React from 'react';
import { useSession } from '@toolpad/core';
import { AuthenticationContext } from '@toolpad/core/AppProvider';
import {
    Avatar, Box, Button, Chip, Divider, IconButton, Popover, Skeleton, Stack, Typography, alpha, useTheme
} from '@mui/material';
import { useNavigate } from 'react-router';
import { Logout as LogoutIcon, Settings as SettingsIcon } from '@mui/icons-material';
import type { ExtendedAuthentication, Session } from '../types/session';

/**
 * Modern account menu used in the dashboard toolbar.
 */
export default function AccountMenu() {
    const session = useSession<Session>();
    const theme = useTheme();
    const navigate = useNavigate();
    const authentication = React.useContext(AuthenticationContext) as ExtendedAuthentication | null;
    const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);
    const [signingOut, setSigningOut] = React.useState(false);

    const user = session?.user;
    const isLoading = Boolean(session?.loading);
    const open = Boolean(anchorEl);
    const popoverId = open ? 'account-menu' : undefined;

    const handleOpen = React.useCallback((event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    }, []);

    const handleClose = React.useCallback(() => {
        setAnchorEl(null);
    }, []);

    const handleSignOut = React.useCallback(async () => {
        if (!authentication?.signOut) {
            return;
        }

        setSigningOut(true);
        try {
            await authentication.signOut();
        } catch (error) {
            console.error('Failed to sign out', error);
        } finally {
            setSigningOut(false);
            handleClose();
        }
    }, [authentication, handleClose]);

    const handleGoToSettings = React.useCallback(() => {
        navigate('/settings');
        handleClose();
    }, [handleClose, navigate]);

    const initials = React.useMemo(() => {
        if (user?.name) {
            const firstName = user.name.trim().split(/\s+/)[0];
            if (firstName) return firstName[0]?.toUpperCase() ?? '';
        }
        if (user?.email) {
            return user.email[0]?.toUpperCase() ?? '';
        }
        return '';
    }, [user?.email, user?.name]);

    const roleLabel = React.useMemo(() => {
        if (!user?.role) return 'Guest';
        return user.role.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
    }, [user?.role]);

    const accentSurface = React.useMemo(() => {
        if (theme.palette.mode === 'dark') {
            return `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.2)}, ${alpha(theme.palette.primary.main, 0.16)})`;
        }
        return `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.14)}, ${alpha(theme.palette.secondary.main, 0.18)})`;
    }, [theme.palette.mode, theme.palette.primary.light, theme.palette.primary.main, theme.palette.secondary.main]);

    return (
        <>
            <IconButton
                aria-label="Open account menu"
                aria-describedby={popoverId}
                onClick={handleOpen}
                disableRipple
                sx={{
                    borderRadius: 999,
                    p: 0,
                    border: 'none',
                    backgroundColor: 'transparent',
                    boxShadow: 'none',
                    '&:hover': { backgroundColor: 'transparent' },
                }}
            >
                {isLoading ? (
                    <Skeleton variant="circular" width={32} height={32} />
                ) : (
                    <Avatar
                        src={user?.image || undefined}
                        alt={user?.name || user?.email || 'Account avatar'}
                        sx={{ width: 32, height: 32 }}
                    >
                        {initials}
                    </Avatar>
                )}
            </IconButton>

            <Popover
                id={popoverId}
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                slotProps={{
                    paper: {
                        sx: {
                            width: 340,
                            maxWidth: 'calc(100vw - 24px)',
                            p: 2.5,
                            borderRadius: 3,
                            boxShadow: theme.shadows[8],
                            backgroundColor: 'background.paper',
                            border: `1px solid ${alpha(theme.palette.divider, 0.45)}`,
                            backdropFilter: 'blur(12px)',
                        },
                    }
                }}
            >
                <Stack spacing={2}>
                    <Box
                        sx={{
                            p: 2,
                            borderRadius: 2,
                            background: accentSurface,
                            display: 'flex',
                            gap: 2,
                            alignItems: 'center',
                        }}
                    >
                        {isLoading ? (
                            <Skeleton variant="circular" width={64} height={64} />
                        ) : (
                            <Avatar
                                src={user?.image || undefined}
                                alt={user?.name || user?.email || 'Account avatar'}
                                sx={{ width: 64, height: 64, boxShadow: theme.shadows[3] }}
                            >
                                {initials}
                            </Avatar>
                        )}

                        <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                            {isLoading ? (
                                <>
                                    <Skeleton variant="text" width={160} />
                                    <Skeleton variant="text" width={140} />
                                </>
                            ) : (
                                <>
                                    <Typography variant="subtitle1" fontWeight={700} sx={{ wordBreak: 'break-word' }}>
                                        {user?.name || user?.email || 'Signed in user'}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" noWrap>
                                        {user?.email || 'No email available'}
                                    </Typography>
                                </>
                            )}
                            {isLoading ? (
                                <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: 999 }} />
                            ) : (
                                <Chip
                                    label={roleLabel}
                                    size="small"
                                    sx={{
                                        alignSelf: 'flex-start',
                                        borderRadius: 999,
                                        backgroundColor: alpha(theme.palette.background.paper, 0.6),
                                        fontWeight: 600,
                                        textTransform: 'capitalize',
                                    }}
                                />
                            )}
                        </Stack>
                    </Box>

                    <Stack direction="row" spacing={1.5} sx={{ color: 'text.secondary' }}>
                        <Box sx={{ flex: 1 }}>
                            <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
                                Department
                            </Typography>
                            {isLoading ? (
                                <Skeleton variant="text" width={120} />
                            ) : (
                                <Typography variant="body2" fontWeight={600} color="text.primary">
                                    {user?.department || 'Not set'}
                                </Typography>
                            )}
                        </Box>
                        <Box sx={{ flex: 1 }}>
                            <Typography variant="caption" sx={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
                                Course
                            </Typography>
                            {isLoading ? (
                                <Skeleton variant="text" width={120} />
                            ) : (
                                <Typography variant="body2" fontWeight={600} color="text.primary">
                                    {user?.course || 'Not set'}
                                </Typography>
                            )}
                        </Box>
                    </Stack>

                    <Divider sx={{ borderColor: alpha(theme.palette.divider, 0.6) }} />

                    <Stack spacing={1}>
                        <Button
                            variant="contained"
                            startIcon={<SettingsIcon />}
                            onClick={handleGoToSettings}
                            disabled={isLoading}
                            fullWidth
                            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
                        >
                            Open Settings
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<LogoutIcon />}
                            onClick={handleSignOut}
                            disabled={signingOut || isLoading}
                            fullWidth
                            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
                        >
                            {signingOut ? 'Signing out…' : 'Sign Out'}
                        </Button>
                    </Stack>
                </Stack>
            </Popover>
        </>
    );
}
