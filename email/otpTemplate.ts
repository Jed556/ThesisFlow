/**
 * OTP (One-Time Pin) email template for ThesisFlow
 */
import type { OtpTemplateData } from './types.js';
import { wrapInBaseTemplate, createPlainTextEmail, brandColors } from './baseTemplate.js';

/**
 * Generates the OTP email HTML content
 * @param data - OTP template data
 * @returns HTML email content
 */
export function generateOtpEmailHtml(data: OtpTemplateData): string {
    const { recipientName, pin, expiryMinutes = 10, purpose = 'verify your account', footerText } = data;
    const greeting = recipientName ? `Hello ${recipientName},` : 'Hello,';

    const content = `
        <div class="content">
            <p class="greeting">${greeting}</p>
            <p>
                You've requested a one-time verification code to <strong>${purpose}</strong>.
                Please use the following code:
            </p>
            <div class="code-box">
                <span class="code">${pin}</span>
            </div>
            <div class="expiry-notice">
                <p>⏱️ This code will expire in <strong>${expiryMinutes} minutes</strong>.</p>
            </div>
            <p class="warning-text">
                If you didn't request this code, please ignore this email or contact support
                if you have concerns about your account security.
            </p>
            <p style="margin-top: 24px; color: ${brandColors.textSecondary}; font-size: 14px;">
                <strong>Security tip:</strong> Never share this code with anyone.
                ThesisFlow staff will never ask for your verification code.
            </p>
        </div>
    `;

    return wrapInBaseTemplate(content, footerText);
}

/**
 * Generates the OTP email plain text content
 * @param data - OTP template data
 * @returns Plain text email content
 */
export function generateOtpEmailText(data: OtpTemplateData): string {
    const { recipientName, pin, expiryMinutes = 10, purpose = 'verify your account', footerText } = data;
    const greeting = recipientName ? `Hello ${recipientName},` : 'Hello,';

    const body = `
You've requested a one-time verification code to ${purpose}.

Your verification code is: ${pin}

⏱️ This code will expire in ${expiryMinutes} minutes.

If you didn't request this code, please ignore this email or contact support if you have concerns about your account security.

Security tip: Never share this code with anyone. ThesisFlow staff will never ask for your verification code.
    `.trim();

    return createPlainTextEmail(greeting, body, footerText);
}

/**
 * Gets the default subject for OTP emails
 * @param purpose - The purpose of the OTP
 * @returns Default email subject
 */
export function getOtpDefaultSubject(purpose?: string): string {
    if (purpose) {
        return `Your ThesisFlow verification code to ${purpose}`;
    }
    return 'Your ThesisFlow verification code';
}
