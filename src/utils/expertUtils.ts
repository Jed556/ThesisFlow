import type { ExpertApprovalState, ExpertRole, ThesisChapter, ThesisData } from '../types/thesis';

export const EXPERT_ROLE_ORDER: ExpertRole[] = ['adviser', 'editor', 'statistician'];

export const expertRoleLabels: Record<ExpertRole, string> = {
    adviser: 'Adviser',
    editor: 'Editor',
    statistician: 'Statistician',
};

export const getAssignedExpertRoles = (thesis?: ThesisData | null): ExpertRole[] => {
    if (!thesis) {
        return [];
    }
    return EXPERT_ROLE_ORDER.filter((role) => Boolean(thesis[role]));
};

export const createEmptyExpertApprovals = (thesis?: ThesisData | null): ExpertApprovalState | undefined => {
    const assigned = getAssignedExpertRoles(thesis);
    if (!assigned.length) {
        return undefined;
    }
    return assigned.reduce<ExpertApprovalState>((state, role) => {
        state[role] = false;
        return state;
    }, {} as ExpertApprovalState);
};

export const hydrateExpertApprovals = (
    thesis?: ThesisData | null,
    approvals?: ExpertApprovalState,
): ExpertApprovalState | undefined => {
    const base = createEmptyExpertApprovals(thesis);
    if (!base) {
        return approvals ? { ...approvals } : undefined;
    }
    return {
        ...base,
        ...(approvals ?? {}),
    };
};

const mapValues = (
    approvals: ExpertApprovalState,
    value: boolean,
): ExpertApprovalState => Object.keys(approvals).reduce<ExpertApprovalState>((acc, key) => {
    acc[key as ExpertRole] = value;
    return acc;
}, {} as ExpertApprovalState);

export const resolveChapterExpertApprovals = (
    chapter: Pick<ThesisChapter, 'expertApprovals' | 'status'>,
    thesis?: ThesisData | null,
): ExpertApprovalState | undefined => {
    const hydrated = hydrateExpertApprovals(thesis, chapter.expertApprovals);
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
