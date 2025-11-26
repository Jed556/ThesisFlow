import * as React from 'react';
import type { Navigation } from '@toolpad/core/AppProvider';
import type { RouteObject } from 'react-router';
import type { NavigationItem, NavigationGroup } from '../types/navigation';
import { hasRoleAccess } from './roleUtils';
import type { UserRole } from '../types/profile';
import Layout from '../layouts/Layout';
import ErrorBoundary from '../layouts/ErrorBoundary';
import NotFoundPage from '../layouts/NotFoundPage';
import { isDevelopmentEnvironment } from './devUtils';

// Type for page module with metadata
interface PageModule {
    default: React.ComponentType;
    metadata: NavigationItem;
}

// Dynamic page registry
let PAGE_REGISTRY: Record<string, PageModule> = {};

/**
 *  Dynamically import and register a page module
 */
async function importPageModule(pageName: string): Promise<PageModule | null> {
    try {
        // Handle both flat and nested page paths
        const module = await import(`../pages/${pageName}.tsx`);
        if (module.default && module.metadata) {
            return {
                default: module.default,
                metadata: module.metadata,
            };
        }
        console.warn(`Page ${pageName} missing default export or metadata`);
        return null;
    } catch (error) {
        console.warn(`Failed to import page ${pageName}:`, error);
        return null;
    }
}

/**
 * Discover and load all pages from the pages directory
 */
async function discoverPages(): Promise<void> {
    // Get all page files from the pages directory and subdirectories
    // Using import.meta.glob for dynamic imports with Vite
    const pageModules = import.meta.glob('../pages/**/*.tsx', { eager: false });

    const loadPromises = Object.keys(pageModules).map(async (path) => {
        // Extract the page name from the full path, preserving folder structure
        const pageName = path.replace('../pages/', '').replace('.tsx', '');

        try {
            const module = await pageModules[path]();
            if (module && typeof module === 'object' && 'default' in module && 'metadata' in module) {
                const segment = resolveSegment(module.metadata as NavigationItem);
                if (segment && segment.toLowerCase().startsWith('api/')) {
                    if (isDevelopmentEnvironment())
                        console.warn(`Skipping page ${pageName} because it resolves to API route segment "${segment}"`);
                    return;
                }
                PAGE_REGISTRY[pageName] = {
                    default: module.default as React.ComponentType,
                    metadata: module.metadata as NavigationItem,
                };
            } else {
                console.warn(`Page ${pageName} missing required exports:`, module);
            }
        } catch (error) {
            console.warn(`Failed to load page ${pageName}:`, error);
        }
    });

    await Promise.all(loadPromises);
}

// Honor env flag to allow showing the dev-helper page only when explicitly enabled
const DEV_HELPER_USERNAME = import.meta.env.VITE_DEV_HELPER_USERNAME || '';
const DEV_HELPER_PASSWORD = import.meta.env.VITE_DEV_HELPER_PASSWORD || '';
const DEV_HELPER_ENABLED = (import.meta.env.VITE_DEV_HELPER_ENABLED === 'true') &&
    DEV_HELPER_USERNAME !== '' &&
    DEV_HELPER_PASSWORD !== '';

/**
 * 
 * @param metadata Optional NavigationItem metadata to check
 * @returns true if the page should be hidden, false otherwise
 */
function isHidden(metadata?: NavigationItem) {
    if (!metadata) return false;
    // If the page is marked hidden, allow opt-in for the dev-helper when env flag is set
    if (metadata.hidden) {
        if (DEV_HELPER_ENABLED) {
            const seg = resolveSegment(metadata);
            // allow any page under dev/ when dev helper enabled
            if (seg && seg.startsWith('dev/')) {
                return false;
            }
        }
        return true;
    }
    return false;
}

/**
 * Initialize the page registry
 */
let registryInitialized = false;
async function initializeRegistry(): Promise<void> {
    if (!registryInitialized) {
        await discoverPages();
        registryInitialized = true;
    }
}

