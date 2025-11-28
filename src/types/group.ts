import type { ExpertRequest } from './expertRequest';
import type { TopicProposalSet } from './proposal';
import type { ThesisData } from './thesis';

/**
 * Group-specific status values
 */
export type GroupStatus = 'draft' | 'review' | 'active' | 'inactive' | 'rejected' | 'completed' | 'archived';

/**
 * Thesis group represents a team working on a thesis project
 */
export interface ThesisGroup {
    id: string;
    name: string;
    description?: string;
    members: ThesisGroupMembers;
    createdAt: string;
    updatedAt: string;
    status: GroupStatus;
    expertRequests?: ExpertRequest[]; // Array of ExpertRequest IDs
    proposals?: TopicProposalSet[];
    thesis?: ThesisData;
    panelComments?: string[];
    department?: string;
    course?: string;
    /** Pending invites to other students (array of UIDs) */
    invites?: string[];
    /** Incoming join requests from students (array of UIDs) */
    requests?: string[];
    /** Rejection reason (only populated when status is 'rejected') */
    rejectionReason?: string;
}

/**
 * Thesis group members
 */
export interface ThesisGroupMembers {
    leader: string; // Firebase UID of the group leader
    members: string[]; // Array of member Firebase UIDs
    editor?: string; // Firebase UID of the assigned editor
    statistician?: string; // Firebase UID of the assigned statistician
    adviser?: string; // Firebase UID of the assigned adviser
    panels?: string[]; // Array of panel member Firebase UIDs
}

/**
 * Form data for creating/editing thesis groups
 */
export interface ThesisGroupFormData {
    id?: string;
    name: string;
    description?: string;
    leader: string;
    members: string[];
    adviser?: string;
    editor?: string;
    thesis?: ThesisData;
    status: GroupStatus;
    department?: string;
    course?: string;
}

/**
 * Group invite for a student
 */
export interface GroupInvite {
    groupId: string;
    groupName: string;
    leaderUid: string;
    invitedAt: string;
}

/**
 * Group join request from a student
 */
export interface GroupJoinRequest {
    groupId: string;
    groupName: string;
    requesterUid: string;
    requestedAt: string;
}
