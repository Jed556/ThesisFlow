/**
 * Text Viewer Component
 * Displays plain text files with monospace formatting
 */

import * as React from 'react';
import { Box, Skeleton, Typography } from '@mui/material';

export interface TextViewerProps {
    /** URL of the text file */
    url: string;
    /** Height of the viewer container */
    height?: number | string;
}

/**
 * Text Viewer component for plain text, markdown, CSV, JSON, and XML files
 */
export const TextViewer: React.FC<TextViewerProps> = ({ url, height = '100%' }) => {
    const [content, setContent] = React.useState<string>('');
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        setIsLoading(true);
        setError(null);

        fetch(url)
            .then((response) => {
                if (!response.ok) throw new Error('Failed to fetch file');
                return response.text();
            })
            .then((text) => {
                setContent(text);
                setIsLoading(false);
            })
            .catch((err) => {
                setError(err.message || 'Failed to load text file');
                setIsLoading(false);
            });
    }, [url]);

    if (error) {
        return (
            <Box
                sx={{
                    height,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <Typography color="error">{error}</Typography>
            </Box>
        );
    }

    if (isLoading) {
        return (
            <Box sx={{ height, p: 2 }}>
                <Skeleton variant="text" width="100%" />
                <Skeleton variant="text" width="80%" />
                <Skeleton variant="text" width="90%" />
                <Skeleton variant="text" width="70%" />
            </Box>
        );
    }

    return (
        <Box
            sx={{
                height,
                overflow: 'auto',
                p: 2,
                bgcolor: 'background.paper',
                borderRadius: 1,
            }}
        >
            <Typography
                component="pre"
                variant="body2"
                sx={{
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    m: 0,
                }}
            >
                {content}
            </Typography>
        </Box>
    );
};

export default TextViewer;
