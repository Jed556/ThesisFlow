/**
 * Unsupported File Viewer Component
 * Fallback viewer for unsupported file types with download option
 */

import * as React from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import { Download as DownloadIcon } from '@mui/icons-material';
import type { FileAttachment } from '../../../types/file';

export interface UnsupportedViewerProps {
    /** The file that cannot be previewed */
    file: FileAttachment;
    /** Custom download handler */
    onDownload?: () => void;
}

/**
 * Fallback viewer for unsupported file types
 * Displays a message and download button
 */
export const UnsupportedViewer: React.FC<UnsupportedViewerProps> = ({ file, onDownload }) => {
    const handleDownload = React.useCallback(() => {
        if (onDownload) {
            onDownload();
        } else if (file.url) {
            window.open(file.url, '_blank', 'noopener,noreferrer');
        }
    }, [file.url, onDownload]);

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                p: 4,
                textAlign: 'center',
            }}
        >
            <Typography variant="h6" color="text.secondary">
                Preview not available
            </Typography>
            <Typography variant="body2" color="text.secondary">
                This file type cannot be previewed in the browser.
            </Typography>
            <IconButton
                color="primary"
                onClick={handleDownload}
                sx={{ bgcolor: 'action.hover', p: 2 }}
            >
                <DownloadIcon />
            </IconButton>
            <Typography variant="caption" color="text.secondary">
                Click to download {file.name}
            </Typography>
        </Box>
    );
};

export default UnsupportedViewer;
