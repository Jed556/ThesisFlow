import * as React from 'react';
import Typography from '@mui/material/Typography';
import type { NavigationItem } from '../types/navigation';
import {School} from '@mui/icons-material';


export const metadata: NavigationItem = {
  group: 'thesis',
  index: 0,
  title: 'My Thesis',
  segment: 'thesis',
  icon: <School />,
  // children: [],
  // path: '/thesis',
  roles: ['user', 'admin'],
  // hidden: false,
};

export default function ThesisPage() {
  return <Typography>Welcome to the thesis tab!</Typography>;
}
