import * as React from 'react';
import { AssignmentInd as AssignmentIndIcon } from '@mui/icons-material';
import type { NavigationItem } from '../../../types/navigation';
import ExpertRequestsPage from '../../../components/ExpertRequests/ExpertRequestsPage';

export const metadata: NavigationItem = {
    group: 'statistician',
    index: 0,
    title: 'Expert Requests',
    segment: 'statistician/requests',
    icon: <AssignmentIndIcon />,
    roles: ['statistician'],
};

export default function StatisticianExpertRequestsPage() {
    return <ExpertRequestsPage role="statistician" roleLabel="Statistician" allowedRoles={['statistician']} />;
}
