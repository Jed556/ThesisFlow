/**
 * PDF Viewer Component
 * Uses react-pdf to render PDF documents with continuous scrolling and zoom controls
 */

import * as React from 'react';
import {
    Box, CircularProgress, IconButton, Paper, Skeleton, Stack,
    Tooltip, Typography, useTheme,
} from '@mui/material';
import {
    ZoomIn as ZoomInIcon,
    ZoomOut as ZoomOutIcon,
    FitScreen as FitScreenIcon,
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
 * PDF Viewer component with continuous scrolling and zoom controls
 */
export const PDFViewer: React.FC<PDFViewerProps> = ({ url, height = '100%' }) => {
    const theme = useTheme();
    const containerRef = React.useRef<HTMLDivElement>(null);
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);
    const pageRefs = React.useRef<Map<number, HTMLDivElement>>(new Map());
    const [numPages, setNumPages] = React.useState<number>(0);
    const [currentPage, setCurrentPage] = React.useState<number>(1);
    const [scale, setScale] = React.useState<number>(1.0);
    const [isLoading, setIsLoading] = React.useState<boolean>(true);
    const [error, setError] = React.useState<string | null>(null);
    const [containerWidth, setContainerWidth] = React.useState<number>(600);

    // Track current page based on scroll position using Intersection Observer
    React.useEffect(() => {
        if (numPages === 0 || !scrollContainerRef.current) return;

        const options: IntersectionObserverInit = {
            root: scrollContainerRef.current,
            rootMargin: '-50% 0px -50% 0px', // Trigger when page center crosses viewport center
            threshold: 0,
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const pageNum = Number(entry.target.getAttribute('data-page'));
                    if (!isNaN(pageNum)) {
                        setCurrentPage(pageNum);
                    }
                }
            });
        }, options);

        // Observe all page elements
        pageRefs.current.forEach((element) => {
            observer.observe(element);
        });

        return () => observer.disconnect();
    }, [numPages]);

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

    const zoomIn = React.useCallback(() => {
        setScale((prev) => Math.min(prev + 0.25, 3.0));
    }, []);

    const zoomOut = React.useCallback(() => {
        setScale((prev) => Math.max(prev - 0.25, 0.5));
    }, []);

    const resetZoom = React.useCallback(() => {
        setScale(1.0);
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
                <Typography variant="body2" sx={{ mx: 1 }}>
                    {numPages > 0 ? `Page ${currentPage}/${numPages}` : '–'}
                </Typography>

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
                <Tooltip title="Reset zoom">
                    <span>
                        <IconButton size="small" onClick={resetZoom} disabled={scale === 1.0}>
                            <FitScreenIcon fontSize="small" />
                        </IconButton>
                    </span>
                </Tooltip>
            </Paper>

            {/* PDF Content - Scrollable */}
            <Box
                ref={scrollContainerRef}
                sx={{
                    flex: 1,
                    minHeight: 0,
                    overflow: 'auto',
                    p: 2,
                }}
            >
                <Stack
                    spacing={2}
                    sx={{
                        alignItems: 'center',
                        minWidth: 'fit-content',
                    }}
                >
                    {isLoading && (
                        <Stack spacing={2} alignItems="center" sx={{ py: 4 }}>
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
                        {Array.from(new Array(numPages), (_, index) => (
                            <Box
                                key={`page_${index + 1}`}
                                ref={(el: HTMLDivElement | null) => {
                                    if (el) {
                                        pageRefs.current.set(index + 1, el);
                                    } else {
                                        pageRefs.current.delete(index + 1);
                                    }
                                }}
                                data-page={index + 1}
                                sx={{
                                    mb: 2,
                                    boxShadow: 2,
                                    bgcolor: 'background.paper',
                                }}
                            >
                                <Page
                                    pageNumber={index + 1}
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
                            </Box>
                        ))}
                    </Document>
                </Stack>
            </Box>
        </Box>
    );
};

export default PDFViewer;
