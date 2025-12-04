/**
 * Test email endpoint using Nodemailer with configurable SMTP
 * Supports Ethereal (auto) or custom SMTP credentials
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';
import { handleCors, successResponse, errorResponse } from '../../utils/utils.js';

/** SMTP configuration interface */
interface SmtpConfig {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
}

/** Email request body interface */
interface EmailRequest {
    to: string;
    subject: string;
    text?: string;
    html?: string;
    smtp?: SmtpConfig;
    useEthereal?: boolean;
}

/**
 * Validates email format
 * @param email - Email address to validate
 * @returns True if email is valid
 */
function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Handler for test email endpoint
 * POST: Send a test email via configured SMTP or Ethereal
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Handle CORS
    if (handleCors(req, res)) return;

    // Only allow POST
    if (req.method !== 'POST') {
        return errorResponse(res, 'Method not allowed', 405);
    }

    const { to, subject, text, html, smtp, useEthereal = true } = req.body as EmailRequest;

    // Validate required fields
    if (!to || !subject) {
        return errorResponse(res, 'Missing required fields: to, subject', 400);
    }

    if (!isValidEmail(to)) {
        return errorResponse(res, 'Invalid email address format', 400);
    }

    if (!text && !html) {
        return errorResponse(res, 'Either text or html content is required', 400);
    }

    // Validate custom SMTP if not using Ethereal
    if (!useEthereal) {
        if (!smtp?.host || !smtp?.user || !smtp?.pass) {
            return errorResponse(res, 'Custom SMTP requires host, user, and pass', 400);
        }
    }

    try {
        let transporter: nodemailer.Transporter;
        let fromAddress: string;
        let previewUrl: string | false = false;
        let testAccountInfo: { user: string; web: string } | undefined;

        if (useEthereal) {
            // Create Ethereal test account
            const testAccount = await nodemailer.createTestAccount();
            testAccountInfo = {
                user: testAccount.user,
                web: testAccount.web,
            };
            fromAddress = testAccount.user;

            // Create transporter using Ethereal SMTP
            transporter = nodemailer.createTransport({
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false,
                auth: {
                    user: testAccount.user,
                    pass: testAccount.pass,
                },
            });
        } else {
            // Create transporter using custom SMTP
            transporter = nodemailer.createTransport({
                host: smtp!.host,
                port: smtp!.port || 587,
                secure: smtp!.secure ?? false,
                auth: {
                    user: smtp!.user,
                    pass: smtp!.pass,
                },
            });
            fromAddress = smtp!.user;
        }

        // Send email
        const info = await transporter.sendMail({
            from: `"ThesisFlow Test" <${fromAddress}>`,
            to,
            subject,
            text: text ?? undefined,
            html: html ?? undefined,
        });

        // Get preview URL for Ethereal emails
        if (useEthereal) {
            previewUrl = nodemailer.getTestMessageUrl(info);
        }

        return successResponse(res, {
            messageId: info.messageId,
            previewUrl: previewUrl || undefined,
            testAccount: testAccountInfo,
            smtpHost: useEthereal ? 'smtp.ethereal.email' : smtp!.host,
        }, 'Test email sent successfully');
    } catch (error) {
        console.error('Email sending error:', error);
        return errorResponse(
            res,
            error instanceof Error ? error.message : 'Failed to send email',
            500
        );
    }
}
