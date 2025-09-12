/**
 * Check if the current environment should be treated as development
 * 
 * @returns {boolean} True if in development environment
 */
export function isDevelopmentEnvironment(): boolean {
    return !import.meta.env.PROD || import.meta.env.VITE_SHOW_DEV_FEATURES === 'true' ||
        import.meta.env.MODE === 'development' || import.meta.env.MODE === 'preview' || import.meta.env.MODE === 'test';
}

/**
 * Get development environment info for debugging
 * 
 * @returns {object} Object containing environment detection details
 */
export function getDevelopmentInfo() {
    return {
        isDevelopment: isDevelopmentEnvironment(),
        hostname: typeof window !== 'undefined' ? window.location.hostname : 'unknown',
        environment: {
            DEV: import.meta.env.DEV,
            MODE: import.meta.env.MODE,
            PROD: import.meta.env.PROD,
            VITE_SHOW_DEV_FEATURES: import.meta.env.VITE_SHOW_DEV_FEATURES
        }
    };
}

/**
 * Log development environment info to console (development only)
 */
export function logDevelopmentInfo() {
    if (isDevelopmentEnvironment() && typeof console !== 'undefined') {
        console.log('🔧 Development Environment Info:', getDevelopmentInfo());
    }
}
