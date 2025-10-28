# API - Vercel Serverless Functions

This directory contains the serverless API functions for ThesisFlow, deployed on Vercel.

## Endpoints

### Health Check
- **GET** `/api/health`
- Returns server status and timestamp
- No authentication required

### User Management (Admin)
- **POST** `/api/user/create`
  - Body: `{ email: string, password: string }`
  - Creates a new Firebase user
  - Requires admin authentication

- **DELETE** `/api/user/delete`
  - Body: `{ uid?: string, email?: string }`
  - Deletes a Firebase user by UID or email
  - Requires admin authentication

## Authentication

All admin endpoints support two authentication methods:

1. **Firebase ID Token** (Recommended for client-side)
   - Include in Authorization header: `Bearer <token>`
   - User must have `admin` or `developer` role

2. **API Secret** (For server-to-server)
   - Include in header: `X-API-Secret: <secret>`
   - Set via `ADMIN_API_SECRET` environment variable

## Environment Variables

Required environment variables:

```env
# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY=your-private-key

# API Authentication
ADMIN_API_SECRET=your-secret-key

# CORS (comma-separated origins)
ALLOWED_ORIGINS=http://localhost:5173,https://yourdomain.com
```

## Deployment

The API is automatically deployed with Vercel when changes are pushed to the repository.

### Configuration

The `vercel.json` in the root directory configures:
- Function memory and timeout limits
- API route rewrites
- CORS headers
