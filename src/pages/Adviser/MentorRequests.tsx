import * as React from 'react';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import type { NavigationItem } from '../../types/navigation';
import MentorRequestsPage from '../../components/MentorRequests/MentorRequestsPage';

export const metadata: NavigationItem = {
    group: 'adviser-editor',
    index: 5,
    title: 'Mentor Requests',
    segment: 'adviser/requests',
    icon: <AssignmentIndIcon />,
    roles: ['adviser'],
};

export default function AdviserMentorRequestsPage() {
    return <MentorRequestsPage role="adviser" roleLabel="Adviser" />;
}
