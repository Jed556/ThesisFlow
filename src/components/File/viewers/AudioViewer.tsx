/**
 * Audio Viewer Component
 * HTML5 audio player for mp3, wav, ogg, and other audio formats
 */

import * as React from 'react';
import { Box, Typography } from '@mui/material';

export interface AudioViewerProps {
    /** URL of the audio file */
    url: string;
    /** File name to display */
    fileName?: string;
}

/**
 * Audio Viewer component with native HTML5 controls
 */
export const AudioViewer: React.FC<AudioViewerProps> = ({ url, fileName }) => {
    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                p: 4,
            }}
        >
            {fileName && (
                <Typography variant="h6" color="text.secondary">
                    {fileName}
                </Typography>
            )}
            <Box
                component="audio"
                controls
                src={url}
                sx={{ width: '100%', maxWidth: 500 }}
            >
                Your browser does not support the audio tag.
            </Box>
        </Box>
    );
};

export default AudioViewer;
