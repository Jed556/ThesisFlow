import * as React from 'react';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import type { NavigationItem } from '../../types/navigation';
import { AnimatedPage } from '../../components/Animate';
import { TerminalRequirementApprovalWorkspace } from '../../components/TerminalRequirements';

export const metadata: NavigationItem = {
    group: 'thesis',
    index: 2,
    title: 'Terminal Requirements',
    segment: 'statistician-terminal-requirements',
    icon: <QueryStatsIcon />,
    roles: ['statistician'],
};

export default function StatisticianTerminalRequirementApprovalsPage() {
    return (
        <AnimatedPage variant="slideUp">
            <TerminalRequirementApprovalWorkspace
                role="statistician"
                description="Confirm that the quantitative deliverables meet the data standards after editors finish their pass."
                emptyStateMessage="No thesis groups are currently assigned to you as a statistician."
            />
        </AnimatedPage>
    );
}
