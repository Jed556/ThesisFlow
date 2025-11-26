import { useState, useEffect, useMemo, useRef } from 'react';
import { backgroundJobManager, type BackgroundJob } from '../utils/backgroundJobs';

/**
 * React hook to access and monitor background jobs.
 * Automatically subscribes to job updates and provides methods to start/cancel jobs.
 */
export function useBackgroundJobs() {
    const [jobs, setJobs] = useState<BackgroundJob[]>(() => backgroundJobManager.getAllJobs());

    useEffect(() => {
        const unsubscribe = backgroundJobManager.subscribe(setJobs);
        return unsubscribe;
    }, []);

    const activeJobs = jobs.filter(job => job.status === 'pending' || job.status === 'running');
    const completedJobs = jobs.filter(job => job.status === 'completed');
    const failedJobs = jobs.filter(job => job.status === 'failed');

    return {
        jobs,
        activeJobs,
        completedJobs,
        failedJobs,
        hasActiveJobs: activeJobs.length > 0,
        startJob: backgroundJobManager.startJob.bind(backgroundJobManager),
        cancelJob: backgroundJobManager.cancelJob.bind(backgroundJobManager),
        getJob: backgroundJobManager.getJob.bind(backgroundJobManager),
        clearAll: backgroundJobManager.clearAll.bind(backgroundJobManager),
    };
}

/**
 * Provides stable handlers for interacting with the background job manager
 * without subscribing to job updates. Useful when only the controller
 * functions are needed and re-renders on progress updates should be avoided.
 */
export function useBackgroundJobControls() {
    return useMemo(() => ({
        startJob: backgroundJobManager.startJob.bind(backgroundJobManager),
        cancelJob: backgroundJobManager.cancelJob.bind(backgroundJobManager),
        getJob: backgroundJobManager.getJob.bind(backgroundJobManager),
        clearAll: backgroundJobManager.clearAll.bind(backgroundJobManager),
    }), []);
}

/**
 * Tracks whether any background job matches the provided predicate. The
 * component that uses this hook will only re-render when the derived boolean
 * value changes, avoiding excessive renders from frequent progress updates.
 */
export function useBackgroundJobFlag(predicate: (job: BackgroundJob) => boolean): boolean {
    const predicateRef = useRef(predicate);

    useEffect(() => {
        predicateRef.current = predicate;
    }, [predicate]);

    const [isActive, setIsActive] = useState<boolean>(() => {
        const jobs = backgroundJobManager.getAllJobs();
        return jobs.some(job => predicateRef.current(job));
    });

    useEffect(() => {
        const unsubscribe = backgroundJobManager.subscribe((jobs) => {
            const next = jobs.some(job => predicateRef.current(job));
            setIsActive(prev => (prev === next ? prev : next));
        });

        return unsubscribe;
    }, []);

    return isActive;
}
