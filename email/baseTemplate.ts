/**
 * Base email template styles and wrapper for ThesisFlow
 */

/** Brand colors matching the theme */
export const brandColors = {
    primary: '#1976d2',
    primaryLight: '#42a5f5',
    primaryDark: '#1565c0',
    secondary: '#9c27b0',
    success: '#2e7d32',
    warning: '#ed6c02',
    error: '#d32f2f',
    info: '#0288d1',
    textPrimary: '#212121',
    textSecondary: '#757575',
    background: '#f5f5f5',
    surface: '#ffffff',
    border: '#e0e0e0',
};

/**
 * Base styles for email templates
 */
export const baseStyles = `
    body {
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        background-color: ${brandColors.background};
        color: ${brandColors.textPrimary};
        line-height: 1.6;
    }
    .container {
        max-width: 600px;
        margin: 0 auto;
        padding: 40px 20px;
    }
    .card {
        background-color: ${brandColors.surface};
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        overflow: hidden;
    }
    .header {
        background: linear-gradient(135deg, ${brandColors.primary} 0%, ${brandColors.primaryDark} 100%);
        padding: 32px 24px;
        text-align: center;
    }
    .header h1 {
        margin: 0;
        color: #ffffff;
        font-size: 28px;
        font-weight: 600;
        letter-spacing: -0.5px;
    }
    .header .logo {
        font-size: 36px;
        margin-bottom: 8px;
    }
    .content {
        padding: 32px 24px;
    }
    .content p {
        margin: 0 0 16px 0;
        color: ${brandColors.textPrimary};
    }
    .content .greeting {
        font-size: 18px;
        margin-bottom: 24px;
    }
    .footer {
        background-color: ${brandColors.background};
        padding: 24px;
        text-align: center;
        border-top: 1px solid ${brandColors.border};
    }
    .footer p {
        margin: 0;
        font-size: 12px;
        color: ${brandColors.textSecondary};
    }
    .footer a {
        color: ${brandColors.primary};
        text-decoration: none;
    }
    .button {
        display: inline-block;
        padding: 14px 32px;
        background-color: ${brandColors.primary};
        color: #ffffff !important;
        text-decoration: none;
        border-radius: 8px;
        font-weight: 600;
        font-size: 16px;
        transition: background-color 0.2s;
    }
    .button:hover {
        background-color: ${brandColors.primaryDark};
    }
    .button-success {
        background-color: ${brandColors.success};
    }
    .button-warning {
        background-color: ${brandColors.warning};
    }
    .button-error {
        background-color: ${brandColors.error};
    }
    .code-box {
        background-color: ${brandColors.background};
        border: 2px dashed ${brandColors.border};
        border-radius: 8px;
        padding: 24px;
        text-align: center;
        margin: 24px 0;
    }
    .code {
        font-family: 'SF Mono', Monaco, 'Courier New', monospace;
        font-size: 36px;
        font-weight: 700;
        letter-spacing: 8px;
        color: ${brandColors.primary};
    }
    .warning-text {
        font-size: 13px;
        color: ${brandColors.textSecondary};
        font-style: italic;
    }
    .expiry-notice {
        background-color: #fff3e0;
        border-left: 4px solid ${brandColors.warning};
        padding: 12px 16px;
        margin: 16px 0;
        border-radius: 0 8px 8px 0;
    }
    .expiry-notice p {
        margin: 0;
        color: ${brandColors.warning};
        font-size: 14px;
    }
`;

/**
 * Wraps content in the base email template
 * @param content - HTML content to wrap
 * @param footerText - Optional custom footer text
 * @returns Complete HTML email
 */
export function wrapInBaseTemplate(content: string, footerText?: string): string {
    const year = new Date().getFullYear();
    const footer = footerText || `© ${year} ThesisFlow. All rights reserved.`;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>ThesisFlow</title>
    <style>
        ${baseStyles}
    </style>
</head>
<body>
    <div class="container">
        <div class="card">
            <div class="header">
                <div class="logo">📚</div>
                <h1>ThesisFlow</h1>
            </div>
            ${content}
            <div class="footer">
                <p>${footer}</p>
                <p style="margin-top: 8px;">
                    This is an automated message. Please do not reply directly to this email.
                </p>
            </div>
        </div>
    </div>
</body>
</html>
    `.trim();
}

/**
 * Creates a plain text version of the email
 * @param greeting - Greeting text
 * @param body - Main body text
 * @param footerText - Optional footer text
 * @returns Plain text email content
 */
export function createPlainTextEmail(
    greeting: string,
    body: string,
    footerText?: string
): string {
    const year = new Date().getFullYear();
    const footer = footerText || `© ${year} ThesisFlow. All rights reserved.`;

    return `
ThesisFlow
==========

${greeting}

${body}

---
${footer}
This is an automated message. Please do not reply directly to this email.
    `.trim();
}
