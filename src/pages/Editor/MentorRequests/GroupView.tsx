import { useParams } from 'react-router-dom';
import type { NavigationItem } from '../../../types/navigation';
import ExpertRequestGroupView from '../../../components/ExpertRequests/ExpertRequestGroupView';

export const metadata: NavigationItem = {
    title: 'Group Profile',
    segment: 'editor-requests/:groupId',
    roles: ['editor'],
    hidden: true,
};

export default function EditorGroupViewPage() {
    const { groupId } = useParams<{ groupId: string }>();
    return (
        <ExpertRequestGroupView
            groupId={groupId ?? ''}
            role="editor"
            roleLabel="Editor"
            hint="Shows the thesis group requesting expertship."
        />
    );
}
