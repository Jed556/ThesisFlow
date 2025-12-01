import * as React from 'react';
import { AssignmentInd as AssignmentIndIcon } from '@mui/icons-material';
import type { NavigationItem } from '../../../types/navigation';
import ExpertRequestsPage from '../../../components/ExpertRequests/ExpertRequestsPage';

export const metadata: NavigationItem = {
    group: 'experts',
    index: 5,
    title: 'Expert Requests',
    segment: 'adviser-requests',
    icon: <AssignmentIndIcon />,
    roles: ['adviser'],
};

export default function AdviserExpertRequestsPage() {
    return <ExpertRequestsPage role="adviser" roleLabel="Adviser" />;
}
