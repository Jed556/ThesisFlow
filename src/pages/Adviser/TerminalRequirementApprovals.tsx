import * as React from 'react';
import ChecklistIcon from '@mui/icons-material/Checklist';
import type { NavigationItem } from '../../types/navigation';
import { AnimatedPage } from '../../components/Animate';
import { TerminalRequirementApprovalWorkspace } from '../../components/TerminalRequirements';

export const metadata: NavigationItem = {
    group: 'thesis',
    index: 4,
    title: 'Terminal Approvals',
    segment: 'adviser-terminal-approvals',
    icon: <ChecklistIcon />,
    roles: ['adviser'],
};

export default function AdviserTerminalRequirementApprovalsPage() {
    return (
        <AnimatedPage variant="slideUp">
            <TerminalRequirementApprovalWorkspace
                role="adviser"
                description="Verify each stage once the panels finish their review so editors and statisticians can continue the workflow."
                emptyStateMessage="No thesis groups are currently assigned to you as an adviser."
            />
        </AnimatedPage>
    );
}
