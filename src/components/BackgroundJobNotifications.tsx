import React from 'react';
import {
    Alert, AlertTitle, LinearProgress, Box, Typography, IconButton, Collapse, Stack, Chip,
} from '@mui/material';
import {
    Close as CloseIcon, CheckCircle as CheckCircleIcon, Error as ErrorIcon, HourglassEmpty as HourglassIcon,
} from '@mui/icons-material';
import { useBackgroundJobs } from '../hooks/useBackgroundJobs';
import type { BackgroundJob } from '../utils/backgroundJobs';

/**
 * Floating notification component that shows progress of active background jobs.
 * Displays a compact summary and allows users to dismiss or view details.
 */
export function BackgroundJobNotifications() {
    const { activeJobs, completedJobs, failedJobs, cancelJob } = useBackgroundJobs();
    const [dismissed, setDismissed] = React.useState<Set<string>>(new Set());
    const [showCompleted, setShowCompleted] = React.useState(true);

    // Show recently completed/failed jobs for a few seconds
    const recentJobs = React.useMemo(() => {
        const now = Date.now();
        const recentThreshold = 10000; // Show for 10 seconds after completion

        return [...completedJobs, ...failedJobs].filter(job => {
            if (!job.endTime) return false;
            return now - job.endTime < recentThreshold && !dismissed.has(job.id);
        });
    }, [completedJobs, failedJobs, dismissed]);

    // Auto-dismiss completed jobs after 10 seconds
    React.useEffect(() => {
        if (recentJobs.length === 0) return;

        const timer = setTimeout(() => {
            setShowCompleted(false);
            // After fade out, add to dismissed set
            setTimeout(() => {
                setDismissed(prev => {
                    const next = new Set(prev);
                    recentJobs.forEach(job => next.add(job.id));
                    return next;
                });
                setShowCompleted(true);
            }, 300);
        }, 10000);

        return () => clearTimeout(timer);
    }, [recentJobs]);

    const visibleJobs = [...activeJobs, ...recentJobs];

    if (visibleJobs.length === 0) return null;

    return (
        <Box
            sx={{
                position: 'fixed',
                bottom: 24,
                right: 24,
                zIndex: 1400,
                maxWidth: 400,
                width: '100%',
            }}
        >
            <Stack spacing={1}>
                {visibleJobs.map(job => (
                    <JobNotification
                        key={job.id}
                        job={job}
                        onDismiss={() => {
                            if (job.status === 'running' || job.status === 'pending') {
                                cancelJob(job.id);
                            }
                            setDismissed(prev => new Set(prev).add(job.id));
                        }}
                        show={showCompleted || job.status === 'running' || job.status === 'pending'}
                    />
                ))}
            </Stack>
        </Box>
    );
}

interface JobNotificationProps {
    job: BackgroundJob;
    onDismiss: () => void;
    show: boolean;
}

function JobNotification({ job, onDismiss, show }: JobNotificationProps) {
    const severity =
        job.status === 'completed'
            ? 'success'
            : job.status === 'failed'
                ? 'error'
                : 'info';

    const icon =
        job.status === 'completed' ? (
            <CheckCircleIcon />
        ) : job.status === 'failed' ? (
            <ErrorIcon />
        ) : (
            <HourglassIcon />
        );

    const title =
        job.status === 'completed'
            ? 'Import Complete'
            : job.status === 'failed'
                ? 'Import Failed'
                : 'Importing...';

    // Extract progress message as string early
    const progressMessage = job.metadata?.progressMessage
        ? String(job.metadata.progressMessage)
        : '';

    // Extract completed result message early
    const completedMessage = React.useMemo(() => {
        if (job.status !== 'completed' || !job.result) return '';
        const result = job.result;
        if (typeof result === 'object' && result !== null && 'count' in result) {
            return `Imported ${(result as { count: number }).count} item(s)`;
        }
        return 'Operation completed successfully';
    }, [job.status, job.result]);

    return (
        <Collapse in={show}>
            <Alert
                severity={severity}
                icon={icon}
                action={
                    <IconButton
                        aria-label="close"
                        color="inherit"
                        size="small"
                        onClick={onDismiss}
                    >
                        <CloseIcon fontSize="inherit" />
                    </IconButton>
                }
                sx={{ width: '100%' }}
            >
                <AlertTitle>{title}</AlertTitle>
                <Typography variant="body2" gutterBottom>
                    {job.name}
                </Typography>

                {(job.status === 'running' || job.status === 'pending') && (
                    <>
                        <LinearProgress
                            variant="determinate"
                            value={job.progress}
                            sx={{ mt: 1, mb: 0.5 }}
                        />
                        <Typography variant="caption" color="text.secondary">
                            {`${job.progress}%${progressMessage ? ` - ${progressMessage}` : ''}`}
                        </Typography>
                    </>
                )}

                {job.status === 'completed' && completedMessage !== '' && (
                    <Typography variant="caption" color="text.secondary">
                        {completedMessage}
                    </Typography>
                )}

                {job.status === 'failed' && job.error && (
                    <Typography variant="caption" color="error">
                        {job.error}
                    </Typography>
                )}

                {job.status === 'running' && (
                    <Chip
                        label="Running in background"
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ mt: 1 }}
                    />
                )}
            </Alert>
        </Collapse>
    );
}

export default BackgroundJobNotifications;
