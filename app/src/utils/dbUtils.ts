/**
 * Database utility functions for data access and manipulation
 * These functions handle data retrieval, formatting, and calculations
 */

import type { FileAttachment } from '../types/file';
import { mockFileRegistry, mockThesisData, mockUserProfiles } from '../data/mockData';
import type { UserProfile } from '../types/profile';
import { parseThesisDate } from './dateUtils';

/**
 * Get user profile by email
 */
export function getProfile(email: string): UserProfile | undefined {
    return mockUserProfiles.find(profile => profile.email === email);
}

/**
 * Get formatted display name for user
 * 
 */
export function getDisplayName(email: string): string {
    const profile = getProfile(email);
    if (!profile) return email; // Fallback to email if profile not found

    const parts: string[] = [];

    if (profile.prefix) {
        parts.push(profile.prefix);
    }

    parts.push(profile.firstName);

    if (profile.middleName) {
        parts.push(profile.middleName);
    }

    parts.push(profile.lastName);

    if (profile.suffix) {
        parts.push(profile.suffix);
    }

    return parts.join(' ');
}

/**
 * Get all thesis team members from thesis data
 */
export function getThesisTeamMembers() {
    const teamMembers = [];

    // Add leader (student)
    const leader = getProfile(mockThesisData.leader);
    if (leader) {
        teamMembers.push({
            ...leader,
            thesisRole: 'Leader' // Using different property name to avoid conflict
        });
    }

    // Add other members (student)
    mockThesisData.members.forEach(memberEmail => {
        const member = getProfile(memberEmail);
        if (member) {
            teamMembers.push({
                ...member,
                thesisRole: 'Member' // Using different property name to avoid conflict
            });
        }
    });

    // Add adviser
    const adviser = getProfile(mockThesisData.adviser);
    if (adviser) {
        teamMembers.push({
            ...adviser,
            thesisRole: 'Adviser' // Using different property name to avoid conflict
        });
    }

    // Add editor
    const editor = getProfile(mockThesisData.editor);
    if (editor) {
        teamMembers.push({
            ...editor,
            thesisRole: 'Editor' // Using different property name to avoid conflict
        });
    }

    return teamMembers;
}

/**
 * Get document name from chapter submissions by version index
 */
export function getDocumentNameByVersion(chapterId: number, version: number): string {
    const chapter = mockThesisData.chapters.find(ch => ch.id === chapterId);
    if (!chapter || !chapter.submissions[version - 1]) {
        return `Document v${version}`;
    }

    const fileHash = chapter.submissions[version - 1];
    const file = mockFileRegistry[fileHash];
    return file ? file.name : `Document v${version}`;
}

/**
 * Get version number from submission hash in chapter
 */
export function getVersionFromHash(chapterId: number, hash: string): number {
    const chapter = mockThesisData.chapters.find(ch => ch.id === chapterId);
    if (!chapter) return 1;

    const index = chapter.submissions.indexOf(hash);
    return index >= 0 ? index + 1 : 1;
}

/**
 * Helper functions for working with the hash-based file system
 */

/**
 * Get file by hash from the registry
 */
export function getFileByHash(hash: string): FileAttachment | undefined {
    return mockFileRegistry[hash];
}

/**
 * Get all submission files for a specific chapter
 */
export function getChapterSubmissions(chapterId: number): FileAttachment[] {
    const chapter = mockThesisData.chapters.find(ch => ch.id === chapterId);
    if (!chapter) return [];

    return chapter.submissions.map(hash => mockFileRegistry[hash]).filter(Boolean);
}

/**
 * Get attachment files by hash array
 */
export function getAttachmentFiles(hashes: string[]): FileAttachment[] {
    return hashes.map(hash => mockFileRegistry[hash]).filter(Boolean);
}

/**
 * Get version history for a specific chapter
 */
export function getVersionHistory(chapterId: number): FileAttachment[] {
    const submissions = getChapterSubmissions(chapterId);
    return submissions
        .filter(file => file.category === 'submission')
        .sort((a, b) => parseThesisDate(b.uploadDate).getTime() - parseThesisDate(a.uploadDate).getTime());
}

/**
 * Get current version for a specific chapter
 */
export function getCurrentVersion(chapterId: number): FileAttachment | null {
    const submissions = getChapterSubmissions(chapterId);
    const versions = submissions.filter(file => file.category === 'submission');
    if (versions.length === 0) return null;

    // Return the most recently submitted file
    return versions.sort((a, b) => parseThesisDate(b.uploadDate).getTime() - parseThesisDate(a.uploadDate).getTime())[0] || null;
}

/**
 * Get all versions for a specific chapter
 */
export function getAllVersions(chapterId: number): FileAttachment[] {
    return getVersionHistory(chapterId);
}

/**
 * Helper function to get group member by name
 */
export function getGroupMember(name: string) {
    const teamMembers = getThesisTeamMembers();
    return teamMembers.find(member => {
        const displayName = getDisplayName(member.email);
        return displayName === name;
    });
}

/**
 * Helper function to calculate thesis progress
 */
export function calculateProgress(): number {
    const total = mockThesisData.chapters.length;
    const approved = mockThesisData.chapters.filter(ch => ch.status === 'approved').length;
    return (approved / total) * 100;
}

/**
 * Get all users (for backwards compatibility)
 */
export function getUsers(): UserProfile[] {
    return mockUserProfiles;
}
