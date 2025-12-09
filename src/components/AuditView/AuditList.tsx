import * as React from 'react';
import {
    Alert, Box, Button, Chip, Divider, List, ListItem, ListItemAvatar,
    ListItemText, Pagination, Skeleton, Stack, Tooltip, Typography,
    useMediaQuery
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow, isValid } from 'date-fns';
import { AnimatedList } from '../Animate';
import { Avatar, Name } from '../Avatar';
import type { AuditEntry } from '../../types/audit';
import type { UserProfile } from '../../types/profile';
import type { ThesisGroup } from '../../types/group';
import { getCategoryIcon } from './icons';
import { getAuditCategoryLabel, getAuditCategoryColor } from '../../utils/auditUtils';
import { buildAuditNavigationPath } from '../../utils/auditNotificationUtils';

interface AuditListProps {
    /** Audit entries to display */
    audits: AuditEntry[];
    /** Whether data is loading */
    loading: boolean;
    /** User profiles map for display names */
    userProfiles: Map<string, UserProfile>;
    /** Available groups for name lookup */
    groups: ThesisGroup[];
    /** Whether to show group name in entries */
    showGroupName?: boolean;
    /** Whether to show user avatars */
    showAvatars?: boolean;
    /** Number of items per page */
    itemsPerPage?: number;
    /** Current page (controlled) */
    page?: number;
    /** Page change handler */
    onPageChange?: (page: number) => void;
    /** Empty state message */
    emptyMessage?: string;
    /** Whether filters are active */
    hasActiveFilters?: boolean;
    /** Whether to use compact display */
    compact?: boolean;
}

/**
 * Format timestamp to readable date string
 */
function formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    if (!isValid(date)) return 'Unknown time';
    return format(date, 'PPp');
}

/**
 * Format timestamp to relative time
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
    userProfiles: Map<string, UserProfile>
): string {
    const profile = userProfiles.get(userId);
    if (!profile) return userId;
    const { name, email } = profile;
    if (name?.first || name?.last) {
        return `${name.first || ''} ${name.last || ''}`.trim();
    }
    return email || userId;
}

/**
 * Get group name from groups array
 */
function getGroupName(groupId: string, groups: ThesisGroup[]): string {
    const group = groups.find((g) => g.id === groupId);
    return group?.name || groupId;
}

/**
 * Audit list component with pagination
 */
