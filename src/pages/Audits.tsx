import * as React from 'react';
import { Box, Typography, Stack } from '@mui/material';
import { History as HistoryIcon } from '@mui/icons-material';
import { useSession } from '@toolpad/core';
import { AnimatedPage } from '../components/Animate';
import { AuditView } from '../components/AuditView';
import type { NavigationItem } from '../types/navigation';
import type { Session } from '../types/session';

export const metadata: NavigationItem = {
    group: 'management',
    index: 5,
    title: 'Audits',
    segment: 'audits',
    icon: <HistoryIcon />,
    // Visible to all users - filtering is handled within the component
};

/**
 * Audits page for viewing activity history with role-based access
 *
 * This page uses the AuditView component which automatically handles:
 * - Role-based scope availability (personal, group, departmental, admin)
 * - Hierarchical filters (department > course > group)
 * - Category, date, and search filters
 * - Pagination and user profile display
 */
export default function AuditsPage(): React.ReactElement {
    const session = useSession<Session>();

    const userUid = session?.user?.uid ?? null;
    const userRole = session?.user?.role;

    return (
        <AnimatedPage>
            <Box sx={{ p: { xs: 2, md: 3 } }}>
                {/* Header */}
                <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    spacing={2}
                    sx={{ mb: 3 }}
                >
                    <Typography variant="h4" component="h1">
                        Audit History
                    </Typography>
                </Stack>

                {/* Audit View Component */}
                <AuditView
                    userRole={userRole}
                    userUid={userUid}
                    displayConfig={{
                        title: 'Activity Log',
                        showGroupName: true,
                        showAvatars: true,
                        itemsPerPage: 20,
                    }}
                />
            </Box>
        </AnimatedPage>
    );
}
