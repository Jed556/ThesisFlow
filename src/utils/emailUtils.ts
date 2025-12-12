/**
 * Email Notification Utilities
 * 
 * Provides functions for sending email notifications via the /api/email endpoint.
 * Uses the notification template for consistent styling across all emails.
 */

import type { AuditAction } from '../types/audit';
import type { UserProfile, UserName } from '../types/profile';
import { isDevelopmentEnvironment } from './devUtils';

// ============================================================================
// Types
// ============================================================================

/**
 * Email notification severity for styling
 */
export type EmailNotificationSeverity = 'success' | 'error' | 'warning' | 'info';

/**
 * Options for sending a single email notification
 */
export interface SendEmailOptions {
    /** Recipient email address */
    to: string;
    /** Notification title */
    title: string;
    /** Notification message/description */
    message: string;
    /** Notification type for styling */
    notificationType?: EmailNotificationSeverity;
    /** Optional recipient name for personalization */
    recipientName?: string;
    /** Optional action button text */
    actionText?: string;
    /** Optional action button URL */
    actionUrl?: string;
    /** Optional header color (hex) - uses recipient's profile color */
    headerColor?: string;
}

/**
 * Result of email sending operation
 */
export interface SendEmailResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Format a UserName object into a display string
 * @param name - The UserName object to format
 * @returns Formatted full name string
 */
export function formatUserName(name: UserName | undefined): string {
    if (!name) return '';
    const parts = [name.prefix, name.first, name.middle, name.last, name.suffix]
        .filter(Boolean);
    return parts.join(' ').trim();
}

/**
 * Get display name from a UserProfile
 * Prefers full name, falls back to email
 * @param profile - User profile to get display name from
 * @returns Display name string
 */
export function getDisplayName(profile: UserProfile): string {
    const fullName = formatUserName(profile.name);
    return fullName || profile.email;
}

/**
 * Determine email notification severity based on audit action
 * @param action - Audit action type
 * @returns Appropriate notification severity
 */
export function getEmailSeverityFromAction(action: AuditAction): EmailNotificationSeverity {
    const successActions: AuditAction[] = [
        'group_approved',
        'submission_approved',
        'proposal_approved',
        'terminal_approved',
        'invite_accepted',
        'join_request_accepted',
        'expert_request_accepted',
        'chapter_status_changed',
    ];

    const errorActions: AuditAction[] = [
        'group_rejected',
        'submission_rejected',
        'proposal_rejected',
        'terminal_rejected',
        'invite_rejected',
        'join_request_rejected',
        'expert_request_rejected',
        'member_removed',
    ];

    const warningActions: AuditAction[] = [
        'submission_revision_requested',
        'group_status_changed',
        'thesis_stage_changed',
    ];

    if (successActions.includes(action)) return 'success';
    if (errorActions.includes(action)) return 'error';
    if (warningActions.includes(action)) return 'warning';
    return 'info';
}

// ============================================================================
// Email Sending Functions
// ============================================================================

/**
 * Send a single email notification
 * @param options - Email sending options
 * @returns Promise that resolves to send result
 */
export async function sendEmailNotification(options: SendEmailOptions): Promise<SendEmailResult> {
    // Skip email sending in development mode
    // if (isDevelopmentEnvironment()) {
    //     console.info('[Email] Skipping email in dev mode:', options.title, '→', options.to);
    //     return {
    //         success: true,
    //         messageId: 'dev-mode-skipped',
    //     };
    // }

    const {
        to,
        title,
        message,
        notificationType = 'info',
        recipientName,
        actionText,
        actionUrl,
        headerColor,
    } = options;

    try {
        const response = await fetch('/api/email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                to,
                template: 'notification',
                data: {
                    recipientName,
                    title,
                    message,
                    notificationType,
                    actionText: actionText || (actionUrl ? 'View Details' : undefined),
                    actionUrl,
                    headerColor,
                },
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.warn(`Failed to send email to ${to}: ${response.statusText}`, errorText);
            return {
                success: false,
                error: response.statusText,
            };
        }

        const result = await response.json();
        return {
            success: result.success ?? true,
            messageId: result.messageId,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error sending email to ${to}:`, error);
        return {
            success: false,
            error: errorMessage,
        };
    }
}

/**
 * Send email notification using audit action to determine severity
 * @param email - Recipient email address
 * @param title - Notification title
 * @param message - Notification message
 * @param action - Audit action for determining severity
 * @param actionUrl - Optional action URL
 * @param actionText - Optional action button text
 * @param recipientName - Optional recipient name
 * @param headerColor - Optional header color (hex)
 * @returns Promise that resolves to true if email was sent successfully
 */
export async function sendAuditEmailNotification(
    email: string,
    title: string,
    message: string,
    action: AuditAction,
    actionUrl?: string,
    actionText?: string,
    recipientName?: string,
    headerColor?: string
): Promise<boolean> {
    const result = await sendEmailNotification({
        to: email,
        title,
        message,
        notificationType: getEmailSeverityFromAction(action),
        recipientName,
        actionText,
        actionUrl,
        headerColor,
    });
    return result.success;
}

/**
 * Send email notifications to multiple users in parallel
 * Uses each recipient's themeColor for personalized email headers
 * @param profiles - User profiles to send emails to
 * @param title - Notification title
 * @param message - Notification message
 * @param action - Audit action for determining severity
 * @param actionUrl - Optional action URL for the email
 * @param actionText - Optional action button text
 * @returns Number of emails sent successfully
 */
export async function sendBulkAuditEmails(
    profiles: UserProfile[],
    title: string,
    message: string,
    action: AuditAction,
    actionUrl?: string,
    actionText?: string
): Promise<number> {
    // Filter to users with emails only
    const validProfiles = profiles.filter(profile => profile.email);

    if (validProfiles.length === 0) {
        return 0;
    }

    const emailPromises = validProfiles.map(profile =>
        sendAuditEmailNotification(
            profile.email,
            title,
            message,
            action,
            actionUrl,
            actionText,
            getDisplayName(profile),
            profile.preferences?.themeColor
        )
    );

    const results = await Promise.allSettled(emailPromises);
    return results.filter(r => r.status === 'fulfilled' && r.value === true).length;
}
