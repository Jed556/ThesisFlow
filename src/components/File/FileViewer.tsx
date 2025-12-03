/**
 * File Viewer Component
 * Multi-format file viewer that automatically selects the appropriate viewer
 * based on file type/MIME type.
 * 
 * Supports:
 * - PDF files (using react-pdf)
 * - Images (jpg, png, gif, webp, svg, bmp)
 * - Videos (mp4, webm, ogg)
 * - Audio (mp3, wav, ogg)
 * - Text files (txt, md, csv, json, xml)
 * - Office documents (docx, xlsx, pptx - via Microsoft Office Online viewer)
 */

import * as React from 'react';
import {
    Box, CircularProgress, IconButton, Paper, Tooltip, Typography,
} from '@mui/material';
import { ArrowBack as BackIcon, Download as DownloadIcon } from '@mui/icons-material';
import type { FileAttachment, FileCategory } from '../../types/file';
import {
    PDFViewer, ImageViewer, VideoViewer, AudioViewer,
    TextViewer, OfficeViewer, UnsupportedViewer,
} from './viewers';
import { createFileBlobUrl, revokeBlobUrl } from '../../utils/firebase/storage';

/**
 * Supported viewer types based on file category
 */
export type ViewerType = 'pdf' | 'image' | 'video' | 'audio' | 'text' | 'office' | 'unsupported';

/**
 * File viewer props
 */
export interface FileViewerProps {
    /** The file to display */
    file: FileAttachment | null;
    /** Callback when back button is clicked */
    onBack?: () => void;
    /** Height of the viewer container */
    height?: number | string;
    /** Width of the viewer container */
    width?: number | string;
    /** Whether to show the toolbar */
    showToolbar?: boolean;
    /** Additional actions to render in the toolbar */
    toolbarActions?: React.ReactNode;
    /** Custom loading component */
    loadingComponent?: React.ReactNode;
    /** Custom error component */
    errorComponent?: React.ReactNode;
}

/**
 * Determine the file category from MIME type or extension
 */
export function getFileCategory(file?: FileAttachment | null): FileCategory {
    if (!file) return 'other';

    const mimeType = file.mimeType?.toLowerCase() ?? '';
    const extension = file.name?.split('.').pop()?.toLowerCase() ?? '';
    const type = file.type?.toLowerCase() ?? '';

    // Check MIME type first
    if (mimeType.startsWith('image/') || type.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/') || type.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/') || type.startsWith('audio/')) return 'audio';
    if (mimeType === 'application/pdf' || type === 'application/pdf') return 'document';
    if (
        mimeType.includes('word') ||
        mimeType.includes('excel') ||
        mimeType.includes('spreadsheet') ||
        mimeType.includes('powerpoint') ||
        mimeType.includes('presentation')
    ) return 'document';

    // Check extension as fallback
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'tiff'];
    const videoExts = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', '3gp'];
    const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma'];
    const documentExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'csv', 'md'];
    const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz'];

    if (imageExts.includes(extension)) return 'image';
    if (videoExts.includes(extension)) return 'video';
    if (audioExts.includes(extension)) return 'audio';
    if (documentExts.includes(extension)) return 'document';
    if (archiveExts.includes(extension)) return 'archive';

    return 'other';
}

/**
 * Determine the specific viewer type for the file
 */
export function getViewerType(file?: FileAttachment | null): ViewerType {
    if (!file) return 'unsupported';

    const mimeType = file.mimeType?.toLowerCase() ?? '';
    const extension = file.name?.split('.').pop()?.toLowerCase() ?? '';
    const type = file.type?.toLowerCase() ?? '';

    // PDF
    if (mimeType === 'application/pdf' || type === 'application/pdf' || extension === 'pdf') {
        return 'pdf';
    }

    // Images
    const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp'];
    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
    if (imageTypes.some((t) => mimeType.includes(t) || type.includes(t)) || imageExts.includes(extension)) {
        return 'image';
    }

    // Videos
    const videoTypes = ['video/mp4', 'video/webm', 'video/ogg'];
    const videoExts = ['mp4', 'webm', 'ogg', 'ogv'];
    if (videoTypes.some((t) => mimeType.includes(t) || type.includes(t)) || videoExts.includes(extension)) {
        return 'video';
    }

    // Audio
    const audioTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm'];
    const audioExts = ['mp3', 'wav', 'ogg', 'oga', 'webm'];
    if (audioTypes.some((t) => mimeType.includes(t) || type.includes(t)) || audioExts.includes(extension)) {
        return 'audio';
    }

    // Text files
    const textTypes = ['text/plain', 'text/markdown', 'text/csv', 'application/json', 'application/xml'];
    const textExts = ['txt', 'md', 'csv', 'json', 'xml', 'log'];
    if (textTypes.some((t) => mimeType.includes(t) || type.includes(t)) || textExts.includes(extension)) {
        return 'text';
    }

    // Office documents (use iframe with Microsoft/Google viewer)
    const officeTypes = [
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ];
    const officeExts = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
    if (officeTypes.some((t) => mimeType.includes(t) || type.includes(t)) || officeExts.includes(extension)) {
        return 'office';
    }

    return 'unsupported';
}

