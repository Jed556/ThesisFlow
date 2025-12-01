/**
 * Salary tracking types for expert honoraria payouts.
 */

import type { UserRole } from './profile';

/**
 * Supported expert roles that can receive stipends/honoraria.
 */
export type SalaryRole = Extract<UserRole, 'adviser' | 'editor' | 'statistician'>;

/**
 * Linear payout statuses visualised through the UI stepper.
 */
export type SalaryStatus = 'psrf_pending' | 'distributed' | 'received';

/**
 * History entry describing every status change along the payout pipeline.
 */
export interface SalaryStatusEvent {
    id: string;
    status: SalaryStatus;
    changedBy: string;
    changedAt: string;
    note?: string;
}

/**
 * Firestore document describing a stipend/honorarium release.
 */
export interface SalaryDistribution {
    id: string;
    year: string;
    role: SalaryRole;
    userUid: string;
    userName?: string;
    amount: number;
    currency?: string;
    psrfNumber?: string;
    period: string; // YYYY-MM period identifier
    status: SalaryStatus;
    distributedAt?: string;
    distributedBy?: string;
    receivedAt?: string;
    receivedBy?: string;
    remarks?: string;
    createdAt: string;
    updatedAt: string;
    history?: SalaryStatusEvent[];
}

/**
 * Data used when creating a new salary distribution entry.
 */
export interface SalaryDistributionDraft {
    role: SalaryRole;
    userUid: string;
    userName?: string;
    amount: number;
    currency?: string;
    psrfNumber?: string;
    period: string;
    remarks?: string;
}
