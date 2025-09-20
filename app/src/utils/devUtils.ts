import { buildRoutes } from './navBuilder';

// Store the current routes for dev access
let currentRoutes: any[] = [];
let currentRouter: any = null;
let currentAppTheme: any = null;

/**
 * Store the current routes for development access
 */
export function setCurrentRoutes(routes: any[]) {
    currentRoutes = routes;
}

/**
 * Store the current router for development access
 */
export function setCurrentRouter(router: any) {
    currentRouter = router;
}

/**
 * Store the current AppTheme for development access
 */
export function setCurrentAppTheme(theme: any) {
    currentAppTheme = theme;
}

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
 * Get environment info for debugging
 * 
 * @returns {object} Object containing environment detection details
 */
export function getEnvironmentInfo() {
    const info = {
        isDevelopment: isDevelopmentEnvironment(),
        hostname: typeof window !== 'undefined' ? window.location.hostname : 'unknown',
        environment: {
            DEV: import.meta.env.DEV,
            MODE: import.meta.env.MODE,
            PROD: import.meta.env.PROD,
            VITE_SHOW_DEV_FEATURES: import.meta.env.VITE_SHOW_DEV_FEATURES
        }
    };
    console.log('Environment Info:', info);
    return info;
}

export async function rebuildRoutes() {
    if (!isDevelopmentEnvironment()) {
        return console.warn('Rebuilding routes is only available in development mode.');
    }

    try {
        const routes = await buildRoutes();
        console.log('Built routes:', routes);
        setCurrentRoutes(routes);
        return routes;
    } catch (error) {
        return console.error('Failed to rebuild routes:', error);
    }
}

/**
 * Get the current routes without rebuilding
 */
export function getCurrentRoutes() {
    if (currentRoutes.length === 0) {
        return console.warn('No routes cached. Consider calling rebuildRoutes() to build them.');
    }
    console.log('Current cached routes:', currentRoutes);
    return currentRoutes;
}

/**
 * Get the current router instance
 */
export function getCurrentRouter() {
    if (!currentRouter) {
        return console.warn('No router instance cached. It may not have been initialized yet.');
    }
    console.log('Current router:', currentRouter);
    return currentRouter;
}

/**
 * Get current AppTheme
 */
export function getCurrentAppTheme() {
    if (!currentAppTheme) {
        return console.warn('No AppTheme instance cached. It may not have been initialized yet.');
    }
    console.log('Current AppTheme:', currentAppTheme);
    return currentAppTheme;
}


/**
 * Make dev utilities globally accessible in the browser console
 */
export function attachDevUtilsToWindow() {
    if (typeof window === 'undefined') return;

    const baseUtils = {
        isDevelopmentEnvironment,
        getEnvironmentInfo,
        getCurrentRoutes,
        getCurrentRouter,
        getCurrentAppTheme,
    };

    const devOnlyUtils = isDevelopmentEnvironment() ? {
        rebuildRoutes
    } : {};

    (window as any).devUtils = {
        ...(window as any).devUtils,
        ...baseUtils,
        ...devOnlyUtils,
    };
}