/**
 * Return the canonical segment/path for a page metadata.
 * Use this instead of repeating `metadata.path || metadata.segment`.
 * Removes any leading slash and any trailing slashes (e.g. '/dashboard/me/' -> 'dashboard/me').
 */
export function resolveSegment(metadata?: NavigationItem): string | undefined {
    const seg = metadata ? (metadata.path ?? metadata.segment) : undefined;
    if (seg == null) return undefined;
    // Remove leading and trailing slashes. If original was "/", this yields '' (empty string).
    return seg.replace(/^\/+|\/+$/g, '');
}

/**
 * Groups navigation items by their group property, supporting both segment and title-based grouping
 */
function groupNavigationItems(pages: NavigationItem[], navigationGroups: NavigationGroup[]): Record<string, NavigationItem[]> {
    const groups: Record<string, NavigationItem[]> = {};

    // Create a mapping from group title/segment to the preferred grouping key
    const groupKeyMap = new Map<string, string>();
    navigationGroups.forEach(group => {
        const groupKey = group.segment || group.title;
        // Map both title and segment to the same key for flexibility
        groupKeyMap.set(group.title, groupKey);
        if (group.segment) {
            groupKeyMap.set(group.segment, groupKey);
        }
    });

    pages.forEach(page => {
        const pageGroup = page.group || 'default';
        const groupKey = groupKeyMap.get(pageGroup) || pageGroup;

        if (!groups[groupKey]) {
            groups[groupKey] = [];
        }
        groups[groupKey].push(page);
    });

    return groups;
}

/**
 * Converts NavigationItem to Toolpad Navigation format
 */
function convertToToolpadNavigation(metadata: NavigationItem, userRole?: UserRole): Navigation[0] {
    const baseItem: any = {
        segment: resolveSegment(metadata),
        title: metadata.title,
        icon: metadata.icon,
    };

    // Add children if they exist
    if (metadata.children && metadata.children.length > 0) {
        const visibleChildren = metadata.children
            .map(childSegment => {
                const childPage = Object.values(PAGE_REGISTRY).find(
                    page => page.metadata.segment === childSegment
                );
                return childPage;
            })
            .filter(childPage => {
                if (!childPage || isHidden(childPage.metadata)) {
                    return false;
                }
                // Filter by role access
                if (userRole && childPage.metadata.roles) {
                    return hasRoleAccess(userRole, childPage.metadata.roles);
                }
                return true;
            })
            .map(childPage => convertToToolpadNavigation(childPage!.metadata, userRole));

        // Only add children if there are visible ones
        if (visibleChildren.length > 0) {
            baseItem.children = visibleChildren;
        }
    }

    return baseItem;
}

/**
 * Builds navigation structure from page metadata and navigation groups
 */
