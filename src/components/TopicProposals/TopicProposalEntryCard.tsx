import * as React from 'react';
import { Box, Card, CardContent, Chip, Divider, Stack, Typography } from '@mui/material';
import type { TopicProposalEntry } from '../../types/topicProposal';
import type { UserProfile } from '../../types/profile';
import { Avatar, Name } from '../Avatar';
import { getStatusChipConfig } from '../../utils/topicProposalUtils';

export interface TopicProposalEntryCardProps {
    entry: TopicProposalEntry;
    author?: UserProfile | null;
    actions?: React.ReactNode;
    footer?: React.ReactNode;
    highlight?: boolean;
}

function formatUserName(profile?: UserProfile | null, fallback?: string): string {
    if (!profile) {
        return fallback ?? 'Unknown member';
    }

    const segments = [profile.name?.prefix, profile.name?.first, profile.name?.middle, profile.name?.last, profile.name?.suffix]
        .filter((segment): segment is string => Boolean(segment && segment.trim()))
        .map((segment) => segment.trim());

    if (segments.length === 0) {
        return profile.email;
    }

    return segments.join(' ');
}

/**
 * Generic card for rendering topic proposal entries with reusable status, author, and action slots.
 */
export default function TopicProposalEntryCard(props: TopicProposalEntryCardProps) {
    const { entry, author, actions, footer, highlight = false } = props;
    const statusChip = getStatusChipConfig(entry.status);

    return (
        <Card
            variant={highlight ? 'outlined' : undefined}
            sx={{
                borderColor: highlight ? 'success.main' : undefined,
                height: '100%',
            }}
        >
            <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="h6" gutterBottom>
                            {entry.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            {entry.abstract}
                        </Typography>
                    </Box>
                    <Chip label={statusChip.label} color={statusChip.color} size="small" />
                </Box>

                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                    <Avatar
                        uid={author?.uid ?? entry.proposedBy}
                        initials={[Name.FIRST, Name.LAST]}
                        label={formatUserName(author, entry.proposedBy)}
                        tooltip="email"
                        mode="chip"
                        chipProps={{ size: 'small', color: 'default' }}
                    />
                    <Typography variant="caption" color="text.secondary">
                        Proposed by {formatUserName(author, entry.proposedBy)}
                    </Typography>
                </Stack>

                {entry.problemStatement && (
                    <Box sx={{ mb: 1.5 }}>
                        <Typography variant="subtitle2">Problem Statement</Typography>
                        <Typography variant="body2" color="text.secondary">
                            {entry.problemStatement}
                        </Typography>
                    </Box>
                )}

                {entry.expectedOutcome && (
                    <Box sx={{ mb: 1.5 }}>
                        <Typography variant="subtitle2">Expected Outcome</Typography>
                        <Typography variant="body2" color="text.secondary">
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
