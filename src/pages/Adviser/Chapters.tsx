import * as React from 'react';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import { useSession } from '@toolpad/core';
import type { NavigationItem } from '../../types/navigation';
import type { Session } from '../../types/session';
import MentorChapterWorkspace from '../../components/Chapter/MentorChapterWorkspace';

export const metadata: NavigationItem = {
    group: 'adviser-editor',
    index: 2,
    title: 'Advisee Chapters',
    segment: 'adviser/chapters',
    icon: <MenuBookIcon />,
    roles: ['adviser'],
};

export default function AdviserChaptersPage() {
    const session = useSession<Session>();

    return (
        <MentorChapterWorkspace
            role="adviser"
            mentorUid={session?.user?.uid}
            title="Advisee chapter submissions"
            description="Track student uploads per chapter, attach your annotated feedback, and keep reviewers aligned."
            emptyStateMessage="You have no advisee theses assigned yet."
            uploadLabels={{ empty: 'Attach Feedback', existing: 'Update Feedback' }}
        />
    );
}
