import { Box, Typography, Button, Paper, Container } from '@mui/material';
import { Home, ArrowBack, Search } from '@mui/icons-material';
import { useNavigate } from 'react-router';

export default function NotFoundPage() {
    const navigate = useNavigate();

    const handleGoHome = () => {
        navigate('/');
    };

    const handleGoBack = () => {
        navigate(-1);
    };

    return (
        <Container maxWidth="md" sx={{ mt: 8 }}>
            <Paper elevation={3} sx={{ p: 6, textAlign: 'center' }}>
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h1" component="h1" sx={{ fontSize: '8rem', fontWeight: 'bold', color: 'primary.main' }}>
                        404
                    </Typography>
                    <Typography variant="h4" component="h2" gutterBottom>
                        Page Not Found
                    </Typography>
                    <Typography variant="body1" color="text.secondary" component={'p'}>
                        Oops! The page you're looking for doesn't exist. It might have been moved, deleted, or you entered the wrong URL.
                    </Typography>
                </Box>

                <Box sx={{ mb: 4 }}>
                    <Search sx={{ fontSize: 100, color: 'text.secondary', opacity: 0.5 }} />
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
                        startIcon={<ArrowBack />}
                        onClick={handleGoBack}
                        size="large"
                    >
                        Go Back
                    </Button>
                </Box>

                <Box sx={{ mt: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                        If you think this is a mistake, please contact support.
                    </Typography>
                </Box>
            </Paper>
        </Container>
    );
}
