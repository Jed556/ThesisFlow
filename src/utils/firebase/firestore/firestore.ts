/**
 * Clean up data by removing undefined values and optionally null values.
 * This prevents Firestore validation errors when saving documents.
 * 
 * **Firestore rules:**
 * - `undefined` is NEVER allowed in Firestore and must be removed
 * - `null` when updating with merge:true will DELETE the field
 * - `null` when creating is stored as null value
 * 
 * @param data - Object to clean
 * @param mode - 'create' removes null/undefined/empty, 'update' only removes undefined (keeps null for deletion)
 * @returns Cleaned object with only valid Firestore fields
 */
export function cleanData<T extends object>(data: T, mode: 'create' | 'update' = 'create'): Partial<T> {
    const cleaned: Partial<T> = {};

    for (const key of Object.keys(data) as (keyof T)[]) {
        const value = data[key];

        // Always remove undefined - Firestore doesn't support it
        if (value === undefined) {
            continue;
        }

        if (mode === 'create') {
            // For create: remove null, undefined, and empty strings
            if (value !== null && value !== '') {
                // Special handling for arrays: filter out empty elements
                if (Array.isArray(value)) {
                    const filteredArray = value.filter(item =>
                        item !== null && item !== undefined && item !== ''
                    );
                    if (filteredArray.length > 0) {
                        cleaned[key] = filteredArray as T[keyof T];
                    }
                } else {
                    cleaned[key] = value;
                }
            }
        } else {
            // For update: keep null (to delete fields), remove undefined and empty strings
            if (value !== '') {
                // Special handling for arrays: filter out undefined elements but keep null
                if (Array.isArray(value)) {
                    const filteredArray = value.filter(item => item !== undefined && item !== '');
                    if (filteredArray.length > 0) {
                        cleaned[key] = filteredArray as T[keyof T];
                    }
                } else {
                    cleaned[key] = value;
                }
            }
        }
    }

    return cleaned;
}
