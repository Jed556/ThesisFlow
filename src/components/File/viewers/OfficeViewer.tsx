/**
 * Office Document Viewer Component
 * Uses Microsoft Office Online Viewer for DOCX, XLSX, and PPTX files
 */

import * as React from 'react';
import { Box, CircularProgress, Stack, Typography } from '@mui/material';

export interface OfficeViewerProps {
    /** URL of the Office document (must be publicly accessible) */
    url: string;
    /** Height of the viewer container */
    height?: number | string;
}

/**
 * Office Document Viewer using Microsoft Office Online embed
 * 
 * Supports:
 * - Word documents (.doc, .docx)
 * - Excel spreadsheets (.xls, .xlsx)
 * - PowerPoint presentations (.ppt, .pptx)
 * 
 * Note: The file URL must be publicly accessible for the viewer to work
 */
export const OfficeViewer: React.FC<OfficeViewerProps> = ({ url, height = '100%' }) => {
    const [isLoading, setIsLoading] = React.useState(true);

    // Use Microsoft Office Online Viewer for public URLs
    // Format: https://view.officeapps.live.com/op/embed.aspx?src=<encoded_url>
    const viewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;

    return (
        <Box
            sx={{
                height,
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 1,
                overflow: 'hidden',
                position: 'relative',
            }}
        >
            {isLoading && (
                <Box
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 'background.paper',
                        zIndex: 1,
                    }}
                >
                    <Stack spacing={2} alignItems="center">
                        <CircularProgress />
                        <Typography variant="body2" color="text.secondary">
                            Loading document...
                        </Typography>
                    </Stack>
                </Box>
            )}
            <Box
                component="iframe"
                src={viewerUrl}
                onLoad={() => setIsLoading(false)}
                sx={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                }}
                title="Office Document Viewer"
            />
        </Box>
    );
};

export default OfficeViewer;
