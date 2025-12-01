import type { ChipProps } from '@mui/material';
import type { ThesisGroup } from '../../types/group';

/**
 * Enumerates the allowable thesis group statuses in display order.
 */
export const GROUP_STATUS_OPTIONS: ThesisGroup['status'][] = [
    'draft', 'review', 'active', 'inactive', 'rejected', 'completed', 'archived'
];

/**
 * Maps thesis group statuses to the corresponding MUI chip color token.
 */
export const GROUP_STATUS_COLORS: Record<ThesisGroup['status'], ChipProps['color']> = {
    draft: 'default',
    review: 'warning',
    active: 'success',
    inactive: 'default',
    rejected: 'error',
    completed: 'info',
    archived: 'warning',
};

/**
 * Formats a status enum into a display-friendly label.
 */
export const formatGroupStatus = (status: ThesisGroup['status']): string =>
    status.charAt(0).toUpperCase() + status.slice(1);
