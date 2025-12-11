/**
 * ApprovalStatusChip - A unified chip component for displaying approval statuses
 * across the application. Shows an icon, label, and tooltip with decision date/time.
 *
 * Used in:
 * - Terminal Requirements approval workflow
 * - Topic Proposals moderator/head review
 * - Thesis Workspace chapter submissions
 */

import * as React from 'react';
import { Chip, Tooltip } from '@mui/material';
import type { ChipProps } from '@mui/material';
import {
    CheckCircle as ApprovedIcon,
    Pending as PendingIcon,
    Cancel as RejectedIcon,
    Undo as RevisionIcon,
} from '@mui/icons-material';

export type ApprovalChipStatus = 'pending' | 'approved' | 'rejected' | 'revision_required';

export interface ApprovalStatusChipProps {
    /** The role or entity label (e.g., "Adviser", "Moderator", "Editor") */
    roleLabel: string;
    /** Current status of the approval */
    status: ApprovalChipStatus;
    /** ISO date string or Date object for when the decision was made */
    decidedAt?: string | Date | null;
    /** Whether to use filled variant when approved/rejected, outlined when pending */
    highlightDecided?: boolean;
    /** Size of the chip */
    size?: ChipProps['size'];
    /** Additional sx props */
    sx?: ChipProps['sx'];
}

/**
 * Format a date for display in tooltip
 */
function formatDecisionTooltip(status: ApprovalChipStatus, decidedAt?: string | Date | null): string {
    if (status === 'pending') {
        return 'Pending approval';
    }

    if (!decidedAt) {
        const actionLabel = status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Revision requested';
        return `${actionLabel} (date not available)`;
    }

    try {
        const date = typeof decidedAt === 'string' ? new Date(decidedAt) : decidedAt;
        if (Number.isNaN(date.getTime())) {
            return status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Revision requested';
        }

        const formattedDate = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
        const formattedTime = date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });

        const actionLabel = status === 'approved'
            ? 'Approved'
            : status === 'rejected'
                ? 'Rejected'
                : 'Revision requested';

        return `${actionLabel} on ${formattedDate} at ${formattedTime}`;
    } catch {
        return status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Revision requested';
    }
}

/**
 * Get chip configuration based on status
 */
function getChipConfig(roleLabel: string, status: ApprovalChipStatus) {
    switch (status) {
        case 'approved':
            return {
                icon: <ApprovedIcon fontSize="small" />,
                label: `${roleLabel} Approved`,
                color: 'success' as const,
                variant: 'outlined' as const,
            };
        case 'rejected':
            return {
                icon: <RejectedIcon fontSize="small" />,
                label: `${roleLabel} Rejected`,
                color: 'error' as const,
                variant: 'outlined' as const,
            };
        case 'revision_required':
            return {
                icon: <RevisionIcon fontSize="small" />,
                label: `${roleLabel} Needs Revision`,
                color: 'warning' as const,
                variant: 'outlined' as const,
            };
        default: // pending
            return {
                icon: <PendingIcon fontSize="small" />,
                label: `${roleLabel} Pending`,
                color: 'default' as const,
                variant: 'outlined' as const,
            };
    }
}

/**
 * ApprovalStatusChip - Displays a styled chip with icon, status label, and tooltip
 * showing the decision date/time on hover.
 */
export const ApprovalStatusChip: React.FC<ApprovalStatusChipProps> = ({
    roleLabel,
    status,
    decidedAt,
    highlightDecided = false,
    size = 'small',
    sx,
}) => {
    const { icon, label, color, variant: defaultVariant } = getChipConfig(roleLabel, status);
    const tooltipText = formatDecisionTooltip(status, decidedAt);

    // Use filled variant for decided statuses when highlightDecided is true
    const variant = highlightDecided && status !== 'pending' ? 'filled' : defaultVariant;

    return (
        <Tooltip title={tooltipText} arrow>
            <Chip
                size={size}
                icon={icon}
                label={label}
                color={color}
                variant={variant}
                sx={sx}
            />
        </Tooltip>
    );
};

export default ApprovalStatusChip;
