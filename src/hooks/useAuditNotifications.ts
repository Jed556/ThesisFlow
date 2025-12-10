/**
 * useAuditNotifications Hook
 * 
 * Listens to user audit entries and displays snackbar notifications for new entries.
 * This hook should be used at the app level to provide real-time notifications.
 */

import * as React from 'react';
import type { UserAuditEntry, UserAuditContext } from '../types/audit';
import type { UserProfile } from '../types/profile';
import { useSnackbar } from '../contexts/SnackbarContext';
import {
    listenAllUserAuditEntries,
    markUserAuditAsRead,
    buildUserAuditContextFromProfile
} from '../utils/auditUtils';

/**
 * Options for the useAuditNotifications hook
 */
export interface UseAuditNotificationsOptions {
    /** Whether to show snackbar notifications */
    showSnackbars?: boolean;
    /** Duration for snackbar notifications (ms) */
    snackbarDuration?: number;
    /** Maximum number of notifications to show at once */
    maxNotifications?: number;
    /** Callback when new notifications arrive */
    onNewNotifications?: (notifications: UserAuditEntry[]) => void;
}

/**
 * Return value of the useAuditNotifications hook
 */
export interface UseAuditNotificationsResult {
    /** All user audit entries */
    notifications: UserAuditEntry[];
    /** Unread notification count */
    unreadCount: number;
    /** Whether notifications are loading */
    loading: boolean;
    /** Error if any */
    error: Error | null;
    /** Mark a notification as read */
    markAsRead: (auditId: string) => Promise<void>;
    /** Mark all notifications as read */
    markAllAsRead: () => Promise<void>;
    /** Refresh notifications */
    refresh: () => void;
}

/**
 * Hook to listen to user audit notifications
 * @param userProfile - The current user's profile
 * @param options - Hook options
 * @returns Notification state and handlers
 */
export function useAuditNotifications(
    userProfile: UserProfile | null | undefined,
    options: UseAuditNotificationsOptions = {}
): UseAuditNotificationsResult {
    const {
        showSnackbars = true,
        snackbarDuration = 5000,
        maxNotifications = 3,
        onNewNotifications,
    } = options;

    const { showNotification } = useSnackbar();
    const [notifications, setNotifications] = React.useState<UserAuditEntry[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<Error | null>(null);

    // Track shown notifications to avoid duplicates
    const shownNotificationsRef = React.useRef<Set<string>>(new Set());
    const previousNotificationsRef = React.useRef<UserAuditEntry[]>([]);

    // Build context from user profile
    const userContext = React.useMemo<UserAuditContext | null>(() => {
        if (!userProfile?.uid) return null;
        return buildUserAuditContextFromProfile(userProfile);
    }, [userProfile]);

    // Listen to notifications
    React.useEffect(() => {
        if (!userProfile?.uid) {
            setNotifications([]);
            setLoading(false);
            return () => { /* no-op */ };
        }

        setLoading(true);
        setError(null);

        const unsubscribe = listenAllUserAuditEntries(
            userProfile.uid,
            {
                onData: (audits) => {
                    setNotifications(audits);
                    setLoading(false);

                    // Find new notifications that haven't been shown
                    const previousIds = new Set(
                        previousNotificationsRef.current.map((n) => n.id)
                    );
                    const newAudits = audits.filter(
                        (a) =>
                            !previousIds.has(a.id) &&
                            !shownNotificationsRef.current.has(a.id) &&
                            a.showSnackbar &&
                            !a.read
                    );

                    // Show snackbar notifications for new entries
                    if (showSnackbars && newAudits.length > 0) {
                        const toShow = newAudits.slice(0, maxNotifications);
                        toShow.forEach((audit) => {
                            shownNotificationsRef.current.add(audit.id);
                            showNotification(
                                audit.description || audit.name,
                                getSnackbarSeverity(audit),
                                snackbarDuration
                            );
                        });

                        // If there are more notifications, show a summary
                        if (newAudits.length > maxNotifications) {
                            const remaining = newAudits.length - maxNotifications;
                            showNotification(
                                `And ${remaining} more notification${remaining > 1 ? 's' : ''}`,
                                'info',
                                snackbarDuration
                            );
                        }
                    }

                    // Call callback
                    if (onNewNotifications && newAudits.length > 0) {
                        onNewNotifications(newAudits);
                    }

                    // Update previous notifications reference
                    previousNotificationsRef.current = audits;
                },
                onError: (err) => {
                    console.error('Failed to load notifications:', err);
                    setError(err);
                    setLoading(false);
                },
            },
            { orderDirection: 'desc', limit: 100 }
        );

        return () => {
            unsubscribe();
        };
    }, [
        userProfile?.uid, showSnackbars, snackbarDuration,
        maxNotifications, onNewNotifications, showNotification
    ]);

    // Unread count
    const unreadCount = React.useMemo(
        () => notifications.filter((n) => !n.read).length,
        [notifications]
    );

    // Mark single notification as read
    const markAsRead = React.useCallback(
        async (auditId: string) => {
            if (!userContext) return;
            try {
                await markUserAuditAsRead(userContext, auditId);
            } catch (err) {
                console.error('Failed to mark notification as read:', err);
            }
        },
        [userContext]
    );

    // Mark all notifications as read
    const markAllAsRead = React.useCallback(async () => {
        if (!userContext) return;
        const unreadIds = notifications
            .filter((n) => !n.read)
            .map((n) => n.id);

        if (unreadIds.length === 0) return;

        try {
            // Import dynamically to avoid circular dependencies
            const { markUserAuditsAsRead } = await import(
                '../utils/firebase/firestore/userAudits'
            );
            await markUserAuditsAsRead(userContext, unreadIds);
        } catch (err) {
            console.error('Failed to mark all notifications as read:', err);
        }
    }, [userContext, notifications]);

    // Refresh (re-trigger listener)
    const refresh = React.useCallback(() => {
        // The listener auto-updates, but we can reset state
        setLoading(true);
    }, []);

    return {
        notifications,
        unreadCount,
        loading,
        error,
        markAsRead,
        markAllAsRead,
        refresh,
    };
}

/**
 * Get snackbar severity based on audit entry
 */
function getSnackbarSeverity(
    audit: UserAuditEntry
): 'success' | 'error' | 'warning' | 'info' {
    // Determine severity based on action type
    const successActions = [
        'group_approved',
        'submission_approved',
        'proposal_approved',
        'terminal_approved',
        'invite_accepted',
        'join_request_accepted',
        'expert_request_accepted',
    ];

    const errorActions = [
        'group_rejected',
        'submission_rejected',
        'proposal_rejected',
        'terminal_rejected',
        'invite_rejected',
        'join_request_rejected',
        'expert_request_rejected',
        'member_removed',
    ];

    const warningActions = [
        'submission_revision_requested',
        'group_status_changed',
        'thesis_stage_changed',
    ];

    if (successActions.includes(audit.action)) {
        return 'success';
    }
    if (errorActions.includes(audit.action)) {
        return 'error';
    }
    if (warningActions.includes(audit.action)) {
        return 'warning';
    }

    return 'info';
}

export default useAuditNotifications;
