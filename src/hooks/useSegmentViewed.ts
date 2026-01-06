/**
 * useSegmentViewed Hook
 * 
 * Hook to mark audit notifications as "page viewed" when a navigation segment/page is visited.
 * This automatically marks all unviewed audits for a specific segment as pageViewed
 * when the page is mounted or when the segment changes.
 * 
 * The `pageViewed` field is used for drawer badge counting - only audits where
 * pageViewed !== true are counted in the notification badges.
 */

import * as React from 'react';
import { useSession } from '@toolpad/core';
import type { Session } from '../types/session';
import type { UserProfile } from '../types/profile';
import type { UserAuditContext } from '../types/audit';
import { buildUserAuditContextFromProfile } from '../utils/auditUtils';
import { markUserAuditsBySegmentAsPageViewed } from '../utils/firebase/firestore/userAudits';
import { onUserProfile } from '../utils/firebase/firestore/user';

interface UseSegmentViewedOptions {
    /** The navigation segment to mark as viewed (e.g., 'group', 'thesis') */
    segment: string;
    /** Whether to mark audits as page-viewed (default: true) */
    enabled?: boolean;
    /** Delay in ms before marking as viewed (default: 1000ms to avoid marking on quick navigation) */
    delay?: number;
}

interface UseSegmentViewedResult {
    /** Number of audits marked as page-viewed */
    markedCount: number;
    /** Whether the marking operation is in progress */
    isMarking: boolean;
    /** Error if marking failed */
    error: Error | null;
    /** Manually trigger marking as page-viewed */
    markAsViewed: () => Promise<void>;
}

/**
 * Hook to automatically mark audit notifications as page-viewed when visiting a page segment.
 * This removes the notification badge count for that segment.
 * 
 * @example
 * // In a page component:
 * function GroupPage() {
 *     useSegmentViewed({ segment: 'group' });
 *     // ... rest of component
 * }
 * 
 * @example
 * // With manual control:
 * function ThesisPage() {
 *     const { markAsViewed, markedCount } = useSegmentViewed({
 *         segment: 'thesis',
 *         enabled: false // Don't auto-mark
 *     });
 *     
 *     // Mark when user clicks a button
 *     return <Button onClick={markAsViewed}>Clear Badge ({markedCount})</Button>;
 * }
 */
export function useSegmentViewed({
    segment,
    enabled = true,
    delay = 1000,
}: UseSegmentViewedOptions): UseSegmentViewedResult {
    const session = useSession<Session>();
    const userUid = session?.user?.uid ?? null;

    const [profile, setProfile] = React.useState<UserProfile | null>(null);
    const [markedCount, setMarkedCount] = React.useState(0);
    const [isMarking, setIsMarking] = React.useState(false);
    const [error, setError] = React.useState<Error | null>(null);

    // Track if we've already marked for this segment to prevent duplicate calls
    const hasMarkedRef = React.useRef<string | null>(null);

    // Load user profile
    React.useEffect(() => {
        if (!userUid) {
            setProfile(null);
            return () => { /* no-op */ };
        }

        const unsubscribe = onUserProfile(userUid, (profileData) => {
            setProfile(profileData);
        });

        return () => {
            unsubscribe();
        };
    }, [userUid]);

    // Build user audit context
    const userContext = React.useMemo<UserAuditContext | null>(() => {
        if (!profile?.uid) return null;
        return buildUserAuditContextFromProfile(profile);
    }, [profile]);

    // Function to mark audits as page-viewed
    const markAsViewed = React.useCallback(async () => {
        if (!userContext || isMarking) return;

        setIsMarking(true);
        setError(null);

        try {
            // Pass user role for role-specific segment mapping
            const count = await markUserAuditsBySegmentAsPageViewed(
                userContext,
                segment,
                profile?.role
            );
            setMarkedCount(prev => prev + count);
            hasMarkedRef.current = segment;
        } catch (err) {
            console.error(`Error marking audits as page-viewed for segment '${segment}':`, err);
            setError(err instanceof Error ? err : new Error('Failed to mark audits as page-viewed'));
        } finally {
            setIsMarking(false);
        }
    }, [userContext, segment, isMarking, profile?.role]);

    // Auto-mark when segment is viewed (with delay)
    React.useEffect(() => {
        // Skip if not enabled, already marked, or no context
        if (!enabled || !userContext || hasMarkedRef.current === segment) {
            return;
        }

        const timeoutId = setTimeout(() => {
            void markAsViewed();
        }, delay);

        return () => {
            clearTimeout(timeoutId);
        };
    }, [enabled, userContext, segment, delay, markAsViewed]);

    // Reset hasMarked when segment changes
    React.useEffect(() => {
        if (hasMarkedRef.current !== segment) {
            hasMarkedRef.current = null;
            setMarkedCount(0);
        }
    }, [segment]);

    return {
        markedCount,
        isMarking,
        error,
        markAsViewed,
    };
}

export default useSegmentViewed;
