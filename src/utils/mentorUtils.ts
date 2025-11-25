import type { MentorApprovalState, MentorRole, ThesisChapter, ThesisData } from '../types/thesis';

export const MENTOR_ROLE_ORDER: MentorRole[] = ['adviser', 'editor', 'statistician'];

export const mentorRoleLabels: Record<MentorRole, string> = {
    adviser: 'Adviser',
    editor: 'Editor',
    statistician: 'Statistician',
};

export const getAssignedMentorRoles = (thesis?: ThesisData | null): MentorRole[] => {
    if (!thesis) {
        return [];
    }
    return MENTOR_ROLE_ORDER.filter((role) => Boolean(thesis[role]));
};

export const createEmptyMentorApprovals = (thesis?: ThesisData | null): MentorApprovalState | undefined => {
    const assigned = getAssignedMentorRoles(thesis);
    if (!assigned.length) {
        return undefined;
    }
    return assigned.reduce<MentorApprovalState>((state, role) => {
        state[role] = false;
        return state;
    }, {} as MentorApprovalState);
};

export const hydrateMentorApprovals = (
    thesis?: ThesisData | null,
    approvals?: MentorApprovalState,
): MentorApprovalState | undefined => {
    const base = createEmptyMentorApprovals(thesis);
    if (!base) {
        return approvals ? { ...approvals } : undefined;
    }
    return {
        ...base,
        ...(approvals ?? {}),
    };
};

const mapValues = (
    approvals: MentorApprovalState,
    value: boolean,
): MentorApprovalState => Object.keys(approvals).reduce<MentorApprovalState>((acc, key) => {
    acc[key as MentorRole] = value;
    return acc;
}, {} as MentorApprovalState);

export const resolveChapterMentorApprovals = (
    chapter: Pick<ThesisChapter, 'mentorApprovals' | 'status'>,
    thesis?: ThesisData | null,
): MentorApprovalState | undefined => {
    const hydrated = hydrateMentorApprovals(thesis, chapter.mentorApprovals);
    if (!hydrated) {
        return undefined;
    }
    if (chapter.status === 'approved') {
        return mapValues(hydrated, true);
    }
    if (chapter.status === 'revision_required' || chapter.status === 'not_submitted') {
        return mapValues(hydrated, false);
    }
    return hydrated;
};
