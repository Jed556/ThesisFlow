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
 * ThesisFlow SVG logo as inline string for email templates
 * White color for visibility on colored headers
 */
/* eslint-disable max-len */
export const thesisFlowLogoSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 28.74" width="48" height="43" fill="#ffffff">
    <g>
        <path d="m24.53,13.21c0,.65,0,1.3,0,1.94,0,.42-.15.72-.55.91-.94.45-1.93.74-2.97.85-1.9.21-3.75-.14-5.58-.59-1.67-.41-3.37-.58-5.08-.49-.71.04-1.41.11-2.11.23-.57.1-.77-.09-.79-.67-.04-1.39-.05-2.78-.05-4.17,0-.18-.06-.24-.23-.31-.73-.27-1.42-.63-2.13-.95-1.52-.7-3.04-1.4-4.56-2.11-.05-.03-.11-.05-.16-.08C.14,7.69,0,7.55,0,7.34c0-.22.15-.36.34-.45.75-.34,1.49-.68,2.24-1.01,2.55-1.15,5.1-2.31,7.65-3.44,1.67-.74,3.33-1.49,4.96-2.28.47-.23.88-.2,1.36,0,4.88,2.08,9.65,4.4,14.52,6.48.22.09.44.21.65.32.16.08.27.21.27.41,0,.2-.12.32-.29.39-.63.28-1.26.57-1.89.84-.19.08-.25.19-.25.39,0,1.41,0,2.82,0,4.22,0,.14,0,.27.11.38.42.41.4.89.2,1.38-.06.15-.06.28-.03.42.18.93.36,1.86.53,2.8.1.55-.12.94-.63,1.16-.38.17-.77.24-1.19.15-.55-.12-.82-.47-.84-1.02-.02-.5.12-.98.18-1.46.07-.54.17-1.07.32-1.6.03-.12,0-.21-.07-.31-.38-.53-.22-1.22.02-1.7.02-.04.07-.1.11-.1.31-.05.28-.27.28-.49,0-1.1,0-2.19,0-3.29,0-.34-.02-.35-.33-.22-1.18.52-2.37,1.04-3.56,1.56-.15.06-.13.16-.13.27,0,.68,0,1.36,0,2.05Z"/>
        <path d="m19.7,22.88c-1.74-.03-3.26-.42-4.73-1.07-1.6-.71-3.23-1.3-4.97-1.59-2.32-.39-4.52-.11-6.55,1.14-.05.03-.11.06-.16.09-.06.03-.11.05-.17,0-.07-.05-.06-.12-.04-.19.06-.2.15-.39.26-.56,1.43-2.14,3.35-3.55,5.95-3.91,1.86-.26,3.64.1,5.39.7,1.48.51,2.92,1.1,4.42,1.55,1.64.49,3.28.51,4.91-.06.69-.24,1.33-.58,1.94-.98.09-.06.19-.12.29-.17.05-.03.11-.05.17,0,.06.05.04.11.02.17-.56,1.51-1.26,2.93-2.7,3.82-1.04.64-2.16,1.03-3.4,1.05-.25,0-.5.05-.63.05Z"/>
        <path d="m18.19,28.74c-1.72.04-3.24-.52-4.7-1.29-1.32-.69-2.52-1.57-3.82-2.3-.98-.55-1.99-1.03-3.11-1.26-.51-.1-1.02-.17-1.54-.1-.15.02-.29.01-.44.02-.07,0-.17.02-.21-.06-.05-.09,0-.17.07-.23.11-.11.22-.22.34-.31,1.03-.75,2.19-1.1,3.46-1.14,1.98-.06,3.82.47,5.61,1.26,1.43.63,2.85,1.3,4.38,1.65,2.51.58,4.88.21,7.08-1.18.13-.08.29-.3.44-.16.13.13-.06.3-.14.43-1.06,1.81-2.5,3.23-4.43,4.1-.96.43-1.98.6-2.99.57Z"/>
    </g>
</svg>
`;
/* eslint-enable max-len */

/**
 * Darkens a hex color by a percentage
 * @param hex - Hex color string (with or without #)
 * @param percent - Percentage to darken (0-100)
 * @returns Darkened hex color
 */
export function darkenColor(hex: string, percent: number): string {
    const cleanHex = hex.replace('#', '');
    const num = parseInt(cleanHex, 16);
    const r = Math.max(0, (num >> 16) - Math.round(2.55 * percent));
    const g = Math.max(0, ((num >> 8) & 0x00FF) - Math.round(2.55 * percent));
    const b = Math.max(0, (num & 0x0000FF) - Math.round(2.55 * percent));
    return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
}

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
 * @param headerColor - Optional custom header color (hex), defaults to brand primary
 * @returns Complete HTML email
 */
export function wrapInBaseTemplate(
    content: string,
    footerText?: string,
    headerColor?: string
): string {
    const year = new Date().getFullYear();
    const footer = footerText || `© ${year} ThesisFlow. All rights reserved.`;
    const primaryColor = headerColor || brandColors.primary;
    const darkColor = darkenColor(primaryColor, 15);

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
            <div class="header" style="background: linear-gradient(135deg, ${primaryColor} 0%, ${darkColor} 100%);">
                <div class="logo">${thesisFlowLogoSvg}</div>
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
