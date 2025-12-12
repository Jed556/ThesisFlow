import type { UserProfile } from '../types/profile';
import { normalizeDateInput } from './dateUtils';
import { isCompletedGroupStatus } from './expertProfileUtils';
import type { ThesisGroup } from '../types/group';
import { devLog } from './devUtils';

type ThesisExpertRole = 'adviser' | 'editor' | 'statistician';

export interface ThesisRoleStats {
    adviserCount: number;
    editorCount: number;
    statisticianCount: number;
}

/**
 * Represents a matched skill with its similarity score
 */
export interface MatchedSkill {
    name: string;
    rating: number;
    similarity: number;
}

export interface ExpertCardData {
    profile: UserProfile;
    stats: ThesisRoleStats;
    compatibility: number;
    capacity: number;
    activeCount: number;
    openSlots: number;
    rank: number;
    /** Top matched skills sorted by similarity */
    matchedSkills: MatchedSkill[];
}

/**
 * Aggregates counts of adviser and editor roles handled by each user across all groups.
 * @param groups List of groups to analyze
 * @return Map of user UIDs to their thesis role statistics
 */
export function aggregateThesisStats(
    groups: ThesisGroup[]
): Map<string, ThesisRoleStats> {
    const stats = new Map<string, ThesisRoleStats>();
    const countedAssignments = new Set<string>();

    const ensureRecord = (uid: string): ThesisRoleStats => {
        if (!stats.has(uid)) {
            stats.set(uid, { adviserCount: 0, editorCount: 0, statisticianCount: 0 });
        }
        return stats.get(uid)!;
    };

    const registerAssignment = (
        uid: string | null | undefined,
        role: ThesisExpertRole,
        referenceId: string | null | undefined
    ) => {
        if (!uid) {
            return;
        }
        const dedupeKey = `${role}:${uid}:${referenceId ?? 'global'}`;
        if (countedAssignments.has(dedupeKey)) {
            return;
        }
        countedAssignments.add(dedupeKey);
        const record = ensureRecord(uid);
        if (role === 'adviser') {
            record.adviserCount += 1;
        } else if (role === 'editor') {
            record.editorCount += 1;
        } else {
            record.statisticianCount += 1;
        }
    };

    const activeGroupStatuses: ThesisGroup['status'][] = ['draft', 'review', 'active'];
    groups.forEach((group) => {
        if (isCompletedGroupStatus(group.status)) {
            return;
        }
        if (!activeGroupStatuses.includes(group.status)) {
            return;
        }
        registerAssignment(group.members.adviser, 'adviser', group.id);
        registerAssignment(group.members.editor, 'editor', group.id);
        registerAssignment(group.members.statistician, 'statistician', group.id);
    });

    return stats;
}

/**
 * Builds a combined text for a skill from its name, description, and keywords.
 * Used for TF-IDF matching against thesis titles.
 */
function buildSkillText(skill: { name: string; description?: string; keywords?: string[] }): string {
    const parts: string[] = [skill.name];
    if (skill.description) {
        parts.push(skill.description);
    }
    if (skill.keywords && skill.keywords.length > 0) {
        parts.push(skill.keywords.join(' '));
    }
    return parts.join(' ');
}

/**
 * Computes similarity between thesis title and an expert's skills using TF-IDF.
 * Uses skill name, description, and keywords for comprehensive matching.
 * Returns matched skills sorted by similarity score.
 */
function computeSkillMatches(
    thesisTitle: string | undefined | null,
    profile: UserProfile
): MatchedSkill[] {
    const skills = profile.skillRatings ?? [];
    if (!thesisTitle || skills.length === 0) {
        // Return all skills with zero similarity if no thesis title
        return skills.map((s) => ({
            name: s.name,
            rating: s.rating,
            similarity: 0,
        }));
    }

    // Tokenize thesis title
    const titleTokens = tokenize(thesisTitle);
    if (titleTokens.length === 0) {
        return skills.map((s) => ({
            name: s.name,
            rating: s.rating,
            similarity: 0,
        }));
    }

    // Build skill text combining name, description, and keywords
    const skillTexts = skills.map((s) => buildSkillText(s));
    const skillTokensList = skillTexts.map((text) => tokenize(text));
    const allDocuments = [titleTokens, ...skillTokensList];

    // Compute IDF across all documents
    const idf = computeInverseDocumentFrequency(allDocuments);

    // Build TF-IDF vector for thesis title
    const titleTf = computeTermFrequency(titleTokens);
    const titleVector = buildTfidfVector(titleTf, idf);

    // Calculate similarity for each skill
    const matched = skills.map((skill, index) => {
        const skillTf = computeTermFrequency(skillTokensList[index]);
        const skillVector = buildTfidfVector(skillTf, idf);
        const similarity = cosineSimilarity(titleVector, skillVector);
        return {
            name: skill.name,
            rating: skill.rating,
            similarity,
        };
    });

    // Sort by similarity descending
    matched.sort((a, b) => b.similarity - a.similarity);
    return matched;
}

