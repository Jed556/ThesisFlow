import * as React from 'react';
import {
    Box, Paper, IconButton, Typography, Button, Divider,
    LinearProgress, Stack, useTheme, alpha
} from '@mui/material';
import {
    Close as CloseIcon, CheckCircle as SuccessIcon, Error as ErrorIcon,
    Warning as WarningIcon, Info as InfoIcon, Cancel as CancelIcon,
    HourglassEmpty as HourglassIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import {
    useSnackbar, type Notification, type NotificationSeverity, type NotificationAction,
} from '../../contexts/SnackbarContext';

/**
 * Get default icon for severity
 */
function getDefaultIcon(severity: NotificationSeverity): React.ReactElement {
    switch (severity) {
        case 'success':
            return <SuccessIcon />;
        case 'error':
            return <ErrorIcon />;
        case 'warning':
            return <WarningIcon />;
        case 'info':
        default:
            return <InfoIcon />;
    }
}

/**
 * Timer progress bar component
 */
interface TimerProgressProps {
    duration: number;
    createdAt: number;
    severity: NotificationSeverity;
}

function TimerProgress({ duration, createdAt, severity }: TimerProgressProps) {
    const theme = useTheme();
    const [progress, setProgress] = React.useState(100);

    React.useEffect(() => {
        if (duration <= 0) return;

        const updateProgress = () => {
            const elapsed = Date.now() - createdAt;
            const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
            setProgress(remaining);
        };

        // Update every 50ms for smooth animation
        const interval = setInterval(updateProgress, 50);
        updateProgress();

        return () => clearInterval(interval);
    }, [duration, createdAt]);

    if (duration <= 0) return null;

    return (
        <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 3,
                borderRadius: '0 0 12px 12px',
                backgroundColor: alpha(theme.palette[severity].main, 0.15),
                '& .MuiLinearProgress-bar': {
                    backgroundColor: theme.palette[severity].main,
                    transition: 'transform 0.05s linear',
                },
            }}
        />
    );
}

/**
 * Job progress bar component - shows job completion percentage at the bottom
 */
interface JobProgressProps {
    progress: number;
    severity: NotificationSeverity;
}

function JobProgressBar({ progress, severity }: JobProgressProps) {
    const theme = useTheme();

    return (
        <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 3,
                borderRadius: '0 0 12px 12px',
                backgroundColor: alpha(theme.palette[severity].main, 0.15),
                '& .MuiLinearProgress-bar': {
                    backgroundColor: theme.palette[severity].main,
                    transition: 'transform 0.1s ease-out',
                },
            }}
        />
    );
}

/**
 * Action button component
 */
interface ActionButtonProps {
    action: NotificationAction;
    severity: NotificationSeverity;
    onClose: () => void;
}

function ActionButton({ action, severity, onClose }: ActionButtonProps) {
    const navigate = useNavigate();
    const theme = useTheme();

    const handleClick = () => {
        if (action.href) {
            navigate(action.href);
        }
        action.onClick();
        onClose();
    };

    const variant = action.variant ?? 'outlined';

    return (
        <Button
            size="small"
            variant={variant}
            onClick={handleClick}
            sx={{
                minWidth: 'auto',
                px: 2,
                py: 0.5,
                fontSize: '0.8125rem',
                fontWeight: 500,
                textTransform: 'none',
                borderRadius: 2,
                borderColor: variant === 'outlined' ? theme.palette[severity].main : undefined,
                color: variant === 'contained'
                    ? theme.palette[severity].contrastText
                    : theme.palette[severity].main,
                backgroundColor: variant === 'contained'
                    ? theme.palette[severity].main
                    : undefined,
                '&:hover': {
                    borderColor: variant === 'outlined' ? theme.palette[severity].dark : undefined,
                    backgroundColor: variant === 'contained'
                        ? theme.palette[severity].dark
                        : alpha(theme.palette[severity].main, 0.08),
                },
            }}
        >
            {action.label}
        </Button>
    );
}

/**
 * Individual notification item component - Modern design with enter/exit animations
 * Stacking: Newest notification on top, older ones peek below with reduced scale
 */
