/**
 * CalendarDeadlineNotifications Component
 * 
 * A component that monitors calendar events and shows deadline notifications.
 * Should be placed at the app level (after authentication) to provide notifications.
 */

import * as React from 'react';
import { useSession } from '@toolpad/core';
import { findUserById } from '../utils/firebase/firestore/user';
import { useCalendarDeadlineNotifications } from '../hooks';
import type { Session } from '../types/session';
import type { UserProfile } from '../types/profile';

/**
 * CalendarDeadlineNotifications - renders nothing, just manages notifications
 */
export default function CalendarDeadlineNotifications() {
    const session = useSession<Session>();
    const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);

    // Fetch user profile when session changes
    React.useEffect(() => {
        if (!session?.user?.uid) {
            setUserProfile(null);
            return;
        }

        let mounted = true;

        const fetchProfile = async () => {
            try {
                const profile = await findUserById(session.user!.uid);
                if (mounted && profile) {
                    setUserProfile(profile);
                }
            } catch (error) {
                console.error('Failed to fetch user profile for deadline notifications:', error);
            }
        };

        fetchProfile();

        return () => {
            mounted = false;
        };
    }, [session?.user?.uid]);

    // Use the deadline notifications hook
    // Notification timings are read from userProfile.preferences.calendarNotifications
    useCalendarDeadlineNotifications(userProfile, {
        enabled: !!userProfile,
    });

    // This component doesn't render anything - it just manages notifications
    return null;
}
