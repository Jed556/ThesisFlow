/**
 * Firestore helpers for salary distribution tracking (PSRF workflow).
 * 
 * Salary records are stored under user documents at three scope levels:
 * - Year: year/{year}/users/{userId}/salary/{salaryId}
 * - Department: year/{year}/departments/{dept}/users/{userId}/salary/{salaryId}
 * - Course: year/{year}/departments/{dept}/courses/{course}/users/{userId}/salary/{salaryId}
 */

import {
    arrayUnion,
    collection,
    doc,
    getDocs,
    onSnapshot,
    orderBy,
    query,
    setDoc,
    updateDoc,
    where,
    type DocumentData,
    type DocumentSnapshot,
    type QueryConstraint,
    type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import { cleanData } from './firestore';
import {
    buildYearUserSalaryCollectionPath,
    buildYearUserSalaryDocPath,
    buildDepartmentUserSalaryCollectionPath,
    buildDepartmentUserSalaryDocPath,
    buildCourseUserSalaryCollectionPath,
    buildCourseUserSalaryDocPath,
} from './paths';
import type {
    SalaryDistribution,
    SalaryDistributionDraft,
    SalaryRole,
    SalaryStatus,
    SalaryStatusEvent,
} from '../../../types/salary';

// ============================================================================
// Salary Scope Types
// ============================================================================

/** Scope for year-level users (e.g., admin, developer) */
export interface SalaryScopeYear {
    type: 'year';
    year: string;
    userId: string;
}

/** Scope for department-level users */
export interface SalaryScopeDepartment {
    type: 'department';
    year: string;
    department: string;
    userId: string;
}

/** Scope for course-level users */
export interface SalaryScopeCourse {
    type: 'course';
    year: string;
    department: string;
    course: string;
    userId: string;
}

/** Union type for all salary scopes */
export type SalaryScope = SalaryScopeYear | SalaryScopeDepartment | SalaryScopeCourse;

// ============================================================================
// Path Resolution Helpers
// ============================================================================

/**
 * Resolve the salary collection path based on the scope
 */
function resolveSalaryCollectionPath(scope: SalaryScope): string {
    switch (scope.type) {
        case 'year':
            return buildYearUserSalaryCollectionPath(scope.year, scope.userId);
        case 'department':
            return buildDepartmentUserSalaryCollectionPath(scope.year, scope.department, scope.userId);
        case 'course':
            return buildCourseUserSalaryCollectionPath(
                scope.year, scope.department, scope.course, scope.userId
            );
    }
}

/**
 * Resolve the salary document path based on the scope
 */
function resolveSalaryDocPath(scope: SalaryScope, salaryId: string): string {
    switch (scope.type) {
        case 'year':
            return buildYearUserSalaryDocPath(scope.year, scope.userId, salaryId);
        case 'department':
            return buildDepartmentUserSalaryDocPath(
                scope.year, scope.department, scope.userId, salaryId
            );
        case 'course':
            return buildCourseUserSalaryDocPath(
                scope.year, scope.department, scope.course, scope.userId, salaryId
            );
    }
}

// ============================================================================
// Document Conversion
// ============================================================================

function docToSalary(
    snapshot: QueryDocumentSnapshot<DocumentData> | DocumentSnapshot<DocumentData>,
    scope: SalaryScope,
): SalaryDistribution | null {
    if (!snapshot.exists()) {
        return null;
    }
    const data = snapshot.data() ?? {};
    const history = Array.isArray(data.history)
        ? data.history as SalaryStatusEvent[]
        : undefined;
    return {
        id: snapshot.id,
        year: scope.year,
        role: data.role,
        userUid: scope.userId,
        userName: data.userName ?? undefined,
        amount: Number(data.amount ?? 0),
        currency: data.currency ?? undefined,
        psrfNumber: data.psrfNumber ?? undefined,
        period: data.period ?? '',
        status: data.status ?? 'psrf_pending',
        distributedAt: data.distributedAt ?? undefined,
        distributedBy: data.distributedBy ?? undefined,
        receivedAt: data.receivedAt ?? undefined,
        receivedBy: data.receivedBy ?? undefined,
        remarks: data.remarks ?? undefined,
        createdAt: data.createdAt ?? new Date().toISOString(),
        updatedAt: data.updatedAt ?? new Date().toISOString(),
        history,
    } satisfies SalaryDistribution;
}

// ============================================================================
// Query Building
// ============================================================================

export interface SalaryFilters {
    role?: SalaryRole | SalaryRole[];
    status?: SalaryStatus | SalaryStatus[];
    period?: string;
}

function buildSalaryQuery(
    scope: SalaryScope,
    filters?: SalaryFilters,
): [ReturnType<typeof collection>, QueryConstraint[]] {
    const collPath = resolveSalaryCollectionPath(scope);
    const collRef = collection(firebaseFirestore, collPath);
    const constraints: QueryConstraint[] = [];

    if (filters?.role) {
        if (Array.isArray(filters.role)) {
            const roles = filters.role.filter(Boolean);
            if (roles.length > 0) {
                constraints.push(where('role', 'in', roles));
            }
        } else {
            constraints.push(where('role', '==', filters.role));
        }
    }

    if (filters?.status) {
        if (Array.isArray(filters.status)) {
            const statuses = filters.status.filter(Boolean);
            if (statuses.length > 0) {
                constraints.push(where('status', 'in', statuses));
            }
        } else {
            constraints.push(where('status', '==', filters.status));
        }
    }

    if (filters?.period) {
        constraints.push(where('period', '==', filters.period));
    }

    constraints.push(orderBy('createdAt', 'desc'));

    return [collRef, constraints];
}

// ============================================================================
// Fetching & Listening
// ============================================================================

/**
 * Fetch salary distributions for a user at the specified scope
 */
export async function getSalaryDistributions(
    scope: SalaryScope,
    filters?: SalaryFilters,
): Promise<SalaryDistribution[]> {
    const [collRef, constraints] = buildSalaryQuery(scope, filters);
    const q = constraints.length > 0 ? query(collRef, ...constraints) : collRef;
    const snapshot = await getDocs(q);
    return snapshot.docs
        .map((docSnap) => docToSalary(docSnap, scope))
        .filter((salary): salary is SalaryDistribution => salary !== null);
}

export interface SalaryListenerOptions {
    onData: (records: SalaryDistribution[]) => void;
    onError?: (error: Error) => void;
}

/**
 * Listen for real-time salary distribution updates for a user at the specified scope
 */
export function listenSalaryDistributions(
    scope: SalaryScope,
    options: SalaryListenerOptions,
    filters?: SalaryFilters,
): () => void {
    const { onData, onError } = options;
    const [collRef, constraints] = buildSalaryQuery(scope, filters);
    const q = constraints.length > 0 ? query(collRef, ...constraints) : collRef;

    return onSnapshot(
        q,
        (snapshot) => {
            const records = snapshot.docs
                .map((docSnap) => docToSalary(docSnap, scope))
                .filter((salary): salary is SalaryDistribution => salary !== null);
            onData(records);
        },
        (error) => {
            if (onError) {
                onError(error as Error);
            } else {
                console.error('Salary listener error:', error);
            }
        }
    );
}

// ============================================================================
// History Event Creation
// ============================================================================

function createHistoryEvent(
    status: SalaryStatus,
    actorUid: string,
    note?: string,
): SalaryStatusEvent {
    const entryId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    return cleanData({
        id: entryId,
        status,
        changedBy: actorUid,
        changedAt: new Date().toISOString(),
        note,
    }, 'create') as SalaryStatusEvent;
}

// ============================================================================
// CRUD Operations
// ============================================================================

export interface CreateSalaryDistributionPayload extends SalaryDistributionDraft {
    createdBy: string;
}

/**
 * Create a new salary distribution record for a user at the specified scope
 */
export async function createSalaryDistribution(
    scope: SalaryScope,
    payload: CreateSalaryDistributionPayload,
): Promise<string> {
    const collPath = resolveSalaryCollectionPath(scope);
    const collRef = collection(firebaseFirestore, collPath);
    const newDocRef = doc(collRef);

    const now = new Date().toISOString();
    await setDoc(newDocRef, {
        ...cleanData({
            role: payload.role,
            userName: payload.userName,
            amount: payload.amount,
            currency: payload.currency ?? 'PHP',
            psrfNumber: payload.psrfNumber,
            period: payload.period,
            status: 'psrf_pending',
            remarks: payload.remarks,
            history: [createHistoryEvent('psrf_pending', payload.createdBy, 'Created record')],
            createdAt: now,
            updatedAt: now,
        }, 'create'),
    });

    return newDocRef.id;
}

export interface MarkDistributedPayload {
    salaryId: string;
    adminUid: string;
    psrfNumber?: string;
    note?: string;
}

/**
 * Mark a salary record as distributed (PSRF released)
 */
export async function markSalaryDistributed(
    scope: SalaryScope,
    payload: MarkDistributedPayload,
): Promise<void> {
    const docPath = resolveSalaryDocPath(scope, payload.salaryId);
    const ref = doc(firebaseFirestore, docPath);
    const now = new Date().toISOString();
    await updateDoc(ref, {
        ...cleanData({
            status: 'distributed',
            psrfNumber: payload.psrfNumber,
            distributedAt: now,
            distributedBy: payload.adminUid,
            updatedAt: now,
        }, 'update'),
        history: arrayUnion(
            createHistoryEvent('distributed', payload.adminUid, payload.note ?? 'PSRF released')
        ),
    });
}

export interface MarkReceivedPayload {
    salaryId: string;
    userUid: string;
    note?: string;
}

/**
 * Mark a salary record as received by the expert
 */
export async function markSalaryReceived(
    scope: SalaryScope,
    payload: MarkReceivedPayload,
): Promise<void> {
    const docPath = resolveSalaryDocPath(scope, payload.salaryId);
    const ref = doc(firebaseFirestore, docPath);
    const now = new Date().toISOString();
    await updateDoc(ref, {
        ...cleanData({
            status: 'received',
            receivedAt: now,
            receivedBy: payload.userUid,
            updatedAt: now,
        }, 'update'),
        history: arrayUnion(
            createHistoryEvent('received', payload.userUid, payload.note ?? 'Acknowledged by expert')
        ),
    });
}
