import * as React from 'react';
import VerifiedIcon from '@mui/icons-material/Verified';
import type { NavigationItem } from '../../types/navigation';
import { AnimatedPage } from '../../components/Animate';
import { TerminalRequirementApprovalWorkspace } from '../../components/TerminalRequirements';

export const metadata: NavigationItem = {
    group: 'thesis',
    index: 5,
    title: 'Terminal Requirements',
    segment: 'panel-terminal-requirements',
    icon: <VerifiedIcon />,
    roles: ['panel'],
};

export default function PanelTerminalRequirementApprovalsPage() {
    return (
        <AnimatedPage variant="slideUp">
            <TerminalRequirementApprovalWorkspace
                role="panel"
                description="Review each stage’s submissions and endorse the group so advisers can continue the workflow."
                emptyStateMessage="No thesis groups are currently assigned to you as a panel member."
            />
        </AnimatedPage>
    );
}
