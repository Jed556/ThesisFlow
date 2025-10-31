/**
 * Health check endpoint
 * Returns server status and timestamp
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, successResponse } from '../libs/utils.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Handle CORS
    if (handleCors(req, res)) return;

    // Only allow GET
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    return successResponse(res, {
        status: 'ok',
        timestamp: new Date().toISOString(),
    });
}
