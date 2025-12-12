/**
 * Firestore utilities for department-level adviser skill templates
 *
 * Skill templates are stored at: year/{year}/departments/{department}/adviserSkills/{skillId}
 *
 * These templates define the skills that advisers/editors/statisticians can rate themselves on.
 * Advisers must rate their skills before being allowed to increase their slots.
 */

import {
    collection, doc, setDoc, getDoc, getDocs, deleteDoc, onSnapshot, query, orderBy,
    serverTimestamp, type Unsubscribe,
} from 'firebase/firestore';
import { firebaseFirestore } from '../firebaseConfig';
import { cleanData } from './firestore';
import { buildAdviserSkillsCollectionPath, buildAdviserSkillDocPath } from './paths';
import { DEFAULT_YEAR } from '../../../config/firestore';
import type {
    SkillTemplate,
    SkillTemplateRecord,
    ExpertSkillRating,
} from '../../../types/skillTemplate';
import { hasRatedAllSkills, getUnratedSkillCount } from '../../../types/skillTemplate';

// ============================================================================
// Skill Template CRUD Operations
// ============================================================================

/**
 * Create a new skill template for a department
 * @param year - Academic year
 * @param department - Department name
 * @param skill - Skill template data (without id)
 * @param creatorUid - UID of the admin creating the skill
 * @returns The created skill template with its assigned ID
 */
export async function createSkillTemplate(
    year: string,
    department: string,
    skill: Omit<SkillTemplate, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>,
    creatorUid?: string
): Promise<SkillTemplateRecord> {
    const collectionPath = buildAdviserSkillsCollectionPath(year, department);
    const skillsRef = collection(firebaseFirestore, collectionPath);
    const newDocRef = doc(skillsRef);
    const now = new Date().toISOString();

    const skillData: SkillTemplate = {
        ...skill,
        id: newDocRef.id,
        createdAt: now,
        updatedAt: now,
        createdBy: creatorUid,
    };

    await setDoc(newDocRef, cleanData({
        ...skillData,
        _serverTimestamp: serverTimestamp(),
    }));

    return skillData;
}

/**
 * Update an existing skill template
 * @param year - Academic year
 * @param department - Department name
 * @param skillId - Skill template ID
 * @param updates - Partial skill template updates
 */
export async function updateSkillTemplate(
    year: string,
    department: string,
    skillId: string,
    updates: Partial<Omit<SkillTemplate, 'id' | 'createdAt' | 'createdBy'>>
): Promise<void> {
    const docPath = buildAdviserSkillDocPath(year, department, skillId);
    const docRef = doc(firebaseFirestore, docPath);

    await setDoc(docRef, cleanData({
        ...updates,
        updatedAt: new Date().toISOString(),
        _serverTimestamp: serverTimestamp(),
    }), { merge: true });
}

/**
 * Delete a skill template
 * @param year - Academic year
 * @param department - Department name
 * @param skillId - Skill template ID to delete
 */
export async function deleteSkillTemplate(
    year: string,
    department: string,
    skillId: string
): Promise<void> {
    const docPath = buildAdviserSkillDocPath(year, department, skillId);
    const docRef = doc(firebaseFirestore, docPath);
    await deleteDoc(docRef);
}

/**
 * Get a single skill template by ID
 * @param year - Academic year
 * @param department - Department name
 * @param skillId - Skill template ID
 * @returns Skill template or null if not found
 */
export async function getSkillTemplate(
    year: string,
    department: string,
    skillId: string
): Promise<SkillTemplateRecord | null> {
    const docPath = buildAdviserSkillDocPath(year, department, skillId);
    const docRef = doc(firebaseFirestore, docPath);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
        return null;
    }

    return snap.data() as SkillTemplateRecord;
}

/**
 * Get all skill templates for a department
 * @param year - Academic year
 * @param department - Department name
 * @returns Array of skill templates sorted by order
 */
export async function getSkillTemplates(
    year: string,
    department: string
): Promise<SkillTemplateRecord[]> {
    const collectionPath = buildAdviserSkillsCollectionPath(year, department);
    const skillsRef = collection(firebaseFirestore, collectionPath);
    const q = query(skillsRef, orderBy('order', 'asc'));
    const snap = await getDocs(q);

    return snap.docs.map((docSnap) => docSnap.data() as SkillTemplateRecord);
}

