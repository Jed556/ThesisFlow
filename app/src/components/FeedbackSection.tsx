import * as React from 'react';
import {
    Typography,
    Box,
    Chip,
    Card,
    CardContent,
    Avatar,
    Stack,
    Divider,
} from '@mui/material';
import {
    Description,
    Person,
    Edit,
} from '@mui/icons-material';
import type { ThesisComment } from '../types/thesis';

interface FeedbackSectionProps {
    comments: ThesisComment[];
}

export function FeedbackSection({ comments }: FeedbackSectionProps) {
    if (comments.length === 0) {
        return null;
    }

    return (
        <Box>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Person sx={{ mr: 1 }} />
                Recent Feedback
            </Typography>
            <Stack spacing={2}>
                {comments.slice(0, 2).map((comment, index) => (
                    <Card key={index} variant="outlined">
                        <CardContent sx={{ pb: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                <Avatar sx={{ width: 32, height: 32, mr: 2, bgcolor: 'primary.main' }}>
                                    {comment.role === 'adviser' ? <Person /> : <Edit />}
                                </Avatar>
                                <Box sx={{ flexGrow: 1 }}>
                                    <Typography variant="subtitle2">
                                        {comment.author}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {comment.role === 'adviser' ? 'Adviser' : 'Editor'} • {comment.date}
                                    </Typography>
                                    {comment.documentVersion && comment.documentName && (
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                            <Description fontSize="small" color="primary" />
                                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                {comment.documentName}
                                            </Typography>
                                            <Chip
                                                label={`v${comment.documentVersion}`}
                                                size="small"
                                                color="primary"
                                                sx={{ height: 18, fontSize: '0.65rem' }}
                                            />
                                        </Box>
                                    )}
                                </Box>
                            </Box>
                            <Typography variant="body2">
                                {comment.comment}
                            </Typography>
                        </CardContent>
                    </Card>
                ))}
            </Stack>
        </Box>
    );
}
