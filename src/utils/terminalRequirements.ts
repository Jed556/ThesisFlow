import type { FileAttachment } from '../types/file';
import type { TerminalRequirementStatus } from '../types/terminalRequirement';

/**
 * Derives the current status of a terminal requirement based on uploaded files.
 */
export function getTerminalRequirementStatus(files?: FileAttachment[]): TerminalRequirementStatus {
    return files && files.length > 0 ? 'submitted' : 'pending';
}
