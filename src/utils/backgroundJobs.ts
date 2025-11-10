/**
 * Background job utilities for async operations that don't block the UI.
 * Allows users to navigate away while long-running tasks complete in the background.
 */

export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface BackgroundJob<T = unknown> {
    id: string;
    name: string;
    status: JobStatus;
    progress: number; // 0-100
    startTime: number;
    endTime?: number;
    result?: T;
    error?: string;
    metadata?: Record<string, unknown>;
}

export interface JobProgress {
    current: number;
    total: number;
    message?: string;
}

type JobExecutor<T> = (
    updateProgress: (progress: JobProgress) => void,
    signal: AbortSignal
) => Promise<T>;

type JobCompleteCallback<T> = (job: BackgroundJob<T>) => void;

/**
 * Simple in-memory background job manager.
 * Runs jobs asynchronously and tracks their status.
 */
class BackgroundJobManager {
    private jobs = new Map<string, BackgroundJob>();
    private abortControllers = new Map<string, AbortController>();
    private listeners = new Set<(jobs: BackgroundJob[]) => void>();
    private completionCallbacks = new Map<string, JobCompleteCallback<unknown>>();

    /**
     * Start a new background job
     * @param name - Human-readable job name
     * @param executor - Async function that performs the work
     * @param metadata - Optional metadata for the job
     * @returns Job ID
     */
    startJob<T>(
        name: string,
        executor: JobExecutor<T>,
        metadata?: Record<string, unknown>,
        onComplete?: JobCompleteCallback<T>
    ): string {
        const id = `job-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
        const abortController = new AbortController();

        const job: BackgroundJob<T> = {
            id,
            name,
            status: 'pending',
            progress: 0,
            startTime: Date.now(),
            metadata,
        };

        this.jobs.set(id, job);
        this.abortControllers.set(id, abortController);
        if (onComplete) {
            this.completionCallbacks.set(id, onComplete as JobCompleteCallback<unknown>);
        }
        this.notifyListeners();

        // Start the job asynchronously
        this.executeJob(id, executor, abortController.signal);

        return id;
    }

    private async executeJob<T>(
        id: string,
        executor: JobExecutor<T>,
        signal: AbortSignal
    ): Promise<void> {
        const job = this.jobs.get(id) as BackgroundJob<T>;
        if (!job) return;

        try {
            // Update to running
            job.status = 'running';
            this.notifyListeners();

            // Create progress updater
            const updateProgress = (progress: JobProgress) => {
                const percent = Math.round((progress.current / progress.total) * 100);
                job.progress = Math.min(100, Math.max(0, percent));
                if (progress.message) {
                    job.metadata = { ...job.metadata, progressMessage: progress.message };
                }
                this.notifyListeners();
            };

            // Execute the job
            const result = await executor(updateProgress, signal);

            // Job completed successfully
            if (!signal.aborted) {
                job.status = 'completed';
                job.progress = 100;
                job.result = result;
                job.endTime = Date.now();
                this.notifyListeners();

                // Call completion callback if registered
                const callback = this.completionCallbacks.get(id);
                if (callback) {
                    callback(job);
                    this.completionCallbacks.delete(id);
                }
            }
        } catch (error) {
            if (!signal.aborted) {
                job.status = 'failed';
                job.error = error instanceof Error ? error.message : String(error);
                job.endTime = Date.now();
                this.notifyListeners();

                // Call completion callback even on error
                const callback = this.completionCallbacks.get(id);
                if (callback) {
                    callback(job);
                    this.completionCallbacks.delete(id);
                }
            }
        } finally {
            // Cleanup abort controller
            this.abortControllers.delete(id);
        }
    }

    /**
     * Cancel a running job
     */
    cancelJob(id: string): void {
        const controller = this.abortControllers.get(id);
        if (controller) {
            controller.abort();
            const job = this.jobs.get(id);
            if (job) {
                job.status = 'cancelled';
                job.endTime = Date.now();
                this.notifyListeners();
            }
            this.abortControllers.delete(id);
            this.completionCallbacks.delete(id);
        }
    }

    /**
     * Get a job by ID
     */
    getJob(id: string): BackgroundJob | undefined {
        return this.jobs.get(id);
    }

    /**
     * Get all jobs
     */
    getAllJobs(): BackgroundJob[] {
        return Array.from(this.jobs.values());
    }

    /**
     * Get active jobs (pending or running)
     */
    getActiveJobs(): BackgroundJob[] {
        return Array.from(this.jobs.values()).filter(
            job => job.status === 'pending' || job.status === 'running'
        );
    }

    /**
     * Remove completed/failed jobs older than the specified time (in ms)
     * @param maxAge - Maximum age in milliseconds (default: 1 hour)
     */
    cleanupOldJobs(maxAge = 60 * 60 * 1000): void {
        const now = Date.now();
        const toDelete: string[] = [];

        for (const [id, job] of this.jobs.entries()) {
            if (
                (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') &&
                job.endTime &&
                now - job.endTime > maxAge
            ) {
                toDelete.push(id);
            }
        }

        toDelete.forEach(id => {
            this.jobs.delete(id);
            this.completionCallbacks.delete(id);
        });

        if (toDelete.length > 0) {
            this.notifyListeners();
        }
    }

    /**
     * Subscribe to job updates
     */
    subscribe(listener: (jobs: BackgroundJob[]) => void): () => void {
        this.listeners.add(listener);
        // Immediately call with current state
        listener(this.getAllJobs());

        // Return unsubscribe function
        return () => {
            this.listeners.delete(listener);
        };
    }

    private notifyListeners(): void {
        const jobs = this.getAllJobs();
        this.listeners.forEach(listener => listener(jobs));
    }

    /**
     * Clear all jobs (use with caution)
     */
    clearAll(): void {
        // Cancel all running jobs
        for (const controller of this.abortControllers.values()) {
            controller.abort();
        }
        this.jobs.clear();
        this.abortControllers.clear();
        this.completionCallbacks.clear();
        this.notifyListeners();
    }
}

// Global singleton instance
export const backgroundJobManager = new BackgroundJobManager();

// Auto-cleanup old jobs every 5 minutes
if (typeof window !== 'undefined') {
    setInterval(() => {
        backgroundJobManager.cleanupOldJobs();
    }, 5 * 60 * 1000);
}
