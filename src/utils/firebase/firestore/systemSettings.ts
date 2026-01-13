/**
 * Firebase Firestore - System Settings
 * CRUD operations for global system settings document
 * Settings are stored in a singleton document at: global/settings
 */

import {
    doc, getDoc, setDoc, onSnapshot, serverTimestamp
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import type {
    SystemSettings, ChapterSubmissionSettings, TerminalRequirementSettings,
    PanelCommentSettings, ChatSettings
} from '../../../types/systemSettings';
import { DEFAULT_SYSTEM_SETTINGS } from '../../../types/systemSettings';
import { normalizeTimestamp } from '../../dateUtils';

// ============================================================================
// Constants
// ============================================================================

const GLOBAL_COLLECTION = 'global';
const SETTINGS_DOC = 'settings';

// ============================================================================
// Settings Path Helpers
// ============================================================================

/**
 * Get the path to the global settings document
 */
function getSettingsDocPath(): string {
    return `${GLOBAL_COLLECTION}/${SETTINGS_DOC}`;
}

// ============================================================================
// Type Guards & Mappers
// ============================================================================

/**
 * Maps Firestore document data to SystemSettings
 */
function mapSettingsDoc(data: Record<string, unknown>): Omit<SystemSettings, 'id'> {
    const chapterData = data.chapterSubmissions as ChapterSubmissionSettings | undefined;
    const terminalData = data.terminalRequirements as TerminalRequirementSettings | undefined;
    const panelData = data.panelComments as PanelCommentSettings | undefined;
    const chatData = data.chat as ChatSettings | undefined;

    return {
        chapterSubmissions: {
            mode: chapterData?.mode ?? DEFAULT_SYSTEM_SETTINGS.chapterSubmissions.mode,
            linkPlaceholder: chapterData?.linkPlaceholder
                ?? DEFAULT_SYSTEM_SETTINGS.chapterSubmissions.linkPlaceholder,
            allowedLinkPatterns: chapterData?.allowedLinkPatterns
                ?? DEFAULT_SYSTEM_SETTINGS.chapterSubmissions.allowedLinkPatterns,
        },
        terminalRequirements: {
            mode: terminalData?.mode ?? DEFAULT_SYSTEM_SETTINGS.terminalRequirements.mode,
            defaultDriveFolderUrl: terminalData?.defaultDriveFolderUrl,
        },
        panelComments: {
            mode: panelData?.mode ?? DEFAULT_SYSTEM_SETTINGS.panelComments.mode,
            linkPlaceholder: panelData?.linkPlaceholder
                ?? DEFAULT_SYSTEM_SETTINGS.panelComments.linkPlaceholder,
        },
        chat: {
            attachmentsEnabled: chatData?.attachmentsEnabled
                ?? DEFAULT_SYSTEM_SETTINGS.chat.attachmentsEnabled,
            maxAttachmentSizeMb: chatData?.maxAttachmentSizeMb
                ?? DEFAULT_SYSTEM_SETTINGS.chat.maxAttachmentSizeMb,
            allowedAttachmentTypes: chatData?.allowedAttachmentTypes
                ?? DEFAULT_SYSTEM_SETTINGS.chat.allowedAttachmentTypes,
        },
        updatedAt: normalizeTimestamp(data.updatedAt),
        updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : undefined,
    };
}

// ============================================================================
// System Settings CRUD Operations
// ============================================================================

/**
 * Get system settings (creates with defaults if not exists)
 * @returns SystemSettings document
 */
export async function getSystemSettings(): Promise<SystemSettings> {
    const docPath = getSettingsDocPath();
    const docRef = doc(firebaseFirestore, docPath);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
        // Create default settings if not exists
        const defaultSettings: Omit<SystemSettings, 'id' | 'updatedAt'> = {
            ...DEFAULT_SYSTEM_SETTINGS,
        };
        await setDoc(docRef, {
            ...defaultSettings,
            updatedAt: serverTimestamp(),
        });
        return {
            id: SETTINGS_DOC,
            ...DEFAULT_SYSTEM_SETTINGS,
        };
    }

    const data = docSnap.data() as Record<string, unknown>;
    return {
        id: SETTINGS_DOC,
        ...mapSettingsDoc(data),
    };
}

