import * as React from 'react';

/**
 * Notification severity types
 */
export type NotificationSeverity = 'success' | 'error' | 'warning' | 'info';

/**
 * Action button configuration for notifications
 */
export interface NotificationAction {
    /** Button label */
    label: string;
    /** Click handler */
    onClick: () => void;
    /** Optional: navigate to a path instead of onClick */
    href?: string;
    /** Button variant */
    variant?: 'text' | 'outlined' | 'contained';
}

/**
 * Job status type for background job notifications
 */
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Extended notification options for modern toast
 */
export interface NotificationOptions {
    /** Main title (bold, above divider) */
    title?: string;
    /** Description message (below divider) */
    message: string;
    /** Notification severity for coloring */
    severity?: NotificationSeverity;
    /** Auto-dismiss duration in ms (0 = no auto-dismiss) */
    duration?: number;
    /** Custom icon React node (overrides severity icon) */
    icon?: React.ReactNode;
    /** Whether to show divider between title and message */
    showDivider?: boolean;
    /** Action buttons (up to 2 recommended) */
    actions?: NotificationAction[];
    /** Whether to show the progress timer bar */
    showProgress?: boolean;
    /** Notification type: 'notification' or 'job' */
    type?: 'notification' | 'job';
    /** Associated job ID (for job notifications) */
    jobId?: string;
    /** Job progress percentage 0-100 (for job notifications) */
    jobProgress?: number;
    /** Job status (for job notifications) */
    jobStatus?: JobStatus;
    /** Whether the notification can be dismissed with X button */
    dismissible?: boolean;
    /** Whether to show cancel button (for job notifications) */
    showCancel?: boolean;
}

/**
 * Internal notification item interface
 */
export interface Notification {
    id: string;
    title?: string;
    message: string;
    severity: NotificationSeverity;
    duration: number;
    icon?: React.ReactNode;
    showDivider: boolean;
    actions?: NotificationAction[];
    showProgress: boolean;
    createdAt: number;
    /** Notification type: 'notification' for standard, 'job' for background jobs */
    type: 'notification' | 'job';
    /** Associated job ID (for job notifications) */
    jobId?: string;
    /** Job progress percentage 0-100 (for job notifications) */
    jobProgress?: number;
    /** Job status (for job notifications) */
    jobStatus?: JobStatus;
    /** Whether the notification can be dismissed with X button (default: true) */
    dismissible: boolean;
    /** Whether to show cancel button (for job notifications) */
    showCancel?: boolean;
}

/**
 * Options for showing a job notification
 */
export interface JobNotificationOptions {
    /** Job ID from BackgroundJobManager */
    jobId: string;
    /** Title for the notification */
    title: string;
    /** Description message */
    message: string;
    /** Initial progress (0-100) */
    progress?: number;
    /** Initial job status */
    status?: JobStatus;
    /** Custom icon */
    icon?: React.ReactNode;
}

/**
 * Snackbar context interface
 */
interface SnackbarContextValue {
    notifications: Notification[];
    /**
     * Show a notification with modern options
     */
    showNotification: (
        messageOrOptions: string | NotificationOptions,
        severity?: NotificationSeverity,
        duration?: number,
        action?: NotificationAction
    ) => string;
    /**
     * Show a job notification with progress bar and cancel button
     * @param options - Job notification options
     * @returns Notification ID
     */
    showJobNotification: (options: JobNotificationOptions) => string;
    /**
     * Update a job notification's progress and status
     * @param id - Notification ID (returned from showJobNotification)
     * @param progress - New progress value (0-100)
     * @param status - New job status
     * @param message - Optional updated message
     */
    updateJobNotification: (
        id: string,
        progress: number,
        status: JobStatus,
        message?: string
    ) => void;
    /**
     * Simple function to update just the progress percentage of a job notification
     * @param id - Notification ID (returned from showJobNotification)
     * @param progress - New progress value (0-100)
     * @param message - Optional updated message
     */
    updateJobProgress: (id: string, progress: number, message?: string) => void;
    /**
     * Mark a job notification as complete
     * @param id - Notification ID
     * @param success - Whether the job completed successfully
     * @param message - Optional completion message
     */
    completeJobNotification: (
        id: string,
        success: boolean,
        message?: string
    ) => void;
    hideNotification: (id: string) => void;
    clearAll: () => void;
    /**
     * Handler for cancelling a job (called from notification cancel button)
     */
    onCancelJob?: (jobId: string) => void;
    /**
     * Set the job cancel handler
     */
    setJobCancelHandler: (handler: (jobId: string) => void) => void;
}

const SnackbarContext = React.createContext<SnackbarContextValue | undefined>(undefined);

/**
 * Default notification duration in milliseconds (30 seconds)
 */
const DEFAULT_DURATION = 30000;

/**
 * Provider component for the snackbar notification system
 */
