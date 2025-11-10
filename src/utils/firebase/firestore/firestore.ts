/**
 * Clean up data by removing undefined, null, and empty string values.
 * This prevents Firestore validation errors when saving documents with optional fields.
 * 
 * @param data - Object to clean
 * @returns Cleaned object with only populated fields
 */
export function cleanData<T extends object>(data: T): Partial<T> {
    const cleaned: Partial<T> = {};

    for (const key of Object.keys(data) as (keyof T)[]) {
        const value = data[key];
        // Keep the value if it's not null, not undefined, and not an empty string
        if (value !== null && value !== undefined && value !== '') {
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
    }

    return cleaned;
}
