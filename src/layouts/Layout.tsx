import { Box, Fade, LinearProgress, Stack } from '@mui/material';
import { useSession } from '@toolpad/core';
import { Outlet, Navigate, useLocation, useMatches } from 'react-router';
import { DashboardLayout, ThemeSwitcher } from '@toolpad/core/DashboardLayout';
import { PageContainer } from '@toolpad/core/PageContainer';
import { Account } from '@toolpad/core/Account';
import UnauthorizedNotice from './UnauthorizedNotice';
import { hasRoleAccess } from '../utils/roleUtils';
import type { Session } from '../types/session';
import type { NavigationItem } from '../types/navigation';

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
    const matches = useMatches();
    const isLoading = Boolean(session?.loading);
    const hasUser = Boolean(session?.user);
    const activeMatch = matches[matches.length - 1];
    type RouteHandle = { metadata?: NavigationItem };
    const routeMetadata = (activeMatch?.handle as RouteHandle | undefined)?.metadata;
    const requiredRoles = routeMetadata?.roles;
    const userRole = session?.user?.role;
    const hasAccess = !requiredRoles || (userRole ? hasRoleAccess(userRole, requiredRoles) : false);
    const showUnauthorized = hasUser && !isLoading && Boolean(routeMetadata) && !hasAccess;
    const pageTitle = typeof routeMetadata?.title === 'string' ? routeMetadata.title : undefined;

    if (!hasUser && !isLoading) {
        const currentPath = `${location.pathname}${location.search}${location.hash}`;
        const redirectTo = `/sign-in?callbackUrl=${encodeURIComponent(currentPath)}`;
        return <Navigate to={redirectTo} replace />;
    }

    return (
        <>
            <Fade in={isLoading} timeout={{ enter: 200, exit: 450 }}>
                <Box sx={{ width: '100%', position: 'fixed', left: 0, right: 0, top: 0, zIndex: (theme) => theme.zIndex.appBar + 1 }}>
                    <LinearProgress />
                </Box>
            </Fade>

            <DashboardLayout slots={{ toolbarActions: CustomActions, toolbarAccount: CustomAccount }}>
                <PageContainer sx={{ pb: 0, mb: '2 !important', maxWidth: '100% !important', width: '100%', height: '100vh' }}>
                    {hasUser && hasAccess ? <Outlet /> : null}
                    {showUnauthorized ? (
                        <UnauthorizedNotice
                            title={pageTitle ?? 'Unauthorized'}
                            description="You don't have permission to view this page."
                            variant="box"
                        />
                    ) : null}
                </PageContainer>
            </DashboardLayout>
        </>
    );
}
