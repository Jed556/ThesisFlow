import * as React from 'react';
import Typography from '@mui/material/Typography';
import type { NavigationItem } from '../types/navigation';
import { Analytics } from '@mui/icons-material';

export const metadata: NavigationItem = {
    // group: 'main',
    index: 99,
    title: 'Test Page',
    segment: 'test',
    icon: <Analytics />,
    children: [],
    roles: ['admin'],
    hidden: false,
};

export default function TestPage() {
    return (
        <div>
            <Typography>
                This is a Test Page
            </Typography>
        </div>
    );
}