interface NotificationItemProps {
    notification: Notification;
    index: number;
    totalCount: number;
    isExpanded: boolean;
    onClose: (id: string) => void;
    onCancelJob?: (jobId: string) => void;
}

function NotificationItem({
    notification, index, totalCount, isExpanded, onClose, onCancelJob
}: NotificationItemProps) {
    const theme = useTheme();
    const {
        id, title, message, severity, icon, showDivider, actions, showProgress, duration, createdAt,
        type, jobId, jobProgress, jobStatus, dismissible = true, showCancel,
    } = notification;

    const isJob = type === 'job';
    const isActiveJob = isJob && (jobStatus === 'running' || jobStatus === 'pending');

    // Animation states
    const [isVisible, setIsVisible] = React.useState(false);
    const [isExiting, setIsExiting] = React.useState(false);

    // Trigger enter animation on mount
    React.useEffect(() => {
        const enterTimer = setTimeout(() => setIsVisible(true), 10 + index * 50);
        return () => clearTimeout(enterTimer);
    }, [index]);

    const handleClose = React.useCallback(() => {
        // Don't allow closing active jobs with X button
        if (isActiveJob && !dismissible) return;
        if (isExiting) return; // Prevent double-close
        setIsExiting(true);
        // Wait for exit animation to complete before removing
        setTimeout(() => onClose(id), 200);
    }, [id, onClose, isExiting, isActiveJob, dismissible]);

    const handleCancelJob = React.useCallback(() => {
        if (jobId && onCancelJob) {
            onCancelJob(jobId);
        }
    }, [jobId, onCancelJob]);

    // Auto-dismiss timer - triggers animated close (skip for active jobs)
    React.useEffect(() => {
        if (duration <= 0 || isActiveJob) return;

        const remainingTime = duration - (Date.now() - createdAt);
        if (remainingTime <= 0) {
            handleClose();
            return;
        }

        const timer = setTimeout(() => {
            handleClose();
        }, remainingTime);

        return () => clearTimeout(timer);
    }, [duration, createdAt, handleClose, isActiveJob]);

    // Get display icon - use hourglass for running jobs
    const getDisplayIcon = () => {
        if (icon) return icon;
        if (isActiveJob) return <HourglassIcon />;
        return getDefaultIcon(severity);
    };

    const displayIcon = getDisplayIcon();
    const severityColor = theme.palette[severity].main;
    const isDarkMode = theme.palette.mode === 'dark';

    // Stacking calculations - index 0 is the newest/front card (at bottom visually)
    // Older cards (higher index) peek out ABOVE the front card
    const stackOffset = 10; // Vertical offset between stacked cards (peek amount)
    const scaleReduction = 0.04; // Scale reduction per card in stack
    const maxStackedCards = 3; // Maximum visible cards in stack

    // For stacked mode: only show first 3 cards, rest are hidden
    const isHiddenInStack = !isExpanded && index >= maxStackedCards;
    const stackIndex = Math.min(index, maxStackedCards - 1);

    // Calculate stacked transform - older cards move UP (negative Y) and shrink
    // Index 0 (newest) = no offset, full scale
    // Index 1+ (older) = negative offset (moves up), smaller scale
    const stackedTransform = `translateY(${-stackIndex * stackOffset}px) scale(${1 - stackIndex * scaleReduction})`;
    const expandedTransform = 'translateY(0) scale(1)';
    const enterTransform = 'translateY(20px) scale(0.95)';
    const exitTransform = 'translateY(10px) scale(0.98)';

    return (
        <Paper
            elevation={isDarkMode ? 8 : 6}
            sx={{
                // In stacked mode, use absolute positioning for overlay effect
                // In expanded mode, use relative for normal flow
                position: isExpanded ? 'relative' : 'absolute',
                bottom: 0, // Anchor to bottom
                left: 0,
                right: 0,
                width: '100%',
                overflow: 'hidden',
                borderRadius: 3,
                // Use theme's background.paper for proper light/dark mode support
                backgroundColor: 'background.paper',
                border: '1px solid var(--mui-palette-divider)',
                // Enter/exit animation and stacking
                // Stacked cards (not front) have reduced opacity for modern look
                opacity: isExiting
                    ? 0
                    : isHiddenInStack
                        ? 0
                        : isVisible
                            ? (isExpanded ? 1 : index === 0 ? 1 : 0.6)
                            : 0,
                transform: isExiting
                    ? exitTransform
                    : isVisible
                        ? isExpanded
                            ? expandedTransform
                            : stackedTransform
                        : enterTransform,
                transition: isExiting
                    ? 'opacity 0.2s ease-out, transform 0.2s ease-out'
                    : 'all 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
                transitionDelay: isVisible && !isExiting ? `${index * 30}ms` : '0ms',
                transformOrigin: 'bottom center',
                zIndex: totalCount - index, // Front card (index 0) has highest z-index
                mb: isExpanded ? 1.5 : 0,
                boxShadow: theme.shadows[8],
            }}
        >
            {/* Main content container */}
            <Box sx={{ p: 2, pb: showProgress ? 2.5 : 2 }}>
                {/* Header row: Icon + Title + Close */}
                <Stack direction="row" alignItems="flex-start" spacing={1.5}>
                    {/* Icon container */}
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            backgroundColor: alpha(severityColor, isDarkMode ? 0.2 : 0.12),
                            color: severityColor,
                            flexShrink: 0,
                            '& .MuiSvgIcon-root': {
                                fontSize: 22,
                            },
                        }}
                    >
                        {displayIcon}
                    </Box>

                    {/* Content area */}
                    <Box sx={{ flex: 1, minWidth: 0, pt: 0.25 }}>
                        {/* Title */}
                        {title && (
                            <Typography
                                variant="subtitle1"
                                sx={{
                                    fontWeight: 600,
                                    color: 'text.primary',
                                    lineHeight: 1.3,
                                    mb: showDivider ? 1 : 0.5,
                                }}
                            >
                                {title}
                            </Typography>
                        )}

                        {/* Divider */}
                        {showDivider && (
                            <Divider sx={{ mb: 1, borderColor: alpha(severityColor, 0.2) }} />
                        )}

                        {/* Message with job progress % inline */}
                        <Typography
                            variant="body2"
                            sx={{
                                color: 'text.secondary',
                                lineHeight: 1.5,
                                wordBreak: 'break-word',
                            }}
                        >
                            {message}
                            {isJob && typeof jobProgress === 'number' && (
                                <Typography
                                    component="span"
                                    variant="body2"
                                    sx={{
                                        color: severityColor,
                                        fontWeight: 600,
                                        ml: 1,
                                    }}
                                >
                                    {`${jobProgress}%`}
                                </Typography>
                            )}
                        </Typography>

                        {/* Action buttons or Cancel button for jobs */}
                        {(actions && actions.length > 0) || showCancel ? (
                            <Stack
                                direction="row"
                                spacing={1}
                                justifyContent={showCancel ? 'flex-end' : 'flex-start'}
                                sx={{ mt: 1.5 }}
                            >
                                {/* Regular action buttons */}
                                {actions?.map((action, actionIndex) => (
                                    <ActionButton
                                        key={actionIndex}
                                        action={action}
                                        severity={severity}
                                        onClose={handleClose}
                                    />
                                ))}
                                {/* Cancel button for active jobs - positioned to the right */}
                                {showCancel && (
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        color="error"
                                        startIcon={<CancelIcon />}
                                        onClick={handleCancelJob}
                                        sx={{
                                            minWidth: 'auto',
                                            px: 2,
                                            py: 0.5,
                                            fontSize: '0.8125rem',
                                            fontWeight: 500,
                                            textTransform: 'none',
                                            borderRadius: 2,
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                )}
                            </Stack>
                        ) : null}
                    </Box>

                    {/* Close button - only show if notification is dismissible */}
                    {dismissible && (
                        <IconButton
                            size="small"
                            onClick={handleClose}
                            sx={{
                                color: 'text.secondary',
                                p: 0.5,
                                '&:hover': {
                                    backgroundColor: alpha(severityColor, 0.08),
                                    color: severityColor,
                                },
                            }}
                        >
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    )}
                </Stack>
            </Box>

            {/* Bottom progress bar - job progress for active jobs, timer for regular notifications */}
            {isActiveJob && typeof jobProgress === 'number' ? (
                <JobProgressBar
                    progress={jobProgress}
                    severity={severity}
                />
            ) : (
                showProgress && !isActiveJob && (
                    <TimerProgress
                        duration={duration}
                        createdAt={createdAt}
                        severity={severity}
                    />
                )
            )}
        </Paper>
    );
}