export function SnackbarProvider({ children }: { children: React.ReactNode }) {
    const [notifications, setNotifications] = React.useState<Notification[]>([]);
    const [jobCancelHandler, setJobCancelHandlerState] = React.useState<
        ((jobId: string) => void) | undefined
    >(undefined);

    const hideNotification = React.useCallback((id: string) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, []);

    const showNotification = React.useCallback(
        (
            messageOrOptions: string | NotificationOptions,
            severity: NotificationSeverity = 'info',
            duration: number = DEFAULT_DURATION,
            action?: NotificationAction
        ): string => {
            const id = `notification-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

            let notification: Notification;

            if (typeof messageOrOptions === 'string') {
                // Legacy API: simple string message
                notification = {
                    id,
                    message: messageOrOptions,
                    severity,
                    duration,
                    showDivider: false,
                    showProgress: duration > 0,
                    actions: action ? [action] : undefined,
                    createdAt: Date.now(),
                    type: 'notification',
                    dismissible: true,
                };
            } else {
                // Modern API: options object
                const opts = messageOrOptions;
                const isJob = opts.type === 'job';
                const isActiveJob = isJob &&
                    (opts.jobStatus === 'running' || opts.jobStatus === 'pending');
                notification = {
                    id,
                    title: opts.title,
                    message: opts.message,
                    severity: opts.severity ?? 'info',
                    duration: opts.duration ?? DEFAULT_DURATION,
                    icon: opts.icon,
                    showDivider: opts.showDivider ?? Boolean(opts.title),
                    showProgress: opts.showProgress ?? (opts.duration ?? DEFAULT_DURATION) > 0,
                    actions: opts.actions,
                    createdAt: Date.now(),
                    type: opts.type ?? 'notification',
                    jobId: opts.jobId,
                    jobProgress: opts.jobProgress,
                    jobStatus: opts.jobStatus,
                    // Active jobs are NOT dismissible (no X button)
                    dismissible: opts.dismissible ?? !isActiveJob,
                    showCancel: opts.showCancel ?? isActiveJob,
                };
            }

            setNotifications((prev) => [...prev, notification]);

            // Auto-dismiss is now handled by NotificationItem component
            // to properly trigger exit animation before removal

            return id;
        },
        []
    );

    /**
     * Show a job notification with progress bar and cancel button.
     * Job notifications cannot be dismissed with X button while active,
     * only via cancel button.
     */
    const showJobNotification = React.useCallback(
        (options: JobNotificationOptions): string => {
            const id = `job-notification-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
            const status = options.status ?? 'pending';
            const isActive = status === 'pending' || status === 'running';

            const notification: Notification = {
                id,
                title: options.title,
                message: options.message,
                severity: 'info',
                duration: 0, // Jobs don't auto-dismiss
                icon: options.icon,
                showDivider: true,
                showProgress: true,
                createdAt: Date.now(),
                type: 'job',
                jobId: options.jobId,
                jobProgress: options.progress ?? 0,
                jobStatus: status,
                // Active jobs: NO X button, YES cancel button
                dismissible: !isActive,
                showCancel: isActive,
            };

            setNotifications((prev) => [...prev, notification]);
            return id;
        },
        []
    );

    /**
     * Update a job notification's progress and status
     */
    const updateJobNotification = React.useCallback(
        (id: string, progress: number, status: JobStatus, message?: string) => {
            setNotifications((prev) =>
                prev.map((n) => {
                    if (n.id !== id) return n;
                    const isActive = status === 'pending' || status === 'running';
                    return {
                        ...n,
                        jobProgress: progress,
                        jobStatus: status,
                        message: message ?? n.message,
                        // Update dismissible/showCancel based on new status
                        dismissible: !isActive,
                        showCancel: isActive,
                    };
                })
            );
        },
        []
    );

    /**
     * Simple function to just update job progress percentage
     * Keeps the job in 'running' status
     */
    const updateJobProgress = React.useCallback(
        (id: string, progress: number, message?: string) => {
            setNotifications((prev) =>
                prev.map((n) => {
                    if (n.id !== id) return n;
                    return {
                        ...n,
                        jobProgress: progress,
                        jobStatus: 'running' as JobStatus,
                        message: message ?? n.message,
                        dismissible: false,
                        showCancel: true,
                    };
                })
            );
        },
        []
    );

    /**
     * Mark a job notification as complete (success or failure)
     * Makes it dismissible and auto-dismisses after DEFAULT_DURATION (30 seconds)
     */
    const completeJobNotification = React.useCallback(
        (id: string, success: boolean, message?: string) => {
            setNotifications((prev) =>
                prev.map((n) => {
                    if (n.id !== id) return n;
                    return {
                        ...n,
                        jobStatus: success ? 'completed' : 'failed',
                        jobProgress: success ? 100 : n.jobProgress,
                        severity: success ? 'success' : 'error',
                        message: message ?? n.message,
                        // Completed jobs: YES X button, NO cancel button, auto-dismiss
                        dismissible: true,
                        showCancel: false,
                        duration: DEFAULT_DURATION,
                        createdAt: Date.now(), // Reset timer
                    };
                })
            );
        },
        []
    );

    const clearAll = React.useCallback(() => {
        setNotifications([]);
    }, []);

    const setJobCancelHandler = React.useCallback(
        (handler: (jobId: string) => void) => {
            setJobCancelHandlerState(() => handler);
        },
        []
    );

    const value = React.useMemo(
        () => ({
            notifications,
            showNotification,
            showJobNotification,
            updateJobNotification,
            updateJobProgress,
            completeJobNotification,
            hideNotification,
            clearAll,
            onCancelJob: jobCancelHandler,
            setJobCancelHandler,
        }),
        [
            notifications, showNotification, showJobNotification, updateJobNotification,
            updateJobProgress, completeJobNotification, hideNotification, clearAll,
            jobCancelHandler, setJobCancelHandler
        ]
    );

    return <SnackbarContext.Provider value={value}>{children}</SnackbarContext.Provider>;
}

/**
 * Hook to access the snackbar notification system
 */
export function useSnackbar() {
    const context = React.useContext(SnackbarContext);
    if (!context) {
        throw new Error('useSnackbar must be used within a SnackbarProvider');
    }
    return context;
}
