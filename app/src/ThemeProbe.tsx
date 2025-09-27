import * as React from 'react';
import { useTheme } from '@mui/material/styles';
import { Box, Typography } from '@mui/material';

/**
 * Small overlay box displaying the current primary theme color for debugging purposes
 */
export default function ThemeProbe() {
    const theme = useTheme();
    React.useEffect(() => {
        // Helpful debug log to confirm theme is available
        // eslint-disable-next-line no-console
        console.log('ThemeProbe: theme.palette.primary.main =', theme.palette?.primary?.main);
    }, [theme]);

    return (
        <Box sx={{ position: 'fixed', right: 8, top: 8, bgcolor: 'background.paper', p: 1, borderRadius: 1, zIndex: 2000 }}>
            <Typography variant="caption">primary: {theme.palette?.primary?.main}</Typography>
        </Box>
    );
}
