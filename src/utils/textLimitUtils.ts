/**
 * Utility functions for text limit handling (words and characters).
 * Provides consistent text limiting across the application.
 */

/**
 * Count words in a string.
 * @param text - The text to count words in
 * @returns The number of words
 */
export function countWords(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Limit text to a maximum number of words.
 * @param text - The input text
 * @param maxWords - Maximum number of words allowed
 * @returns The text limited to maxWords
 */
export function limitWords(text: string, maxWords: number): string {
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length <= maxWords) {
        return text;
    }
    return words.slice(0, maxWords).join(' ');
}

/**
 * Limit text to a maximum number of characters.
 * @param text - The input text
 * @param maxChars - Maximum number of characters allowed
 * @returns The text limited to maxChars
 */
export function limitChars(text: string, maxChars: number): string {
    return text.slice(0, maxChars);
}

/**
 * Generate helper text showing word count with limit.
 * @param text - The current text
 * @param maxWords - Maximum number of words allowed
 * @returns Helper text string (e.g., "5/20 words")
 */
export function wordLimitHelperText(text: string, maxWords: number): string {
    return `${countWords(text)}/${maxWords} words`;
}

/**
 * Generate helper text showing character count with limit.
 * @param text - The current text
 * @param maxChars - Maximum number of characters allowed
 * @returns Helper text string (e.g., "150/500")
 */
export function charLimitHelperText(text: string, maxChars: number): string {
    return `${text.length}/${maxChars}`;
}

/**
 * Check if text exceeds word limit.
 * @param text - The text to check
 * @param maxWords - Maximum number of words allowed
 * @returns True if word count exceeds limit
 */
export function exceedsWordLimit(text: string, maxWords: number): boolean {
    return countWords(text) > maxWords;
}

/**
 * Check if text exceeds character limit.
 * @param text - The text to check
 * @param maxChars - Maximum number of characters allowed
 * @returns True if character count exceeds limit
 */
export function exceedsCharLimit(text: string, maxChars: number): boolean {
    return text.length > maxChars;
}
