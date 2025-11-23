import * as React from 'react';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import { useSession } from '@toolpad/core';
import { Box, MenuItem, Stack, TextField, Typography } from '@mui/material';
import type { NavigationItem } from '../../types/navigation';
import type { Session } from '../../types/session';
import RoleAwareChapterView from '../../components/Chapter/RoleAwareChapterView';

export const metadata: NavigationItem = {
    group: 'admin',
    index: 3,
    title: 'All Chapters',
    segment: 'admin/chapters',
    icon: <MenuBookIcon />,
    roles: ['admin'],
};

/**
 * Admin chapter view page
 * Shows all chapter submissions across all departments and courses with filters
 */
export default function AdminChaptersPage() {
    const session = useSession<Session>();

    const [selectedDepartment, setSelectedDepartment] = React.useState<string>('');
    const [selectedCourse, setSelectedCourse] = React.useState<string>('');
    const [selectedGroup, setSelectedGroup] = React.useState<string>('');

    // FIX: Need to fetch all departments, courses, and groups from Firestore
    const allDepartments: string[] = [];
    const availableCourses: string[] = [];
    const availableGroups: string[] = [];

    return (
        <Stack spacing={3}>
            {/* Header */}
            <Box>
                <Typography variant="h5" gutterBottom>
                    System-Wide Chapter Management
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    Monitor and manage all chapter submissions across the entire system.
                    Use filters to narrow down to specific departments, courses, or groups.
                </Typography>
            </Box>

            {/* Filters */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <TextField
                    select
                    label="Department"
                    value={selectedDepartment}
                    onChange={(e) => {
                        setSelectedDepartment(e.target.value);
                        setSelectedCourse('');
                        setSelectedGroup('');
                    }}
                    sx={{ minWidth: 200 }}
                >
                    <MenuItem value="">
                        <em>All Departments</em>
                    </MenuItem>
                    {allDepartments.map((dept) => (
                        <MenuItem key={dept} value={dept}>
                            {dept}
                        </MenuItem>
                    ))}
                </TextField>

                <TextField
                    select
                    label="Course"
                    value={selectedCourse}
                    onChange={(e) => {
                        setSelectedCourse(e.target.value);
                        setSelectedGroup('');
                    }}
                    sx={{ minWidth: 200 }}
                    disabled={!selectedDepartment}
                >
                    <MenuItem value="">
                        <em>All Courses</em>
                    </MenuItem>
                    {availableCourses.map((course) => (
                        <MenuItem key={course} value={course}>
                            {course}
                        </MenuItem>
                    ))}
                </TextField>

                <TextField
                    select
                    label="Group"
                    value={selectedGroup}
                    onChange={(e) => setSelectedGroup(e.target.value)}
                    sx={{ minWidth: 200 }}
                    disabled={!selectedCourse}
                >
                    <MenuItem value="">
                        <em>All Groups</em>
                    </MenuItem>
                    {availableGroups.map((group) => (
                        <MenuItem key={group} value={group}>
                            {group}
                        </MenuItem>
                    ))}
                </TextField>
            </Box>

            {/* Chapter view */}
            <RoleAwareChapterView
                role="admin"
                userUid={session?.user?.uid}
                department={selectedDepartment || undefined}
                course={selectedCourse || undefined}
                groupId={selectedGroup || undefined}
                title={
                    'Chapter Submissions' +
                    `${selectedDepartment ? ` - ${selectedDepartment}` : ''}` +
                    `${selectedCourse ? ` / ${selectedCourse}` : ''}` +
                    `${selectedGroup ? ` / ${selectedGroup}` : ''}`
                }
                description="Viewing all chapter submissions matching the selected filters."
                emptyStateMessage="No submissions found. Adjust filters or check if any groups have uploaded chapters."
                showStageTabs={true}
            />
        </Stack>
    );
}
