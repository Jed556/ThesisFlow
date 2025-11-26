import { useParams } from 'react-router-dom';
import type { NavigationItem } from '../../../types/navigation';
import MentorRequestGroupView from '../../../components/MentorRequests/MentorRequestGroupView';

export const metadata: NavigationItem = {
    title: 'Group Profile',
    segment: 'adviser-requests/:groupId',
    roles: ['adviser'],
    hidden: true,
};

export default function AdviserGroupViewPage() {
    const { groupId } = useParams<{ groupId: string }>();
    return (
        <MentorRequestGroupView
            groupId={groupId ?? ''}
            role="adviser"
            roleLabel="Adviser"
            hint="Shows the thesis group requesting mentorship."
        />
    );
}
