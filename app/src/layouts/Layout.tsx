import Stack from '@mui/material/Stack';
import { Outlet, Navigate, useLocation } from 'react-router';
import { DashboardLayout, ThemeSwitcher } from '@toolpad/core/DashboardLayout';
import { PageContainer } from '@toolpad/core/PageContainer';
import { Account } from '@toolpad/core/Account';

import { useSession } from '../SessionContext';

function CustomActions() {
    return (
        <Stack direction="row" alignItems="center">
            <ThemeSwitcher />
        </Stack>
    );
}

function CustomAccount() {
    return (
        <Account
            slotProps={{
                preview: { slotProps: { avatarIconButton: { sx: { border: '0' } } } },
            }}
        />
    );
}

export default function Layout() {
    const { session } = useSession();
    const location = useLocation();

    if (!session) {
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
