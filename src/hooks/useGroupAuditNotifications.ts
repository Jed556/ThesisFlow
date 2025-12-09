/**
 * Hook for listening to group audit entries and showing notifications
 * 
 * This hook provides real-time notifications for group audit entries.
 * When a new audit is created for a group, group members will see a snackbar notification.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { AuditEntry, AuditCategory, AuditAction, AuditQueryOptions } from '../types/audit';
import type { ThesisGroup } from '../types/group';
import {
    listenAuditEntries, buildAuditContextFromGroup
} from '../utils/auditUtils';
import { getNotificationSeverity, buildAuditNavigationPath } from '../utils/auditNotificationUtils';
import { useSnackbar } from '../contexts/SnackbarContext';

/**
 * Options for the useGroupAuditNotifications hook
 */
export interface UseGroupAuditNotificationsOptions {
    /** Groups to listen to */
    groups: ThesisGroup[];
    /** Current user's ID (to exclude own actions from notifications) */
    currentUserId?: string;
    /** Filter by specific categories */
    categories?: AuditCategory[];
    /** Filter by specific actions */
    actions?: AuditAction[];
    /** Maximum number of entries to keep in memory per group */
    maxEntries?: number;
    /** Whether to show snackbar notifications */
    showSnackbar?: boolean;
    /** Notification duration in milliseconds */
    notificationDuration?: number;
    /** Whether the hook is enabled */
    enabled?: boolean;
}

/**
 * Return value from the useGroupAuditNotifications hook
 */
export interface UseGroupAuditNotificationsReturn {
    /** All audit entries from all groups */
    entries: AuditEntry[];
    /** Map of group ID to its audit entries */
    entriesByGroup: Map<string, AuditEntry[]>;
    /** Loading state */
    loading: boolean;
    /** Error if any */
    error: Error | null;
    /** Number of unread entries */
    unreadCount: number;
    /** Mark a specific entry as read */
    markAsRead: (entryId: string) => void;
    /** Mark all entries as read */
    markAllAsRead: () => void;
    /** Get entries for a specific group */
    getEntriesForGroup: (groupId: string) => AuditEntry[];
}

/**
 * Hook to listen to group audit entries and show snackbar notifications
 * 
 * @example
 * ```tsx
 * const { entries, unreadCount, markAllAsRead } = useGroupAuditNotifications({
 *     groups: userGroups,
 *     currentUserId: user.uid,
 *     showSnackbar: true,
 * });
 * ```
 */
