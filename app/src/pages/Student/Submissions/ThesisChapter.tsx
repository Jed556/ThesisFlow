import * as React from 'react';
import Typography from '@mui/material/Typography';
import type { NavigationItem } from '../../../types/navigation';
import { Article } from '@mui/icons-material';


export const metadata: NavigationItem = {
  group: 'thesis',
  index: 2,
  title: 'Chapters',
  segment: 'thesis-chapters',
  icon: <Article />,
  children: [],
  // path: '/thesis',
  roles: ['student', 'admin'],
  // hidden: false,
};

export default function ThesisSubmissionPage() {
  return <Typography>Welcome to the thesis chapter submission tab!</Typography>;
}
