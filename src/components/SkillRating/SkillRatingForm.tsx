import * as React from 'react';
import {
    Box, Card, CardContent, Divider, FormControl, FormControlLabel,
    Radio, RadioGroup, Skeleton, Stack, Typography, Alert,
} from '@mui/material';
import type { ExpertSkillRating, SkillTemplateRecord } from '../../types/skillTemplate';
import { SKILL_RATING_LABELS, MIN_SKILL_RATING, MAX_SKILL_RATING } from '../../types/skillTemplate';

// ============================================================================
// Types
// ============================================================================

export interface SkillRatingFormProps {
    /** Department name for header display */
    department: string;
    /** List of skill templates to rate */
    skills: SkillTemplateRecord[];
    /** Current skill ratings */
    ratings: ExpertSkillRating[];
    /** Called when a rating changes */
    onRatingChange: (skillId: string, skillName: string, rating: number) => void;
    /** Whether the form is in read-only mode */
    readOnly?: boolean;
    /** Whether skills are loading */
    loading?: boolean;
    /** Show rating scale legend */
    showLegend?: boolean;
    /** Compact mode for smaller displays */
    compact?: boolean;
}

// ============================================================================
// Rating Scale Legend Component
// ============================================================================

interface RatingScaleLegendProps {
    compact?: boolean;
}

function RatingScaleLegend({ compact = false }: RatingScaleLegendProps) {
    const labels = Object.entries(SKILL_RATING_LABELS)
        .filter(([key]) => Number(key) >= MIN_SKILL_RATING && Number(key) <= MAX_SKILL_RATING)
        .map(([key, value]) => ({ rating: Number(key), label: value }));

    return (
        <Box
            sx={{
                bgcolor: 'action.hover',
                borderRadius: 1,
                p: compact ? 1.5 : 2,
                mb: 2,
            }}
        >
            <Typography
                variant={compact ? 'body2' : 'subtitle2'}
                fontWeight="medium"
                gutterBottom
            >
                Rating Scale (1-10):
            </Typography>
            <Box
                component="ul"
                sx={{
                    m: 0,
                    pl: 2,
                    columns: compact ? 1 : 2,
                    columnGap: 4,
                }}
            >
                {labels.map(({ rating, label }) => (
                    <Typography
                        key={rating}
                        component="li"
                        variant={compact ? 'caption' : 'body2'}
                        color="text.secondary"
                        sx={{ mb: 0.25 }}
                    >
                        {rating} – {label}
                    </Typography>
                ))}
            </Box>
        </Box>
    );
}

// ============================================================================
// Single Skill Rating Item
// ============================================================================

interface SkillRatingItemProps {
    skill: SkillTemplateRecord;
    currentRating: number;
    onRatingChange: (rating: number) => void;
    readOnly?: boolean;
    compact?: boolean;
}

function SkillRatingItem({
    skill,
    currentRating,
    onRatingChange,
    readOnly = false,
    compact = false,
}: SkillRatingItemProps) {
    const ratings = Array.from(
        { length: MAX_SKILL_RATING - MIN_SKILL_RATING + 1 },
        (_, i) => MIN_SKILL_RATING + i
    );

    return (
        <Card
            variant="outlined"
            sx={{
                mb: 2,
                borderColor: currentRating === 0 ? 'warning.light' : 'divider',
                '&:hover': {
                    borderColor: 'primary.main',
                    boxShadow: 1,
                },
            }}
        >
            <CardContent sx={{ p: compact ? 1.5 : 2, '&:last-child': { pb: compact ? 1.5 : 2 } }}>
                <Stack spacing={1}>
                    {/* Skill Name and Description */}
                    <Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                            <Typography
                                variant={compact ? 'body2' : 'subtitle1'}
                                fontWeight="medium"
                            >
                                {skill.name}
                            </Typography>
                            {currentRating === 0 && (
                                <Typography
                                    variant="caption"
                                    color="error"
                                    sx={{ fontWeight: 'bold' }}
                                >
                                    *
                                </Typography>
                            )}
                        </Stack>
                        {skill.description && (
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: 'block', mt: 0.5 }}
                            >
                                ({skill.description})
                            </Typography>
                        )}
                    </Box>

                    {/* Rating Radio Buttons - Google Forms Style */}
                    <FormControl component="fieldset" disabled={readOnly}>
                        <Stack
                            direction="row"
                            spacing={0}
                            justifyContent="space-between"
                            alignItems="center"
                            sx={{ mt: 1 }}
                        >
                            {/* Rating Numbers Header */}
                            {ratings.map((rating) => (
                                <Box
                                    key={rating}
                                    sx={{
                                        flex: 1,
                                        textAlign: 'center',
                                        minWidth: compact ? 28 : 36,
                                    }}
                                >
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        sx={{ fontWeight: currentRating === rating ? 'bold' : 'normal' }}
                                    >
                                        {rating}
                                    </Typography>
                                </Box>
                            ))}
                        </Stack>
                        <RadioGroup
                            row
                            value={currentRating.toString()}
                            onChange={(e) => onRatingChange(Number(e.target.value))}
                            sx={{
                                justifyContent: 'space-between',
                                flexWrap: 'nowrap',
                            }}
                        >
                            {ratings.map((rating) => (
                                <FormControlLabel
                                    key={rating}
                                    value={rating.toString()}
                                    control={
                                        <Radio
                                            size="small"
                                            sx={{
                                                p: compact ? 0.5 : 1,
                                                '& .MuiSvgIcon-root': {
                                                    fontSize: compact ? 18 : 22,
                                                },
                                            }}
                                        />
                                    }
                                    label=""
                                    sx={{
                                        flex: 1,
                                        mx: 0,
                                        justifyContent: 'center',
                                        minWidth: compact ? 28 : 36,
                                    }}
                                />
                            ))}
                        </RadioGroup>
                    </FormControl>

                    {/* Current Rating Label */}
                    {currentRating > 0 && (
                        <Typography
                            variant="caption"
                            color="primary"
                            textAlign="center"
                            sx={{ fontStyle: 'italic' }}
                        >
                            {SKILL_RATING_LABELS[currentRating] ?? `Rating: ${currentRating}`}
                        </Typography>
                    )}
                </Stack>
            </CardContent>
        </Card>
    );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * A Google Forms-style skill rating form component.
 * Displays skills with 1-10 radio button ratings.
 */
