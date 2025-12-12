import * as React from 'react';
import { useSession } from '@toolpad/core';
import { Navigate, useLocation } from 'react-router';
import ChangePasswordLayout from '../layouts/ChangePasswordLayout';
import type { Session } from '../types/session';
import type { NavigationItem } from '../types/navigation';

export const metadata: NavigationItem = {
    title: 'Change Password',
    segment: 'change-password',
    hidden: true,
    requiresLayout: false,
};

/**
 * Change Password page for first-time login password change
 * Requires user to be authenticated with mustChangePassword flag
 */
export default function ChangePassword() {
    const session = useSession<Session>();
    const location = useLocation();

    // Get the temporary password from location state if provided
    const locationState = location.state as {
        temporaryPassword?: string;
        isFirstLogin?: boolean;
    } | null;

    // If no user session, redirect to sign in
    if (!session?.user) {
        return <Navigate to="/sign-in" replace />;
    }

    return (
        <ChangePasswordLayout
            uid={session.user.uid}
            email={session.user.email ?? ''}
            title={locationState?.isFirstLogin ? 'Set Your Password' : 'Change Password'}
            description={
                locationState?.isFirstLogin
                    ? 'Welcome! For security, please set a new password for your account.'
                    : 'Please enter your current password and choose a new one.'
            }
            isFirstLogin={locationState?.isFirstLogin}
            temporaryPassword={locationState?.temporaryPassword}
            redirectTo="/"
        />
    );
}
