import type { ThesisData } from '../types/thesis';
import type { UserProfile } from '../types/profile';
import { normalizeDateInput } from './dateUtils';
import { isCompletedThesisStatus } from './mentorProfileUtils';

export interface ThesisRoleStats {
    adviserCount: number;
    editorCount: number;
    statisticianCount: number;
}

export interface MentorCardData {
    profile: UserProfile;
    stats: ThesisRoleStats;
    compatibility: number;
    capacity: number;
    activeCount: number;
    openSlots: number;
    rank: number;
}

/**
 * Aggregates counts of adviser and editor roles handled by each user across all theses.
 * \@param theses List of theses to analyze
 * @return Map of user UIDs to their thesis role statistics
 */
export function aggregateThesisStats(theses: (ThesisData & { id: string })[]): Map<string, ThesisRoleStats> {
    const stats = new Map<string, ThesisRoleStats>();

    theses.forEach((thesis) => {
        if (isCompletedThesisStatus(thesis.overallStatus)) {
            return;
        }
        const ensureRecord = (uid: string): ThesisRoleStats => {
            if (!stats.has(uid)) {
                stats.set(uid, { adviserCount: 0, editorCount: 0, statisticianCount: 0 });
            }
            return stats.get(uid)!;
        };

        if (thesis.adviser) {
            const record = ensureRecord(thesis.adviser);
            stats.set(thesis.adviser, {
                adviserCount: record.adviserCount + 1,
                editorCount: record.editorCount,
                statisticianCount: record.statisticianCount,
            });
        }
        if (thesis.editor) {
            const record = ensureRecord(thesis.editor);
            stats.set(thesis.editor, {
                adviserCount: record.adviserCount,
                editorCount: record.editorCount + 1,
                statisticianCount: record.statisticianCount,
            });
        }
        if (thesis.statistician) {
            const record = ensureRecord(thesis.statistician);
            stats.set(thesis.statistician, {
                adviserCount: record.adviserCount,
                editorCount: record.editorCount,
                statisticianCount: record.statisticianCount + 1,
            });
        }
    });

    return stats;
}

/**
 * Computes mentor recommendation cards sorted by compatibility, capacity, and expertise.
 * @param profiles List of user profiles to evaluate as mentors
 * @param role Role to consider ('adviser', 'editor', or 'statistician')
 * @param statsMap Precomputed thesis role statistics for users
 * @return List of MentorCardData sorted by rank
 */
export function computeMentorCards(
    profiles: UserProfile[],
    role: 'adviser' | 'editor' | 'statistician',
    statsMap: Map<string, ThesisRoleStats>,
): MentorCardData[] {
    const scored = profiles.map((profile) => {
        const stats = statsMap.get(profile.uid) ?? { adviserCount: 0, editorCount: 0, statisticianCount: 0 };
        const capacity = profile.capacity ?? 0;
        const active = role === 'adviser'
            ? stats.adviserCount
            : role === 'editor'
                ? stats.editorCount
                : stats.statisticianCount;
        const openSlots = capacity > 0 ? Math.max(capacity - active, 0) : 0;
        const compatibility = computeCompatibility(profile, stats, role);
        const score = compatibility + openSlots * 5 + (profile.skills?.length ?? 0) * 2;

        return {
            profile,
            stats,
            compatibility,
            capacity,
            activeCount: active,
            openSlots,
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
        rank: index + 1,
    }));
}

/**
 * Reusable compatibility evaluator for mentor detail views.
 */
export function evaluateMentorCompatibility(
    profile: UserProfile,
    stats: ThesisRoleStats,
    role: 'adviser' | 'editor' | 'statistician'
): number {
    return computeCompatibility(profile, stats, role);
}

/**
 * Generates a recency score that weights mentors who were active recently.
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
 * Calculates mentor compatibility using availability, skills coverage, and activity recency.
 */
function computeCompatibility(
    profile: UserProfile,
    stats: ThesisRoleStats,
    role: 'adviser' | 'editor' | 'statistician'
): number {
    const capacity = profile.capacity ?? 0;
    const active = role === 'adviser'
        ? stats.adviserCount
        : role === 'editor'
            ? stats.editorCount
            : stats.statisticianCount;
    const openSlots = capacity > 0 ? Math.max(capacity - active, 0) : 0;
    const availabilityRatio = capacity > 0 ? openSlots / capacity : 0;
    const availabilityScore = Math.round(availabilityRatio * 40);
    const skillsScore = Math.min((profile.skills?.length ?? 0) * 5, 20);
    const recencyScore = computeRecencyScore(normalizeDateInput(profile.lastActive));
    const penalty = Math.min(active * 3, 15);
    const baseScore = 40;
    const total = baseScore + availabilityScore + skillsScore + recencyScore - penalty;
    return Math.max(0, Math.min(100, Math.round(total)));
}

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
 * @param mentors - Array of mentor documents with textual metadata to compare against
 * @returns Mentor matches sorted by similarity in descending order
 */
export function rankMentorsByResearchFit(studentText: string, mentors: ResearchDocument[]): ResearchMatch[] {
    const sanitizedStudentText = studentText ?? '';
    const mentorTexts = mentors.map((document) => document.text ?? '');

    // Tokenization
    const studentTokens = tokenize(sanitizedStudentText);
    const mentorTokens = mentorTexts.map((text) => tokenize(text));

    // Term Frequency (TF)
    const studentTf = computeTermFrequency(studentTokens);
    const mentorTf = mentorTokens.map((tokens) => computeTermFrequency(tokens));

    // Inverse Document Frequency (IDF)
    const idf = computeInverseDocumentFrequency([studentTokens, ...mentorTokens]);

    // TF-IDF Vectorization
    const studentVector = buildTfidfVector(studentTf, idf);
    const mentorVectors = mentorTf.map((tf) => buildTfidfVector(tf, idf));

    // Similarity Scoring
    const matches = mentors.map((mentor, index) => {
        const similarity = cosineSimilarity(studentVector, mentorVectors[index]);
        return {
            uid: mentor.uid,
            profile: mentor.profile,
            similarity,
        } satisfies ResearchMatch;
    });

    matches.sort((a, b) => b.similarity - a.similarity);

    return matches;
}
