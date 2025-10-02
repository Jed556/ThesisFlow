/**
 * ThesisFlow Admin API Server
 * Express server for admin operations (user management, etc.)
 * Deployed on Vercel with Firebase Admin SDK
 */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import adminRoutes from './routes/admin';

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disable for API server
}));

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'];
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);

        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Debug endpoint (only in development)
if (process.env.NODE_ENV !== 'production') {
    app.get('/debug/config', (req, res) => {
        res.json({
            hasFirebaseProjectId: !!process.env.FIREBASE_PROJECT_ID,
            hasFirebaseClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
            hasFirebasePrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
            hasAdminApiSecret: !!process.env.ADMIN_API_SECRET,
            nodeEnv: process.env.NODE_ENV,
            port: process.env.PORT,
            allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || [],
        });
    });
}

// API routes
app.use('/api/admin', adminRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Server error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
    });
});

// Start server (for local development)
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
        console.log(`📝 Admin API: http://localhost:${PORT}/api/admin`);
    });
}

// Export for Vercel
export default app;