/**
 * Computes expert recommendation cards sorted by compatibility, capacity, and expertise.
 * @param profiles List of user profiles to evaluate as experts
 * @param role Role to consider ('adviser', 'editor', or 'statistician')
 * @param statsMap Precomputed thesis role statistics for users
 * @param thesisTitle Optional thesis title for skill matching
 * @return List of ExpertCardData sorted by rank
 */
export function computeExpertCards(
    profiles: UserProfile[],
    role: 'adviser' | 'editor' | 'statistician',
    statsMap: Map<string, ThesisRoleStats>,
    thesisTitle?: string | null,
): ExpertCardData[] {
    const scored = profiles.map((profile) => {
        const stats = statsMap.get(profile.uid) ?? { adviserCount: 0, editorCount: 0, statisticianCount: 0 };
        const capacity = profile.slots ?? 0;
        const active = role === 'adviser'
            ? stats.adviserCount
            : role === 'editor'
                ? stats.editorCount
                : stats.statisticianCount;
        const openSlots = capacity > 0 ? Math.max(capacity - active, 0) : 0;

        // Compute matched skills using TF-IDF (uses name + description + keywords)
        const matchedSkills = computeSkillMatches(thesisTitle, profile);

        // Calculate skill match score: weighted average of (similarity * rating/10) for top 3 skills
        const topSkills = matchedSkills.slice(0, 3);
        const skillMatchScore = topSkills.length > 0
            ? topSkills.reduce((sum, s) => sum + s.similarity * (s.rating / 10), 0) / topSkills.length
            : 0;

        // Compute compatibility using skill match score
        const compatibility = computeCompatibilityWithSkills(
            profile, stats, role, skillMatchScore
        );

        const score = compatibility + openSlots * 5 + skillMatchScore * 50;

        // Log computation results for debugging
        devLog('[recommendUtils] Expert scoring:', JSON.stringify({
            expert: `${profile.name.first} ${profile.name.last}`,
            uid: profile.uid,
            thesisTitle: thesisTitle ?? '(none)',
            scoring: {
                skillMatchScore: Math.round(skillMatchScore * 100) / 100,
                compatibility: compatibility,
                finalScore: score,
            },
            skills: {
                totalSkills: matchedSkills.length,
                topMatches: matchedSkills.slice(0, 3).map(s => ({
                    name: s.name,
                    rating: s.rating,
                    similarity: Math.round(s.similarity * 100) / 100,
                })),
            },
            capacity: {
                slots: capacity,
                active,
                openSlots,
            },
        }, null, 2));

        return {
            profile,
            stats,
            compatibility,
            capacity,
            activeCount: active,
            openSlots,
            matchedSkills,
            score,
        };
    });

    scored.sort((a, b) => b.score - a.score);

    return scored.map((entry, index) => ({
        profile: entry.profile,
        stats: entry.stats,
        compatibility: entry.compatibility,
        capacity: entry.capacity,
        activeCount: entry.activeCount,
        openSlots: entry.openSlots,
        matchedSkills: entry.matchedSkills,
        rank: index + 1,
    }));
}

/**
 * Reusable compatibility evaluator for expert detail views.
 */
export function evaluateExpertCompatibility(
    profile: UserProfile,
    stats: ThesisRoleStats,
    role: 'adviser' | 'editor' | 'statistician'
): number {
    return computeCompatibility(profile, stats, role);
}

/**
 * Generates a recency score that weights experts who were active recently.
 */
function computeRecencyScore(date: Date | null): number {
    if (!date) return 0;
    const diffMs = Date.now() - date.getTime();
    if (Number.isNaN(diffMs) || diffMs < 0) {
        return 20;
    }
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays <= 1) return 20;
    if (diffDays >= 30) return 0;
    return Math.round((30 - diffDays) * (20 / 30));
}

/**
 * Calculates expert compatibility using availability, skills coverage, and activity recency.
 */
function computeCompatibility(
    profile: UserProfile,
    stats: ThesisRoleStats,
    role: 'adviser' | 'editor' | 'statistician'
): number {
    const capacity = profile.slots ?? 0;
    const active = role === 'adviser'
        ? stats.adviserCount
        : role === 'editor'
            ? stats.editorCount
            : stats.statisticianCount;
    const openSlots = capacity > 0 ? Math.max(capacity - active, 0) : 0;
    const availabilityRatio = capacity > 0 ? openSlots / capacity : 0;
    const availabilityScore = Math.round(availabilityRatio * 40);
    const skillsScore = Math.min((profile.skillRatings?.length ?? 0) * 5, 20);
    const recencyScore = computeRecencyScore(normalizeDateInput(profile.lastActive));
    const penalty = Math.min(active * 3, 15);
    const baseScore = 40;
    const total = baseScore + availabilityScore + skillsScore + recencyScore - penalty;
    return Math.max(0, Math.min(100, Math.round(total)));
}

