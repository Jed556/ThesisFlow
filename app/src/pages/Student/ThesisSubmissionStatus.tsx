import * as React from 'react';
import Typography from '@mui/material/Typography';
import type { NavigationItem } from '../../types/navigation';
import { BubbleChart } from '@mui/icons-material';


export const metadata: NavigationItem = {
  group: 'thesis',
  index: 1,
  title: 'Status',
  segment: 'thesis-submission-status',
  icon: <BubbleChart />,
  children: [],
  // path: '/thesis',
  roles: ['user', 'admin'],
  // hidden: false,
};

export default function ThesisSubmissionPage() {
  return <Typography>Welcome to the thesis submission status tab!</Typography>;
}
