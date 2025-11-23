import * as React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { NavigationItem } from '../../../../types/navigation';
import GroupView from '../../../../components/Group/GroupView';

export const metadata: NavigationItem = {
    title: 'Group Details',
    segment: 'group-management/:groupId',
    group: 'management',
    roles: ['admin', 'developer'],
    hidden: true,
};

export default function AdminGroupDetailPage() {
    const navigate = useNavigate();
    const { groupId = '' } = useParams<{ groupId: string }>();

    return (
        <GroupView
            {...({ groupId, enableManagement: true, onBack: () => navigate('/group-management') } as any)}
        />
    );
}
