import * as React from 'react';
import ManageAccountsIcon from '@mui/icons-material/ManageAccounts';
import type { NavigationItem } from '../../types/navigation';
import MentorRequestsPage from '../../components/MentorRequests/MentorRequestsPage';

export const metadata: NavigationItem = {
    group: 'mentors',
    index: 2,
    title: 'Mentor Requests',
    segment: 'editor-requests',
    icon: <ManageAccountsIcon />,
    roles: ['editor'],
};

export default function EditorMentorRequestsPage() {
    return <MentorRequestsPage role="editor" roleLabel="Editor" />;
}
