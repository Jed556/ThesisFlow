import * as React from 'react';
import Typography from '@mui/material/Typography';
import type { NavigationItem } from '../types/navigation';
import { People } from '@mui/icons-material';

export const metadata: NavigationItem = {
    group: 'user-management',
    title: 'Users',
    segment: 'users',
    icon: <People />,
    children: [],
    roles: ['admin'], // Only admins can see this
    hidden: false, // This child should be hidden from navigation
};

export default function UsersPage() {
    return (
        <div>
            <Typography>
                This is the Users Page
            </Typography>
        </div>
    );
}
