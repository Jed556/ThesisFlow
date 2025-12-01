import { useParams } from 'react-router-dom';
import type { NavigationItem } from '../../../types/navigation';
import ExpertRequestGroupView from '../../../components/ExpertRequests/ExpertRequestGroupView';

export const metadata: NavigationItem = {
    title: 'Group Profile',
    segment: 'adviser-requests/:groupId',
    roles: ['adviser'],
    hidden: true,
};

export default function AdviserGroupViewPage() {
    const { groupId } = useParams<{ groupId: string }>();
    return (
        <ExpertRequestGroupView
            groupId={groupId ?? ''}
            role="adviser"
            roleLabel="Adviser"
            hint="Shows the thesis group requesting expertship."
        />
    );
}