export function AuditList({
    audits,
    loading,
    userProfiles,
    groups,
    showGroupName = true,
    showAvatars = true,
    itemsPerPage = 20,
    page: controlledPage,
    onPageChange,
    emptyMessage = 'No audit history available yet.',
    hasActiveFilters = false,
    compact = false,
}: AuditListProps): React.ReactElement {
    const theme = useTheme();
    const navigate = useNavigate();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

    // Internal page state for uncontrolled mode
    const [internalPage, setInternalPage] = React.useState(1);
    const page = controlledPage ?? internalPage;

    /**
     * Handle navigation to the relevant page for an audit entry
     */
    const handleViewDetails = React.useCallback((audit: AuditEntry) => {
        const path = buildAuditNavigationPath(audit.category, audit.action, audit.details);
        if (path) {
            navigate(path);
        }
    }, [navigate]);

    const handlePageChange = React.useCallback(
        (_: React.ChangeEvent<unknown>, newPage: number) => {
            if (onPageChange) {
                onPageChange(newPage);
            } else {
                setInternalPage(newPage);
            }
        },
        [onPageChange]
    );

    // Reset page when audits change
    React.useEffect(() => {
        if (!controlledPage) {
            setInternalPage(1);
        }
    }, [audits.length, controlledPage]);

    // Paginated audits
    const paginatedAudits = React.useMemo(() => {
        const startIndex = (page - 1) * itemsPerPage;
        return audits.slice(startIndex, startIndex + itemsPerPage);
    }, [audits, page, itemsPerPage]);

    const totalPages = Math.ceil(audits.length / itemsPerPage);

    // Loading skeleton
    if (loading) {
        return (
            <Stack spacing={2}>
                {Array.from({ length: 5 }).map((_, index) => (
                    <Box key={index}>
                        <Stack direction="row" spacing={2} alignItems="center">
                            {showAvatars && (
                                <Skeleton variant="circular" width={40} height={40} />
                            )}
                            <Box sx={{ flexGrow: 1 }}>
                                <Skeleton width="60%" height={24} />
                                <Skeleton width="40%" height={20} />
                            </Box>
                            <Skeleton width={80} height={24} />
                        </Stack>
                        {index < 4 && <Divider sx={{ mt: 2 }} />}
                    </Box>
                ))}
            </Stack>
        );
    }

    // Empty state
    if (audits.length === 0) {
        return (
            <Alert severity="info">
                {hasActiveFilters
                    ? 'No audit entries match the current filters.'
                    : emptyMessage}
            </Alert>
        );
    }

    return (
        <>
            <List disablePadding>
                <AnimatedList>
                    {paginatedAudits.map((audit, index) => (
                        <React.Fragment key={audit.id}>
                            <ListItem
                                alignItems="flex-start"
                                sx={{
                                    px: 0,
                                    py: compact ? 1 : 1.5,
                                    '&:hover': {
                                        bgcolor: 'action.hover',
                                        borderRadius: 1,
                                    },
                                }}
                            >
                                {showAvatars && (
                                    <ListItemAvatar>
                                        <Avatar
                                            uid={audit.userId}
                                            tooltip="full"
                                            initials={[Name.FIRST, Name.LAST]}
                                        />
                                    </ListItemAvatar>
                                )}
                                <ListItemText
                                    primary={
                                        <Stack
                                            direction={{ xs: 'column', sm: 'row' }}
                                            spacing={1}
                                            alignItems={{
                                                xs: 'flex-start',
                                                sm: 'center',
                                            }}
                                        >
                                            <Typography
                                                variant={compact ? 'body2' : 'subtitle1'}
                                                component="span"
                                                fontWeight="medium"
                                            >
                                                {audit.name}
                                            </Typography>
                                            <Chip
                                                icon={getCategoryIcon(audit.category)}
                                                label={getAuditCategoryLabel(audit.category)}
                                                size="small"
                                                color={getAuditCategoryColor(audit.category)}
                                                variant="outlined"
                                            />
                                        </Stack>
                                    }
                                    secondary={
                                        <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                                            {!compact && (
                                                <Typography
                                                    variant="body2"
                                                    color="text.primary"
                                                >
                                                    {audit.description}
                                                </Typography>
                                            )}
                                            <Stack
                                                direction="row"
                                                spacing={2}
                                                alignItems="center"
                                                flexWrap="wrap"
                                            >
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                >
                                                    by{' '}
                                                    <strong>
                                                        {getUserDisplayName(
                                                            audit.userId,
                                                            userProfiles
                                                        )}
                                                    </strong>
                                                </Typography>
                                                {showGroupName && (
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                    >
                                                        in{' '}
                                                        <strong>
                                                            {getGroupName(audit.groupId, groups)}
                                                        </strong>
                                                    </Typography>
                                                )}
                                                <Tooltip title={formatTimestamp(audit.timestamp)}>
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                    >
                                                        {formatRelativeTime(audit.timestamp)}
                                                    </Typography>
                                                </Tooltip>
                                            </Stack>
                                            {/* View Details button */}
                                            {buildAuditNavigationPath(audit.category, audit.action, audit.details) && (
                                                <Button
                                                    size="small"
                                                    variant="text"
                                                    onClick={() => handleViewDetails(audit)}
                                                    sx={{
                                                        textTransform: 'none',
                                                        fontWeight: 500,
                                                        fontSize: '0.75rem',
                                                        p: 0,
                                                        minWidth: 'auto',
                                                        mt: 0.5,
                                                        '&:hover': {
                                                            backgroundColor: 'transparent',
                                                            textDecoration: 'underline',
                                                        },
                                                    }}
                                                >
                                                    View Details →
                                                </Button>
                                            )}
                                        </Stack>
                                    }
                                />
                            </ListItem>
                            {index < paginatedAudits.length - 1 && (
                                <Divider component="li" />
                            )}
                        </React.Fragment>
                    ))}
                </AnimatedList>
            </List>

            {/* Pagination */}
            {totalPages > 1 && (
                <Stack direction="row" justifyContent="center" sx={{ mt: 3 }}>
                    <Pagination
                        count={totalPages}
                        page={page}
                        onChange={handlePageChange}
                        color="primary"
                        size={isMobile ? 'small' : 'medium'}
                    />
                </Stack>
            )}
        </>
    );
}

export default AuditList;
