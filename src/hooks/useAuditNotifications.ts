/**
 * useAuditNotifications Hook
 * 
 * Listens to user audit entries and displays snackbar notifications for new entries.
 * This hook should be used at the app level to provide real-time notifications.
 * 
 * Uses snackbarShown field in Firestore to persist which notifications have been shown,
 * preventing duplicate notifications on page reload or re-login.
 */

import * as React from 'react';
import type { UserAuditEntry, UserAuditContext } from '../types/audit';
import type { UserProfile } from '../types/profile';
import { useSnackbar } from '../contexts/SnackbarContext';
import {
    listenAllUserAuditEntries,
    markUserAuditAsRead,
    markUserAuditSnackbarsShown,
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

    // Track notifications currently being shown to avoid duplicates within the same session
    const pendingShowRef = React.useRef<Set<string>>(new Set());

    // Build context from user profile
    const userContext = React.useMemo<UserAuditContext | null>(() => {
        if (!userProfile?.uid) return null;
        return buildUserAuditContextFromProfile(userProfile);
    }, [userProfile]);

    // Listen to notifications
    React.useEffect(() => {
        if (!userProfile?.uid || !userContext) {
            setNotifications([]);
            setLoading(false);
            return () => { /* no-op */ };
        }

        setLoading(true);
        setError(null);

        const unsubscribe = listenAllUserAuditEntries(
            userProfile.uid,
            {
                onData: async (audits) => {
                    setNotifications(audits);
                    setLoading(false);

                    // Find notifications that should show snackbar but haven't been shown yet
                    // Uses snackbarShown field from Firestore to persist across reloads/logins
                    const toShowSnackbar = audits.filter(
                        (a) =>
                            a.showSnackbar &&
                            !a.snackbarShown &&
                            !pendingShowRef.current.has(a.id)
                    );

                    // Show snackbar notifications for new entries
                    if (showSnackbars && toShowSnackbar.length > 0) {
                        const toShow = toShowSnackbar.slice(0, maxNotifications);
                        const shownIds: string[] = [];

                        toShow.forEach((audit) => {
                            // Mark as pending to avoid showing twice in same session
                            pendingShowRef.current.add(audit.id);
                            shownIds.push(audit.id);
                            showNotification(
                                audit.description || audit.name,
                                getSnackbarSeverity(audit),
                                snackbarDuration
                            );
                        });

                        // If there are more notifications, show a summary
                        if (toShowSnackbar.length > maxNotifications) {
                            const remaining = toShowSnackbar.length - maxNotifications;
                            showNotification(
                                `And ${remaining} more notification${remaining > 1 ? 's' : ''}`,
                                'info',
                                snackbarDuration
                            );
                            // Mark all remaining as shown too
                            toShowSnackbar.slice(maxNotifications).forEach((a) => {
                                pendingShowRef.current.add(a.id);
                                shownIds.push(a.id);
                            });
                        }

                        // Persist snackbar shown status to Firestore
                        // This prevents showing the same notifications on reload/login
                        if (shownIds.length > 0 && userContext) {
                            try {
                                await markUserAuditSnackbarsShown(userContext, shownIds);
                            } catch (err) {
                                console.error('Failed to mark snackbars as shown:', err);
                            }
                        }
                    }

                    // Call callback for new unshown notifications
                    if (onNewNotifications && toShowSnackbar.length > 0) {
                        onNewNotifications(toShowSnackbar);
                    }
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
