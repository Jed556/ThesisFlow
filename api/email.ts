/**
 * Email endpoint using Nodemailer with configurable SMTP
 * Supports Ethereal (auto) or custom SMTP credentials
 * Includes built-in templates for OTP, forgot password, and notifications
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import nodemailer from 'nodemailer';
import { handleCors, successResponse, errorResponse } from '../utils/utils.js';
import {
    generateEmailContent,
    type EmailTemplateType,
    type TemplateData,
} from '../email/index.js';

/** SMTP configuration interface */
interface SmtpConfig {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
}

/** Base email request interface */
interface BaseEmailRequest {
    to: string;
    smtp?: SmtpConfig;
    useEthereal?: boolean;
}

/** Raw email request body interface (no template) */
interface RawEmailRequest extends BaseEmailRequest {
    subject: string;
    text?: string;
    html?: string;
}

/** Templated email request body interface */
interface TemplatedEmailRequest extends BaseEmailRequest {
    template: EmailTemplateType;
    data: TemplateData;
    /** Optional subject override */
    subject?: string;
}

/** Combined email request type */
type EmailRequest = RawEmailRequest | TemplatedEmailRequest;

/**
 * Type guard for templated email request
 */
function isTemplatedRequest(req: EmailRequest): req is TemplatedEmailRequest {
    return 'template' in req && 'data' in req;
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
 * Handler for email endpoint
 * POST: Send an email via configured SMTP or Ethereal
 * Supports raw emails or templated emails (otp, forgot-password, notification)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Handle CORS
    if (handleCors(req, res)) return;

    // Only allow POST
    if (req.method !== 'POST') {
        return errorResponse(res, 'Method not allowed', 405);
    }

    const requestBody = req.body as EmailRequest;
    const { to, smtp, useEthereal = true } = requestBody;

    // Validate required fields
    if (!to) {
        return errorResponse(res, 'Missing required field: to', 400);
    }

    if (!isValidEmail(to)) {
        return errorResponse(res, 'Invalid email address format', 400);
    }

    // Determine email content based on request type
    let emailSubject: string;
    let emailText: string | undefined;
    let emailHtml: string | undefined;

    if (isTemplatedRequest(requestBody)) {
        // Templated email
        const { template, data, subject: subjectOverride } = requestBody;

        if (!template || !data) {
            return errorResponse(res, 'Missing required fields for templated email: template, data', 400);
        }

        try {
            const content = generateEmailContent(template, data);
            emailSubject = subjectOverride || content.defaultSubject;
            emailText = content.text;
            emailHtml = content.html;
        } catch (error) {
            return errorResponse(
                res,
                error instanceof Error ? error.message : 'Failed to generate email template',
                400
            );
        }
    } else {
        // Raw email
        const { subject, text, html } = requestBody;

        if (!subject) {
            return errorResponse(res, 'Missing required field: subject', 400);
        }

        if (!text && !html) {
            return errorResponse(res, 'Either text or html content is required', 400);
        }

        emailSubject = subject;
        emailText = text;
        emailHtml = html;
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
            from: `"ThesisFlow" <${fromAddress}>`,
            to,
            subject: emailSubject,
            text: emailText ?? undefined,
            html: emailHtml ?? undefined,
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
            template: isTemplatedRequest(requestBody) ? requestBody.template : undefined,
        }, 'Email sent successfully');
    } catch (error) {
        console.error('Email sending error:', error);
        return errorResponse(
            res,
            error instanceof Error ? error.message : 'Failed to send email',
            500
        );
    }
}
