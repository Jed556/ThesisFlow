/**
 * Group-level notification metadata for thesis progress updates and alerts.
 */
export type GroupNotificationCategory = 'milestone' | 'deadline' | 'feedback' | 'system';

/**
 * Individual notification entry stored under a group notification document.
 */
export interface GroupNotificationEntry {
    id: string;
    title: string;
    message: string;
    category: GroupNotificationCategory;
    createdAt: string;
    createdBy?: string;
    actionUrl?: string;
    readBy?: string[];
}

/**
 * Firestore document holding notifications for a specific group.
 */
export interface GroupNotificationDoc {
    id: string;
    groupId: string;
    notifications: GroupNotificationEntry[];
    updatedAt?: string;
}
