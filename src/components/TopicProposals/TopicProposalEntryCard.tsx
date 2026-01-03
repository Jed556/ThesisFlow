import * as React from 'react';
import { Box, Card, CardContent, Chip, Divider, Stack, Typography } from '@mui/material';
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
}

/**
 * Generic card for rendering topic proposal entries with reusable status, author, and action slots.
 */
export default function TopicProposalEntryCard(props: TopicProposalEntryCardProps) {
    const { entry, author, actions, footer, highlight = false } = props;
    const statusChip = getStatusChipConfig(entry.status ?? 'draft');

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
                        <Typography variant="h6" gutterBottom sx={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                            {entry.title}
                        </Typography>
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="subtitle2">Brief Description</Typography>
                            <Typography variant="body2" color="text.secondary"
                                sx={{ wordBreak: 'break-word', overflowWrap: 'break-word', whiteSpace: 'pre-wrap' }}>
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
                            sx={{ wordBreak: 'break-word', overflowWrap: 'break-word', whiteSpace: 'pre-wrap' }}>
                            {entry.problemStatement}
                        </Typography>
                    </Box>
                )}

                {entry.expectedOutcome && (
                    <Box sx={{ mb: 1.5 }}>
                        <Typography variant="subtitle2">Expected Outcome</Typography>
                        <Typography variant="body2" color="text.secondary"
                            sx={{ wordBreak: 'break-word', overflowWrap: 'break-word', whiteSpace: 'pre-wrap' }}>
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
