import * as React from 'react';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import { useSession } from '@toolpad/core';
import { Alert, Box, MenuItem, Stack, TextField } from '@mui/material';
import type { NavigationItem } from '../../types/navigation';
import type { Session } from '../../types/session';
import RoleAwareChapterView from '../../components/Chapter/RoleAwareChapterView';

export const metadata: NavigationItem = {
    group: 'head',
    index: 2,
    title: 'Department Chapters',
    segment: 'head/chapters',
    icon: <MenuBookIcon />,
    roles: ['head'],
};

/**
 * Department head chapter view page
 * Shows chapter submissions for all courses in the head's department(s)
 */
export default function HeadChaptersPage() {
    const session = useSession<Session>();

    // FIX: Need to get head's assigned departments from user profile
    // For now, using placeholder - should fetch from session.user.departments
    const departments = (
        session?.user as { departments?: string[] } | undefined
    )?.departments || [];

    const [selectedDepartment, setSelectedDepartment] = React.useState<string>(departments[0] || '');
    const [selectedCourse, setSelectedCourse] = React.useState<string>('');

    // FIX: Need to fetch available courses for selected department
    const availableCourses: string[] = [];

    if (departments.length === 0) {
        return (
            <Alert severity="warning" sx={{ mt: 2 }}>
                No departments assigned. Contact your administrator to get department assignments.
            </Alert>
        );
    }

    return (
        <Stack spacing={3}>
            {/* Department and course filters */}
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {departments.length > 1 && (
                    <TextField
                        select
                        label="Department"
                        value={selectedDepartment}
                        onChange={(e) => {
                            setSelectedDepartment(e.target.value);
                            setSelectedCourse(''); // Reset course when department changes
                        }}
                        sx={{ minWidth: 200 }}
                    >
                        {departments.map((dept: string) => (
                            <MenuItem key={dept} value={dept}>
                                {dept}
                            </MenuItem>
                        ))}
                    </TextField>
                )}

                <TextField
                    select
                    label="Course (Optional)"
                    value={selectedCourse}
                    onChange={(e) => setSelectedCourse(e.target.value)}
                    sx={{ minWidth: 200 }}
                    disabled={availableCourses.length === 0}
                    helperText={availableCourses.length === 0 ? 'No courses available' : ''}
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
            </Box>

            {/* Chapter view */}
            <RoleAwareChapterView
                role="head"
                userUid={session?.user?.uid}
                department={selectedDepartment}
                course={selectedCourse || undefined}
                title="Department Chapter Submissions"
                description={
                    'Monitor chapter submissions across ' +
                    `${selectedCourse ? `${selectedCourse} in ` : ''}` +
                    `${selectedDepartment}.`
                }
                emptyStateMessage="No thesis submissions found for the selected filters."
                showStageTabs={true}
            />
        </Stack>
    );
}
