import * as React from 'react';
import { Stack, Typography } from '@mui/material';
import type {
    TerminalRequirementApprovalRole, TerminalRequirementSubmissionRecord
} from '../../types/terminalRequirementSubmission';
import { ApprovalStatusChip, type ApprovalChipStatus } from '../StatusChip';

export const TERMINAL_REQUIREMENT_ROLE_LABELS: Record<TerminalRequirementApprovalRole, string> = {
    panel: 'Panel',
    adviser: 'Adviser',
    editor: 'Editor',
    statistician: 'Statistician',
};

const APPROVAL_FLOW: TerminalRequirementApprovalRole[] = ['panel', 'adviser', 'editor', 'statistician'];

/**
 * Maps terminal requirement approval status to unified chip status
 */
function mapToChipStatus(status?: 'pending' | 'approved' | 'returned'): ApprovalChipStatus {
    switch (status) {
        case 'approved':
            return 'approved';
        case 'returned':
            return 'rejected';
        default:
            return 'pending';
    }
}

export interface SubmissionStatusProps {
    submission?: TerminalRequirementSubmissionRecord | null;
    title?: string;
    highlightRole?: TerminalRequirementApprovalRole | null;
}

export function SubmissionStatus({ submission, title = 'Approval status', highlightRole }: SubmissionStatusProps) {
    if (!submission) {
        return (
            <Stack spacing={1}>
                <Typography variant="subtitle2">{title}</Typography>
                <Typography variant="body2" color="text.secondary">
                    Submit all requirements to start the approval workflow.
                </Typography>
            </Stack>
        );
    }

    const orderedRoles = APPROVAL_FLOW.filter((role) => submission.approvals[role]);

    if (!orderedRoles.length) {
        return (
            <Stack spacing={1}>
                <Typography variant="subtitle2">{title}</Typography>
                <Typography variant="body2" color="text.secondary">
                    Awaiting internal verification. No expert approvals are configured for this stage.
                </Typography>
            </Stack>
        );
    }

    return (
        <Stack spacing={1.5}>
            <Typography variant="subtitle2">{title}</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {orderedRoles.map((role) => {
                    const approval = submission.approvals[role];
                    const status = mapToChipStatus(approval?.status);
                    const roleLabel = TERMINAL_REQUIREMENT_ROLE_LABELS[role];
                    const isHighlighted = highlightRole === role;
                    return (
                        <ApprovalStatusChip
                            key={role}
                            roleLabel={roleLabel}
                            status={status}
                            decidedAt={approval?.decidedAt}
                            highlightDecided={isHighlighted}
                            size="small"
                        />
                    );
                })}
            </Stack>
        </Stack>
    );
}
