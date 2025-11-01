import * as React from 'react';
import { Box, Card, CardContent, Typography, type SxProps, type Theme } from '@mui/material';

export interface UnauthorizedNoticeProps {
    /** Headline displayed to the user */
    title?: string;
    /** Supporting description describing the authorization requirement */
    description?: string;
    /** Choose between a contained card or a bare box container */
    variant?: 'card' | 'box';
    /** Optional styles forwarded to the root container */
    sx?: SxProps<Theme>;
}

/**
 * Reusable notice shown when the active session does not have the proper role.
 * Keeps copy and layout consistent across management pages while remaining flexible.
 */
export function UnauthorizedNotice({
    title = 'Not authorized',
    description = 'You do not have permission to access this area.',
    variant = 'card',
    sx,
}: UnauthorizedNoticeProps) {
    const content = (
        <>
            <Typography variant="h5" gutterBottom>
                {title}
            </Typography>
            <Typography variant="body1">{description}</Typography>
        </>
    );

    if (variant === 'box') {
        return (
            <Box sx={{ p: 4, ...sx }}>
                {content}
            </Box>
        );
    }

    return (
        <Card sx={sx}>
            <CardContent>{content}</CardContent>
        </Card>
    );
}

export default UnauthorizedNotice;
