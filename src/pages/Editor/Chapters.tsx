import * as React from 'react';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import { useSession } from '@toolpad/core';
import type { NavigationItem } from '../../types/navigation';
import type { Session } from '../../types/session';
import MentorChapterWorkspace from '../../components/Chapter/MentorChapterWorkspace';

export const metadata: NavigationItem = {
    group: 'adviser-editor',
    index: 2,
    title: 'Editorial Chapters',
    segment: 'editor/chapters',
    icon: <AutoStoriesIcon />,
    roles: ['editor'],
};

export default function EditorChaptersPage() {
    const session = useSession<Session>();

    return (
        <MentorChapterWorkspace
            role="editor"
            mentorUid={session?.user?.uid}
            title="Editorial chapter workspace"
            description="Monitor submissions from your assigned teams and upload edited annotations or decision notes."
            emptyStateMessage="No theses are assigned to you for moderation yet."
            uploadLabels={{ empty: 'Upload Annotations', existing: 'Update Annotation' }}
        />
    );
}
