import {
    collection, doc, documentId, onSnapshot, query, serverTimestamp, setDoc, where,
    type DocumentData, type QuerySnapshot,
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import type { GroupNotificationDoc, GroupNotificationEntry } from '../../../types/notification';
import { normalizeTimestamp } from '../../dateUtils';

const COLLECTION_NAME = 'groupNotifications';
const DOCUMENT_ID_IN_LIMIT = 10;

export interface GroupNotificationListenerOptions {
    onData: (records: GroupNotificationDoc[]) => void;
    onError?: (error: Error) => void;
}


function mapNotificationDoc(data: DocumentData, docId: string): GroupNotificationDoc {
    const notifications = Array.isArray(data.notifications)
        ? (data.notifications as GroupNotificationEntry[])
        : [];

    return {
        id: docId,
        groupId: typeof data.groupId === 'string' ? data.groupId : docId,
        notifications,
        updatedAt: normalizeTimestamp(data.updatedAt),
    };
}

/**
 * Ensure a group notification document exists so that dashboards can safely listen for updates.
 */
export async function ensureGroupNotificationDocument(groupId: string | null | undefined): Promise<void> {
    if (!groupId) {
        return;
    }

    const ref = doc(firebaseFirestore, COLLECTION_NAME, groupId);
    await setDoc(ref, {
        groupId,
        notifications: [],
        updatedAt: serverTimestamp(),
    }, { merge: true });
}

/**
 * Listen to notification documents for the provided group IDs.
 */
export function listenGroupNotifications(
    groupIds: string[] | undefined,
    options: GroupNotificationListenerOptions
): () => void {
    const uniqueIds = Array.from(new Set((groupIds ?? []).filter((id): id is string => Boolean(id))));

    if (uniqueIds.length === 0) {
        options.onData([]);
        return () => { /* no-op */ };
    }

    const chunkSize = DOCUMENT_ID_IN_LIMIT;
    const chunks: string[][] = [];
    for (let index = 0; index < uniqueIds.length; index += chunkSize) {
        chunks.push(uniqueIds.slice(index, index + chunkSize));
    }

    const aggregated = new Map<string, GroupNotificationDoc>();
    const chunkDocIds = new Map<number, Set<string>>();

    const emit = (): void => {
        const next = Array.from(aggregated.values())
            .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
        options.onData(next);
    };

    const unsubscribes = chunks.map((chunk, chunkIndex) => {
        const notificationsRef = collection(firebaseFirestore, COLLECTION_NAME);
        const notificationsQuery = query(notificationsRef, where(documentId(), 'in', chunk));

        return onSnapshot(
            notificationsQuery,
            (snapshot: QuerySnapshot<DocumentData>) => {
                const seenIds = new Set<string>();
                snapshot.docs.forEach((docSnap) => {
                    const payload = mapNotificationDoc(docSnap.data(), docSnap.id);
                    aggregated.set(docSnap.id, payload);
                    seenIds.add(docSnap.id);
                });

                const previousIds = chunkDocIds.get(chunkIndex) ?? new Set<string>();
                previousIds.forEach((docId) => {
                    if (!seenIds.has(docId)) {
                        aggregated.delete(docId);
                    }
                });

                chunkDocIds.set(chunkIndex, seenIds);
                emit();
            },
            (error) => {
                if (options.onError) {
                    options.onError(error as Error);
                } else {
                    console.error('Group notifications listener error:', error);
                }
            }
        );
    });

    return () => {
        unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
}
