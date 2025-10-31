import { Outlet } from 'react-router';
import type { NavigationItem } from '../../../types/navigation';
import { UploadFile } from '@mui/icons-material';


export const metadata: NavigationItem = {
    group: 'thesis',
    index: 1,
    title: 'Submissions',
    segment: 'thesis-submission',
    icon: <UploadFile />,
    children: ['thesis-chapters'],
    // path: '/thesis',
    roles: ['student', 'admin'],
    // hidden: false,
};

/**
 *  Navbar tab for thesis submissions and related actions
 */
export default function ThesisSubmissionPage() {
    // Render child routes through Outlet
    return <Outlet />;
}
