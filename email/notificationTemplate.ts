/**
 * Notification email template for ThesisFlow
 */
import type { NotificationTemplateData } from './types.js';
import { wrapInBaseTemplate, createPlainTextEmail, brandColors } from './baseTemplate.js';

/** Notification type color mapping */
const notificationColors: Record<string, { bg: string; border: string; icon: string }> = {
    info: {
        bg: '#e3f2fd',
        border: brandColors.info,
        icon: 'ℹ️',
    },
    success: {
        bg: '#e8f5e9',
        border: brandColors.success,
        icon: '✅',
    },
    warning: {
        bg: '#fff3e0',
        border: brandColors.warning,
        icon: '⚠️',
    },
    error: {
        bg: '#ffebee',
        border: brandColors.error,
        icon: '❌',
    },
};

/**
 * Gets the button class based on notification type
 * @param type - Notification type
 * @returns Button class name
 */
function getButtonClass(type?: string): string {
    switch (type) {
        case 'success':
            return 'button button-success';
        case 'warning':
            return 'button button-warning';
        case 'error':
            return 'button button-error';
        default:
            return 'button';
    }
}

/**
 * Generates the notification email HTML content
 * @param data - Notification template data
 * @returns HTML email content
 */
export function generateNotificationEmailHtml(data: NotificationTemplateData): string {
    const {
        recipientName,
        title,
        message,
        actionText,
        actionUrl,
        notificationType = 'info',
        footerText,
    } = data;

    const greeting = recipientName ? `Hello ${recipientName},` : 'Hello,';
    const colors = notificationColors[notificationType] || notificationColors.info;

    const actionButton = actionText && actionUrl
        ? `
            <div style="text-align: center; margin: 32px 0;">
                <a href="${actionUrl}" class="${getButtonClass(notificationType)}">${actionText}</a>
            </div>
        `
        : '';

    const content = `
        <div class="content">
            <p class="greeting">${greeting}</p>
            <div style="
                background-color: ${colors.bg};
                border-left: 4px solid ${colors.border};
                padding: 16px 20px;
                margin: 24px 0;
                border-radius: 0 8px 8px 0;
            ">
                <p style="margin: 0 0 8px 0; font-size: 18px; font-weight: 600; color: ${colors.border};">
                    ${colors.icon} ${title}
                </p>
                <p style="margin: 0; color: ${brandColors.textPrimary};">
                    ${message}
                </p>
            </div>
            ${actionButton}
            <p style="margin-top: 24px; color: ${brandColors.textSecondary}; font-size: 14px;">
                This notification was sent from ThesisFlow regarding your research activities.
                If you have questions, please contact your adviser or the system administrator.
            </p>
        </div>
    `;

    return wrapInBaseTemplate(content, footerText);
}

/**
 * Generates the notification email plain text content
 * @param data - Notification template data
 * @returns Plain text email content
 */
export function generateNotificationEmailText(data: NotificationTemplateData): string {
    const {
        recipientName,
        title,
        message,
        actionText,
        actionUrl,
        footerText,
    } = data;

    const greeting = recipientName ? `Hello ${recipientName},` : 'Hello,';

    let body = `
${title}
${'-'.repeat(title.length)}

${message}
    `.trim();

    if (actionText && actionUrl) {
        body += `\n\n${actionText}: ${actionUrl}`;
    }

    body += '\n\nThis notification was sent from ThesisFlow regarding your research ' +
        'activities. If you have questions, please contact your adviser or the ' +
        'system administrator.';

    return createPlainTextEmail(greeting, body, footerText);
}

/**
 * Gets the default subject for notification emails
 * @param title - Notification title
 * @returns Default email subject
 */
export function getNotificationDefaultSubject(title: string): string {
    return `ThesisFlow: ${title}`;
}