export async function buildNavigation(navigationGroups: NavigationGroup[], userRole?: UserRole): Promise<Navigation> {
    // Ensure registry is initialized
    await initializeRegistry();

    const navigation: Navigation = [];

    // Get all visible pages (not hidden)
    const visiblePages = Object.values(PAGE_REGISTRY)
        .map(page => page.metadata)
        .filter(metadata => {
            if (isHidden(metadata)) {
                return false;
            }
            // Filter by role access
            if (userRole && metadata.roles) {
                return hasRoleAccess(userRole, metadata.roles);
            }
            return true;
        });

    // Get all child segments to exclude from group navigation
    const childSegments = new Set<string>();
    visiblePages.forEach(page => {
        if (page.children && page.children.length > 0) {
            page.children.forEach(child => {
                // Also check if the child page itself is hidden or role-restricted
                const childPage = Object.values(PAGE_REGISTRY).find(p => p.metadata.segment === child);
                if (childPage && !isHidden(childPage.metadata)) {
                    // Check role access for child pages
                    if (userRole && childPage.metadata.roles) {
                        if (hasRoleAccess(userRole, childPage.metadata.roles)) {
                            childSegments.add(child);
                        }
                    } else {
                        childSegments.add(child);
                    }
                }
            });
        }
    });

    // Filter out pages that are children of other pages
    const topLevelPages = visiblePages.filter(page =>
        !childSegments.has(page.segment || '')
    );

    // Group pages by their group property
    const groupedPages = groupNavigationItems(topLevelPages, navigationGroups);

    // Sort navigation groups by index, with undefined indexes sorted alphabetically at the end
    const sortedGroups = [...navigationGroups].sort((a, b) => {
        // If both have indexes, sort by index
        if (a.index !== undefined && b.index !== undefined) {
            return a.index - b.index;
        }

        // If only a has an index, a comes first
        if (a.index !== undefined && b.index === undefined) {
            return -1;
        }

        // If only b has an index, b comes first
        if (a.index === undefined && b.index !== undefined) {
            return 1;
        }

        // If neither has an index, sort alphabetically by segment
        return a.segment.localeCompare(b.segment);
    });

    sortedGroups.forEach((group, index) => {
        // Use segment for grouping, fallback to title if segment not provided
        const groupKey = group.segment || group.title;

        // Check if this group has any pages
        const pagesInGroup = groupedPages[groupKey] || [];

        // Skip empty groups
        if (pagesInGroup.length === 0) {
            return;
        }

        // Add divider if specified (except for first group)
        if (group.divider && index > 0) {
            navigation.push({ kind: 'divider' });
        }

        // Add header if specified
        if (group.header && group.title) {
            // Use the title directly as provided by the user
            navigation.push({
                kind: 'header',
                title: group.title,
            });
        }

        // Sort pages within this group by index, then alphabetically by segment
        const sortedPagesInGroup = pagesInGroup.sort((a, b) => {
            // If both have indexes, sort by index
            if (a.index !== undefined && b.index !== undefined) {
                return a.index - b.index;
            }

            // If only a has an index, a comes first
            if (a.index !== undefined && b.index === undefined) {
                return -1;
            }

            // If only b has an index, b comes first
            if (a.index === undefined && b.index !== undefined) {
                return 1;
            }

            // If neither has an index, sort alphabetically by segment
            return (a.segment || '').localeCompare(b.segment || '');
        });

        // Add sorted pages belonging to this group
        sortedPagesInGroup.forEach(page => {
            navigation.push(convertToToolpadNavigation(page, userRole));
        });
    });

    // Add any ungrouped pages to a default section
    const ungroupedPages = groupedPages.default || [];
    if (ungroupedPages.length > 0) {
        if (navigation.length > 0) {
            navigation.push({ kind: 'divider' });
        }
        // navigation.push({
        //     kind: 'header',
        //     title: 'Other',
        // });

        // Sort ungrouped pages by index, then alphabetically by segment
        const sortedUngroupedPages = ungroupedPages.sort((a, b) => {
            // If both have indexes, sort by index
            if (a.index !== undefined && b.index !== undefined) {
                return a.index - b.index;
            }

            // If only a has an index, a comes first
            if (a.index !== undefined && b.index === undefined) {
                return -1;
            }

            // If only b has an index, b comes first
            if (a.index === undefined && b.index !== undefined) {
                return 1;
            }

            // If neither has an index, sort alphabetically by segment
            return (a.segment || '').localeCompare(b.segment || '');
        });

        sortedUngroupedPages.forEach(page => {
            navigation.push(convertToToolpadNavigation(page, userRole));
        });
    }

    return navigation;
}

/**
 * Builds route configuration from page metadata
 */