/**
 * Remove undefined values from an object recursively
 * Firestore doesn't support undefined values
 */
function cleanUndefinedValues<T extends Record<string, unknown>>(obj: T): T {
    const cleaned: Record<string, unknown> = { ...obj };
    Object.keys(cleaned).forEach((key) => {
        if (cleaned[key] === undefined) {
            delete cleaned[key];
        } else if (cleaned[key] !== null && typeof cleaned[key] === 'object' && !Array.isArray(cleaned[key])) {
            cleaned[key] = cleanUndefinedValues(cleaned[key] as Record<string, unknown>);
        }
    });
    return cleaned as T;
}

/**
 * Update system settings
 * @param settings - Partial settings to update
 * @param updatedBy - UID of the user making the update
 */
export async function updateSystemSettings(
    settings: Partial<Omit<SystemSettings, 'id' | 'updatedAt' | 'updatedBy'>>,
    updatedBy?: string
): Promise<void> {
    const docPath = getSettingsDocPath();
    const docRef = doc(firebaseFirestore, docPath);

    // Ensure settings document exists
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
        // Create with defaults then apply updates
        const dataToWrite = cleanUndefinedValues({
            ...DEFAULT_SYSTEM_SETTINGS,
            ...settings,
            updatedAt: serverTimestamp(),
            updatedBy: updatedBy ?? null,
        });
        await setDoc(docRef, dataToWrite);
        return;
    }

    // Update existing document with merge, removing undefined values
    const dataToWrite = cleanUndefinedValues({
        ...settings,
        updatedAt: serverTimestamp(),
        updatedBy: updatedBy ?? null,
    });
    await setDoc(docRef, dataToWrite, { merge: true });
}

/**
 * Update chapter submission settings specifically
 */
export async function updateChapterSubmissionSettings(
    settings: Partial<ChapterSubmissionSettings>,
    updatedBy?: string
): Promise<void> {
    const current = await getSystemSettings();
    await updateSystemSettings({
        chapterSubmissions: {
            ...current.chapterSubmissions,
            ...settings,
        },
    }, updatedBy);
}

/**
 * Update terminal requirement settings specifically
 */
export async function updateTerminalRequirementSettings(
    settings: Partial<TerminalRequirementSettings>,
    updatedBy?: string
): Promise<void> {
    const current = await getSystemSettings();
    await updateSystemSettings({
        terminalRequirements: {
            ...current.terminalRequirements,
            ...settings,
        },
    }, updatedBy);
}

/**
 * Update panel comment settings specifically
 */
export async function updatePanelCommentSettings(
    settings: Partial<PanelCommentSettings>,
    updatedBy?: string
): Promise<void> {
    const current = await getSystemSettings();
    await updateSystemSettings({
        panelComments: {
            ...current.panelComments,
            ...settings,
        },
    }, updatedBy);
}

/**
 * Update chat settings specifically
 */
export async function updateChatSettings(
    settings: Partial<ChatSettings>,
    updatedBy?: string
): Promise<void> {
    const current = await getSystemSettings();
    await updateSystemSettings({
        chat: {
            ...current.chat,
            ...settings,
        },
    }, updatedBy);
}

// ============================================================================
// Settings Listener
// ============================================================================

export interface SettingsListenerOptions {
    onData: (settings: SystemSettings) => void;
    onError?: (error: Error) => void;
}

/**
 * Listen to system settings changes in real-time
 * @param options - Listener callbacks
 * @returns Unsubscribe function
 */
export function listenSystemSettings(options: SettingsListenerOptions): () => void {
    const docPath = getSettingsDocPath();
    const docRef = doc(firebaseFirestore, docPath);

    return onSnapshot(
        docRef,
        (docSnap) => {
            if (!docSnap.exists()) {
                // Return defaults if document doesn't exist
                options.onData({
                    id: SETTINGS_DOC,
                    ...DEFAULT_SYSTEM_SETTINGS,
                });
                return;
            }

            const data = docSnap.data() as Record<string, unknown>;
            options.onData({
                id: SETTINGS_DOC,
                ...mapSettingsDoc(data),
            });
        },
        (error) => {
            if (options.onError) {
                options.onError(error as Error);
            } else {
                console.error('System settings listener error:', error);
            }
        }
    );
}
