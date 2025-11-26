import { useParams } from 'react-router-dom';
import type { NavigationItem } from '../../../types/navigation';
import MentorRequestGroupView from '../../../components/MentorRequests/MentorRequestGroupView';

export const metadata: NavigationItem = {
    title: 'Group Profile',
    segment: 'statistician-requests/:groupId',
    roles: ['statistician'],
    hidden: true,
};

export default function StatisticianGroupViewPage() {
    const { groupId } = useParams<{ groupId: string }>();
    return (
        <MentorRequestGroupView
            groupId={groupId ?? ''}
            role="statistician"
            roleLabel="Statistician"
            hint="Shows the thesis group requesting mentorship."
        />
    );
}
