/**
 * AuditNotifications Component
 * 
 * Global component that listens for user audit entries and shows snackbar
 * notifications in real-time. This component should be mounted at the app level.
 * 
 * It uses the useAuditNotifications hook to listen for personal notifications
 * and automatically displays them as snackbars when they arrive.
 */

import React from 'react';
import { useSession } from '@toolpad/core';
import { useAuditNotifications } from '../hooks/useAuditNotifications';
import { findUserById } from '../utils/firebase/firestore/user';
import type { Session } from '../types/session';
import type { UserProfile } from '../types/profile';

/**
 * Props for AuditNotifications component
 */
export interface AuditNotificationsProps {
    /** Whether to show snackbar notifications (default: true) */
    showSnackbars?: boolean;
    /** Maximum number of notifications to show at once (default: 3) */
    maxNotifications?: number;
    /** Duration for snackbar notifications in ms (default: 5000) */
    snackbarDuration?: number;
}

/**
 * Component that listens for audit notifications and shows snackbars
 * 
 * This component fetches the user profile on mount and uses it to listen
 * for user audit entries. When new unread entries with showSnackbar=true
 * arrive, they are displayed as snackbar notifications.
 * 
 * @example
 * ```tsx
 * // In App.tsx or Layout.tsx
 * <AuditNotifications />
 * ```
 */
export function AuditNotifications({
    showSnackbars = true,
    maxNotifications = 3,
    snackbarDuration = 5000,
}: AuditNotificationsProps) {
    const session = useSession<Session>();
    const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);
    const [_profileLoading, setProfileLoading] = React.useState(true);

    // Fetch user profile when session changes
    React.useEffect(() => {
        let active = true;

        async function loadProfile() {
            const uid = session?.user?.uid;
            if (!uid) {
                setUserProfile(null);
                setProfileLoading(false);
                return;
            }

            try {
                const profile = await findUserById(uid);
                if (active) {
                    setUserProfile(profile);
                }
            } catch (error) {
                console.error('Failed to load user profile for notifications:', error);
            } finally {
                if (active) {
                    setProfileLoading(false);
                }
            }
        }

        loadProfile();

        return () => {
            active = false;
        };
    }, [session?.user?.uid]);

    // Use the audit notifications hook to listen for notifications
    // The hook handles all the snackbar display logic internally
    useAuditNotifications(userProfile, {
        showSnackbars,
        maxNotifications,
        snackbarDuration,
    });

    // This component doesn't render anything visible
    // It only provides the notification listening functionality
    return null;
}

export default AuditNotifications;
