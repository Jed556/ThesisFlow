import * as React from 'react';

/**
 * Notification severity types
 */
export type NotificationSeverity = 'success' | 'error' | 'warning' | 'info';

/**
 * Notification item interface
 */
export interface Notification {
    id: string;
    message: string;
    severity: NotificationSeverity;
    duration?: number;
    action?: {
        label: string;
        onClick: () => void;
    };
}

/**
 * Snackbar context interface
 */
interface SnackbarContextValue {
    notifications: Notification[];
    showNotification: (message: string, severity?: NotificationSeverity, duration?: number, action?: Notification['action']) => string;
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

    const showNotification = React.useCallback(
        (
            message: string,
            severity: NotificationSeverity = 'info',
            duration: number = DEFAULT_DURATION,
            action?: Notification['action']
        ): string => {
            const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

            const notification: Notification = {
                id,
                message,
                severity,
                duration,
                action,
            };

            setNotifications((prev) => [...prev, notification]);

            // Auto-dismiss after duration (if duration is not 0)
            if (duration > 0) {
                setTimeout(() => {
                    hideNotification(id);
                }, duration);
            }

            return id;
        },
        []
    );

    const hideNotification = React.useCallback((id: string) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, []);

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
