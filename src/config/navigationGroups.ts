import type { NavigationGroup } from '../types/navigation';

/**
 * Navigation groups define sections in the sidebar navigation.
 * Each group can have a header, divider, title, and segment identifier.
 * Groups help organize navigation items into logical sections.
 */
export const navigationGroups: NavigationGroup[] = [
    {
        index: 1,
        header: false,
        divider: true,
        title: 'Main',
        segment: 'main',
    },
    {
        index: 2,
        header: true,
        divider: true,
        title: 'Thesis',
        segment: 'thesis',
    },
    {
        index: 3,
        header: true,
        divider: true,
        title: 'Experts',
        segment: 'experts',
    },
    {
        index: 4,
        header: true,
        divider: true,
        title: 'Management',
        segment: 'management',
    },

];
