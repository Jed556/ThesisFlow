/**
 * Shared utilities for Vercel serverless functions
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * CORS headers for API responses
 */
export function setCorsHeaders(res: VercelResponse, req: VercelRequest) {
    const origin = req.headers.origin ?? '';

    const currentHost = req.headers.host;
    const protocol = (req.headers['x-forwarded-proto'] as string | undefined) || 'https';
    const currentOrigin = currentHost ? `${protocol}://${currentHost}` : '';

    const allowedOrigins = new Set<string>();

    if (currentOrigin) {
        allowedOrigins.add(currentOrigin);
    }

    process.env.ALLOWED_ORIGINS?.split(',')
        .map(originEntry => originEntry.trim())
        .filter(originEntry => originEntry.length > 0)
        .forEach(originEntry => allowedOrigins.add(originEntry));

    if (currentHost?.includes('localhost')) {
        allowedOrigins.add('http://localhost:3000');
        allowedOrigins.add('http://localhost:5173');
    }

    if (origin && allowedOrigins.has(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Secret');

    const existingVary = res.getHeader('Vary');
    if (Array.isArray(existingVary)) {
        if (!existingVary.includes('Origin')) {
            res.setHeader('Vary', [...existingVary, 'Origin']);
        }
    } else if (typeof existingVary === 'string' && existingVary.length > 0) {
        if (!existingVary.split(',').map(value => value.trim()).includes('Origin')) {
            res.setHeader('Vary', `${existingVary}, Origin`);
        }
    } else {
        res.setHeader('Vary', 'Origin');
    }
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
export function successResponse(res: VercelResponse, data: Record<string, unknown>, message?: string) {
    return res.status(200).json({
        success: true,
        ...(message && { message }),
        ...data,
    });
}
