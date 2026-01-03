/**
 * DrawerNotificationsBridge Component
 * 
 * Bridges various notification sources to the drawer notification context.
 * This component should be rendered inside the DrawerNotificationProvider.
 * 
 * Distributes notification badges to relevant navigation segments based on
 * the audit category and where its "View Details" action would navigate to.
 */

import * as React from 'react';
import { useDrawerNotifications } from '../contexts/DrawerNotificationContext';
import type { UserProfile } from '../types/profile';
import type { UserAuditEntry, UserAuditContext } from '../types/audit';
import {
    listenAllUserAuditEntries,
    buildUserAuditContextFromProfile
} from '../utils/auditUtils';
import {
    groupAuditsBySegment,
    BADGEABLE_SEGMENTS
} from '../utils/navigationMappingUtils';

interface DrawerNotificationsBridgeProps {
    /** The current user's profile */
    userProfile: UserProfile | null | undefined;
}

/**
 * Component that bridges notification sources to drawer badges.
 * Distributes notification counts to the appropriate navigation segments
 * based on where each audit's "View Details" action would navigate to.
 */
export function DrawerNotificationsBridge({ userProfile }: DrawerNotificationsBridgeProps) {
    const { setNotification, clearNotification, clearAllNotifications } = useDrawerNotifications();

    // Track which segments we've set to properly clean up
    const activeSegmentsRef = React.useRef<Set<string>>(new Set());

    // Build user audit context
    const userContext = React.useMemo<UserAuditContext | null>(() => {
        if (!userProfile?.uid) return null;
        return buildUserAuditContextFromProfile(userProfile);
    }, [userProfile]);

    // Listen to audit notifications and update drawer badges by segment
    React.useEffect(() => {
        if (!userProfile?.uid || !userContext) {
            // Clear all badges when user logs out or context is not available
            activeSegmentsRef.current.forEach(segment => {
                clearNotification(segment);
            });
            activeSegmentsRef.current.clear();
            return;
        }

        const unsubscribe = listenAllUserAuditEntries(
            userProfile.uid,
            {
                onData: (entries: UserAuditEntry[]) => {
                    // Group audits by their target navigation segment
                    const { counts } = groupAuditsBySegment(entries);

                    // Track which segments we're updating this cycle
                    const updatedSegments = new Set<string>();

                    // Update notifications for each segment with unread count
                    counts.forEach((count, segment) => {
                        if (count > 0) {
                            setNotification(segment, count);
                            updatedSegments.add(segment);
                        }
                    });

                    // Clear notifications for segments that no longer have unread items
                    activeSegmentsRef.current.forEach(segment => {
                        if (!updatedSegments.has(segment)) {
                            clearNotification(segment);
                        }
                    });

                    // Update active segments reference
                    activeSegmentsRef.current = updatedSegments;
                },
                onError: (error: Error) => {
                    console.error('Error listening to audit notifications for drawer:', error);
                    // Clear all on error
                    activeSegmentsRef.current.forEach(segment => {
                        clearNotification(segment);
                    });
                    activeSegmentsRef.current.clear();
                },
            },
            userContext
        );

        return () => {
            unsubscribe?.();
            // Clear all badges on cleanup
            activeSegmentsRef.current.forEach(segment => {
                clearNotification(segment);
            });
            activeSegmentsRef.current.clear();
        };
    }, [userProfile?.uid, userContext, setNotification, clearNotification, clearAllNotifications]);

    // This component doesn't render anything visible
    return null;
}

export default DrawerNotificationsBridge;
