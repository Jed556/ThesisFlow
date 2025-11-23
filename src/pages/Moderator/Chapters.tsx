import * as React from 'react';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import { useSession } from '@toolpad/core';
import type { NavigationItem } from '../../types/navigation';
import type { Session } from '../../types/session';
import RoleAwareChapterView from '../../components/Chapter/RoleAwareChapterView';

export const metadata: NavigationItem = {
    group: 'moderator',
    index: 2,
    title: 'Course Chapters',
    segment: 'moderator/chapters',
    icon: <MenuBookIcon />,
    roles: ['moderator'],
};

/**
 * Moderator chapter view page
 * Shows chapter submissions for courses the moderator manages
 */
export default function ModeratorChaptersPage() {
    const session = useSession<Session>();

    // FIX: Need to get moderator's assigned courses from user profile
    // For now, using placeholder - should fetch from session.user.moderatedCourses
    const moderatedCourses = (
        session?.user as { moderatedCourses?: string[] } | undefined
    )?.moderatedCourses || [];

    // FIX: If moderator has multiple courses, should show course selector
    // For now, showing first course only
    const [selectedCourse] = moderatedCourses;

    if (!selectedCourse) {
        return (
            <RoleAwareChapterView
                role="moderator"
                userUid={session?.user?.uid}
                title="Course Chapter Submissions"
                description="No courses assigned. Contact your department head to get course assignments."
                emptyStateMessage="You are not assigned to moderate any courses."
                showStageTabs={true}
            />
        );
    }

    return (
        <RoleAwareChapterView
            role="moderator"
            userUid={session?.user?.uid}
            course={selectedCourse}
            title="Course Chapter Submissions"
            description={`Review chapter submissions for ${selectedCourse}. Monitor student progress and provide guidance.`}
            emptyStateMessage="No thesis groups in this course have submitted chapters yet."
            showStageTabs={true}
        />
    );
}
