import * as React from 'react';
import VerifiedIcon from '@mui/icons-material/Verified';
import type { NavigationItem } from '../../types/navigation';
import { AnimatedPage } from '../../components/Animate';
import { TerminalRequirementApprovalWorkspace } from '../../components/TerminalRequirements';

export const metadata: NavigationItem = {
    group: 'thesis',
    index: 5,
    title: 'Terminal Approvals',
    segment: 'panel-terminal-approvals',
    icon: <VerifiedIcon />,
    roles: ['panel'],
};

export default function PanelTerminalRequirementApprovalsPage() {
    return (
        <AnimatedPage variant="slideUp">
            <TerminalRequirementApprovalWorkspace
                role="panel"
                title="Terminal Requirement Approvals"
                description="Review each stage’s submissions and endorse the group so advisers can continue the workflow."
                emptyStateMessage="No thesis groups are currently assigned to you as a panel member."
            />
        </AnimatedPage>
    );
}
