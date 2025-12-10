import * as React from 'react';

/**
 * Notification severity types
 */
export type NotificationSeverity = 'success' | 'error' | 'warning' | 'info';

/**
 * Action button configuration for notifications
 */
export interface NotificationAction {
    /** Button label */
    label: string;
    /** Click handler */
    onClick: () => void;
    /** Optional: navigate to a path instead of onClick */
    href?: string;
    /** Button variant */
    variant?: 'text' | 'outlined' | 'contained';
}

/**
 * Extended notification options for modern toast
 */
export interface NotificationOptions {
    /** Main title (bold, above divider) */
    title?: string;
    /** Description message (below divider) */
    message: string;
    /** Notification severity for coloring */
    severity?: NotificationSeverity;
    /** Auto-dismiss duration in ms (0 = no auto-dismiss) */
    duration?: number;
    /** Custom icon React node (overrides severity icon) */
    icon?: React.ReactNode;
    /** Whether to show divider between title and message */
    showDivider?: boolean;
    /** Action buttons (up to 2 recommended) */
    actions?: NotificationAction[];
    /** Whether to show the progress timer bar */
    showProgress?: boolean;
}

/**
 * Internal notification item interface
 */
export interface Notification {
    id: string;
    title?: string;
    message: string;
    severity: NotificationSeverity;
    duration: number;
    icon?: React.ReactNode;
    showDivider: boolean;
    actions?: NotificationAction[];
    showProgress: boolean;
    createdAt: number;
}

/**
 * Snackbar context interface
 */
interface SnackbarContextValue {
    notifications: Notification[];
    /**
     * Show a notification with modern options
     */
    showNotification: (
        messageOrOptions: string | NotificationOptions,
        severity?: NotificationSeverity,
        duration?: number,
        action?: NotificationAction
    ) => string;
    hideNotification: (id: string) => void;
    clearAll: () => void;
}

const SnackbarContext = React.createContext<SnackbarContextValue | undefined>(undefined);

/**
 * Default notification duration in milliseconds
 */
const DEFAULT_DURATION = 5000;

/**
 * Provider component for the snackbar notification system
 */
export function SnackbarProvider({ children }: { children: React.ReactNode }) {
    const [notifications, setNotifications] = React.useState<Notification[]>([]);

    const hideNotification = React.useCallback((id: string) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, []);

    const showNotification = React.useCallback(
        (
            messageOrOptions: string | NotificationOptions,
            severity: NotificationSeverity = 'info',
            duration: number = DEFAULT_DURATION,
            action?: NotificationAction
        ): string => {
            const id = `notification-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

            let notification: Notification;

            if (typeof messageOrOptions === 'string') {
                // Legacy API: simple string message
                notification = {
                    id,
                    message: messageOrOptions,
                    severity,
                    duration,
                    showDivider: false,
                    showProgress: duration > 0,
                    actions: action ? [action] : undefined,
                    createdAt: Date.now(),
                };
            } else {
                // Modern API: options object
                const opts = messageOrOptions;
                notification = {
                    id,
                    title: opts.title,
                    message: opts.message,
                    severity: opts.severity ?? 'info',
                    duration: opts.duration ?? DEFAULT_DURATION,
                    icon: opts.icon,
                    showDivider: opts.showDivider ?? Boolean(opts.title),
                    showProgress: opts.showProgress ?? (opts.duration ?? DEFAULT_DURATION) > 0,
                    actions: opts.actions,
                    createdAt: Date.now(),
                };
            }

            setNotifications((prev) => [...prev, notification]);

            // Auto-dismiss is now handled by NotificationItem component
            // to properly trigger exit animation before removal

            return id;
        },
        []
    );

    const clearAll = React.useCallback(() => {
        setNotifications([]);
    }, []);

    const value = React.useMemo(
        () => ({
            notifications,
            showNotification,
            hideNotification,
            clearAll,
        }),
        [notifications, showNotification, hideNotification, clearAll]
    );

    return <SnackbarContext.Provider value={value}>{children}</SnackbarContext.Provider>;
}

/**
 * Hook to access the snackbar notification system
 */
export function useSnackbar() {
    const context = React.useContext(SnackbarContext);
    if (!context) {
        throw new Error('useSnackbar must be used within a SnackbarProvider');
    }
    return context;
}
