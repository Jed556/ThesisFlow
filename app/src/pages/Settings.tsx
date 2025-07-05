import * as React from 'react';
import Typography from '@mui/material/Typography';
import type { NavigationItem } from '../types/navigation';
import { Settings } from '@mui/icons-material';

export const metadata: NavigationItem = {
    // group: 'settings',
    index: 100,
    title: 'Settings',
    segment: 'settings',
    icon: <Settings />,
    children: [],
    roles: ['admin'],
};

export default function SettingsPage() {
    return (
        <div>
            <Typography>
                This is the settings page
            </Typography>
        </div>
    );
}
