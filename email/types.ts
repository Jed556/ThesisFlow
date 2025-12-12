/**
 * Email template types and interfaces for ThesisFlow
 */

/** Supported email template types */
export type EmailTemplateType = 'otp' | 'forgot-password' | 'notification';

/** Base template data interface */
export interface BaseTemplateData {
    /** Recipient name */
    recipientName?: string;
    /** Custom footer text */
    footerText?: string;
    /** Custom header color (hex color code) - uses recipient's profile color */
    headerColor?: string;
}

/** OTP (One-Time Pin) email template data */
export interface OtpTemplateData extends BaseTemplateData {
    /** The one-time pin code */
    pin: string;
    /** Expiry time in minutes */
    expiryMinutes?: number;
    /** Purpose of the OTP (e.g., "verify your email", "confirm login") */
    purpose?: string;
}

/** Forgot password email template data */
export interface ForgotPasswordTemplateData extends BaseTemplateData {
    /** Password reset link */
    resetLink: string;
    /** Expiry time in minutes */
    expiryMinutes?: number;
}

/** Notification email template data */
export interface NotificationTemplateData extends BaseTemplateData {
    /** Notification title */
    title: string;
    /** Main notification message */
    message: string;
    /** Optional action button text */
    actionText?: string;
    /** Optional action button URL */
    actionUrl?: string;
    /** Notification type for styling */
    notificationType?: 'info' | 'success' | 'warning' | 'error';
}

/** Union type for all template data */
export type TemplateData = OtpTemplateData | ForgotPasswordTemplateData | NotificationTemplateData;

/** Email template request with template option */
export interface TemplatedEmailRequest {
    to: string;
    subject?: string;
    template: EmailTemplateType;
    data: TemplateData;
}
