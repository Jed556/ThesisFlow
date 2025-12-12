/**
 * Email templates index for ThesisFlow
 * Exports all template types and generators
 */

// Types
export type {
    EmailTemplateType,
    BaseTemplateData,
    OtpTemplateData,
    ForgotPasswordTemplateData,
    NotificationTemplateData,
    TemplateData,
    TemplatedEmailRequest,
} from './types.js';

// Base template utilities
export {
    brandColors,
    baseStyles,
    wrapInBaseTemplate,
    createPlainTextEmail,
    thesisFlowLogoSvg,
    darkenColor,
} from './baseTemplate.js';

// OTP template
export {
    generateOtpEmailHtml,
    generateOtpEmailText,
    getOtpDefaultSubject,
} from './otpTemplate.js';

// Forgot password template
export {
    generateForgotPasswordEmailHtml,
    generateForgotPasswordEmailText,
    getForgotPasswordDefaultSubject,
} from './forgotPasswordTemplate.js';

// Notification template
export {
    generateNotificationEmailHtml,
    generateNotificationEmailText,
    getNotificationDefaultSubject,
} from './notificationTemplate.js';

import type {
    EmailTemplateType,
    TemplateData,
    OtpTemplateData,
    ForgotPasswordTemplateData,
    NotificationTemplateData,
} from './types.js';
import { generateOtpEmailHtml, generateOtpEmailText, getOtpDefaultSubject } from './otpTemplate.js';
import {
    generateForgotPasswordEmailHtml,
    generateForgotPasswordEmailText,
    getForgotPasswordDefaultSubject,
} from './forgotPasswordTemplate.js';
import {
    generateNotificationEmailHtml,
    generateNotificationEmailText,
    getNotificationDefaultSubject,
} from './notificationTemplate.js';

/** Email content with both HTML and plain text versions */
export interface EmailContent {
    html: string;
    text: string;
    defaultSubject: string;
}

/**
 * Type guard for OTP template data
 */
function isOtpData(data: TemplateData): data is OtpTemplateData {
    return 'pin' in data;
}

/**
 * Type guard for forgot password template data
 */
function isForgotPasswordData(data: TemplateData): data is ForgotPasswordTemplateData {
    return 'resetLink' in data;
}

/**
 * Type guard for notification template data
 */
function isNotificationData(data: TemplateData): data is NotificationTemplateData {
    return 'title' in data && 'message' in data;
}

/**
 * Generates email content for the specified template type
 * @param templateType - The type of email template to use
 * @param data - Template-specific data
 * @returns Email content with HTML, plain text, and default subject
 */
export function generateEmailContent(
    templateType: EmailTemplateType,
    data: TemplateData
): EmailContent {
    switch (templateType) {
        case 'otp':
            if (!isOtpData(data)) {
                throw new Error('Invalid data for OTP template: missing "pin" field');
            }
            return {
                html: generateOtpEmailHtml(data),
                text: generateOtpEmailText(data),
                defaultSubject: getOtpDefaultSubject(data.purpose),
            };

        case 'forgot-password':
            if (!isForgotPasswordData(data)) {
                throw new Error('Invalid data for forgot-password template: missing "resetLink" field');
            }
            return {
                html: generateForgotPasswordEmailHtml(data),
                text: generateForgotPasswordEmailText(data),
                defaultSubject: getForgotPasswordDefaultSubject(),
            };

        case 'notification':
            if (!isNotificationData(data)) {
                throw new Error('Invalid data for notification template: missing "title" or "message" field');
            }
            return {
                html: generateNotificationEmailHtml(data),
                text: generateNotificationEmailText(data),
                defaultSubject: getNotificationDefaultSubject(data.title),
            };

        default:
            throw new Error(`Unknown template type: ${templateType}`);
    }
}
