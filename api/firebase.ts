/**
 * Firebase Admin SDK initialization
 * Handles authentication and Firestore access for admin operations
 */
import * as admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\n/g, '\n');

if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) {
    throw new Error('Missing Firebase Admin SDK credentials. Check your environment variables.');
}

admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
    }),
});

export const auth = getAuth();
export const firestore = getFirestore();
export default admin;