/**
 * Main FileViewer Component
 * Automatically selects and renders the appropriate viewer based on file type
 */
export default function FileViewer({
    file,
    onBack,
    height = '100%',
    width = '100%',
    showToolbar = true,
    toolbarActions,
    loadingComponent,
    errorComponent,
}: FileViewerProps) {
    const [blobUrl, setBlobUrl] = React.useState<string | null>(null);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const viewerType = React.useMemo(() => getViewerType(file), [file]);
    const fileUrl = file?.url;

    // Determine if the viewer needs a blob URL (to avoid CORS issues)
    // Office viewer needs the original URL for Microsoft's viewer
    const needsBlobUrl = viewerType !== 'office' && viewerType !== 'unsupported';

    // Fetch blob URL when file changes
    React.useEffect(() => {
        if (!fileUrl || !needsBlobUrl) {
            setBlobUrl(null);
            setError(null);
            return;
        }

        let cancelled = false;
        setIsLoading(true);
        setError(null);

        createFileBlobUrl(fileUrl, file?.mimeType ?? file?.type)
            .then((url) => {
                if (!cancelled) {
                    setBlobUrl(url);
                    setIsLoading(false);
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(err.message ?? 'Failed to load file');
                    setIsLoading(false);
                }
            });

        return () => {
            cancelled = true;
            // Revoke the blob URL when file changes or component unmounts
            if (blobUrl) {
                revokeBlobUrl(blobUrl);
            }
        };
    }, [fileUrl, needsBlobUrl, file?.mimeType, file?.type, blobUrl]);

    // Cleanup blob URL on unmount
    React.useEffect(() => {
        return () => {
            if (blobUrl) {
                revokeBlobUrl(blobUrl);
            }
        };
    }, [blobUrl]);

    const handleDownload = React.useCallback(() => {
        if (fileUrl) {
            window.open(fileUrl, '_blank', 'noopener,noreferrer');
        }
    }, [fileUrl]);

    if (!file) {
        return (
            <Box
                sx={{
                    height,
                    width,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                {errorComponent ?? (
                    <Typography color="text.secondary">No file selected</Typography>
                )}
            </Box>
        );
    }

    const renderViewer = () => {
        if (!fileUrl) {
            return (
                <Box
                    sx={{
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Typography color="error">File URL not available</Typography>
                </Box>
            );
        }

        // Show loading state while fetching blob URL
        if (isLoading && needsBlobUrl) {
            return (
                loadingComponent ?? (
                    <Box
                        sx={{
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 2,
                        }}
                    >
                        <CircularProgress size={40} />
                        <Typography color="text.secondary" variant="body2">
                            Loading file...
                        </Typography>
                    </Box>
                )
            );
        }

        // Show error state
        if (error && needsBlobUrl) {
            return (
                <Box
                    sx={{
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <Typography color="error">{error}</Typography>
                </Box>
            );
        }

        // Use blob URL for viewers that need it, original URL for others
        const viewerUrl = needsBlobUrl && blobUrl ? blobUrl : fileUrl;

        switch (viewerType) {
            case 'pdf':
                return <PDFViewer url={viewerUrl} height="100%" />;
            case 'image':
                return <ImageViewer url={viewerUrl} alt={file.name} height="100%" />;
            case 'video':
                return <VideoViewer url={viewerUrl} height="100%" />;
            case 'audio':
                return <AudioViewer url={viewerUrl} fileName={file.name} />;
            case 'text':
                return <TextViewer url={viewerUrl} height="100%" />;
            case 'office':
                return <OfficeViewer url={fileUrl} height="100%" />;
            default:
                return <UnsupportedViewer file={file} onDownload={handleDownload} />;
        }
    };

    return (
        <Box
            sx={{
                height,
                width,
                display: 'flex',
                flexDirection: 'column',
                bgcolor: 'background.default',
                borderRadius: 1,
                overflow: 'hidden',
            }}
        >
            {/* Main Toolbar */}
            {showToolbar && (
                <Paper
                    elevation={1}
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        p: 1,
                        px: 2,
                        borderRadius: 0,
                        bgcolor: 'background.paper',
                        borderBottom: 1,
                        borderColor: 'divider',
                    }}
                >
                    {onBack && (
                        <Tooltip title="Back to chapters">
                            <IconButton size="small" onClick={onBack} edge="start">
                                <BackIcon />
                            </IconButton>
                        </Tooltip>
                    )}
                    <Typography
                        variant="subtitle2"
                        noWrap
                        sx={{ flexGrow: 1, ml: onBack ? 1 : 0 }}
                    >
                        {file.name}
                    </Typography>
                    {toolbarActions}
                    <Tooltip title="Download">
                        <IconButton size="small" onClick={handleDownload} disabled={!fileUrl}>
                            <DownloadIcon />
                        </IconButton>
                    </Tooltip>
                </Paper>
            )}

            {/* Viewer Content */}
            <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
                {renderViewer()}
            </Box>
        </Box>
    );
}