/**
 * Get only active skill templates for a department
 * @param year - Academic year
 * @param department - Department name
 * @returns Array of active skill templates sorted by order
 */
export async function getActiveSkillTemplates(
    year: string,
    department: string
): Promise<SkillTemplateRecord[]> {
    const allSkills = await getSkillTemplates(year, department);
    return allSkills.filter((skill) => skill.isActive);
}

// ============================================================================
// Skill Template Listeners
// ============================================================================

export interface SkillTemplatesListenerOptions {
    /** Called when skill templates data is received */
    onData: (skills: SkillTemplateRecord[]) => void;
    /** Called when an error occurs */
    onError?: (error: Error) => void;
}

/**
 * Listen to skill templates for a department in real-time
 * @param year - Academic year
 * @param department - Department name
 * @param options - Listener callbacks
 * @returns Unsubscribe function
 */
export function listenSkillTemplates(
    year: string,
    department: string,
    options: SkillTemplatesListenerOptions
): Unsubscribe {
    const collectionPath = buildAdviserSkillsCollectionPath(year, department);
    const skillsRef = collection(firebaseFirestore, collectionPath);
    const q = query(skillsRef, orderBy('order', 'asc'));

    return onSnapshot(
        q,
        (snap) => {
            const skills = snap.docs.map((docSnap) => docSnap.data() as SkillTemplateRecord);
            options.onData(skills);
        },
        (error) => {
            console.error('Error listening to skill templates:', error);
            options.onError?.(error);
        }
    );
}

// ============================================================================
// Skill Rating Validation
// ============================================================================

export interface SkillRatingValidationResult {
    /** Whether the expert has rated all required skills */
    isComplete: boolean;
    /** Number of skills that still need to be rated */
    unratedCount: number;
    /** Total number of active skills in the department */
    totalSkills: number;
    /** Names of skills that need to be rated */
    unratedSkillNames: string[];
}

/**
 * Check if an expert has rated all required department skills
 * Used to validate before allowing slot increases
 * @param year - Academic year
 * @param department - Department name
 * @param expertSkillRatings - Expert's current skill ratings from their profile
 * @returns Validation result with details
 */
export async function validateExpertSkillRatings(
    year: string,
    department: string,
    expertSkillRatings: ExpertSkillRating[] | undefined | null
): Promise<SkillRatingValidationResult> {
    const departmentSkills = await getActiveSkillTemplates(year, department);

    const isComplete = hasRatedAllSkills(expertSkillRatings, departmentSkills);
    const unratedCount = getUnratedSkillCount(expertSkillRatings, departmentSkills);

    // Get names of unrated skills
    const ratedSkillIds = new Set(
        (expertSkillRatings ?? []).map((rating) => rating.skillId)
    );
    const unratedSkillNames = departmentSkills
        .filter((skill) => !ratedSkillIds.has(skill.id))
        .map((skill) => skill.name);

    return {
        isComplete,
        unratedCount,
        totalSkills: departmentSkills.length,
        unratedSkillNames,
    };
}

/**
 * Check if an expert can increase their slots (requires skill ratings)
 * @param year - Academic year
 * @param department - Department name
 * @param expertSkillRatings - Expert's current skill ratings
 * @returns true if the expert can request more slots
 */
export async function canExpertRequestSlots(
    year: string,
    department: string,
    expertSkillRatings: ExpertSkillRating[] | undefined | null
): Promise<boolean> {
    const validation = await validateExpertSkillRatings(year, department, expertSkillRatings);
    return validation.isComplete;
}

// ============================================================================
// Helper Functions for Default Year
// ============================================================================

/**
 * Get skill templates for a department using the current academic year
 * @param department - Department name
 * @returns Array of skill templates
 */
export async function getSkillTemplatesForDepartment(
    department: string
): Promise<SkillTemplateRecord[]> {
    return getSkillTemplates(DEFAULT_YEAR, department);
}

/**
 * Get active skill templates for a department using the current academic year
 * @param department - Department name
 * @returns Array of active skill templates
 */
export async function getActiveSkillTemplatesForDepartment(
    department: string
): Promise<SkillTemplateRecord[]> {
    return getActiveSkillTemplates(DEFAULT_YEAR, department);
}

/**
 * Listen to skill templates for a department using the current academic year
 * @param department - Department name
 * @param options - Listener callbacks
 * @returns Unsubscribe function
 */
