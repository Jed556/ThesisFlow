import * as React from 'react';
import { Stack, Tooltip, Typography } from '@mui/material';
import type {
    TerminalRequirementApprovalRole, TerminalRequirementApprovalState, TerminalRequirementSubmissionRecord
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

/**
 * Counts approved members for a multi-approver role.
 */
function countApprovedMembers(approval: TerminalRequirementApprovalState | undefined): {
    approved: number;
    total: number;
} {
    if (!approval?.memberApprovals) {
        return { approved: 0, total: 0 };
    }
    const members = Object.values(approval.memberApprovals);
    return {
        approved: members.filter((m) => m.status === 'approved').length,
        total: members.length,
    };
}

/**
 * Builds a tooltip showing individual member approval status.
 */
function buildMemberTooltip(
    approval: TerminalRequirementApprovalState | undefined,
    assignedApprovers?: string[],
): string | null {
    if (!approval?.memberApprovals || !assignedApprovers || assignedApprovers.length <= 1) {
        return null;
    }

    const lines: string[] = [];
    for (const uid of assignedApprovers) {
        const member = approval.memberApprovals[uid];
        const statusLabel = member?.status === 'approved'
            ? '✓ Approved'
            : member?.status === 'returned'
                ? '✗ Returned'
                : '○ Pending';
        // Show UID as fallback (in real app, would resolve to display name)
        lines.push(`${statusLabel}`);
    }
    return lines.join('\n');
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
                    const assignedApprovers = submission.assignedApprovers?.[role];
                    const isMultiApprover = assignedApprovers && assignedApprovers.length > 1;

                    // For multi-approver roles, show count progress
                    const { approved, total } = countApprovedMembers(approval);
                    const roleLabel = isMultiApprover && total > 0
                        ? `${TERMINAL_REQUIREMENT_ROLE_LABELS[role]} (${approved}/${total})`
                        : TERMINAL_REQUIREMENT_ROLE_LABELS[role];

                    const status = mapToChipStatus(approval?.status);
                    const isHighlighted = highlightRole === role;
                    const memberTooltip = buildMemberTooltip(approval, assignedApprovers);

                    const chip = (
                        <ApprovalStatusChip
                            key={role}
                            roleLabel={roleLabel}
                            status={status}
                            decidedAt={approval?.decidedAt}
                            highlightDecided={isHighlighted}
                            size="small"
                        />
                    );

                    if (memberTooltip) {
                        return (
                            <Tooltip
                                key={role}
                                title={
                                    <Typography
                                        variant="body2"
                                        sx={{ whiteSpace: 'pre-line' }}
                                    >
                                        {memberTooltip}
                                    </Typography>
                                }
                                arrow
                            >
                                <span>{chip}</span>
                            </Tooltip>
                        );
                    }

                    return chip;
                })}
            </Stack>
        </Stack>
    );
}