/**
 * Badge showing notification count (when stacked) - pill shaped, attached to bottom of front card
 */
interface NotificationBadgeProps {
    count: number;
    isExpanded: boolean;
}

function NotificationBadge({ count, isExpanded }: NotificationBadgeProps) {
    const theme = useTheme();

    if (count <= 1) return null;

    return (
        <Box
            sx={{
                position: 'absolute',
                bottom: -16, // Attach to bottom of front card, overlapping slightly
                left: '50%',
                transform: 'translateX(-50%)',
                opacity: isExpanded ? 0 : 1,
                transition: 'opacity 0.2s ease-in-out',
                pointerEvents: 'none',
                zIndex: 100, // Above all cards
            }}
        >
            <Paper
                elevation={4}
                sx={{
                    backgroundColor: theme.palette.text.primary,
                    color: theme.palette.background.paper,
                    px: 2.5,
                    py: 0.5,
                    borderRadius: 3,
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    minWidth: 36,
                    textAlign: 'center',
                    border: `1px solid ${theme.palette.divider}`,
                    boxShadow: theme.shadows[3],
                }}
            >
                {count}
            </Paper>
        </Box>
    );
}

/**
 * Main snackbar container component that handles stacking and hover expansion
 */
export default function SnackbarContainer() {
    const { notifications, hideNotification, onCancelJob } = useSnackbar();
    // Expansion is only triggered by clicking, not hovering
    const [isExpanded, setIsExpanded] = React.useState(false);

    // Auto-collapse after a delay when clicking outside or after interaction
    const handleToggleExpand = React.useCallback(() => {
        setIsExpanded((prev) => !prev);
    }, []);

    // Auto-collapse when notifications change (new one added or one removed)
    React.useEffect(() => {
        if (isExpanded && notifications.length <= 1) {
            setIsExpanded(false);
        }
    }, [notifications.length, isExpanded]);

    if (notifications.length === 0) {
        return null;
    }

    return (
        <Box
            onClick={notifications.length > 1 ? handleToggleExpand : undefined}
            sx={{
                position: 'fixed',
                bottom: 24,
                right: 24,
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                pointerEvents: 'auto',
                maxHeight: isExpanded ? 'calc(100vh - 100px)' : 'auto',
                overflowY: isExpanded ? 'auto' : 'visible',
                overflowX: 'visible',
                '&::-webkit-scrollbar': {
                    width: '6px',
                },
                '&::-webkit-scrollbar-track': {
                    backgroundColor: 'transparent',
                },
                '&::-webkit-scrollbar-thumb': {
                    backgroundColor: 'rgba(0,0,0,0.2)',
                    borderRadius: '3px',
                    '&:hover': {
                        backgroundColor: 'rgba(0,0,0,0.3)',
                    },
                },
            }}
        >
            <Box
                sx={{
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    width: 380,
                    maxWidth: '90vw',
                }}
            >
                {/* Stack container - reserves height for absolute positioned cards */}
                <Box
                    sx={{
                        position: 'relative',
                        width: '100%',
                        // Reserve space at TOP for cards peeking above
                        // and at BOTTOM for the badge
                        pt: isExpanded ? 0 : `${Math.min(notifications.length - 1, 2) * 10}px`,
                        pb: isExpanded ? 0 : 2, // Space for badge
                    }}
                >
                    {/* Render notifications - newest first (index 0 = front card) */}
                    {notifications.map((notification, index) => (
                        <NotificationItem
                            key={notification.id}
                            notification={notification}
                            index={index}
                            totalCount={notifications.length}
                            isExpanded={isExpanded}
                            onClose={hideNotification}
                            onCancelJob={onCancelJob}
                        />
                    ))}

                    {/* Notification count badge - attached to bottom of front card */}
                    <NotificationBadge
                        count={notifications.length}
                        isExpanded={isExpanded}
                    />
                </Box>
            </Box>
        </Box>
    );
}
