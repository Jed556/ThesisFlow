/**
 * Check if the current environment should be treated as development
 * 
 * @returns {boolean} True if in development environment
 */
export function isDevelopmentEnvironment(): boolean {
    // Local development check (Vite dev server)
    const isLocalDev = !import.meta.env.PROD;

    // Custom environment variable for forcing development mode
    const isForceDevMode = import.meta.env.VITE_SHOW_DEV_FEATURES === 'true';

    // Domain-based detection for common development/preview platforms
    // const isDevelopmentDomain = typeof window !== 'undefined' && (
    //     window.location.hostname === 'localhost' ||
    //     window.location.hostname === '127.0.0.1' ||
    //     window.location.hostname.includes('vercel.app') ||
    //     window.location.hostname.includes('netlify.app') ||
    //     window.location.hostname.includes('preview') ||
    //     window.location.hostname.includes('staging') ||
    //     window.location.hostname.includes('dev.') ||
    //     window.location.hostname.startsWith('dev-')
    // );

    return isLocalDev || isForceDevMode; // || isDevelopmentDomain;
}

/**
 * Check if the current environment is specifically local development
 * 
 * @returns {boolean} True if running on local development server
 */
export function isLocalDevelopment(): boolean {
    return import.meta.env.DEV &&
        import.meta.env.MODE === 'development' &&
        !import.meta.env.PROD;
}

/**
 * Check if the current environment is a preview deployment
 * 
 * @returns {boolean} True if running on preview/staging environment
 */
// export function isPreviewEnvironment(): boolean {
//     if (typeof window === 'undefined') return false;

//     return window.location.hostname.includes('vercel.app') ||
//         window.location.hostname.includes('netlify.app') ||
//         window.location.hostname.includes('preview') ||
//         window.location.hostname.includes('staging');
// }

/**
 * Get development environment info for debugging
 * 
 * @returns {object} Object containing environment detection details
 */
export function getDevelopmentInfo() {
    return {
        isDevelopment: isDevelopmentEnvironment(),
        isLocal: isLocalDevelopment(),
        // isPreview: isPreviewEnvironment(),
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