/**
 * Calculates expert compatibility based purely on skill match score.
 * Uses TF-IDF skill match score for thesis-expert matching.
 * The score is based on how well the expert's skills match the thesis title.
 * @param skillMatchScore - TF-IDF based match score (0-1)
 */
function computeCompatibilityWithSkills(
    _profile: UserProfile,
    _stats: ThesisRoleStats,
    _role: 'adviser' | 'editor' | 'statistician',
    skillMatchScore: number
): number {
    // Scale skill match score (0-1) to 0-100%
    return Math.max(0, Math.min(100, Math.round(skillMatchScore * 100)));
}

// -----
const DEFAULT_STOPWORDS = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'have', 'in',
    'is', 'it', 'of', 'on', 'or', 'that', 'the', 'this', 'to', 'with',
]);

function normalizeWord(raw: string): string | null {
    const cleaned = raw.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!cleaned || DEFAULT_STOPWORDS.has(cleaned)) {
        return null;
    }
    return cleaned;
}

function tokenize(text: string | undefined | null): string[] {
    if (!text) {
        return [];
    }
    const candidateWords = text.split(/\s+/g);
    const tokens = candidateWords
        .map(normalizeWord)
        .filter((token): token is string => Boolean(token));
    return tokens;
}

function computeTermFrequency(tokens: string[]): Map<string, number> {
    const tf = new Map<string, number>();
    tokens.forEach((token) => {
        tf.set(token, (tf.get(token) ?? 0) + 1);
    });
    return tf;
}

function computeInverseDocumentFrequency(documents: string[][]): Map<string, number> {
    const docCount = documents.length;
    const df = new Map<string, number>();

    documents.forEach((tokens) => {
        const seen = new Set<string>();
        tokens.forEach((token) => {
            if (!seen.has(token)) {
                seen.add(token);
                df.set(token, (df.get(token) ?? 0) + 1);
            }
        });
    });

    const idf = new Map<string, number>();
    df.forEach((count, token) => {
        idf.set(token, Math.log((docCount + 1) / (count + 1)) + 1);
    });

    return idf;
}

function buildTfidfVector(tf: Map<string, number>, idf: Map<string, number>): Map<string, number> {
    const tfidf = new Map<string, number>();
    tf.forEach((frequency, token) => {
        const idfWeight = idf.get(token) ?? 0;
        const tfWeight = 1 + Math.log(frequency);
        tfidf.set(token, tfWeight * idfWeight);
    });
    return tfidf;
}

function toVectorMagnitude(vector: Map<string, number>): number {
    let sumSquares = 0;
    vector.forEach((value) => {
        sumSquares += value * value;
    });
    return Math.sqrt(sumSquares);
}

function cosineSimilarity(vectorA: Map<string, number>, vectorB: Map<string, number>): number {
    let dot = 0;
    vectorA.forEach((value, token) => {
        const other = vectorB.get(token);
        if (other !== undefined) {
            dot += value * other;
        }
    });
    const magnitude = toVectorMagnitude(vectorA) * toVectorMagnitude(vectorB);
    if (magnitude === 0) {
        return 0;
    }
    return dot / magnitude;
}

export interface ResearchDocument {
    uid: string;
    profile: UserProfile;
    text: string;
}

export interface ResearchMatch {
    uid: string;
    profile: UserProfile;
    similarity: number;
}

/**
 * Computes research-fit recommendations using a TF-IDF + cosine similarity pipeline.
 * @param studentText - Combined research title/abstract or similar student submission text
 * @param experts - Array of expert documents with textual metadata to compare against
 * @returns Expert matches sorted by similarity in descending order
 */
export function rankExpertsByResearchFit(studentText: string, experts: ResearchDocument[]): ResearchMatch[] {
    const sanitizedStudentText = studentText ?? '';
    const expertTexts = experts.map((document) => document.text ?? '');

    // Tokenization
    const studentTokens = tokenize(sanitizedStudentText);
    const expertTokens = expertTexts.map((text) => tokenize(text));

    // Term Frequency (TF)
    const studentTf = computeTermFrequency(studentTokens);
    const expertTf = expertTokens.map((tokens) => computeTermFrequency(tokens));

    // Inverse Document Frequency (IDF)
    const idf = computeInverseDocumentFrequency([studentTokens, ...expertTokens]);

    // TF-IDF Vectorization
    const studentVector = buildTfidfVector(studentTf, idf);
    const expertVectors = expertTf.map((tf) => buildTfidfVector(tf, idf));

    // Similarity Scoring
    const matches = experts.map((expert, index) => {
        const similarity = cosineSimilarity(studentVector, expertVectors[index]);
        return {
            uid: expert.uid,
            profile: expert.profile,
            similarity,
        } satisfies ResearchMatch;
    });

    matches.sort((a, b) => b.similarity - a.similarity);

    return matches;
}
