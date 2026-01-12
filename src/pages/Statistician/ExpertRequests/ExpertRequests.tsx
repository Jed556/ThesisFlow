import * as React from 'react';
import { AssignmentInd as AssignmentIndIcon } from '@mui/icons-material';
import type { NavigationItem } from '../../../types/navigation';
import ExpertRequestsPage from '../../../components/ExpertRequests/ExpertRequestsPage';
import { useSegmentViewed } from '../../../hooks';

export const metadata: NavigationItem = {
    group: 'experts',
    index: 0,
    title: 'Service Requests',
    segment: 'statistician-requests',
    icon: <AssignmentIndIcon />,
    roles: ['statistician'],
};

export default function StatisticianExpertRequestsPage() {
    useSegmentViewed({ segment: 'statistician-requests' });
    return <ExpertRequestsPage role="statistician" roleLabel="Statistician" allowedRoles={['statistician']} />;
}
