/**
 * Clean up data by removing undefined, null, and empty string values.
 * This prevents Firestore validation errors when saving documents with optional fields.
 * 
 * @param data - Object to clean
 * @returns Cleaned object with only populated fields
 */
export function cleanData<T extends Record<string, any>>(data: T): Partial<T> {
    const cleaned: any = {};

    for (const [key, value] of Object.entries(data)) {
        // Keep the value if it's not null, not undefined, and not an empty string
        if (value !== null && value !== undefined && value !== '') {
            cleaned[key] = value;
        }
    }

    return cleaned as Partial<T>;
}