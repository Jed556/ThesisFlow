/**
 * Forgot password email template for ThesisFlow
 */
import type { ForgotPasswordTemplateData } from './types.js';
import { wrapInBaseTemplate, createPlainTextEmail, brandColors } from './baseTemplate.js';

/**
 * Generates the forgot password email HTML content
 * @param data - Forgot password template data
 * @returns HTML email content
 */
export function generateForgotPasswordEmailHtml(data: ForgotPasswordTemplateData): string {
    const { recipientName, resetLink, expiryMinutes = 60, footerText, headerColor, runtimeOrigin } = data;
    const greeting = recipientName ? `Hello ${recipientName},` : 'Hello,';

    const content = `
        <div class="content">
            <p class="greeting">${greeting}</p>
            <p>
                We received a request to reset the password for your ThesisFlow account.
                Click the button below to create a new password:
            </p>
            <div style="text-align: center; margin: 32px 0;">
                <a href="${resetLink}" class="button">Reset Password</a>
            </div>
            <div class="expiry-notice">
                <p>This link will expire in <strong>${expiryMinutes} minutes</strong>.</p>
            </div>
            <p style="margin-top: 24px;">
                If the button doesn't work, copy and paste this link into your browser:
            </p>
            <p style="
                background-color: ${brandColors.background};
                padding: 12px;
                border-radius: 6px;
                word-break: break-all;
                font-size: 13px;
                color: ${brandColors.primary};
            ">
                ${resetLink}
            </p>
            <p class="warning-text" style="margin-top: 24px;">
                If you didn't request a password reset, you can safely ignore this email.
                Your password will remain unchanged.
            </p>
            <p style="margin-top: 24px; color: ${brandColors.textSecondary}; font-size: 14px;">
                <strong>Security tip:</strong> Make sure you're on the official ThesisFlow website
                before entering your new password. We will never ask for your password via email.
            </p>
        </div>
    `;

    return wrapInBaseTemplate(content, footerText, headerColor, runtimeOrigin);
}

/**
 * Generates the forgot password email plain text content
 * @param data - Forgot password template data
 * @returns Plain text email content
 */
export function generateForgotPasswordEmailText(data: ForgotPasswordTemplateData): string {
    const { recipientName, resetLink, expiryMinutes = 60, footerText } = data;
    const greeting = recipientName ? `Hello ${recipientName},` : 'Hello,';

    const body = `
We received a request to reset the password for your ThesisFlow account.

To reset your password, visit the following link:
${resetLink}

This link will expire in ${expiryMinutes} minutes.

If you didn't request a password reset, you can safely ignore this email.
Your password will remain unchanged.

Security tip: Make sure you're on the official ThesisFlow website before
entering your new password. We will never ask for your password via email.
    `.trim();

    return createPlainTextEmail(greeting, body, footerText);
}

/**
 * Gets the default subject for forgot password emails
 * @returns Default email subject
 */
export function getForgotPasswordDefaultSubject(): string {
    return 'Reset your ThesisFlow password';
}
