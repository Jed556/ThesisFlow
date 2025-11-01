/**
 * Shared utilities for Vercel serverless functions
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * CORS headers for API responses
 */
export function setCorsHeaders(res: VercelResponse, req: VercelRequest) {
    const origin = req.headers.origin || '*';
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
        'https://thesisflow.vercel.app'
    ];

    if (allowedOrigins.includes(origin) || origin === '*') {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }

    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Secret');
}

/**
 * Handle OPTIONS preflight requests
 */
export function handleCors(req: VercelRequest, res: VercelResponse): boolean {
    setCorsHeaders(res, req);

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return true;
    }

    return false;
}

/**
 * Standard error response
 */
export function errorResponse(res: VercelResponse, message: string, status: number = 500) {
    return res.status(status).json({
        success: false,
        error: message,
    });
}

/**
 * Standard success response
 */
export function successResponse(res: VercelResponse, data: any, message?: string) {
    return res.status(200).json({
        success: true,
        ...(message && { message }),
        ...data,
    });
}
