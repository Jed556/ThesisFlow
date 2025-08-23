import * as React from 'react';
import Typography from '@mui/material/Typography';
import type { NavigationItem } from '../../types/navigation';
import { UploadFile } from '@mui/icons-material';


export const metadata: NavigationItem = {
  group: 'thesis',
  index: 0,
  title: 'Submissions',
  segment: 'thesis-submission',
  icon: <UploadFile />,
  children: ['thesis-submission-status', 'thesis-submission-chapters'],
  // path: '/thesis',
  roles: ['user', 'admin'],
  // hidden: false,
};

export default function ThesisSubmissionPage() {
  return <Typography>Welcome to the thesis submission tab!</Typography>;
}
