import { useParams } from 'react-router-dom';
import type { NavigationItem } from '../../../types/navigation';
import MentorRequestGroupView from '../../../components/MentorRequests/MentorRequestGroupView';

export const metadata: NavigationItem = {
    title: 'Group Profile',
    segment: 'editor-requests/:groupId',
    roles: ['editor'],
    hidden: true,
};

export default function EditorGroupViewPage() {
    const { groupId } = useParams<{ groupId: string }>();
    return (
        <MentorRequestGroupView
            groupId={groupId ?? ''}
            role="editor"
            roleLabel="Editor"
            hint="Shows the thesis group requesting mentorship."
        />
    );
}
