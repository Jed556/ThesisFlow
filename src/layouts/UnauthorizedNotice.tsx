import * as React from 'react';
import {
    Box, Container, Paper, Typography,
    type SxProps, type Theme
} from '@mui/material';
import { Lock as LockIcon } from '@mui/icons-material';

export interface UnauthorizedNoticeProps {
    /** Headline displayed to the user */
    title?: string;
    /** Supporting description describing the authorization requirement */
    description?: string;
    /** Choose between a contained card or a bare box container */
    variant?: 'card' | 'box';
    /** Icon component to display above the title */
    icon?: React.ElementType;
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
    icon: IconComponent = LockIcon,
    sx,
}: UnauthorizedNoticeProps) {
    const content = (
        <>
            <Box sx={{ mb: 4 }}>
                <IconComponent color="warning" sx={{ fontSize: 80, mb: 2 }} />
                <Typography variant="h4" component="h1" gutterBottom>
                    {title}
                </Typography>
            </Box>

            <Box sx={{ mb: 4 }}>
                <Typography variant="body1" color="text.secondary">
                    {description}
                </Typography>
            </Box>

            <Box sx={{ mt: 4 }}>
                <Typography variant="body2" color="text.secondary">
                    If you believe this is an error, please contact your administrator.
                </Typography>
            </Box>
        </>
    );

    const containerSx = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '90%',
        px: 2,
        ...sx,
    } as const;

    if (variant === 'box') {
        return (
            <Container maxWidth="md" sx={containerSx}>
                <Box sx={{ p: 6, textAlign: 'center' }}>
                    {content}
                </Box>
            </Container>
        );
    }

    return (
        <Container maxWidth="md" sx={containerSx}>
            <Paper elevation={3} sx={{ p: 6, textAlign: 'center' }}>
                {content}
            </Paper>
        </Container>
    );
}

export default UnauthorizedNotice;
