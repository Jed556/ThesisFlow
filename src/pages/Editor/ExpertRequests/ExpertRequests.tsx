import * as React from 'react';
import { AssignmentInd as AssignmentIndIcon } from '@mui/icons-material';
import type { NavigationItem } from '../../../types/navigation';
import ExpertRequestsPage from '../../../components/ExpertRequests/ExpertRequestsPage';

export const metadata: NavigationItem = {
    group: 'experts',
    index: 2,
    title: 'Service Requests',
    segment: 'editor-requests',
    icon: <AssignmentIndIcon />,
    roles: ['editor'],
};

export default function EditorExpertRequestsPage() {
    return <ExpertRequestsPage role="editor" roleLabel="Editor" />;
}