export function SkillRatingForm({
    department,
    skills,
    ratings,
    onRatingChange,
    readOnly = false,
    loading = false,
    showLegend = true,
    compact = false,
}: SkillRatingFormProps) {
    // Build a map for quick rating lookup
    const ratingsMap = React.useMemo(() => {
        const map = new Map<string, number>();
        ratings.forEach((r) => map.set(r.skillId, r.rating));
        return map;
    }, [ratings]);

    // Group skills by category
    const skillsByCategory = React.useMemo(() => {
        const grouped = new Map<string, SkillTemplateRecord[]>();
        const uncategorized: SkillTemplateRecord[] = [];

        skills
            .filter((s) => s.isActive)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            .forEach((skill) => {
                const category = skill.category?.trim();
                if (category) {
                    const existing = grouped.get(category) ?? [];
                    existing.push(skill);
                    grouped.set(category, existing);
                } else {
                    uncategorized.push(skill);
                }
            });

        return { grouped, uncategorized };
    }, [skills]);

    // Calculate completion stats
    const activeSkillCount = skills.filter((s) => s.isActive).length;
    const ratedCount = ratings.filter((r) => r.rating >= MIN_SKILL_RATING).length;
    const isComplete = ratedCount >= activeSkillCount;

    if (loading) {
        return (
            <Stack spacing={2}>
                <Skeleton variant="rectangular" height={80} sx={{ borderRadius: 1 }} />
                {[1, 2, 3].map((i) => (
                    <Skeleton key={i} variant="rectangular" height={120} sx={{ borderRadius: 1 }} />
                ))}
            </Stack>
        );
    }

    if (skills.length === 0) {
        return (
            <Alert severity="info">
                No skills have been defined for this department yet.
                Skills can be configured in the Skills Management page.
            </Alert>
        );
    }

    return (
        <Box>
            {/* Header */}
            <Box
                sx={{
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    p: compact ? 1.5 : 2,
                    borderRadius: '8px 8px 0 0',
                    mb: 0,
                }}
            >
                <Typography
                    variant={compact ? 'subtitle1' : 'h6'}
                    fontWeight="bold"
                    textTransform="uppercase"
                >
                    {department}
                </Typography>
            </Box>

            {/* Content */}
            <Box
                sx={{
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: 'divider',
                    borderTop: 0,
                    borderRadius: '0 0 8px 8px',
                    p: compact ? 1.5 : 2,
                }}
            >
                {/* Section Title */}
                <Typography variant="subtitle2" fontWeight="medium" gutterBottom>
                    II. Expertise & Research Interests
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Please rate your level of expertise in the following areas on a scale of 1
                    (Novice) to 10 (Expert).
                </Typography>

                {/* Legend */}
                {showLegend && <RatingScaleLegend compact={compact} />}

                {/* Completion Status */}
                {!isComplete && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        {activeSkillCount - ratedCount} skill(s) still need to be rated.
                        All skills must be rated before requesting thesis slots.
                    </Alert>
                )}

                {/* Skills by Category */}
                {Array.from(skillsByCategory.grouped.entries()).map(([category, categorySkills]) => (
                    <Box key={category} sx={{ mb: 3 }}>
                        <Typography
                            variant="overline"
                            color="text.secondary"
                            sx={{ display: 'block', mb: 1 }}
                        >
                            {category}
                        </Typography>
                        {categorySkills.map((skill) => (
                            <SkillRatingItem
                                key={skill.id}
                                skill={skill}
                                currentRating={ratingsMap.get(skill.id) ?? 0}
                                onRatingChange={(rating) =>
                                    onRatingChange(skill.id, skill.name, rating)
                                }
                                readOnly={readOnly}
                                compact={compact}
                            />
                        ))}
                    </Box>
                ))}

                {/* Uncategorized Skills */}
                {skillsByCategory.uncategorized.length > 0 && (
                    <Box>
                        {skillsByCategory.grouped.size > 0 && (
                            <Typography
                                variant="overline"
                                color="text.secondary"
                                sx={{ display: 'block', mb: 1 }}
                            >
                                Other Skills
                            </Typography>
                        )}
                        {skillsByCategory.uncategorized.map((skill) => (
                            <SkillRatingItem
                                key={skill.id}
                                skill={skill}
                                currentRating={ratingsMap.get(skill.id) ?? 0}
                                onRatingChange={(rating) =>
                                    onRatingChange(skill.id, skill.name, rating)
                                }
                                readOnly={readOnly}
                                compact={compact}
                            />
                        ))}
                    </Box>
                )}

                {/* Footer Note */}
                <Divider sx={{ my: 2 }} />
                <Typography variant="caption" color="text.secondary">
                    Note: Evaluation results will be kept confidential
                </Typography>
            </Box>
        </Box>
    );
}

export default SkillRatingForm;
