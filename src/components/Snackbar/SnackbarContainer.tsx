import * as React from 'react';
import { Box, Paper, IconButton, Typography, Button, Collapse, Fade, Slide } from '@mui/material';
import {
    Close as CloseIcon,
    CheckCircle as SuccessIcon,
    Error as ErrorIcon,
    Warning as WarningIcon,
    Info as InfoIcon,
} from '@mui/icons-material';
import { useSnackbar, type Notification, type NotificationSeverity } from '../../contexts/SnackbarContext';

/**
 * Icon mapping for notification severity
 */
const SEVERITY_ICONS: Record<NotificationSeverity, React.ReactElement> = {
    success: <SuccessIcon />,
    error: <ErrorIcon />,
    warning: <WarningIcon />,
    info: <InfoIcon />,
};

/**
 * Color mapping for notification severity
 */
const SEVERITY_COLORS: Record<NotificationSeverity, string> = {
    success: '#4caf50',
    error: '#f44336',
    warning: '#ff9800',
    info: '#2196f3',
};

/**
 * Individual notification item component
 */
interface NotificationItemProps {
    notification: Notification;
    index: number;
    isExpanded: boolean;
    onClose: (id: string) => void;
}

function NotificationItem({ notification, index, isExpanded, onClose }: NotificationItemProps) {
    const { message, severity, action } = notification;
    const icon = SEVERITY_ICONS[severity];
    const color = SEVERITY_COLORS[severity];

    return (
        <Slide direction="up" in={true} timeout={300} style={{ transitionDelay: `${index * 50}ms` }}>
            <Paper
                elevation={3}
                sx={{
                    position: 'relative',
                    width: 400,
                    maxWidth: '90vw',
                    p: 2,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1.5,
                    backgroundColor: 'background.paper',
                    border: `1px solid ${color}`,
                    borderLeft: `4px solid ${color}`,
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    mb: isExpanded ? 1.5 : 0,
                    opacity: isExpanded ? 1 : index === 0 ? 1 : 0.3,
                    transform: isExpanded
                        ? 'translateY(0) scale(1)'
                        : `translateY(${index * -8}px) scale(${1 - index * 0.05})`,
                    transformOrigin: 'bottom center',
                    '&:hover': {
                        boxShadow: 6,
                    },
                }}
            >
                {/* Icon */}
                <Box
                    sx={{
                        color: color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mt: 0.5,
                    }}
                >
                    {icon}
                </Box>

                {/* Content */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                        variant="body2"
                        sx={{
                            color: 'text.primary',
                            wordBreak: 'break-word',
                            mb: action ? 1 : 0,
                        }}
                    >
                        {message}
                    </Typography>

                    {/* Action Button */}
                    {action && (
                        <Button
                            size="small"
                            onClick={action.onClick}
                            sx={{
                                color: color,
                                minWidth: 'auto',
                                p: 0,
                                textTransform: 'none',
                                fontWeight: 600,
                                '&:hover': {
                                    backgroundColor: 'transparent',
                                    textDecoration: 'underline',
                                },
                            }}
                        >
                            {action.label}
                        </Button>
                    )}
                </Box>

                {/* Close Button */}
                <IconButton
                    size="small"
                    onClick={() => onClose(notification.id)}
                    sx={{
                        color: 'text.secondary',
                        p: 0.5,
                        mt: 0.25,
                        '&:hover': {
                            backgroundColor: 'action.hover',
                        },
                    }}
                >
                    <CloseIcon fontSize="small" />
                </IconButton>
            </Paper>
        </Slide>
    );
}

/**
 * Badge showing notification count (when stacked)
 */
interface NotificationBadgeProps {
    count: number;
    isExpanded: boolean;
}

function NotificationBadge({ count, isExpanded }: NotificationBadgeProps) {
    if (count <= 1 || isExpanded) return null;

    return (
        <Fade in={!isExpanded}>
            <Paper
                elevation={4}
                sx={{
                    position: 'absolute',
                    bottom: -12,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: 'primary.main',
                    color: 'primary.contrastText',
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 10,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    zIndex: 10,
                    minWidth: 40,
                    textAlign: 'center',
                    pointerEvents: 'none',
                }}
            >
                {count}
            </Paper>
        </Fade>
    );
}

/**
 * Main snackbar container component that handles stacking and hover expansion
 */
export default function SnackbarContainer() {
    const { notifications, hideNotification } = useSnackbar();
    const [isExpanded, setIsExpanded] = React.useState(false);
    const [isHovering, setIsHovering] = React.useState(false);

    // Auto-collapse after a delay when mouse leaves
    React.useEffect(() => {
        if (!isHovering && isExpanded) {
            const timer = setTimeout(() => {
                setIsExpanded(false);
            }, 300);
            return () => clearTimeout(timer);
        } else if (isHovering) {
            setIsExpanded(true);
        }
    }, [isHovering, isExpanded]);

    if (notifications.length === 0) {
        return null;
    }

    return (
        <Box
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            sx={{
                position: 'fixed',
                bottom: 24,
                right: 24,
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                pointerEvents: 'auto',
                maxHeight: 'calc(100vh - 100px)',
                overflowY: isExpanded ? 'auto' : 'visible',
                overflowX: 'visible',
                pb: isExpanded ? 0 : 2,
                pr: 1,
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
                    flexDirection: 'column-reverse',
                    alignItems: 'flex-end',
                    width: '100%',
                }}
            >
                {/* Render notifications in reverse order (newest at bottom) */}
                {notifications.map((notification, index) => (
                    <NotificationItem
                        key={notification.id}
                        notification={notification}
                        index={notifications.length - 1 - index}
                        isExpanded={isExpanded}
                        onClose={hideNotification}
                    />
                ))}

                {/* Notification count badge */}
                <NotificationBadge count={notifications.length} isExpanded={isExpanded} />
            </Box>
        </Box>
    );
}
