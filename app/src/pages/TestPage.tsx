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
    roles: ['admin', 'student', 'editor', 'adviser'],
    hidden: false,
};

/**
 * Test page for development and debugging purposes
 */
export default function TestPage() {
    return (
        <>
            <Typography>
                This is a Test Page
            </Typography>
        </>
    );
}
