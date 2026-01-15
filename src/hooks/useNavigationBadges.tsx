/**
 * useNavigationBadges Hook
 * 
 * Enhances navigation items with dynamic notification badges.
 * Takes static navigation from buildNavigation and adds action props
 * based on the DrawerNotificationContext state.
 */

import * as React from 'react';
import { Badge } from '@mui/material';
import type { Navigation } from '@toolpad/core/AppProvider';

/**
 * Map of segment to notification data
 */
export interface NavigationBadge {
    count: number;
    color?: 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' | 'default';
    max?: number;
}

/**
 * Props for the useNavigationBadges hook
 */
export interface UseNavigationBadgesOptions {
    /** Map of segment to badge configuration */
    badges: Map<string, NavigationBadge>;
}

/**
 * Create a badge action element
 */
function createBadgeAction(badge: NavigationBadge): React.ReactNode {
    if (badge.count <= 0) {
        return undefined;
    }

    return (
        <Badge
            badgeContent={badge.count}
            color={badge.color ?? 'error'}
            max={badge.max ?? 99}
            sx={{
                marginRight: 1.5,
                '& .MuiBadge-badge': {
                    fontSize: '0.65rem',
                    height: 16,
                    minWidth: 16,
                    padding: '0 4px',
                },
            }}
        >
            {/* Empty box to provide spacing */}
            <span style={{ width: 1, height: 1, display: 'inline-block' }} />
        </Badge>
    );
}

/**
 * Recursively enhance navigation items with badges
 */
function enhanceNavigationWithBadges(
    navigation: Navigation,
    badges: Map<string, NavigationBadge>
): Navigation {
    return navigation.map(item => {
        // Skip non-page items (dividers, headers)
        if ('kind' in item && (item.kind === 'divider' || item.kind === 'header')) {
            return item;
        }

        // Check if this item has a badge
        const pageItem = item as Navigation[0] & {
            segment?: string;
            children?: Navigation;
            action?: React.ReactNode;
        };
        const segment = pageItem.segment;
        const badge = segment ? badges.get(segment) : undefined;

        // Create enhanced item with proper typing
        const enhancedItem: typeof pageItem = { ...pageItem };

        // Add badge action if exists and count > 0
        if (badge && badge.count > 0) {
            enhancedItem.action = createBadgeAction(badge);
        }

        // Recursively enhance children
        if (pageItem.children && Array.isArray(pageItem.children)) {
            enhancedItem.children = enhanceNavigationWithBadges(pageItem.children, badges);
        }

        return enhancedItem;
    });
}

/**
 * Hook that enhances navigation with dynamic badges
 * @param navigation - Base navigation from buildNavigation
 * @param options - Badge configuration
 * @returns Enhanced navigation with badge actions
 */
export function useNavigationBadges(
    navigation: Navigation,
    options: UseNavigationBadgesOptions
): Navigation {
    const { badges } = options;

    return React.useMemo(() => {
        if (badges.size === 0) {
            return navigation;
        }
        return enhanceNavigationWithBadges(navigation, badges);
    }, [navigation, badges]);
}

export default useNavigationBadges;
