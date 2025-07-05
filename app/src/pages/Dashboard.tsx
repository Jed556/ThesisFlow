import * as React from 'react';
import Typography from '@mui/material/Typography';
import type { NavigationItem } from '../types/navigation';
import DashboardIcon from '@mui/icons-material/Dashboard';

export const metadata: NavigationItem = {
  group: 'main',
  index: 0,
  title: 'Dashboard',
  segment: 'dashboard',
  icon: <DashboardIcon />,
  children: [],
  // path: '/dashboard',
  roles: ['user', 'admin'],
  // hidden: false,
};

export default function DashboardPage() {
  return <Typography>Welcome to the dashboard!</Typography>;
}
