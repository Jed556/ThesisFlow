import * as React from 'react';
import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import { alpha } from '@mui/material/styles';

export interface ScrollContainerProps {
    children: React.ReactNode;
    /** CSS calc offset from 100vh, e.g., '140px'. Controls vertical height of the scroll box. */
    heightOffset?: string;
    /** Additional sx styles to merge in. */
    sx?: SxProps<Theme>;
}

/**
 * ScrollContainer confines scrolling to an inner Box with a custom scrollbar.
 * It prevents the outer window from scrolling when used with a global overflow hidden.
 */
export default function ScrollContainer({
    children,
    heightOffset = '140px',
    sx,
}: ScrollContainerProps) {
    return (
        <Box
            sx={(theme) => ({
                m: 0,
                width: '100%',
                // Constrain height to viewport minus header/breadcrumbs area
                height: `calc(100vh - ${heightOffset})`,
                overflow: 'auto',
                pl: 0,
                pb: 0,
                scrollBehavior: 'smooth',
                scrollbarGutter: 'stable',
                scrollbarWidth: 'thin',
                scrollbarColor: `${alpha(theme.palette.primary.main, 0.5)} transparent`,
                '&::-webkit-scrollbar': {
                    width: 10,
                    height: 10,
                },
                '&::-webkit-scrollbar-track': {
                    backgroundColor: 'transparent',
                },
                '&::-webkit-scrollbar-thumb': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.5),
                    borderRadius: 8,
                    border: '2px solid transparent',
                    backgroundClip: 'content-box',
                },
                '&::-webkit-scrollbar-thumb:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.7),
                },
                ...((typeof sx === 'function' ? sx(theme) : sx) as object),
            })}
        >
            {children}
        </Box>
    );
}
