import Typography from '@mui/material/Typography';
import type { NavigationItem } from '../../types/navigation';
import { People } from '@mui/icons-material';

/**
 * Metadata for the Users admin page
 */
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

/**
 * User management page for administrators
 */
export default function UsersPage() {
    return (
        <>
            <Typography>
                This is the Users Page
            </Typography>
        </>
    );
}
