import {
    collection,
    doc,
    getDocs,
    getDoc,
    setDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    updateDoc,
    serverTimestamp,
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import { cleanData } from './firestore';
import type { FormTemplate } from '../../../types/forms';

const COLLECTION_NAME = 'formTemplates';

/**
 * Get all form templates
 */
export async function getAllFormTemplates(): Promise<FormTemplate[]> {
    try {
        const formsRef = collection(firebaseFirestore, COLLECTION_NAME);
        const snapshot = await getDocs(query(formsRef, orderBy('createdAt', 'desc')));

        return snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
                updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
            } as FormTemplate;
        });
    } catch (error) {
        console.error('Error getting form templates:', error);
        throw new Error('Failed to fetch form templates');
    }
}

/**
 * Get a specific form template by ID
 */
export async function getFormTemplateById(formId: string): Promise<FormTemplate | null> {
    try {
        const formRef = doc(firebaseFirestore, COLLECTION_NAME, formId);
        const snapshot = await getDoc(formRef);

        if (!snapshot.exists()) {
            return null;
        }

        const data = snapshot.data();
        return {
            id: snapshot.id,
            ...data,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        } as FormTemplate;
    } catch (error) {
        console.error('Error getting form template:', error);
        throw new Error('Failed to fetch form template');
    }
}

/**
 * Get form templates by status
 */
export async function getFormTemplatesByStatus(status: FormTemplate['status']): Promise<FormTemplate[]> {
    try {
        const formsRef = collection(firebaseFirestore, COLLECTION_NAME);
        const q = query(formsRef, where('status', '==', status), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);

        return snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
                updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
            } as FormTemplate;
        });
    } catch (error) {
        console.error('Error getting form templates by status:', error);
        throw new Error('Failed to fetch form templates by status');
    }
}

/**
 * Get form templates by audience
 */
export async function getFormTemplatesByAudience(audience: FormTemplate['audience']): Promise<FormTemplate[]> {
    try {
        const formsRef = collection(firebaseFirestore, COLLECTION_NAME);
        const q = query(formsRef, where('audience', '==', audience), orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);

        return snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
                updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
            } as FormTemplate;
        });
    } catch (error) {
        console.error('Error getting form templates by audience:', error);
        throw new Error('Failed to fetch form templates by audience');
    }
}

/**
 * Create a new form template
 */
export async function createFormTemplate(
    form: Omit<FormTemplate, 'id' | 'createdAt' | 'updatedAt'>
): Promise<FormTemplate> {
    try {
        const formsRef = collection(firebaseFirestore, COLLECTION_NAME);
        const newFormRef = doc(formsRef);

        // Clean data to remove undefined, null, and empty values (create mode)
        const cleanedForm = cleanData({
            ...form,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        }, 'create');

        await setDoc(newFormRef, cleanedForm);

        return {
            id: newFormRef.id,
            ...form,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
    } catch (error) {
        console.error('Error creating form template:', error);
        throw new Error('Failed to create form template');
    }
}

/**
 * Update an existing form template
 */
export async function updateFormTemplate(formId: string, updates: Partial<FormTemplate>): Promise<void> {
    try {
        const formRef = doc(firebaseFirestore, COLLECTION_NAME, formId);

        // Remove id, createdAt from updates
        const { id, createdAt, ...updateData } = updates as Partial<FormTemplate>;

        // Clean data: remove undefined (keep null to delete fields in update mode)
        const cleanedData = cleanData({
            ...updateData,
            updatedAt: serverTimestamp(),
        }, 'update');

        await updateDoc(formRef, cleanedData);
    } catch (error) {
        console.error('Error updating form template:', error);
        throw new Error('Failed to update form template');
    }
}

/**
 * Delete a form template
 */
export async function deleteFormTemplate(formId: string): Promise<void> {
    try {
        const formRef = doc(firebaseFirestore, COLLECTION_NAME, formId);
        await deleteDoc(formRef);
    } catch (error) {
        console.error('Error deleting form template:', error);
        throw new Error('Failed to delete form template');
    }
}

/**
 * Set a form template document (for imports)
 */
export async function setFormTemplate(formId: string, form: FormTemplate): Promise<void> {
    try {
        const formRef = doc(firebaseFirestore, COLLECTION_NAME, formId);

        const formData: Record<string, unknown> = {
            ...form,
            updatedAt: serverTimestamp(),
        };

        // If no createdAt, add it
        if (!form.createdAt) {
            formData.createdAt = serverTimestamp();
        }

        // Clean data to remove undefined values (create mode)
        const cleanedData = cleanData(formData, 'create');

        await setDoc(formRef, cleanedData);
    } catch (error) {
        console.error('Error setting form template:', error);
        throw new Error('Failed to set form template');
    }
}
