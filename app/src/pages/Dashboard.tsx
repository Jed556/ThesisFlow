import * as React from 'react';
import Typography from '@mui/material/Typography';
import { Box, Chip } from '@mui/material';
import type { NavigationItem } from '../types/navigation';
import { useSession } from '../SessionContext';
import DashboardIcon from '@mui/icons-material/Dashboard';

export const metadata: NavigationItem = {
  group: 'main',
  index: 0,
  title: 'Dashboard',
  segment: 'dashboard',
  icon: <DashboardIcon />,
  children: [],
  // path: '/dashboard',
  roles: ['student', 'admin'],
  // hidden: false,
};

export default function DashboardPage() {
  const { session } = useSession();
  const userRole = session?.user?.role || 'guest';

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Welcome to the dashboard!</Typography>
      <Box sx={{ mt: 2 }}>
        <Typography variant="body1" sx={{ mb: 1 }}>
          Current User: {session?.user?.name || 'Unknown'}
        </Typography>
        <Typography variant="body1" sx={{ mb: 1 }}>
          Email: {session?.user?.email || 'Unknown'}
        </Typography>
        <Typography variant="body1" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          Role: <Chip
            label={userRole}
            color={
              userRole === 'admin' ? 'error' :
                userRole === 'editor' ? 'warning' :
                  userRole === 'adviser' ? 'info' :
                    'primary'
            }
            size="small"
          />
        </Typography>
      </Box>
    </Box>
  );
}
