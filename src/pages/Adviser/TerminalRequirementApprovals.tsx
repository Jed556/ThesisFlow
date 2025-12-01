import * as React from 'react';
import {FactCheck as FactCheckIcon} from '@mui/icons-material';
import type { NavigationItem } from '../../types/navigation';
import { AnimatedPage } from '../../components/Animate';
import { TerminalRequirementApprovalWorkspace } from '../../components/TerminalRequirements';

export const metadata: NavigationItem = {
    group: 'thesis',
    index: 4,
    title: 'Terminal Requirements',
    segment: 'adviser-terminal-requirements',
    icon: <FactCheckIcon />,
    roles: ['adviser'],
};

export default function AdviserTerminalRequirementApprovalsPage() {
    return (
        <AnimatedPage variant="slideUp">
            <TerminalRequirementApprovalWorkspace
                role="adviser"
                // eslint-disable-next-line max-len
                description="Verify each stage once the panels finish their review so editors and statisticians can continue the workflow."
                emptyStateMessage="No thesis groups are currently assigned to you as an adviser."
            />
        </AnimatedPage>
    );
}
