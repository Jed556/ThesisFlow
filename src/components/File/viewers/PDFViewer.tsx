/**
 * PDF Viewer Component
 * Uses react-pdf to render PDF documents with pagination and zoom controls
 */

import * as React from 'react';
import {
    Box, CircularProgress, IconButton, Paper, Skeleton, Stack,
    Tooltip, Typography, useTheme,
} from '@mui/material';
import {
    ZoomIn as ZoomInIcon,
    ZoomOut as ZoomOutIcon,
    NavigateBefore as PrevPageIcon,
    NavigateNext as NextPageIcon,
    FirstPage as FirstPageIcon,
    LastPage as LastPageIcon,
} from '@mui/icons-material';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export interface PDFViewerProps {
    /** URL of the PDF file */
    url: string;
    /** Height of the viewer container */
    height?: number | string;
}

/**
 * PDF Viewer component with pagination, zoom, and responsive scaling
 */
export const PDFViewer: React.FC<PDFViewerProps> = ({ url, height = '100%' }) => {
    const theme = useTheme();
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [numPages, setNumPages] = React.useState<number>(0);
    const [pageNumber, setPageNumber] = React.useState<number>(1);
    const [scale, setScale] = React.useState<number>(1.0);
    const [isLoading, setIsLoading] = React.useState<boolean>(true);
    const [error, setError] = React.useState<string | null>(null);
    const [containerWidth, setContainerWidth] = React.useState<number>(600);

    // Observe container width for responsive scaling
    React.useEffect(() => {
        if (!containerRef.current) return;

        const resizeObserver = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (entry) {
                setContainerWidth(entry.contentRect.width - 48); // Account for padding
            }
        });

        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    const onDocumentLoadSuccess = React.useCallback(({ numPages: pages }: { numPages: number }) => {
        setNumPages(pages);
        setIsLoading(false);
        setError(null);
    }, []);

    const onDocumentLoadError = React.useCallback((err: Error) => {
        setError(err.message || 'Failed to load PDF');
        setIsLoading(false);
    }, []);

    const goToPage = React.useCallback((page: number) => {
        setPageNumber(Math.max(1, Math.min(page, numPages)));
    }, [numPages]);

    const zoomIn = React.useCallback(() => {
        setScale((prev) => Math.min(prev + 0.25, 3.0));
    }, []);

    const zoomOut = React.useCallback(() => {
        setScale((prev) => Math.max(prev - 0.25, 0.5));
    }, []);

    if (error) {
        return (
            <Box
                sx={{
                    height,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'background.default',
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
                bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.100',
                borderRadius: 1,
                overflow: 'hidden',
            }}
        >
            {/* PDF Toolbar */}
            <Paper
                elevation={1}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1,
                    p: 1,
                    borderRadius: 0,
                    bgcolor: 'background.paper',
                }}
            >
                <Tooltip title="First page">
                    <span>
                        <IconButton
                            size="small"
                            onClick={() => goToPage(1)}
                            disabled={pageNumber <= 1}
                        >
                            <FirstPageIcon fontSize="small" />
                        </IconButton>
                    </span>
                </Tooltip>
                <Tooltip title="Previous page">
                    <span>
                        <IconButton
                            size="small"
                            onClick={() => goToPage(pageNumber - 1)}
                            disabled={pageNumber <= 1}
                        >
                            <PrevPageIcon fontSize="small" />
                        </IconButton>
                    </span>
                </Tooltip>
                <Typography variant="body2" sx={{ mx: 1, minWidth: 80, textAlign: 'center' }}>
                    {numPages > 0 ? `${pageNumber} / ${numPages}` : '–'}
                </Typography>
                <Tooltip title="Next page">
                    <span>
                        <IconButton
                            size="small"
                            onClick={() => goToPage(pageNumber + 1)}
                            disabled={pageNumber >= numPages}
                        >
                            <NextPageIcon fontSize="small" />
                        </IconButton>
                    </span>
                </Tooltip>
                <Tooltip title="Last page">
                    <span>
                        <IconButton
                            size="small"
                            onClick={() => goToPage(numPages)}
                            disabled={pageNumber >= numPages}
                        >
                            <LastPageIcon fontSize="small" />
                        </IconButton>
                    </span>
                </Tooltip>

                <Box sx={{ mx: 1, borderLeft: 1, borderColor: 'divider', height: 24 }} />

                <Tooltip title="Zoom out">
                    <span>
                        <IconButton size="small" onClick={zoomOut} disabled={scale <= 0.5}>
                            <ZoomOutIcon fontSize="small" />
                        </IconButton>
                    </span>
                </Tooltip>
                <Typography variant="body2" sx={{ minWidth: 50, textAlign: 'center' }}>
                    {Math.round(scale * 100)}%
                </Typography>
                <Tooltip title="Zoom in">
                    <span>
                        <IconButton size="small" onClick={zoomIn} disabled={scale >= 3.0}>
                            <ZoomInIcon fontSize="small" />
                        </IconButton>
                    </span>
                </Tooltip>
            </Paper>

            {/* PDF Content */}
            <Box
                sx={{
                    flexGrow: 1,
                    overflow: 'auto',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: isLoading ? 'center' : 'flex-start',
                    p: 2,
                }}
            >
                {isLoading && (
                    <Stack spacing={2} alignItems="center">
                        <CircularProgress />
                        <Typography variant="body2" color="text.secondary">
                            Loading PDF...
                        </Typography>
                    </Stack>
                )}
                <Document
                    file={url}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    loading={null}
                >
                    <Page
                        pageNumber={pageNumber}
                        scale={scale}
                        width={containerWidth}
                        loading={
                            <Skeleton
                                variant="rectangular"
                                width={containerWidth}
                                height={containerWidth * 1.414}
                            />
                        }
                    />
                </Document>
            </Box>
        </Box>
    );
};

export default PDFViewer;
