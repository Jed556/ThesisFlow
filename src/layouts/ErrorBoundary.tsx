import { useRouteError, isRouteErrorResponse } from 'react-router';
import { Box, Typography, Button, Paper, Container } from '@mui/material';
import { Home, Refresh, BugReport } from '@mui/icons-material';

/**
 * ErrorBoundary page to catch and display errors in the application
 */
export default function ErrorBoundary() {
    const error = useRouteError();

    let errorMessage = 'Something went wrong';
    let errorStatus = 'Unknown Error';

    if (isRouteErrorResponse(error)) {
        errorStatus = `${error.status} ${error.statusText}`;
        errorMessage = error.data?.message || error.statusText;
    } else if (error instanceof Error) {
        errorMessage = error.message;
    }

    const handleRefresh = () => {
        window.location.reload();
    };

    const handleGoHome = () => {
        window.location.href = '/';
    };

    return (
        <Container maxWidth="md" sx={{ mt: 8 }}>
            <Paper elevation={3} sx={{ p: 6, textAlign: 'center' }}>
                <Box sx={{ mb: 4 }}>
                    <BugReport color="error" sx={{ fontSize: 80, mb: 2 }} />
                    <Typography variant="h3" component="h1" gutterBottom color="error">
                        Oops! Something went wrong
                    </Typography>
                    <Typography variant="h5" component="h2" gutterBottom color="text.secondary">
                        {errorStatus}
                    </Typography>
                </Box>

                <Box sx={{ mb: 4 }}>
                    <Typography variant="body1" paragraph>
                        We're sorry for the inconvenience. The page you're looking for might not exist or there was an unexpected error.
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', bgcolor: 'background.paper', p: 2, borderRadius: 1 }}>
                        {errorMessage}
                    </Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<Home />}
                        onClick={handleGoHome}
                        size="large"
                    >
                        Go Home
                    </Button>
                    <Button
                        variant="outlined"
                        color="primary"
                        startIcon={<Refresh />}
                        onClick={handleRefresh}
                        size="large"
                    >
                        Refresh Page
                    </Button>
                </Box>

                <Box sx={{ mt: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                        If this problem persists, please contact support.
                    </Typography>
                </Box>
            </Paper>
        </Container>
    );
}
