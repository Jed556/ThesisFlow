import { doc, getDoc, setDoc, collection, getDocs, query, where, onSnapshot } from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import { cleanData } from './firestore';
import type {
    TerminalRequirementConfigDocument,
    TerminalRequirementConfigEntry,
} from '../../../types/terminalRequirementConfig';

const COLLECTION_NAME = 'terminalRequirementConfigs';
const DEFAULT_DEPARTMENT_SEGMENT = 'general';
const DEFAULT_COURSE_SEGMENT = 'common';

function sanitizeSegment(value: string | null | undefined, fallback: string): string {
    if (!value) {
        return fallback;
    }
    const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return normalized || fallback;
}

function getDocumentId(department: string, course: string): string {
    const departmentKey = sanitizeSegment(department, DEFAULT_DEPARTMENT_SEGMENT);
    const courseKey = sanitizeSegment(course, DEFAULT_COURSE_SEGMENT);
    return `${departmentKey}_${courseKey}`;
}

function getConfigRef(department: string, course: string) {
    const docId = getDocumentId(department, course);
    return doc(firebaseFirestore, COLLECTION_NAME, docId);
}

function normalizeEntries(entries: TerminalRequirementConfigEntry[]): TerminalRequirementConfigEntry[] {
    const normalized = new Map<string, TerminalRequirementConfigEntry>();

    entries.forEach((entry) => {
        if (!entry.requirementId) {
            return;
        }
        const cleanEntry: TerminalRequirementConfigEntry = {
            stage: entry.stage,
            requirementId: entry.requirementId,
            active: Boolean(entry.active),
        };

        if (entry.requireAttachment !== undefined) {
            cleanEntry.requireAttachment = entry.requireAttachment;
        }

        if (entry.template) {
            cleanEntry.template = { ...entry.template };
        }

        normalized.set(entry.requirementId, cleanEntry);
    });

    return Array.from(normalized.values());
}

function mapSnapshotToDocument(
    department: string,
    course: string,
    data: Omit<TerminalRequirementConfigDocument, 'id'>,
    docId: string,
): TerminalRequirementConfigDocument {
    const fallbackTimestamp = new Date().toISOString();
    return {
        id: docId,
        department: data.department ?? department,
        course: data.course ?? course,
        requirements: normalizeEntries(data.requirements ?? []),
        createdAt: data.createdAt ?? fallbackTimestamp,
        updatedAt: data.updatedAt ?? fallbackTimestamp,
    };
}

export function generateTerminalRequirementConfigId(department: string, course: string): string {
    return getDocumentId(department, course);
}

export async function getTerminalRequirementConfig(
    department: string,
    course: string,
): Promise<TerminalRequirementConfigDocument | null> {
    if (!department || !course) {
        return null;
    }

    const ref = getConfigRef(department, course);
    const snapshot = await getDoc(ref);

    if (!snapshot.exists()) {
        return null;
    }

    const data = snapshot.data() as Omit<TerminalRequirementConfigDocument, 'id'>;
    return mapSnapshotToDocument(department, course, data, ref.id);
}

export function listenTerminalRequirementConfig(
    department: string,
    course: string,
    onData: (config: TerminalRequirementConfigDocument | null) => void,
    onError?: (error: unknown) => void,
): () => void {
    if (!department || !course) {
        onData(null);
        return () => { /* no-op */ };
    }

    const ref = getConfigRef(department, course);
    return onSnapshot(
        ref,
        (snapshot) => {
            if (!snapshot.exists()) {
                onData(null);
                return;
            }
            const data = snapshot.data() as Omit<TerminalRequirementConfigDocument, 'id'>;
            onData(mapSnapshotToDocument(department, course, data, ref.id));
        },
        (error) => {
            if (onError) {
                onError(error);
            } else {
                console.error('Terminal requirement config listener error:', error);
            }
        }
    );
}

export async function getTerminalRequirementConfigsByDepartment(
    department: string,
): Promise<TerminalRequirementConfigDocument[]> {
    const configsRef = collection(firebaseFirestore, COLLECTION_NAME);
    const q = query(configsRef, where('department', '==', department));
    const snapshot = await getDocs(q);

    return snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as Omit<TerminalRequirementConfigDocument, 'id'>;
        return mapSnapshotToDocument(data.department, data.course, data, docSnap.id);
    });
}

export async function getTerminalRequirementDepartments(): Promise<string[]> {
    const configsRef = collection(firebaseFirestore, COLLECTION_NAME);
    const snapshot = await getDocs(configsRef);

    const departments = new Set<string>();
    snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data() as Partial<TerminalRequirementConfigDocument>;
        const department = data.department?.trim();
        if (department) {
            departments.add(department);
        }
    });

    return Array.from(departments).sort((a, b) => a.localeCompare(b));
}

export interface SaveTerminalRequirementConfigPayload {
    department: string;
    course: string;
    requirements: TerminalRequirementConfigEntry[];
}

export async function setTerminalRequirementConfig(
    payload: SaveTerminalRequirementConfigPayload,
): Promise<string> {
    const department = payload.department?.trim();
    const course = payload.course?.trim();

    if (!department || !course) {
        throw new Error('Department and course are required.');
    }

    const ref = getConfigRef(department, course);
    const snapshot = await getDoc(ref);
    const now = new Date().toISOString();

    const existing = snapshot.exists()
        ? (snapshot.data() as Omit<TerminalRequirementConfigDocument, 'id'>)
        : null;

    const documentPayload: Omit<TerminalRequirementConfigDocument, 'id'> = {
        department,
        course,
        requirements: normalizeEntries(payload.requirements),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
    };

    const cleaned = cleanData(documentPayload, existing ? 'update' : 'create');
    await setDoc(ref, cleaned, { merge: true });
    return ref.id;
}
