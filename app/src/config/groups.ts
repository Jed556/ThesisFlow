import type { NavigationGroup } from '../types/navigation';

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
        title: 'User Management',
        segment: 'user-management',
    },
];
