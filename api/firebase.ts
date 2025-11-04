/**
 * Firebase Admin SDK initialization
 * Handles authentication and Firestore access for admin operations
 */
import admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK
const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\n/g, '\n');
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase Admin SDK credentials. Check your environment variables.');
}

admin.initializeApp({
    credential: admin.credential.cert({
        projectId, clientEmail, privateKey,
    }),
});

export const auth = getAuth();
export const firestore = getFirestore();
export default admin;
