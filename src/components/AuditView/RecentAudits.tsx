/**
 * RecentAudits Component
 * 
 * Displays a compact list of recent audit notifications/updates.
 * Designed to be used in sidebars, dashboards, or "Recent Updates" sections.
 */

import * as React from 'react';
import {
    Box, Button, Chip, List, ListItem, ListItemAvatar, ListItemButton,
    ListItemText, Skeleton, Stack, Typography
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, isValid } from 'date-fns';
import { Notifications as NotificationsIcon } from '@mui/icons-material';
import { Avatar, Name } from '../Avatar';
import { getCategoryIcon } from '../AuditView/icons';
import { getAuditCategoryLabel, getAuditCategoryColor } from '../../utils/auditUtils';
import { getAuditNavigationInfo } from '../../utils/auditNotificationUtils';
import type { UserAuditEntry, AuditCategory } from '../../types/audit';
import type { UserProfile, UserRole } from '../../types/profile';

interface RecentAuditsProps {
    /** Audit entries to display (should be pre-filtered/sorted) */
    audits: UserAuditEntry[];
    /** Whether data is loading */
    loading?: boolean;
    /** User profiles map for display names (optional - will use uid if not provided) */
    userProfiles?: Map<string, UserProfile>;
    /** Current user's role for access control */
    userRole?: UserRole;
    /** Maximum number of items to show */
    maxItems?: number;
    /** Whether to show avatars */
    showAvatars?: boolean;
    /** Whether to show category chips */
    showCategories?: boolean;
    /** Title to display */
    title?: string;
    /** Show "View All" button */
    showViewAll?: boolean;
    /** Path for "View All" button */
    viewAllPath?: string;
    /** Click handler for audit item */
    onAuditClick?: (audit: UserAuditEntry) => void;
    /** Empty state message */
    emptyMessage?: string;
    /** Filter by categories */
    categories?: AuditCategory[];
}

/**
 * Format timestamp to relative time (e.g., "2 hours ago")
 */
function formatRelativeTime(timestamp: string): string {
    const date = new Date(timestamp);
    if (!isValid(date)) return '';
    return formatDistanceToNow(date, { addSuffix: true });
}

/**
 * Get user display name from profile
 */
function getUserDisplayName(
    userId: string,
    userProfiles?: Map<string, UserProfile>
): string {
    if (!userProfiles) return userId.slice(0, 8);
    const profile = userProfiles.get(userId);
    if (!profile) return userId.slice(0, 8);
    const { name, email } = profile;
    if (name?.first || name?.last) {
        return `${name.first || ''} ${name.last || ''}`.trim();
    }
    return email || userId.slice(0, 8);
}

/**
 * Skeleton loader for the audit list
 */
function RecentAuditsSkeleton({
    count = 3,
    showAvatars = true,
}: {
    count?: number;
    showAvatars?: boolean;
}): React.ReactElement {
    return (
        <List disablePadding>
            {Array.from({ length: count }).map((_, index) => (
                <ListItem key={index} disablePadding sx={{ py: 0.5 }}>
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: '100%', px: 1 }}>
                        {showAvatars && (
                            <Skeleton variant="circular" width={32} height={32} />
                        )}
                        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                            <Skeleton width="80%" height={18} />
                            <Skeleton width="50%" height={14} sx={{ mt: 0.5 }} />
                        </Box>
                    </Stack>
                </ListItem>
            ))}
        </List>
    );
}

/**
 * Empty state for no audits
 */
