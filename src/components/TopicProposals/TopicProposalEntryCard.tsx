import * as React from 'react';
import { Box, Card, CardContent, Chip, Collapse, Divider, Stack, Typography } from '@mui/material';
import { Category as CategoryIcon, EnergySavingsLeaf as EcoIcon, Public as PublicIcon } from '@mui/icons-material';
import type { TopicProposalEntry } from '../../types/proposal';
import type { UserProfile } from '../../types/profile';
import { Avatar, Name } from '../Avatar';
import { getStatusChipConfig } from '../../utils/topicProposalUtils';

export interface TopicProposalEntryCardProps {
    entry: TopicProposalEntry;
    author?: UserProfile | null;
    actions?: React.ReactNode;
    footer?: React.ReactNode;
    highlight?: boolean;
    /** Whether to show classification (agenda, ESG, SDG) - defaults to true */
    showClassification?: boolean;
}

/**
 * Generic card for rendering topic proposal entries with reusable status, author, and action slots.
 */
export default function TopicProposalEntryCard(props: TopicProposalEntryCardProps) {
    const { entry, author, actions, footer, highlight = false, showClassification = true } = props;
    const statusChip = getStatusChipConfig(entry.status ?? 'draft');

    // Check if classification data exists
    const hasClassification = Boolean(entry.agenda || entry.ESG || entry.SDG);

    // Format agenda path for display
    const agendaLabel = React.useMemo(() => {
        if (!entry.agenda?.agendaPath?.length) return null;
        const path = entry.agenda.agendaPath;
        // Show last 2 levels for brevity, or all if <= 2
        if (path.length <= 2) return path.join(' > ');
        return `${path[path.length - 2]} > ${path[path.length - 1]}`;
    }, [entry.agenda]);

    return (
        <Card
            elevation={2}
            sx={{
                borderColor: highlight ? 'success.main' : undefined,
                border: highlight ? 1 : undefined,
                height: '100%',
                bgcolor: 'background.paper',
            }}
        >
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        <Typography variant="h6" gutterBottom sx={{
                            wordBreak: 'break-word', overflowWrap: 'break-word'
                        }}>
                            {entry.title}
                        </Typography>
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="subtitle2">Brief Description</Typography>
                            <Typography variant="body2" color="text.secondary"
                                sx={{
                                    wordBreak: 'break-word', overflowWrap: 'break-word',
                                    whiteSpace: 'pre-wrap'
                                }}>
                                {entry.description}
                            </Typography>
                        </Box>
                    </Box>
                    <Chip label={statusChip.label} color={statusChip.color} size="small" />
                </Box>

                <Stack direction="row" spacing={.5} alignItems="center" sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                        Proposed by
                    </Typography>
                    <Avatar
                        uid={author?.uid ?? entry.proposedBy}
                        initials={[Name.FIRST, Name.LAST]}
                        tooltip="email"
                        mode="chip"
                        editable={false}
                        chipProps={{ size: 'small', color: 'default' }}
                    />
                </Stack>

                {entry.problemStatement && (
                    <Box sx={{ mb: 1.5 }}>
                        <Typography variant="subtitle2">Problem Statement</Typography>
                        <Typography variant="body2" color="text.secondary"
                            sx={{
                                wordBreak: 'break-word', overflowWrap: 'break-word',
                                whiteSpace: 'pre-wrap'
                            }}>
                            {entry.problemStatement}
                        </Typography>
                    </Box>
                )}

                {entry.expectedOutcome && (
                    <Box sx={{ mb: 1.5 }}>
                        <Typography variant="subtitle2">Expected Outcome</Typography>
                        <Typography variant="body2" color="text.secondary"
                            sx={{
                                wordBreak: 'break-word', overflowWrap: 'break-word',
                                whiteSpace: 'pre-wrap'
                            }}>
                            {entry.expectedOutcome}
                        </Typography>
                    </Box>
                )}

                {entry.keywords && entry.keywords.length > 0 && (
                    <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 2 }}>
                        {entry.keywords.map((keyword) => (
                            <Chip key={keyword} label={keyword} size="small" variant="outlined" />
                        ))}
                    </Stack>
                )}

                {/* Classification Section - Agenda, ESG, SDG */}
                <Collapse in={showClassification && hasClassification}>
                    <Box sx={{
                        p: 1.5, mt: 1, mb: 1, bgcolor: 'action.hover', borderRadius: 1
                    }}>
                        <Typography variant="subtitle2" gutterBottom sx={{
                            fontWeight: 'medium', color: 'text.secondary', fontSize: '0.75rem'
                        }}>
                            Classification
                        </Typography>
                        <Stack spacing={1}>
                            {agendaLabel && (
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <CategoryIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                    <Typography variant="body2" sx={{ flex: 1 }}>
                                        {agendaLabel}
                                    </Typography>
                                    {entry.agenda?.type === 'departmental' && (
                                        <Chip
                                            label={entry.agenda.department ?? 'Dept'}
                                            size="small"
                                            variant="outlined"
                                            sx={{ height: 20, fontSize: '0.7rem' }}
                                        />
                                    )}
                                </Stack>
                            )}
                            {entry.ESG && (
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <EcoIcon sx={{ fontSize: 16, color: 'success.main' }} />
                                    <Typography variant="body2">ESG: {entry.ESG}</Typography>
                                </Stack>
                            )}
                            {entry.SDG && (
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <PublicIcon sx={{ fontSize: 16, color: 'info.main' }} />
                                    <Typography variant="body2" sx={{
                                        overflow: 'hidden', textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        SDG: {entry.SDG}
                                    </Typography>
                                </Stack>
                            )}
                        </Stack>
                    </Box>
                </Collapse>

                {actions && (
                    <Box sx={{ mt: 2 }}>
                        <Divider sx={{ mb: 2 }} />
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {actions}
                        </Box>
                    </Box>
                )}

                {footer && (
                    <Box sx={{ mt: 2 }}>
                        <Divider sx={{ mb: 2 }} />
                        {footer}
                    </Box>
                )}
            </CardContent>
        </Card>
    );
}
