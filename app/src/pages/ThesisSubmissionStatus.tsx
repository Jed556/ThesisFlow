import * as React from 'react';
import Typography from '@mui/material/Typography';
import type { NavigationItem } from '../types/navigation';
import { UploadFile } from '@mui/icons-material';


export const metadata: NavigationItem = {
  group: 'thesis',
  title: 'Status',
  segment: 'thesis-submission-status',
  icon: <UploadFile />,
  children: [],
  // path: '/thesis',
  roles: ['user', 'admin'],
  // hidden: false,
};

export default function ThesisSubmissionPage() {
  return <Typography>Welcome to the thesis submission status tab!</Typography>;
}
