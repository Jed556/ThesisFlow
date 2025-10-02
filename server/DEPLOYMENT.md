# ThesisFlow Server Deployment Guide

This guide explains how to deploy the ThesisFlow admin API server with proper secret isolation.

## Overview

The server has been refactored from Firebase Functions to a standalone Express.js application that:
- Uses Firebase Admin SDK for user management
- Authenticates requests using Firebase ID tokens
- Isolates admin secrets from the client application

## Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Client App    │────────▶│  Admin API Server│────────▶│  Firebase Auth  │
│  (Vite/React)   │  HTTPS  │   (Express.js)   │  Admin  │   & Firestore   │
│                 │◀────────│                  │  SDK    │                 │
└─────────────────┘         └──────────────────┘         └─────────────────┘
                                      │
                                      │ Environment Variables
                                      │ (Secrets)
                                      ▼
                            Firebase Admin Credentials
                            (Never exposed to client)
```

## Prerequisites

2. **Firebase Project**: Your existing Firebase project
3. **Firebase Service Account**: Generate from Firebase Console

## Step 1: Get Firebase Service Account Credentials

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** (⚙️ icon) → **Service Accounts**
4. Click **Generate New Private Key**
5. Save the downloaded JSON file securely (never commit to git!)

The JSON file contains:
```json
{
  "project_id": "your-project-id",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...",
  "client_email": "firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com"
}
```

## Step 2: Install Dependencies

```bash
cd server
npm install
```

## Step 3: Local Development Setup

1. **Create `.env` file** (copy from `.env.example`):

```bash
cp .env.example .env
```

2. **Configure environment variables**:

```env
# Firebase Admin SDK (from service account JSON)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-Private-Key-Here\n-----END PRIVATE KEY-----\n"

# Server Configuration
PORT=3001
NODE_ENV=development

# CORS (your frontend URL)
ALLOWED_ORIGINS=http://localhost:5173

# Admin API Secret (generate using: openssl rand -hex 32)
ADMIN_API_SECRET=your-super-secret-random-string-here
```

3. **Run development server**:

```bash
npm run dev
```

Server will start at `http://localhost:3001`

Test with:
```bash
curl http://localhost:3001/health
```

## Step 3: Testing

### Test Health Endpoint

```bash
curl https://your-server.domain.com/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-10-02T..."
}
```

### Test Admin Endpoints

1. **Get Firebase ID Token** from your logged-in admin user:

```javascript
// In browser console (while logged in as admin)
const token = await firebase.auth().currentUser.getIdToken();
console.log(token);
```

2. **Test Create User**:

```bash
curl -X POST https://your-server.domain.com/api/admin/users/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ID_TOKEN_HERE" \
  -d '{"email": "test@example.com", "password": "Test123456"}'
```

3. **Test Delete User**:

```bash
curl -X POST https://your-server.domain.com/api/admin/users/delete \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ID_TOKEN_HERE" \
  -d '{"email": "test@example.com"}'
```

## Security Best Practices

### 1. **Secret Management**

✅ **DO:**
- Use environment variables for all secrets
- Rotate credentials periodically
- Use different service accounts for dev/staging/prod
- Enable Firebase Admin SDK audit logging

❌ **DON'T:**
- Commit `.env` files to git
- Share service account JSON files
- Use the same credentials across environments
- Log sensitive data

### 2. **CORS Configuration**

Only allow your actual frontend domains:

```env
ALLOWED_ORIGINS=https://myapp.domain.com,https://staging.myapp.domain.com
```

### 3. **Firebase Security Rules**

Even with server-side Admin SDK, maintain proper Firestore rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        (request.auth.token.role == 'admin' || request.auth.token.role == 'developer');
    }
  }
}
```

### 4. **Rate Limiting**

Consider adding rate limiting middleware for production:

```bash
npm install express-rate-limit
```

Update `src/index.ts`:

```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use('/api', limiter);
```

### Common Issues

#### 1. "Cannot find module 'firebase-admin'"

**Solution:** Ensure dependencies are installed and committed to git:
```bash
npm install
git add package.json package-lock.json
git commit -m "Add dependencies"
```

#### 2. "CORS policy blocked"

**Solution:** Add your frontend URL to `ALLOWED_ORIGINS`:
```env
ALLOWED_ORIGINS=https://your-app.domain.com,http://localhost:5173
```

#### 3. "Unauthorized: Invalid token"

**Solution:** Ensure user has admin role in Firebase custom claims:
```javascript
// Set custom claims (use Firebase Admin SDK or Cloud Function)
admin.auth().setCustomUserClaims(uid, { role: 'admin' });
```

#### 4. "Invalid private key"

**Solution:** Check `FIREBASE_PRIVATE_KEY` format:
- Must be wrapped in double quotes
- Must preserve `\n` characters (not actual newlines)
- Example: `"-----BEGIN PRIVATE KEY-----\nABC...\n-----END PRIVATE KEY-----\n"`

## Deployment Checklist

- [ ] Firebase service account JSON downloaded
- [ ] `.env.example` copied to `.env` locally
- [ ] All environment variables configured
- [ ] `ALLOWED_ORIGINS` includes your frontend URL
- [ ] `VITE_ADMIN_API_URL` set in client app
- [ ] Server deployed successfully
- [ ] Health endpoint returns 200 OK
- [ ] Admin endpoints tested with valid token
- [ ] CORS working from client app
- [ ] Firebase custom claims configured for admin users
- [ ] `.env` added to `.gitignore`