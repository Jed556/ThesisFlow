/**
 * Firebase Firestore - Agendas
 * CRUD operations for research agendas using hierarchical structure:
 * - Institution-wide: year/{year}/agendas/{agendaId}
 * - Department-specific: year/{year}/departments/{department}/departmentAgendas/{agendaId}
 */

import {
    collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
    serverTimestamp, writeBatch, onSnapshot, query, orderBy,
    type DocumentSnapshot, type Unsubscribe,
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import type { AgendaDocument, AgendaDocumentWithId, AgendaScope } from '../../../types/agenda';
import {
    buildAgendasCollectionPath, buildAgendaPath,
    buildDepartmentAgendasCollectionPath, buildDepartmentAgendaPath,
} from './paths';
import { DEFAULT_YEAR } from '../../../config/firestore';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert Firestore document data to AgendaDocumentWithId
 */
function docToAgenda(docSnap: DocumentSnapshot): AgendaDocumentWithId | null {
    if (!docSnap.exists()) return null;
    const data = docSnap.data();
    return {
        docId: docSnap.id,
        id: data.id || docSnap.id,
        title: data.title || '',
        subThemes: data.subThemes || [],
        createdAt: data.createdAt?.toDate?.() || undefined,
        updatedAt: data.updatedAt?.toDate?.() || undefined,
    };
}

/**
 * Generate next theme ID (A, B, C, ...)
 */
function getNextThemeId(agendas: AgendaDocumentWithId[]): string {
    if (agendas.length === 0) return 'A';
    const sortedIds = agendas
        .map((a) => a.id)
        .filter((id) => /^[A-Z]$/.test(id))
        .sort();
    if (sortedIds.length === 0) return 'A';
    const lastId = sortedIds[sortedIds.length - 1];
    return String.fromCharCode(lastId.charCodeAt(0) + 1);
}

// ============================================================================
// Read Operations - Institution-wide Agendas
// ============================================================================

/**
 * Get all institution-wide agendas
 * @param year - Academic year (defaults to current)
 * @returns Array of agenda documents
 */
export async function getInstitutionalAgendas(
    year: string = DEFAULT_YEAR
): Promise<AgendaDocumentWithId[]> {
    const collectionPath = buildAgendasCollectionPath(year);
    const agendasRef = collection(firebaseFirestore, collectionPath);
    const q = query(agendasRef, orderBy('id', 'asc'));
    const snapshot = await getDocs(q);

    return snapshot.docs
        .map((docSnap) => docToAgenda(docSnap))
        .filter((a): a is AgendaDocumentWithId => a !== null);
}

/**
 * Get a specific institution-wide agenda
 * @param year - Academic year
 * @param agendaId - Agenda document ID
 * @returns Agenda document or null if not found
 */
export async function getInstitutionalAgenda(
    year: string,
    agendaId: string
): Promise<AgendaDocumentWithId | null> {
    const docPath = buildAgendaPath(year, agendaId);
    const docRef = doc(firebaseFirestore, docPath);
    const docSnap = await getDoc(docRef);
    return docToAgenda(docSnap);
}

/**
 * Listen to institution-wide agendas in real-time
 * @param year - Academic year
 * @param callback - Function to call when data changes
 * @returns Unsubscribe function
 */
export function listenInstitutionalAgendas(
    year: string,
    callback: (agendas: AgendaDocumentWithId[]) => void
): Unsubscribe {
    const collectionPath = buildAgendasCollectionPath(year);
    const agendasRef = collection(firebaseFirestore, collectionPath);
    const q = query(agendasRef, orderBy('id', 'asc'));

    return onSnapshot(q, (snapshot) => {
        const agendas = snapshot.docs
            .map((docSnap) => docToAgenda(docSnap))
            .filter((a): a is AgendaDocumentWithId => a !== null);
        callback(agendas);
    });
}

// ============================================================================
// Read Operations - Department-specific Agendas
// ============================================================================

/**
 * Get all department-specific agendas
 * @param year - Academic year
 * @param department - Department name
 * @returns Array of agenda documents
 */
export async function getDepartmentAgendas(
    year: string,
    department: string
): Promise<AgendaDocumentWithId[]> {
    const collectionPath = buildDepartmentAgendasCollectionPath(year, department);
    const agendasRef = collection(firebaseFirestore, collectionPath);
    const q = query(agendasRef, orderBy('id', 'asc'));
    const snapshot = await getDocs(q);

    return snapshot.docs
        .map((docSnap) => docToAgenda(docSnap))
        .filter((a): a is AgendaDocumentWithId => a !== null);
}

/**
 * Get a specific department agenda
 * @param year - Academic year
 * @param department - Department name
 * @param agendaId - Agenda document ID
 * @returns Agenda document or null if not found
 */
export async function getDepartmentAgenda(
    year: string,
    department: string,
    agendaId: string
): Promise<AgendaDocumentWithId | null> {
    const docPath = buildDepartmentAgendaPath(year, department, agendaId);
    const docRef = doc(firebaseFirestore, docPath);
    const docSnap = await getDoc(docRef);
    return docToAgenda(docSnap);
}

/**
 * Listen to department-specific agendas in real-time
 * @param year - Academic year
 * @param department - Department name
 * @param callback - Function to call when data changes
 * @returns Unsubscribe function
 */
export function listenDepartmentAgendas(
    year: string,
    department: string,
    callback: (agendas: AgendaDocumentWithId[]) => void
): Unsubscribe {
    const collectionPath = buildDepartmentAgendasCollectionPath(year, department);
    const agendasRef = collection(firebaseFirestore, collectionPath);
    const q = query(agendasRef, orderBy('id', 'asc'));

    return onSnapshot(q, (snapshot) => {
        const agendas = snapshot.docs
            .map((docSnap) => docToAgenda(docSnap))
            .filter((a): a is AgendaDocumentWithId => a !== null);
        callback(agendas);
    });
}

// ============================================================================
// Create Operations
// ============================================================================

/**
 * Create a new institution-wide agenda
 * @param year - Academic year
 * @param data - Agenda data (id is optional, will be auto-generated if not provided)
 * @returns Created agenda document ID
 */
export async function createInstitutionalAgenda(
    year: string,
    data: Omit<AgendaDocument, 'createdAt' | 'updatedAt'>
): Promise<string> {
    // Get existing agendas to generate ID if needed
    let agendaId = data.id;
    if (!agendaId) {
        const existing = await getInstitutionalAgendas(year);
        agendaId = getNextThemeId(existing);
    }

    const docPath = buildAgendaPath(year, agendaId);
    const docRef = doc(firebaseFirestore, docPath);

    const agendaData = {
        id: agendaId,
        title: data.title,
        subThemes: data.subThemes || [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    await setDoc(docRef, agendaData);
    return agendaId;
}

/**
 * Create a new department-specific agenda
 * @param year - Academic year
 * @param department - Department name
 * @param data - Agenda data
 * @returns Created agenda document ID
 */
export async function createDepartmentAgenda(
    year: string,
    department: string,
    data: Omit<AgendaDocument, 'createdAt' | 'updatedAt'>
): Promise<string> {
    // Get existing agendas to generate ID if needed
    let agendaId = data.id;
    if (!agendaId) {
        const existing = await getDepartmentAgendas(year, department);
        agendaId = getNextThemeId(existing);
    }

    const docPath = buildDepartmentAgendaPath(year, department, agendaId);
    const docRef = doc(firebaseFirestore, docPath);

    const agendaData = {
        id: agendaId,
        title: data.title,
        subThemes: data.subThemes || [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    await setDoc(docRef, agendaData);
    return agendaId;
}

// ============================================================================
// Update Operations
// ============================================================================

/**
 * Update an institution-wide agenda
 * @param year - Academic year
 * @param agendaId - Agenda document ID
 * @param data - Partial agenda data to update
 */
export async function updateInstitutionalAgenda(
    year: string,
    agendaId: string,
    data: Partial<Pick<AgendaDocument, 'title' | 'subThemes'>>
): Promise<void> {
    const docPath = buildAgendaPath(year, agendaId);
    const docRef = doc(firebaseFirestore, docPath);

    await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp(),
    });
}

/**
 * Update a department-specific agenda
 * @param year - Academic year
 * @param department - Department name
 * @param agendaId - Agenda document ID
 * @param data - Partial agenda data to update
 */
export async function updateDepartmentAgenda(
    year: string,
    department: string,
    agendaId: string,
    data: Partial<Pick<AgendaDocument, 'title' | 'subThemes'>>
): Promise<void> {
    const docPath = buildDepartmentAgendaPath(year, department, agendaId);
    const docRef = doc(firebaseFirestore, docPath);

    await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp(),
    });
}

/**
 * Add a sub-theme to an institution-wide agenda
 * @param year - Academic year
 * @param agendaId - Agenda document ID
 * @param subTheme - Sub-theme to add
 */
export async function addInstitutionalSubTheme(
    year: string,
    agendaId: string,
    subTheme: string
): Promise<void> {
    const agenda = await getInstitutionalAgenda(year, agendaId);
    if (!agenda) throw new Error('Agenda not found');

    const updatedSubThemes = [...agenda.subThemes, subTheme];
    await updateInstitutionalAgenda(year, agendaId, { subThemes: updatedSubThemes });
}

/**
 * Remove a sub-theme from an institution-wide agenda
 * @param year - Academic year
 * @param agendaId - Agenda document ID
 * @param subThemeIndex - Index of sub-theme to remove
 */
export async function removeInstitutionalSubTheme(
    year: string,
    agendaId: string,
    subThemeIndex: number
): Promise<void> {
    const agenda = await getInstitutionalAgenda(year, agendaId);
    if (!agenda) throw new Error('Agenda not found');

    const updatedSubThemes = agenda.subThemes.filter((_, i) => i !== subThemeIndex);
    await updateInstitutionalAgenda(year, agendaId, { subThemes: updatedSubThemes });
}

/**
 * Add a sub-theme to a department-specific agenda
 * @param year - Academic year
 * @param department - Department name
 * @param agendaId - Agenda document ID
 * @param subTheme - Sub-theme to add
 */
export async function addDepartmentSubTheme(
    year: string,
    department: string,
    agendaId: string,
    subTheme: string
): Promise<void> {
    const agenda = await getDepartmentAgenda(year, department, agendaId);
    if (!agenda) throw new Error('Agenda not found');

    const updatedSubThemes = [...agenda.subThemes, subTheme];
    await updateDepartmentAgenda(year, department, agendaId, { subThemes: updatedSubThemes });
}

/**
 * Remove a sub-theme from a department-specific agenda
 * @param year - Academic year
 * @param department - Department name
 * @param agendaId - Agenda document ID
 * @param subThemeIndex - Index of sub-theme to remove
 */
export async function removeDepartmentSubTheme(
    year: string,
    department: string,
    agendaId: string,
    subThemeIndex: number
): Promise<void> {
    const agenda = await getDepartmentAgenda(year, department, agendaId);
    if (!agenda) throw new Error('Agenda not found');

    const updatedSubThemes = agenda.subThemes.filter((_, i) => i !== subThemeIndex);
    await updateDepartmentAgenda(year, department, agendaId, { subThemes: updatedSubThemes });
}

// ============================================================================
// Delete Operations
// ============================================================================

/**
 * Delete an institution-wide agenda
 * @param year - Academic year
 * @param agendaId - Agenda document ID
 */
export async function deleteInstitutionalAgenda(
    year: string,
    agendaId: string
): Promise<void> {
    const docPath = buildAgendaPath(year, agendaId);
    const docRef = doc(firebaseFirestore, docPath);
    await deleteDoc(docRef);
}

/**
 * Delete a department-specific agenda
 * @param year - Academic year
 * @param department - Department name
 * @param agendaId - Agenda document ID
 */
export async function deleteDepartmentAgenda(
    year: string,
    department: string,
    agendaId: string
): Promise<void> {
    const docPath = buildDepartmentAgendaPath(year, department, agendaId);
    const docRef = doc(firebaseFirestore, docPath);
    await deleteDoc(docRef);
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Seed institution-wide agendas from JSON data
 * @param year - Academic year
 * @param agendas - Array of agenda data to seed
 */
export async function seedInstitutionalAgendas(
    year: string,
    agendas: Omit<AgendaDocument, 'createdAt' | 'updatedAt'>[]
): Promise<void> {
    const batch = writeBatch(firebaseFirestore);

    for (const agenda of agendas) {
        const docPath = buildAgendaPath(year, agenda.id);
        const docRef = doc(firebaseFirestore, docPath);
        batch.set(docRef, {
            id: agenda.id,
            title: agenda.title,
            subThemes: agenda.subThemes || [],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
    }

    await batch.commit();
}

/**
 * Seed department-specific agendas from JSON data
 * @param year - Academic year
 * @param department - Department name
 * @param agendas - Array of agenda data to seed
 */
export async function seedDepartmentAgendas(
    year: string,
    department: string,
    agendas: Omit<AgendaDocument, 'createdAt' | 'updatedAt'>[]
): Promise<void> {
    const batch = writeBatch(firebaseFirestore);

    for (const agenda of agendas) {
        const docPath = buildDepartmentAgendaPath(year, department, agenda.id);
        const docRef = doc(firebaseFirestore, docPath);
        batch.set(docRef, {
            id: agenda.id,
            title: agenda.title,
            subThemes: agenda.subThemes || [],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
    }

    await batch.commit();
}

/**
 * Clear all institution-wide agendas for a year
 * @param year - Academic year
 */
export async function clearInstitutionalAgendas(year: string): Promise<void> {
    const agendas = await getInstitutionalAgendas(year);
    const batch = writeBatch(firebaseFirestore);

    for (const agenda of agendas) {
        const docPath = buildAgendaPath(year, agenda.docId);
        const docRef = doc(firebaseFirestore, docPath);
        batch.delete(docRef);
    }

    await batch.commit();
}

/**
 * Clear all department-specific agendas for a department
 * @param year - Academic year
 * @param department - Department name
 */
export async function clearDepartmentAgendas(
    year: string,
    department: string
): Promise<void> {
    const agendas = await getDepartmentAgendas(year, department);
    const batch = writeBatch(firebaseFirestore);

    for (const agenda of agendas) {
        const docPath = buildDepartmentAgendaPath(year, department, agenda.docId);
        const docRef = doc(firebaseFirestore, docPath);
        batch.delete(docRef);
    }

    await batch.commit();
}

// ============================================================================
// Unified Interface
// ============================================================================

/**
 * Get agendas based on scope
 * @param scope - 'institutional' or 'department'
 * @param year - Academic year
 * @param department - Department name (required for department scope)
 */
export async function getAgendas(
    scope: AgendaScope,
    year: string = DEFAULT_YEAR,
    department?: string
): Promise<AgendaDocumentWithId[]> {
    if (scope === 'institutional') {
        return getInstitutionalAgendas(year);
    }
    if (!department) {
        throw new Error('Department is required for department-specific agendas');
    }
    return getDepartmentAgendas(year, department);
}

/**
 * Listen to agendas based on scope
 * @param scope - 'institutional' or 'department'
 * @param year - Academic year
 * @param callback - Function to call when data changes
 * @param department - Department name (required for department scope)
 */
export function listenAgendas(
    scope: AgendaScope,
    year: string,
    callback: (agendas: AgendaDocumentWithId[]) => void,
    department?: string
): Unsubscribe {
    if (scope === 'institutional') {
        return listenInstitutionalAgendas(year, callback);
    }
    if (!department) {
        throw new Error('Department is required for department-specific agendas');
    }
    return listenDepartmentAgendas(year, department, callback);
}
