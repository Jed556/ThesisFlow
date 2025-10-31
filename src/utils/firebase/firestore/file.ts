import { doc, setDoc, onSnapshot, collection, query, where, getDocs, addDoc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { firebaseFirestore, firebaseAuth } from '../firebaseConfig';
import { cleanData } from './firestore';

import type { FileAttachment } from '../../../types/file';

/** Firestore collection name used for user documents */
const FILES_COLLECTION = 'files';

/**
 * Store or update file metadata record in Firestore
 */
export async function setFileRecord(hash: string, fileInfo: FileAttachment): Promise<void> {
    const ref = doc(firebaseFirestore, FILES_COLLECTION, hash);

    // Clean the data to remove undefined, null, and empty string values
    const cleanedData = cleanData(fileInfo);

    await setDoc(ref, cleanedData, { merge: true });
}

/**
 * Get file metadata by hash
 */
export async function getFileByHash(hash: string): Promise<FileAttachment | null> {
    const ref = doc(firebaseFirestore, FILES_COLLECTION, hash);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data() as FileAttachment;
}

/**
 * Delete a file record by hash
 * @param hash - File hash used as document ID
 */
export async function deleteFileRecord(hash: string): Promise<void> {
    if (!hash) throw new Error('File hash required');
    const ref = doc(firebaseFirestore, FILES_COLLECTION, hash);
    await deleteDoc(ref);
}

/**
 * Delete multiple file records by their hashes
 * @param hashes - Array of file hashes to delete
 * @returns Promise that resolves when all deletions are complete
 */
export async function bulkDeleteFileRecords(hashes: string[]): Promise<void> {
    if (!hashes || hashes.length === 0) throw new Error('File hashes required');

    const deletePromises = hashes.map(hash => {
        const ref = doc(firebaseFirestore, FILES_COLLECTION, hash);
        return deleteDoc(ref);
    });

    await Promise.all(deletePromises);
}

/**
 * Get all file records
 * @returns Array of FileAttachment with their hashes as IDs
 */
export async function getAllFiles(): Promise<(FileAttachment & { id: string })[]> {
    const snap = await getDocs(collection(firebaseFirestore, FILES_COLLECTION));
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as FileAttachment & { id: string }));
}