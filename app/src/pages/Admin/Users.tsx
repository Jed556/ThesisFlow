import * as React from 'react';
import Typography from '@mui/material/Typography';
import type { NavigationItem } from '../../types/navigation';
import { People } from '@mui/icons-material';

export const metadata: NavigationItem = {
    group: 'user-management',
    index: 0,
    title: 'Users',
    segment: 'users',
    icon: <People />,
    children: [],
    roles: ['admin'],
    hidden: false,
};

export default function UsersPage() {
    return (
        <>
            <Typography>
                This is the Users Page
            </Typography>
        </>
    );
}
