import * as React from 'react';
import type { Navigation } from '@toolpad/core/AppProvider';
import type { RouteObject } from 'react-router';
import type { NavigationItem, NavigationGroup } from '../types/navigation';
import Layout from '../layouts/Layout';
import ErrorBoundary from '../layouts/ErrorBoundary';
import NotFoundPage from '../layouts/NotFoundPage';

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
    // Get all page files from the pages directory
    // Using import.meta.glob for dynamic imports with Vite
    const pageModules = import.meta.glob('../pages/*.tsx', { eager: false });

    const loadPromises = Object.keys(pageModules).map(async (path) => {
        const pageName = path.replace('../pages/', '').replace('.tsx', '');

        try {
            const module = await pageModules[path]();
            if (module && typeof module === 'object' && 'default' in module && 'metadata' in module) {
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
function convertToToolpadNavigation(item: NavigationItem): Navigation[0] {
    const baseItem: any = {
        segment: item.segment,
        title: item.title,
        icon: item.icon,
    };

    // Add children if they exist
    if (item.children && item.children.length > 0) {
        const visibleChildren = item.children
            .map(childSegment => {
                const childPage = Object.values(PAGE_REGISTRY).find(
                    page => page.metadata.segment === childSegment
                );
                return childPage;
            })
            .filter(childPage => childPage && !childPage.metadata.hidden) // Filter out hidden children
            .map(childPage => convertToToolpadNavigation(childPage!.metadata));

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
export async function buildNavigation(navigationGroups: NavigationGroup[]): Promise<Navigation> {
    // Ensure registry is initialized
    await initializeRegistry();

    const navigation: Navigation = [];

    // Get all visible pages (not hidden)
    const visiblePages = Object.values(PAGE_REGISTRY)
        .map(page => page.metadata)
        .filter(metadata => !metadata.hidden);

    // Get all child segments to exclude from group navigation
    const childSegments = new Set<string>();
    visiblePages.forEach(page => {
        if (page.children && page.children.length > 0) {
            page.children.forEach(child => {
                // Also check if the child page itself is hidden
                const childPage = Object.values(PAGE_REGISTRY).find(p => p.metadata.segment === child);
                if (!childPage?.metadata.hidden) {
                    childSegments.add(child);
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
            navigation.push(convertToToolpadNavigation(page));
        });
    });

    // Add any ungrouped pages to a default section
    const ungroupedPages = groupedPages['default'] || [];
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
            navigation.push(convertToToolpadNavigation(page));
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

    // Separate special pages (like signin) from regular pages
    const specialPages = allPages.filter(page => page.metadata.hidden);
    const visiblePages = allPages.filter(page => !page.metadata.hidden);

    // Get all child segments to exclude from top-level routes
    const childSegments = new Set<string>();
    visiblePages.forEach(page => {
        if (page.metadata.children && page.metadata.children.length > 0) {
            page.metadata.children.forEach(child => {
                // Add child to set regardless of its visibility for route exclusion
                childSegments.add(child);
            });
        }
    });

    // Filter out pages that are children of other pages from top-level routes
    const topLevelPages = visiblePages.filter(page =>
        !childSegments.has(page.metadata.segment || '')
    );

    // Build regular routes (protected by Layout)
    const layoutChildren: RouteObject[] = [];

    topLevelPages.forEach(page => {
        const route: RouteObject = {
            path: page.metadata.segment,
            Component: page.default,
        };

        // Handle nested routes if children exist
        if (page.metadata.children && page.metadata.children.length > 0) {
            const childRoutes: RouteObject[] = [];

            page.metadata.children.forEach(childSegment => {
                const childPage = allPages.find(p => p.metadata.segment === childSegment);

                // Only add child route if the child page exists and is not hidden
                if (childPage && !childPage.metadata.hidden) {
                    childRoutes.push({
                        path: childSegment,
                        Component: childPage.default,
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

    // Add special routes (like signin)
    specialPages.forEach(page => {
        routes.push({
            path: `/${page.metadata.segment}`,
            Component: page.default,
            errorElement: React.createElement(ErrorBoundary),
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
 */
export async function getPageSegments(): Promise<string[]> {
    await initializeRegistry();
    return Object.keys(PAGE_REGISTRY);
}
