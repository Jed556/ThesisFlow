import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useSession } from '@toolpad/core';
import { Outlet, Navigate, useLocation } from 'react-router';
import { DashboardLayout, ThemeSwitcher } from '@toolpad/core/DashboardLayout';
import { PageContainer } from '@toolpad/core/PageContainer';
import { Account } from '@toolpad/core/Account';
import type { Session } from '../types/session';

/**
 * CustomActions for the dashboard toolbar
 */
function CustomActions() {
    return (
        <Stack direction="row" alignItems="center">
            <ThemeSwitcher />
        </Stack>
    );
}

/**
 * CustomAccount chip for the dashboard toolbar
 */
function CustomAccount() {
    return (
        <Account
            slotProps={{
                preview: { slotProps: { avatarIconButton: { sx: { border: '0' } } } },
            }}
        />
    );
}

/**
 * Dashboard layout for the application
 */
export default function Layout() {
    const session = useSession<Session>();
    const location = useLocation();

    if (session?.loading) {
        return (
            <Stack alignItems="center" justifyContent="center" sx={{ minHeight: '100vh' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <CircularProgress size={32} />
                    <Typography variant="body2" color="text.secondary">
                        Preparing workspace...
                    </Typography>
                </Box>
            </Stack>
        );
    }

    if (!session?.user) {
        const redirectTo = `/sign-in?callbackUrl=${encodeURIComponent(location.pathname)}`;
        return <Navigate to={redirectTo} replace />;
    }

    return (
        <DashboardLayout slots={{ toolbarActions: CustomActions, toolbarAccount: CustomAccount }}>
            <PageContainer sx={{ pb: 0, mb: '2 !important', maxWidth: '100% !important', width: '100%', height: '100vh' }}>
                <Outlet />
            </PageContainer>
        </DashboardLayout>
    );
}
