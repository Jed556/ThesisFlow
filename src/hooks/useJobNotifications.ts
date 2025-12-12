/**
 * Hook to integrate background jobs with the unified snackbar notification system.
 * 
 * This hook bridges the BackgroundJobManager with the SnackbarContext,
 * automatically creating and updating job notifications as jobs progress.
 * 
 * Job notifications:
 * - Show progress bar at the bottom
 * - Have cancel button (no X dismiss button while active)
 * - Become dismissible when complete/failed
 * - Auto-dismiss 10 seconds after completion
 */

import { useEffect, useRef, useCallback } from 'react';
import { useSnackbar, type JobStatus } from '../contexts/SnackbarContext';
import { backgroundJobManager, type BackgroundJob } from '../utils/backgroundJobs';

/**
 * Maps job IDs to notification IDs
 */
type JobNotificationMap = Record<string, string>;

/**
 * Hook that syncs background jobs with the notification system.
 * Should be used once at the app level (e.g., in Layout or App component).
 */
export function useJobNotifications() {
    const {
        showJobNotification,
        updateJobNotification,
        completeJobNotification,
        hideNotification,
        setJobCancelHandler,
    } = useSnackbar();

    // Store functions in refs to avoid stale closures in subscription callback
    const showJobNotificationRef = useRef(showJobNotification);
    const updateJobNotificationRef = useRef(updateJobNotification);
    const completeJobNotificationRef = useRef(completeJobNotification);
    const hideNotificationRef = useRef(hideNotification);

    // Keep refs updated
    useEffect(() => {
        showJobNotificationRef.current = showJobNotification;
        updateJobNotificationRef.current = updateJobNotification;
        completeJobNotificationRef.current = completeJobNotification;
        hideNotificationRef.current = hideNotification;
    }, [showJobNotification, updateJobNotification, completeJobNotification, hideNotification]);

    // Track which jobs we've already created notifications for
    const jobNotificationMapRef = useRef<JobNotificationMap>({});
    // Track previous job states to detect changes
    const previousJobsRef = useRef<BackgroundJob[]>([]);

    // Handle job cancellation from notification
    const handleCancelJob = useCallback((jobId: string) => {
        backgroundJobManager.cancelJob(jobId);
        // Remove the notification when cancelled
        const notificationId = jobNotificationMapRef.current[jobId];
        if (notificationId) {
            hideNotificationRef.current(notificationId);
            delete jobNotificationMapRef.current[jobId];
        }
    }, []);

    // Register cancel handler with snackbar context
    useEffect(() => {
        setJobCancelHandler(handleCancelJob);
    }, [setJobCancelHandler, handleCancelJob]);

    // Subscribe to job updates
    useEffect(() => {
        const unsubscribe = backgroundJobManager.subscribe((jobs) => {
            const currentJobIds = new Set(jobs.map(j => j.id));

            // Handle each job
            jobs.forEach((job) => {
                const existingNotificationId = jobNotificationMapRef.current[job.id];

                if (!existingNotificationId) {
                    // New job - create notification
                    if (job.status === 'pending' || job.status === 'running') {
                        const notificationId = showJobNotificationRef.current({
                            jobId: job.id,
                            title: job.name,
                            message: getJobMessage(job),
                            progress: job.progress,
                            status: job.status as JobStatus,
                        });
                        jobNotificationMapRef.current[job.id] = notificationId;
                    }
                } else {
                    // Existing job - update notification
                    const prevJob = previousJobsRef.current.find(j => j.id === job.id);

                    // Check if status or progress changed
                    if (!prevJob ||
                        prevJob.status !== job.status ||
                        prevJob.progress !== job.progress) {

                        if (job.status === 'completed') {
                            completeJobNotificationRef.current(
                                existingNotificationId,
                                true,
                                getCompletionMessage(job)
                            );
                        } else if (job.status === 'failed') {
                            completeJobNotificationRef.current(
                                existingNotificationId,
                                false,
                                job.error ?? 'Job failed'
                            );
                        } else if (job.status === 'cancelled') {
                            // Already handled in handleCancelJob
                        } else {
                            // Update progress
                            updateJobNotificationRef.current(
                                existingNotificationId,
                                job.progress,
                                job.status as JobStatus,
                                getJobMessage(job)
                            );
                        }
                    }
                }
            });

            // Cleanup: remove notifications for jobs that no longer exist
            Object.keys(jobNotificationMapRef.current).forEach((jobId) => {
                if (!currentJobIds.has(jobId)) {
                    // Job was removed - check if we should keep the notification
                    const job = previousJobsRef.current.find(j => j.id === jobId);
                    if (job?.status === 'cancelled') {
                        // Already handled
                        delete jobNotificationMapRef.current[jobId];
                    }
                    // For completed/failed jobs, let the auto-dismiss handle it
                }
            });

            // Update previous jobs reference
            previousJobsRef.current = [...jobs];
        });

        return () => {
            unsubscribe();
        };
    }, []); // Empty deps - subscription uses refs
}

/**
 * Get the message for a running job
 */
function getJobMessage(job: BackgroundJob): string {
    const progressMessage = job.metadata?.progressMessage;
    if (progressMessage && typeof progressMessage === 'string') {
        return progressMessage;
    }

    switch (job.status) {
        case 'pending':
            return 'Waiting to start...';
        case 'running':
            return `Processing... ${job.progress}%`;
        case 'completed':
            return 'Completed successfully';
        case 'failed':
            return job.error ?? 'Failed';
        case 'cancelled':
            return 'Cancelled';
        default:
            return job.name;
    }
}

/**
 * Get completion message for a finished job
 */
function getCompletionMessage(job: BackgroundJob): string {
    const result = job.result;
    if (result && typeof result === 'object' && 'count' in result) {
        const count = (result as { count: number }).count;
        return `Completed: ${count} item(s) processed`;
    }
    if (result && typeof result === 'object' && 'message' in result) {
        return String((result as { message: string }).message);
    }
    return 'Completed successfully';
}

export default useJobNotifications;