export function listenSkillTemplatesForDepartment(
    department: string,
    options: SkillTemplatesListenerOptions
): Unsubscribe {
    return listenSkillTemplates(DEFAULT_YEAR, department, options);
}

// ============================================================================
// Seeding Functions
// ============================================================================

export interface SkillsConfigData {
    ratingScale: {
        min: number;
        max: number;
        labels: Record<string, string>;
    };
    defaultSkills: Array<{
        name: string;
        description?: string;
        category?: string;
        keywords?: string[];
    }>;
    departmentTemplates: Array<{
        department: string;
        skills: Array<{
            name: string;
            description?: string;
            category?: string;
            keywords?: string[];
        }>;
    }>;
}

export interface SeedSkillsResult {
    seeded: boolean;
    departmentsSeeded: string[];
    skillsCreated: number;
}

/**
 * Check if a department has any skills
 */
export async function departmentHasSkills(
    year: string,
    department: string
): Promise<boolean> {
    const skills = await getSkillTemplates(year, department);
    return skills.length > 0;
}

/**
 * Seed skills for a single department from template data
 * @param year - Academic year
 * @param department - Department name
 * @param skills - Array of skills to seed (includes keywords for TF-IDF matching)
 * @param creatorUid - UID of the admin creating the skills
 * @returns Number of skills created
 */
export async function seedDepartmentSkills(
    year: string,
    department: string,
    skills: Array<{ name: string; description?: string; category?: string; keywords?: string[] }>,
    creatorUid?: string
): Promise<number> {
    let created = 0;
    for (let i = 0; i < skills.length; i++) {
        const skill = skills[i];
        await createSkillTemplate(
            year,
            department,
            {
                name: skill.name,
                description: skill.description,
                category: skill.category,
                keywords: skill.keywords,
                order: i,
                isActive: true,
            },
            creatorUid
        );
        created++;
    }
    return created;
}

/**
 * Seed skills for all departments that don't have skills yet
 * Uses department-specific templates if available, otherwise uses default skills
 * @param year - Academic year
 * @param departments - List of departments to seed
 * @param config - Skills configuration data from skills.json
 * @param creatorUid - UID of the admin creating the skills
 * @returns Result with counts of seeded departments and skills
 */
export async function seedMissingDepartmentSkills(
    year: string,
    departments: string[],
    config: SkillsConfigData,
    creatorUid?: string
): Promise<SeedSkillsResult> {
    const result: SeedSkillsResult = {
        seeded: false,
        departmentsSeeded: [],
        skillsCreated: 0,
    };

    for (const department of departments) {
        const hasSkills = await departmentHasSkills(year, department);
        if (hasSkills) continue;

        // Find department-specific template or use defaults
        const deptTemplate = config.departmentTemplates.find(
            (t) => t.department.toLowerCase() === department.toLowerCase()
        );
        const skillsToSeed = deptTemplate?.skills ?? config.defaultSkills;

        if (skillsToSeed.length === 0) continue;

        const count = await seedDepartmentSkills(year, department, skillsToSeed, creatorUid);
        if (count > 0) {
            result.seeded = true;
            result.departmentsSeeded.push(department);
            result.skillsCreated += count;
        }
    }

    return result;
}

/**
 * Delete all skills for a department
 * @param year - Academic year
 * @param department - Department name
 * @returns Number of skills deleted
 */
export async function deleteAllDepartmentSkills(
    year: string,
    department: string
): Promise<number> {
    const skills = await getSkillTemplates(year, department);
    for (const skill of skills) {
        await deleteSkillTemplate(year, department, skill.id);
    }
    return skills.length;
}

/**
 * Reset a department's skills to template defaults
 * @param year - Academic year
 * @param department - Department name
 * @param config - Skills configuration data
 * @param creatorUid - UID of the admin
 * @returns Number of skills created
 */
export async function resetDepartmentSkillsToDefault(
    year: string,
    department: string,
    config: SkillsConfigData,
    creatorUid?: string
): Promise<number> {
    // Delete existing skills
    await deleteAllDepartmentSkills(year, department);

    // Find department-specific template or use defaults
    const deptTemplate = config.departmentTemplates.find(
        (t) => t.department.toLowerCase() === department.toLowerCase()
    );
    const skillsToSeed = deptTemplate?.skills ?? config.defaultSkills;

    if (skillsToSeed.length === 0) return 0;

    return seedDepartmentSkills(year, department, skillsToSeed, creatorUid);
}
