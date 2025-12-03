import * as React from 'react';
import { Chip, Stack, Typography } from '@mui/material';
import { CheckCircle as ApprovedIcon, Pending as PendingIcon, Cancel as ReturnedIcon } from '@mui/icons-material';
import type {
    TerminalRequirementApprovalRole, TerminalRequirementSubmissionRecord
} from '../../types/terminalRequirementSubmission';

export const TERMINAL_REQUIREMENT_ROLE_LABELS: Record<TerminalRequirementApprovalRole, string> = {
    panel: 'Panel',
    adviser: 'Adviser',
    editor: 'Editor',
    statistician: 'Statistician',
};

const APPROVAL_FLOW: TerminalRequirementApprovalRole[] = ['panel', 'adviser', 'editor', 'statistician'];

const STATUS_META = {
    pending: { label: 'Pending', color: 'default' as const, icon: PendingIcon },
    approved: { label: 'Approved', color: 'success' as const, icon: ApprovedIcon },
    returned: { label: 'Returned', color: 'error' as const, icon: ReturnedIcon },
};

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
                    const meta = approval ? STATUS_META[approval.status] : STATUS_META.pending;
                    const roleLabel = TERMINAL_REQUIREMENT_ROLE_LABELS[role];
                    const chipLabel = `${roleLabel} ${meta.label}`;
                    const IconComponent = meta.icon;
                    return (
                        <Chip
                            key={role}
                            icon={<IconComponent fontSize="small" />}
                            label={chipLabel}
                            color={meta.color}
                            size="small"
                            variant="filled"
                        />
                    );
                })}
            </Stack>
        </Stack>
    );
}