function RecentAuditsEmpty({ message }: { message: string }): React.ReactElement {
    return (
        <Box
            sx={{
                py: 3,
                px: 2,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <NotificationsIcon
                sx={{ fontSize: 40, color: 'action.disabled', mb: 1 }}
            />
            <Typography variant="body2" color="text.secondary" align="center">
                {message}
            </Typography>
        </Box>
    );
}

/**
 * Recent Audits component - displays a compact list of recent updates
 * 
 * @example
 * // Basic usage in a sidebar
 * <RecentAudits
 *     audits={userAudits}
 *     loading={loading}
 *     maxItems={5}
 * />
 * 
 * @example
 * // With full configuration
 * <RecentAudits
 *     audits={userAudits}
 *     loading={loading}
 *     userProfiles={profilesMap}
 *     userRole="student"
 *     maxItems={5}
 *     showAvatars
 *     showCategories
 *     title="Recent Updates"
 *     showViewAll
 *     viewAllPath="/audits"
 *     categories={['submission', 'comment', 'expert']}
 * />
 */
export function RecentAudits({
    audits,
    loading = false,
    userProfiles,
    userRole,
    maxItems = 5,
    showAvatars = true,
    showCategories = true,
    title = 'Recent Updates',
    showViewAll = true,
    viewAllPath = '/audits',
    onAuditClick,
    emptyMessage = 'No recent updates',
    categories,
}: RecentAuditsProps): React.ReactElement {
    const navigate = useNavigate();

    // Filter by categories if specified
    const filteredAudits = React.useMemo(() => {
        let result = audits;
        if (categories && categories.length > 0) {
            result = audits.filter(audit => categories.includes(audit.category));
        }
        return result.slice(0, maxItems);
    }, [audits, categories, maxItems]);



    /**
     * Check if the current user has access to the audit's navigation path
     */
    const canViewAuditDetails = React.useCallback((audit: UserAuditEntry): boolean => {
        const navInfo = getAuditNavigationInfo(audit.category, audit.action, audit.details);
        if (!navInfo) return false;
        if (navInfo.allowedRoles.length === 0) return true;
        if (!userRole) return false;
        return navInfo.allowedRoles.includes(userRole);
    }, [userRole]);

    /**
     * Handle click on an audit item
     */
    const handleAuditClick = React.useCallback((audit: UserAuditEntry) => {
        if (onAuditClick) {
            onAuditClick(audit);
            return;
        }

        // Navigate to the relevant page
        const navInfo = getAuditNavigationInfo(audit.category, audit.action, audit.details);
        if (navInfo?.path && canViewAuditDetails(audit)) {
            navigate(navInfo.path);
        } else {
            // Fallback to audits page
            navigate('/audits');
        }
    }, [onAuditClick, canViewAuditDetails, navigate]);

    return (
        <Box>
            {/* Header */}
            <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 1.5 }}
            >
                <Stack direction="row" alignItems="center" spacing={1}>
                    <NotificationsIcon color="primary" fontSize="small" />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        {title}
                    </Typography>
                </Stack>
                {showViewAll && !loading && audits.length > 0 && (
                    <Button
                        size="small"
                        onClick={() => navigate(viewAllPath)}
                    >
                        View All
                    </Button>
                )}
            </Stack>

            {/* Content */}
            {loading ? (
                <RecentAuditsSkeleton count={maxItems} showAvatars={showAvatars} />
            ) : filteredAudits.length === 0 ? (
                <RecentAuditsEmpty message={emptyMessage} />
            ) : (
                <List disablePadding>
                    {filteredAudits.map((audit) => (
                        <ListItem
                            key={audit.id}
                            disablePadding
                            sx={{
                                mb: 0.5,
                                borderRadius: 1,
                                overflow: 'hidden',
                            }}
                        >
                            <ListItemButton
                                onClick={() => handleAuditClick(audit)}
                                sx={{
                                    py: 1,
                                    px: 1.5,
                                    borderRadius: 1,
                                    bgcolor: audit.read ? 'transparent' : 'action.hover',
                                    '&:hover': {
                                        bgcolor: 'action.selected',
                                    },
                                }}
                            >
                                {showAvatars && (
                                    <ListItemAvatar sx={{ minWidth: 44 }}>
                                        <Avatar
                                            uid={audit.userId}
                                            size={32}
                                            tooltip="full"
                                            initials={[Name.FIRST]}
                                        />
                                    </ListItemAvatar>
                                )}
                                <ListItemText
                                    primary={
                                        <Stack
                                            direction="row"
                                            alignItems="center"
                                            spacing={1}
                                            sx={{ flexWrap: 'wrap' }}
                                        >
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    fontWeight: audit.read ? 'normal' : 'medium',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                    maxWidth: '180px',
                                                }}
                                            >
                                                {audit.name}
                                            </Typography>
                                            {showCategories && (
                                                <Chip
                                                    icon={getCategoryIcon(audit.category)}
                                                    label={getAuditCategoryLabel(audit.category)}
                                                    size="small"
                                                    color={getAuditCategoryColor(audit.category)}
                                                    variant="outlined"
                                                    sx={{
                                                        height: 20,
                                                        '& .MuiChip-label': {
                                                            px: 0.75,
                                                            fontSize: '0.7rem',
                                                        },
                                                        '& .MuiChip-icon': {
                                                            fontSize: 14,
                                                            ml: 0.5,
                                                        },
                                                    }}
                                                />
                                            )}
                                        </Stack>
                                    }
                                    secondary={
                                        <Stack
                                            direction="row"
                                            alignItems="center"
                                            spacing={0.5}
                                            sx={{ mt: 0.25 }}
                                        >
                                            <Typography
                                                variant="caption"
                                                color="text.secondary"
                                                sx={{
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap',
                                                }}
                                            >
                                                {getUserDisplayName(audit.userId, userProfiles)}
                                            </Typography>
                                            <Typography variant="caption" color="text.disabled">
                                                •
                                            </Typography>
                                            <Typography
                                                variant="caption"
                                                color="text.disabled"
                                            >
                                                {formatRelativeTime(audit.timestamp)}
                                            </Typography>
                                        </Stack>
                                    }
                                />
                            </ListItemButton>
                        </ListItem>
                    ))}
                </List>
            )}
        </Box>
    );
}

export default RecentAudits;
