/* eslint-disable max-len */
import * as React from 'react';
import { FactCheck as FactCheckIcon } from '@mui/icons-material';
import type { NavigationItem } from '../../types/navigation';
import { AnimatedPage } from '../../components/Animate';
import { TerminalRequirementApprovalWorkspace } from '../../components/TerminalRequirements';

export const metadata: NavigationItem = {
    group: 'thesis',
    index: 3,
    title: 'Terminal Requirements',
    segment: 'editor-terminal-requirements',
    icon: <FactCheckIcon />,
    roles: ['editor'],
};

export default function EditorTerminalRequirementApprovalsPage() {
    return (
        <AnimatedPage variant="slideUp">
            <TerminalRequirementApprovalWorkspace
                role="editor"
                description="Review and mark each submission after adviser sign-off so statisticians and admins know when manuscript formatting is finished."
                emptyStateMessage="No thesis groups are currently assigned to you as an editor."
            />
        </AnimatedPage>
    );
}