export function useGroupAuditNotifications(
    options: UseGroupAuditNotificationsOptions
): UseGroupAuditNotificationsReturn {
    const {
        groups,
        currentUserId,
        categories,
        actions,
        maxEntries = 50,
        showSnackbar = true,
        notificationDuration = 5000,
        enabled = true,
    } = options;

    const { showNotification } = useSnackbar();

    // State
    const [entriesByGroup, setEntriesByGroup] = useState<Map<string, AuditEntry[]>>(new Map());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const [readEntryIds, setReadEntryIds] = useState<Set<string>>(new Set());

    // Track shown notifications to avoid duplicates
    const shownNotificationIds = useRef<Set<string>>(new Set());

    // Track initial load per group to avoid notification storm
    const initialLoadDone = useRef<Set<string>>(new Set());

    // Memoize group IDs to prevent unnecessary re-subscriptions
    const groupIds = useMemo(
        () => groups.map((g) => g.id).sort().join(','),
        [groups]
    );

    // Subscribe to audit entries for each group
    useEffect(() => {
        if (!enabled || groups.length === 0) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        const unsubscribes: (() => void)[] = [];

        groups.forEach((group) => {
            if (!group.id || !group.year || !group.department || !group.course) {
                return;
            }

            try {
                const ctx = buildAuditContextFromGroup(group);

                const queryOptions: AuditQueryOptions = {
                    orderDirection: 'desc',
                    limit: maxEntries,
                };

                // Note: Firestore doesn't support OR queries, so we filter categories client-side
                if (actions && actions.length === 1) {
                    queryOptions.action = actions[0];
                }

                const unsubscribe = listenAuditEntries(
                    ctx,
                    {
                        onData: (entries: AuditEntry[]) => {
                            // Filter by categories if specified
                            let filteredEntries = entries;
                            if (categories && categories.length > 0) {
                                filteredEntries = entries.filter(
                                    (e: AuditEntry) => categories.includes(e.category)
                                );
                            }
                            if (actions && actions.length > 1) {
                                filteredEntries = filteredEntries.filter(
                                    (e: AuditEntry) => actions.includes(e.action)
                                );
                            }

                            // Update entries for this group
                            setEntriesByGroup((prev) => {
                                const next = new Map(prev);
                                next.set(group.id, filteredEntries);
                                return next;
                            });

                            // Show notifications for new entries
                            if (showSnackbar && initialLoadDone.current.has(group.id)) {
                                filteredEntries.forEach((entry: AuditEntry) => {
                                    // Skip if already shown
                                    if (shownNotificationIds.current.has(entry.id)) return;

                                    // Skip if entry doesn't want snackbar
                                    if (!entry.showSnackbar) return;

                                    // Skip if entry is from current user
                                    if (currentUserId && entry.userId === currentUserId) return;

                                    // Skip if entry is older than 10 seconds (to avoid old entries)
                                    const entryTime = new Date(entry.timestamp).getTime();
                                    const now = Date.now();
                                    if (now - entryTime > 10000) return;

                                    // Mark as shown
                                    shownNotificationIds.current.add(entry.id);

                                    // Show notification with modern toast
                                    const severity = getNotificationSeverity(entry.action);
                                    const navPath = buildAuditNavigationPath(
                                        entry.category,
                                        entry.action,
                                        entry.details
                                    );

                                    showNotification({
                                        title: entry.name,
                                        message: entry.description || 'New activity in your group.',
                                        severity,
                                        duration: notificationDuration,
                                        showDivider: true,
                                        actions: navPath ? [{
                                            label: 'View Details',
                                            onClick: () => {
                                                // Navigation will be handled by the action button
                                            },
                                            href: navPath,
                                            variant: 'outlined',
                                        }] : undefined,
                                    });
                                });
                            }

                            // Mark initial load as done for this group
                            if (!initialLoadDone.current.has(group.id)) {
                                initialLoadDone.current.add(group.id);
                            }
                        },
                        onError: (err: Error) => {
                            console.error(`Error listening to audits for group ${group.id}:`, err);
                            setError(err);
                        },
                    },
                    queryOptions
                );

                unsubscribes.push(unsubscribe);
            } catch (err) {
                console.error(`Failed to set up listener for group ${group.id}:`, err);
            }
        });

        setLoading(false);

        return () => {
            unsubscribes.forEach((unsub) => unsub());
        };
    }, [
        enabled, groupIds, currentUserId, showSnackbar,
        maxEntries, notificationDuration, showNotification,
        // Note: categories and actions are not in deps to avoid re-subscriptions
        // They are filtered client-side
    ]);

    // Combine all entries from all groups
    const entries = useMemo(() => {
        const allEntries: AuditEntry[] = [];
        entriesByGroup.forEach((groupEntries) => {
            allEntries.push(...groupEntries);
        });
        // Sort by timestamp descending
        return allEntries.sort((a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
    }, [entriesByGroup]);

    // Count unread entries
    const unreadCount = useMemo(() => {
        return entries.filter((e) => !readEntryIds.has(e.id) && !e.read).length;
    }, [entries, readEntryIds]);

    // Mark a specific entry as read (client-side only)
    const markAsRead = useCallback((entryId: string) => {
        setReadEntryIds((prev) => {
            const next = new Set(prev);
            next.add(entryId);
            return next;
        });
    }, []);

    // Mark all entries as read (client-side only)
    const markAllAsRead = useCallback(() => {
        setReadEntryIds((prev) => {
            const next = new Set(prev);
            entries.forEach((e) => next.add(e.id));
            return next;
        });
    }, [entries]);

    // Get entries for a specific group
    const getEntriesForGroup = useCallback(
        (groupId: string): AuditEntry[] => {
            return entriesByGroup.get(groupId) || [];
        },
        [entriesByGroup]
    );

    return {
        entries,
        entriesByGroup,
        loading,
        error,
        unreadCount,
        markAsRead,
        markAllAsRead,
        getEntriesForGroup,
    };
}

export default useGroupAuditNotifications;
