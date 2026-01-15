import * as React from 'react';
import { Badge } from '@mui/material';

/**
 * Notification badge configuration for drawer items
 */
export interface DrawerNotification {
    /** Segment/path the notification applies to */
    segment: string;
    /** Number of unread notifications */
    count: number;
    /** Badge color (defaults to 'error' for red) */
    color?: 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' | 'default';
    /** Maximum count to display before showing "max+" */
    max?: number;
}

/**
 * Context value for drawer notifications
 */
export interface DrawerNotificationContextValue {
    /** Map of segment to notification count */
    notifications: Map<string, DrawerNotification>;
    /** Set notification for a specific segment */
    setNotification: (segment: string, count: number, options?: Partial<DrawerNotification>) => void;
    /** Clear notification for a specific segment */
    clearNotification: (segment: string) => void;
    /** Clear all notifications */
    clearAllNotifications: () => void;
    /** Get notification count for a segment */
    getNotificationCount: (segment: string) => number;
    /** Check if a segment has notifications */
    hasNotification: (segment: string) => boolean;
    /** Get action element for navigation item */
    getNavigationAction: (segment: string) => React.ReactNode | undefined;
}

const DrawerNotificationContext = React.createContext<DrawerNotificationContextValue | null>(null);

/**
 * Provider component for drawer notifications
 */
export function DrawerNotificationProvider({ children }: { children: React.ReactNode }) {
    const [notifications, setNotifications] = React.useState<Map<string, DrawerNotification>>(new Map());

    const setNotification = React.useCallback((
        segment: string,
        count: number,
        options?: Partial<DrawerNotification>
    ) => {
        setNotifications(prev => {
            const next = new Map(prev);
            if (count <= 0) {
                next.delete(segment);
            } else {
                next.set(segment, {
                    segment,
                    count,
                    color: options?.color ?? 'error',
                    max: options?.max ?? 99,
                });
            }
            return next;
        });
    }, []);

    const clearNotification = React.useCallback((segment: string) => {
        setNotifications(prev => {
            const next = new Map(prev);
            next.delete(segment);
            return next;
        });
    }, []);

    const clearAllNotifications = React.useCallback(() => {
        setNotifications(new Map());
    }, []);

    const getNotificationCount = React.useCallback((segment: string): number => {
        return notifications.get(segment)?.count ?? 0;
    }, [notifications]);

    const hasNotification = React.useCallback((segment: string): boolean => {
        const notification = notifications.get(segment);
        return notification !== undefined && notification.count > 0;
    }, [notifications]);

    const getNavigationAction = React.useCallback((segment: string): React.ReactNode | undefined => {
        const notification = notifications.get(segment);
        if (!notification || notification.count <= 0) {
            return undefined;
        }

        return (
            <Badge
                badgeContent={notification.count}
                color={notification.color ?? 'error'}
                max={notification.max ?? 99}
                sx={{
                    '& .MuiBadge-badge': {
                        fontSize: '0.65rem',
                        height: 16,
                        minWidth: 16,
                        padding: '0 4px',
                    },
                }}
            />
        );
    }, [notifications]);

    const value = React.useMemo<DrawerNotificationContextValue>(() => ({
        notifications,
        setNotification,
        clearNotification,
        clearAllNotifications,
        getNotificationCount,
        hasNotification,
        getNavigationAction,
    }), [
        notifications,
        setNotification,
        clearNotification,
        clearAllNotifications,
        getNotificationCount,
        hasNotification,
        getNavigationAction,
    ]);

    return (
        <DrawerNotificationContext.Provider value={value}>
            {children}
        </DrawerNotificationContext.Provider>
    );
}

/**
 * Hook to access drawer notifications context
 * @throws Error if used outside of DrawerNotificationProvider
 */
export function useDrawerNotifications(): DrawerNotificationContextValue {
    const context = React.useContext(DrawerNotificationContext);
    if (!context) {
        throw new Error('useDrawerNotifications must be used within a DrawerNotificationProvider');
    }
    return context;
}

/**
 * Hook to get notification action for a specific segment
 * Returns undefined if no notifications or used outside provider (graceful fallback)
 */
export function useDrawerNotificationAction(segment: string): React.ReactNode | undefined {
    const context = React.useContext(DrawerNotificationContext);
    if (!context) {
        return undefined;
    }
    return context.getNavigationAction(segment);
}

export default DrawerNotificationContext;
