import * as React from 'react';
import EditNoteIcon from '@mui/icons-material/EditNote';
import type { NavigationItem } from '../../types/navigation';
import { AnimatedPage } from '../../components/Animate';
import { TerminalRequirementApprovalWorkspace } from '../../components/TerminalRequirements';

export const metadata: NavigationItem = {
    group: 'thesis',
    index: 3,
    title: 'Terminal Approvals',
    segment: 'editor-terminal-approvals',
    icon: <EditNoteIcon />,
    roles: ['editor'],
};

export default function EditorTerminalRequirementApprovalsPage() {
    return (
        <AnimatedPage variant="slideUp">
            <TerminalRequirementApprovalWorkspace
                role="editor"
                title="Terminal Requirement Approvals"
                description="Review and mark each submission after adviser sign-off so statisticians and admins know when manuscript formatting is finished."
                emptyStateMessage="No thesis groups are currently assigned to you as an editor."
            />
        </AnimatedPage>
    );
}
