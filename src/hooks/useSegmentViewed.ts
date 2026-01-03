/**
 * useSegmentViewed Hook
 * 
 * Hook to mark audit notifications as read when a navigation segment/page is viewed.
 * This automatically marks all unread audits for a specific segment as read
 * when the page is mounted or when the segment changes.
 */

import * as React from 'react';
import { useSession } from '@toolpad/core';
import type { Session } from '../types/session';
import type { UserProfile } from '../types/profile';
import type { UserAuditContext } from '../types/audit';
import { buildUserAuditContextFromProfile } from '../utils/auditUtils';
import { markUserAuditsBySegmentAsRead } from '../utils/firebase/firestore/userAudits';
import { onUserProfile } from '../utils/firebase/firestore/user';

interface UseSegmentViewedOptions {
    /** The navigation segment to mark as viewed (e.g., 'group', 'thesis') */
    segment: string;
    /** Whether to mark audits as read (default: true) */
    enabled?: boolean;
    /** Delay in ms before marking as read (default: 1000ms to avoid marking on quick navigation) */
    delay?: number;
}

interface UseSegmentViewedResult {
    /** Number of audits marked as read */
    markedCount: number;
    /** Whether the marking operation is in progress */
    isMarking: boolean;
    /** Error if marking failed */
    error: Error | null;
    /** Manually trigger marking as read */
    markAsRead: () => Promise<void>;
}

/**
 * Hook to automatically mark audit notifications as read when viewing a page segment.
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
 *     const { markAsRead, markedCount } = useSegmentViewed({
 *         segment: 'thesis',
 *         enabled: false // Don't auto-mark
 *     });
 *     
 *     // Mark when user clicks a button
 *     return <Button onClick={markAsRead}>Mark as Read ({markedCount})</Button>;
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

    // Function to mark audits as read
    const markAsRead = React.useCallback(async () => {
        if (!userContext || isMarking) return;

        setIsMarking(true);
        setError(null);

        try {
            const count = await markUserAuditsBySegmentAsRead(userContext, segment);
            setMarkedCount(prev => prev + count);
            hasMarkedRef.current = segment;
        } catch (err) {
            console.error(`Error marking audits as read for segment '${segment}':`, err);
            setError(err instanceof Error ? err : new Error('Failed to mark audits as read'));
        } finally {
            setIsMarking(false);
        }
    }, [userContext, segment, isMarking]);

    // Auto-mark when segment is viewed (with delay)
    React.useEffect(() => {
        // Skip if not enabled, already marked, or no context
        if (!enabled || !userContext || hasMarkedRef.current === segment) {
            return;
        }

        const timeoutId = setTimeout(() => {
            void markAsRead();
        }, delay);

        return () => {
            clearTimeout(timeoutId);
        };
    }, [enabled, userContext, segment, delay, markAsRead]);

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
        markAsRead,
    };
}

export default useSegmentViewed;
