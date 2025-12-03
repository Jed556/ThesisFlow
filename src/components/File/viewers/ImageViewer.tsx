/**
 * Image Viewer Component
 * Displays images with fullscreen support
 */

import * as React from 'react';
import { Box, IconButton, Paper, Skeleton, Tooltip, Typography } from '@mui/material';
import {
    Fullscreen as FullscreenIcon,
    FullscreenExit as FullscreenExitIcon,
} from '@mui/icons-material';

export interface ImageViewerProps {
    /** URL of the image file */
    url: string;
    /** Alt text for the image */
    alt?: string;
    /** Height of the viewer container */
    height?: number | string;
}

/**
 * Image Viewer component with fullscreen support
 */
export const ImageViewer: React.FC<ImageViewerProps> = ({ url, alt = 'Image', height = '100%' }) => {
    const [isLoading, setIsLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = React.useState(false);
    const containerRef = React.useRef<HTMLDivElement>(null);

    const toggleFullscreen = React.useCallback(() => {
        if (!containerRef.current) return;

        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().then(() => setIsFullscreen(true));
        } else {
            document.exitFullscreen().then(() => setIsFullscreen(false));
        }
    }, []);

    React.useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(Boolean(document.fullscreenElement));
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

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

    return (
        <Box
            ref={containerRef}
            sx={{
                height,
                display: 'flex',
                flexDirection: 'column',
                bgcolor: 'background.default',
                borderRadius: 1,
                overflow: 'hidden',
                position: 'relative',
            }}
        >
            {/* Image Toolbar */}
            <Paper
                elevation={1}
                sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    zIndex: 1,
                    borderRadius: 1,
                }}
            >
                <Tooltip title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
                    <IconButton size="small" onClick={toggleFullscreen}>
                        {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                    </IconButton>
                </Tooltip>
            </Paper>

            {/* Image Content */}
            <Box
                sx={{
                    flexGrow: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 2,
                    overflow: 'auto',
                }}
            >
                {isLoading && <Skeleton variant="rectangular" width="100%" height="100%" />}
                <Box
                    component="img"
                    src={url}
                    alt={alt}
                    onLoad={() => setIsLoading(false)}
                    onError={() => {
                        setError('Failed to load image');
                        setIsLoading(false);
                    }}
                    sx={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                        display: isLoading ? 'none' : 'block',
                    }}
                />
            </Box>
        </Box>
    );
};

export default ImageViewer;
