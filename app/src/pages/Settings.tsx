import Typography from '@mui/material/Typography';
import type { NavigationItem } from '../types/navigation';
import { Settings } from '@mui/icons-material';
import AnimatedPage from '../components/Animate/AnimatedPage/AnimatedPage';

export const metadata: NavigationItem = {
    index: 100,
    title: 'Settings',
    segment: 'settings',
    icon: <Settings />,
    children: [],
    roles: ['admin', 'student', 'editor', 'adviser'],
};

/**
 * Settings page for user preferences and application configurations
 */
export default function SettingsPage() {
    return (
        <AnimatedPage variant="fade">
            <Typography>
                This is the settings page
            </Typography>
        </AnimatedPage>
    );
}
