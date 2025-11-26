import type { ChipProps } from '@mui/material';
import type { ThesisGroup } from '../../types/group';

/**
 * Enumerates the allowable thesis group statuses in display order.
 */
export const GROUP_STATUS_OPTIONS: ThesisGroup['status'][] = ['active', 'inactive', 'completed', 'archived'];

/**
 * Maps thesis group statuses to the corresponding MUI chip color token.
 */
export const GROUP_STATUS_COLORS: Record<ThesisGroup['status'], ChipProps['color']> = {
    active: 'success',
    inactive: 'default',
    completed: 'info',
    archived: 'warning',
};

/**
 * Formats a status enum into a display-friendly label.
 */
export const formatGroupStatus = (status: ThesisGroup['status']): string =>
    status.charAt(0).toUpperCase() + status.slice(1);
