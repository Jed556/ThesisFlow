/**
 * Video Viewer Component
 * HTML5 video player for mp4, webm, and ogg formats
 */

import * as React from 'react';
import { Box } from '@mui/material';

export interface VideoViewerProps {
    /** URL of the video file */
    url: string;
    /** Height of the viewer container */
    height?: number | string;
}

/**
 * Video Viewer component with native HTML5 controls
 */
export const VideoViewer: React.FC<VideoViewerProps> = ({ url, height = '100%' }) => {
    return (
        <Box
            sx={{
                height,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'black',
                borderRadius: 1,
                overflow: 'hidden',
            }}
        >
            <Box
                component="video"
                controls
                src={url}
                sx={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                }}
            >
                Your browser does not support the video tag.
            </Box>
        </Box>
    );
};

export default VideoViewer;
