import * as React from 'react';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import type { NavigationItem } from '../../../types/navigation';
import MentorRequestsPage from '../../../components/MentorRequests/MentorRequestsPage';

export const metadata: NavigationItem = {
    group: 'statistician',
    index: 0,
    title: 'Mentor Requests',
    segment: 'statistician/requests',
    icon: <QueryStatsIcon />,
    roles: ['statistician'],
};

export default function StatisticianMentorRequestsPage() {
    return <MentorRequestsPage role="statistician" roleLabel="Statistician" allowedRoles={['statistician']} />;
}
