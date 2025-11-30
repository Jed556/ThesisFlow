import * as React from 'react';
import {
    Person as PersonIcon, Group as GroupIcon, Description as DescriptionIcon,
    Upload as UploadIcon, Comment as CommentIcon, Assignment as AssignmentIcon,
    Timeline as TimelineIcon, History as HistoryIcon,
    Business as DepartmentIcon, AdminPanelSettings as AdminIcon
} from '@mui/icons-material';
import type { AuditCategory } from '../../types/audit';
import type { AuditScope } from './types';

/**
 * Get icon for audit scope
 */
export function getScopeIcon(scope: AuditScope): React.ReactElement {
    const icons: Record<AuditScope, React.ReactElement> = {
        personal: <PersonIcon fontSize="small" />,
        group: <GroupIcon fontSize="small" />,
        departmental: <DepartmentIcon fontSize="small" />,
        admin: <AdminIcon fontSize="small" />,
    };
    return icons[scope];
}

/**
 * Get icon for audit category
 */
export function getCategoryIcon(category: AuditCategory): React.ReactElement {
    const iconMap: Record<AuditCategory, React.ReactElement> = {
        group: <GroupIcon fontSize="small" />,
        thesis: <DescriptionIcon fontSize="small" />,
        submission: <UploadIcon fontSize="small" />,
        chapter: <AssignmentIcon fontSize="small" />,
        panel: <PersonIcon fontSize="small" />,
        proposal: <DescriptionIcon fontSize="small" />,
        member: <PersonIcon fontSize="small" />,
        expert: <PersonIcon fontSize="small" />,
        comment: <CommentIcon fontSize="small" />,
        file: <UploadIcon fontSize="small" />,
        stage: <TimelineIcon fontSize="small" />,
        terminal: <AssignmentIcon fontSize="small" />,
        other: <HistoryIcon fontSize="small" />,
    };
    return iconMap[category] || <HistoryIcon fontSize="small" />;
}
