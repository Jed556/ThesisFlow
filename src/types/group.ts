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
    status: 'active' | 'inactive' | 'completed' | 'archived';
    thesisTitle?: string;
    department?: string;
    course?: string;
}

/**
 * Thesis group members
 */
export interface ThesisGroupMembers {
    leader: string; // Firebase UID of the group leader
    members: string[]; // Array of member Firebase UIDs
    adviser?: string; // Firebase UID of the assigned adviser
    editor?: string; // Firebase UID of the assigned editor
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
    status: 'active' | 'inactive' | 'completed' | 'archived';
    thesisTitle?: string;
    department?: string;
    course?: string;
}
