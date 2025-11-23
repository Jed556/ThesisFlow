import * as React from 'react';
import { Button } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useNavigate, useParams } from 'react-router-dom';
import type { NavigationItem } from '../../../types/navigation';
import { AnimatedPage } from '../../../components/Animate';
import GroupView from '../../../components/Group/GroupView';

export const metadata: NavigationItem = {
    title: 'Group Profile',
    segment: 'adviser-requests/:groupId',
    roles: ['adviser'],
    hidden: true,
};

export default function AdviserGroupViewPage() {
    const { groupId } = useParams<{ groupId: string }>();
    const navigate = useNavigate();

    const handleBack = React.useCallback(() => {
        navigate(-1);
    }, [navigate]);

    return (
        <AnimatedPage variant="fade">
            <GroupView
                groupId={groupId ?? ''}
                headerActions={(
                    <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={handleBack}>
                        Back
                    </Button>
                )}
                hint="Shows the thesis group requesting mentorship."
            />
        </AnimatedPage>
    );
}