export async function buildRoutes(): Promise<RouteObject[]> {
    // Ensure registry is initialized
    await initializeRegistry();

    const routes: RouteObject[] = [];

    // Get all pages
    const allPages = Object.values(PAGE_REGISTRY);

    // Separate pages that don't require layout (like signin) from those that do
    // requiresLayout defaults to true, so only pages explicitly set to false are excluded
    const pagesWithoutLayout = allPages.filter(page => page.metadata.requiresLayout === false);
    const pagesWithLayout = allPages.filter(page => page.metadata.requiresLayout !== false);

    // Get all child segments to exclude from top-level routes
    const childSegments = new Set<string>();
    pagesWithLayout.forEach(page => {
        if (page.metadata.children && page.metadata.children.length > 0) {
            page.metadata.children.forEach(child => {
                // Add child to set regardless of its visibility for route exclusion
                childSegments.add(child);
            });
        }
    });

    // Filter out pages that are children of other pages from top-level routes
    const topLevelPages = pagesWithLayout.filter(page =>
        !childSegments.has(page.metadata.segment || '')
    );

    // Build regular routes (protected by Layout)
    const layoutChildren: RouteObject[] = [];

    topLevelPages.forEach(page => {
        const route: RouteObject = {
            path: resolveSegment(page.metadata),
            Component: page.default,
            handle: { metadata: page.metadata },
        };

        // Handle nested routes if children exist
        if (page.metadata.children && page.metadata.children.length > 0) {
            const childRoutes: RouteObject[] = [];

            page.metadata.children.forEach(childSegment => {
                const childPage = allPages.find(p => p.metadata.segment === childSegment);

                // Only add child route if the child page exists and is not hidden (honoring ENABLE_DB_HELPER)
                if (childPage && !isHidden(childPage.metadata)) {
                    childRoutes.push({
                        path: resolveSegment(childPage.metadata),
                        Component: childPage.default,
                        handle: { metadata: childPage.metadata },
                    });
                }
            });

            // Only add children if there are visible child routes
            if (childRoutes.length > 0) {
                route.children = childRoutes;
            }
        }

        layoutChildren.push(route);
    });

    // Add main layout route
    routes.push({
        path: '/',
        Component: Layout,
        errorElement: React.createElement(ErrorBoundary),
        children: layoutChildren,
    });

    // Add pages without layout (like signin)
    pagesWithoutLayout.forEach(page => {
        routes.push({
            path: `/${resolveSegment(page.metadata)}`,
            Component: page.default,
            errorElement: React.createElement(ErrorBoundary),
            handle: { metadata: page.metadata },
        });
    });

    // Add catch-all route for 404 errors
    routes.push({
        path: '*',
        Component: NotFoundPage,
    });

    return routes;
}

/**
 * Utility to register a new page dynamically
 */
export async function registerPage(segment: string, pageModule: PageModule): Promise<void> {
    await initializeRegistry();
    const resolvedSegment = resolveSegment(pageModule.metadata);
    if (resolvedSegment && resolvedSegment.toLowerCase().startsWith('api/')) {
        if (isDevelopmentEnvironment())
            console.warn(`Skipping dynamic registration for segment "${resolvedSegment}" because it points to an API route.`);
        return;
    }
    PAGE_REGISTRY[segment] = pageModule;
}

/**
 * Utility to get all registered pages
 */
export async function getRegisteredPages(): Promise<Record<string, PageModule>> {
    await initializeRegistry();
    return { ...PAGE_REGISTRY };
}

/**
 * Utility to get a specific page by segment
 */
export async function getPageBySegment(segment: string): Promise<PageModule | undefined> {
    await initializeRegistry();
    return PAGE_REGISTRY[segment];
}

/**
 * Utility to force refresh the page registry
 */
export async function refreshPageRegistry(): Promise<void> {
    registryInitialized = false;
    PAGE_REGISTRY = {};
    await initializeRegistry();
}

/**
 * Utility to get all page segments
 * @returns Array of all page segments
 */
export async function getPageSegments(): Promise<string[]> {
    await initializeRegistry();
    return Object.keys(PAGE_REGISTRY);
}
