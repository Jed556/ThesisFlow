/**
 * SubmissionCard Component
 * Wrapper for FileCard that adds submission workflow actions:
 * - Upload/Submit for students
 * - Approve/Reject for experts
 * - Click-to-view with tooltip
 * - Draft status display
 * 
 * Approval flow: Student uploads → Statistician → Adviser → Editor
 */

import * as React from 'react';
import {
    Box, Button, Card, CardContent, Chip, CircularProgress,
    IconButton, Stack, Tooltip, Typography,
} from '@mui/material';
import {
    CheckCircle as ApproveIcon,
    Send as SubmitIcon,
    Undo as RevisionIcon,
    Link as LinkIcon,
    ContentCopy as CopyIcon,
    OpenInNew as OpenInNewIcon,
    Delete as DeleteIcon,
} from '@mui/icons-material';
import { FileCard } from './index';
import type { FileAttachment } from '../../types/file';
import type { ExpertRole, ChapterSubmissionStatus } from '../../types/thesis';
import type { ConversationParticipant } from '../Conversation';
import { buildFileSizeLabel, buildSubmissionMeta, buildSubmissionStatusChip } from '../ThesisWorkspace/ChapterRail';
import { ApprovalStatusChip, type ApprovalChipStatus } from '../StatusChip';

/**
 * Submission status for the workflow
 */
export type SubmissionWorkflowStatus =
    | 'draft'           // Uploaded but not submitted
    | 'submitted'       // Submitted, awaiting first approval
    | 'under_review'    // Under review by current expert
    | 'approved'        // Approved by all required experts
    | 'revision_required'; // Revision requested

import type { ExpertApprovalState } from '../../types/thesis';

export interface SubmissionCardProps {
    /** The file attachment */
    file?: FileAttachment;
    /** Document link URL (for link submission mode) */
    link?: string;
    /** Version label (e.g., "v1", "v2") */
    versionLabel?: string;
    /** Version index (0-based) */
    versionIndex: number;
    /** Current submission status */
    status?: ChapterSubmissionStatus;
    /** Whether this is a draft (not yet submitted) */
    isDraft?: boolean;
    /** Whether this submission is ignored (another version is approved) */
    isIgnored?: boolean;
    /** Expert approval states */
    expertApprovals?: ExpertApprovalState;
    /** Whether this card is selected */
    selected?: boolean;
    /** Participants for display names */
    participants?: Record<string, ConversationParticipant>;

    // Role-based props
    /** Whether the current user is a student */
    isStudent?: boolean;
    /** Current user's expert role (if any) */
    currentExpertRole?: ExpertRole;
    /** Whether the thesis has a statistician */
    hasStatistician?: boolean;

    // Action handlers
    /** Called when clicking the card to view/comment */
    onView?: (file: FileAttachment) => void;
    /** Called when viewing a link */
    onViewLink?: (link: string) => void;
    /** Called when submitting a draft */
    onSubmit?: (file: FileAttachment) => void;
    /** Called when submitting a draft link */
    onSubmitLink?: (link: string) => void;
    /** Called when expert approves */
    onApprove?: (file: FileAttachment) => void;
    /** Called when expert approves a link submission */
    onApproveLink?: (link: string) => void;
    /** Called when service requests revision */
    onRequestRevision?: (file: FileAttachment) => void;
    /** Called when service requests revision for link submission */
    onRequestRevisionLink?: (link: string) => void;
    /** Called when deleting the submission */
    onDelete?: (file: FileAttachment) => void;
    /** Called when deleting a link submission */
    onDeleteLink?: (link: string) => void;

    // Loading states
    /** Whether an action is in progress */
    isProcessing?: boolean;
    /** Disable all actions */
    disabled?: boolean;

    // Display options
    /** Whether to show delete button */
    showDeleteButton?: boolean;
}

/**
 * Check if a role has approved in the expertApprovals array
 * Only returns true if decision is 'approved' (or undefined for backward compatibility)
 */
function hasRoleApproved(expertApprovals: ExpertApprovalState | undefined, role: ExpertRole): boolean {
    if (!expertApprovals || !Array.isArray(expertApprovals)) return false;
    return expertApprovals.some((approval) =>
        approval.role === role && (approval.decision === 'approved' || approval.decision === undefined)
    );
}

/**
 * Check if a role has requested revision in the expertApprovals array
 */
function hasRoleRequestedRevision(expertApprovals: ExpertApprovalState | undefined, role: ExpertRole): boolean {
    if (!expertApprovals || !Array.isArray(expertApprovals)) return false;
    return expertApprovals.some((approval) =>
        approval.role === role && approval.decision === 'revision_required'
    );
}

/**
 * Determine which expert should approve next in the workflow
 * Approval order: Statistician (if exists) → Adviser → Editor
 */
function getNextApprover(
    expertApprovals: ExpertApprovalState | undefined,
    hasStatistician: boolean
): ExpertRole | null {
    // Approval order: statistician (if exists) → adviser → editor
    if (hasStatistician && !hasRoleApproved(expertApprovals, 'statistician')) return 'statistician';
    if (!hasRoleApproved(expertApprovals, 'adviser')) return 'adviser';
    if (!hasRoleApproved(expertApprovals, 'editor')) return 'editor';

    return null; // All approved
}

/**
 * Check if the current expert can approve
 */
function canExpertApprove(
    currentRole: ExpertRole | undefined,
    expertApprovals: ExpertApprovalState | undefined,
    hasStatistician: boolean
): boolean {
    if (!currentRole) return false;

    const nextApprover = getNextApprover(expertApprovals, hasStatistician);
    return nextApprover === currentRole;
}

/**
 * Approval status chips component
 * Shows 2-3 chips based on whether statistician is present
 * Also indicates if revision was requested and by whom
 */
interface ApprovalStatusChipsProps {
    expertApprovals?: ExpertApprovalState;
    hasStatistician: boolean;
    /** Current submission status - used to show revision requested state */
    status?: string;
}

const ApprovalStatusChips: React.FC<ApprovalStatusChipsProps> = ({
    expertApprovals,
    hasStatistician,
    status,
}) => {
    const isRevisionRequested = status === 'revision_required';

    // Determine which role requested revision by checking the decision field
    const getRevisionRequester = (): ExpertRole | null => {
        if (!isRevisionRequested) return null;
        // Check who has a 'revision_required' decision in expertApprovals
        if (hasStatistician && hasRoleRequestedRevision(expertApprovals, 'statistician')) return 'statistician';
        if (hasRoleRequestedRevision(expertApprovals, 'adviser')) return 'adviser';
        if (hasRoleRequestedRevision(expertApprovals, 'editor')) return 'editor';
        return null;
    };

    const revisionRequester = getRevisionRequester();

    /**
     * Map expert role state to unified ApprovalChipStatus
     */
    const getChipStatus = (role: ExpertRole): ApprovalChipStatus => {
        if (hasRoleApproved(expertApprovals, role)) return 'approved';
        if (isRevisionRequested && revisionRequester === role) return 'revision_required';
        return 'pending';
    };

    /**
     * Get the decidedAt timestamp for a role from expertApprovals
     */
    const getDecidedAt = (role: ExpertRole): string | undefined => {
        const approval = expertApprovals?.find((a) => a.role === role);
        return approval?.decidedAt;
    };

    const ROLE_LABELS: Record<ExpertRole, string> = {
        statistician: 'Statistician',
        adviser: 'Adviser',
        editor: 'Editor',
    };

    const chips: ExpertRole[] = [];
    if (hasStatistician) {
        chips.push('statistician');
    }
    chips.push('adviser');
    chips.push('editor');

    return (
        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
            {chips.map((role) => (
                <ApprovalStatusChip
                    key={role}
                    roleLabel={ROLE_LABELS[role]}
                    status={getChipStatus(role)}
                    decidedAt={getDecidedAt(role)}
                    size="small"
                    sx={{ height: 24, fontSize: '0.7rem' }}
                />
            ))}
        </Stack>
    );
};

/**
 * SubmissionCard - Wrapper for FileCard with workflow actions
 */
export const SubmissionCard: React.FC<SubmissionCardProps> = ({
    file,
    link,
    versionLabel,
    versionIndex,
    status,
    isDraft = false,
    isIgnored = false,
    expertApprovals,
    selected,
    participants,
    isStudent,
    currentExpertRole,
    hasStatistician = false,
    onView,
    onViewLink,
    onSubmit,
    onSubmitLink,
    onApprove,
    onApproveLink,
    onRequestRevision,
    onRequestRevisionLink,
    onDelete,
    onDeleteLink,
    isProcessing,
    disabled,
    showDeleteButton = false,
}) => {
    const [copySuccess, setCopySuccess] = React.useState(false);
    const isLinkSubmission = Boolean(link) && !file;

    // Determine chip display - show 'Ignored' if isIgnored, otherwise derive from status
    const displayStatus = isIgnored ? 'ignored' : (isDraft ? 'draft' : status);
    const { label: statusChipLabel, color: statusChipColor } = buildSubmissionStatusChip(
        displayStatus
    );

    // Check if expert can approve
    const canApprove = !isStudent && canExpertApprove(
        currentExpertRole,
        expertApprovals,
        hasStatistician
    );

    // Check if all experts have approved
    const isFullyApproved = status === 'approved' || (
        hasRoleApproved(expertApprovals, 'adviser') &&
        hasRoleApproved(expertApprovals, 'editor') &&
        (!hasStatistician || hasRoleApproved(expertApprovals, 'statistician'))
    );

    // Handle card click - view/comment
    const handleCardClick = React.useCallback(() => {
        if (file && onView) {
            onView(file);
        } else if (link && onViewLink) {
            onViewLink(link);
        }
    }, [file, link, onView, onViewLink]);

    // Handle opening link in new tab
    const handleOpenLink = React.useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (link) {
            // Ensure the URL has a protocol
            const url = link.startsWith('http') ? link : `https://${link}`;
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    }, [link]);

    // Handle copy link to clipboard
    const handleCopyLink = React.useCallback(async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (link) {
            try {
                await navigator.clipboard.writeText(link);
                setCopySuccess(true);
                setTimeout(() => setCopySuccess(false), 2000);
            } catch (err) {
                console.error('Failed to copy link:', err);
            }
        }
    }, [link]);

    // Handle submit
    const handleSubmit = React.useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (file && onSubmit) {
            onSubmit(file);
        } else if (link && onSubmitLink) {
            onSubmitLink(link);
        }
    }, [file, link, onSubmit, onSubmitLink]);

    // Handle approve
    const handleApprove = React.useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (file && onApprove) {
            onApprove(file);
        } else if (link && onApproveLink) {
            onApproveLink(link);
        }
    }, [file, link, onApprove, onApproveLink]);

    // Handle request revision
    const handleRequestRevision = React.useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (file && onRequestRevision) {
            onRequestRevision(file);
        } else if (link && onRequestRevisionLink) {
            onRequestRevisionLink(link);
        }
    }, [file, link, onRequestRevision, onRequestRevisionLink]);

    // Handle delete link
    const handleDeleteLink = React.useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (link && onDeleteLink) {
            onDeleteLink(link);
        }
    }, [link, onDeleteLink]);

    // Build tooltip text
    const tooltipText = file
        ? 'Click to view or comment'
        : link
            ? 'Click to open link'
            : 'No file available';

    // Show approval chips for non-draft submissions (both students and experts)
    // Don't show chips for ignored submissions
    const showApprovalChips = !isDraft && !isIgnored && status !== undefined;

    // Check if this submission is awaiting student revision (expert already requested changes)
    const isAwaitingRevision = status === 'revision_required';

    // Expert can take action when:
    // 1. Not a student
    // 2. Has content to act on (file or link)
    // 3. Not fully approved
    // 4. Submission has been submitted (has a status)
    // 5. Not already marked as needing revision (student needs to resubmit first)
    // 6. Not ignored (another version is already approved)
    const hasContent = Boolean(file || link);
    const canTakeExpertAction = !isStudent && hasContent && !isFullyApproved
        && status !== undefined && !isAwaitingRevision && !isIgnored;

    // Determine if submit is available (for students)
    const canSubmitDraft = isStudent && isDraft && (
        (file && onSubmit) || (link && onSubmitLink)
    );

    return (
        <Card
            elevation={3}
            sx={{
                borderRadius: 2,
                border: 1,
                borderColor: selected ? 'primary.main' : 'divider',
                transition: 'border-color 120ms ease, box-shadow 120ms ease',
                '&:hover': {
                    borderColor: 'primary.light',
                },
            }}
        >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                {/* Link submission display */}
                {isLinkSubmission ? (
                    <Box>
                        {/* Link card header */}
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                            <LinkIcon color="primary" />
                            <Typography variant="subtitle2" fontWeight={600}>
                                {versionLabel ?? `v${versionIndex + 1}`}
                            </Typography>
                            {isDraft && (
                                <Chip size="small" label="Draft" color="default" />
                            )}
                            {!isDraft && statusChipLabel && (
                                <Chip size="small" label={statusChipLabel} color={statusChipColor} />
                            )}
                        </Stack>

                        {/* Link URL with actions */}
                        <Stack
                            direction="row"
                            spacing={1}
                            alignItems="center"
                            sx={{
                                p: 1.5,
                                bgcolor: 'action.hover',
                                borderRadius: 1,
                                border: 1,
                                borderColor: 'divider',
                            }}
                        >
                            <Typography
                                variant="body2"
                                sx={{
                                    flex: 1,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    color: 'primary.main',
                                    cursor: 'pointer',
                                    '&:hover': { textDecoration: 'underline' },
                                }}
                                onClick={handleOpenLink}
                                title={link}
                            >
                                {link}
                            </Typography>

                            <Tooltip title={copySuccess ? 'Copied!' : 'Copy link'}>
                                <IconButton
                                    size="small"
                                    onClick={handleCopyLink}
                                    color={copySuccess ? 'success' : 'default'}
                                >
                                    <CopyIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>

                            <Tooltip title="Open in new tab">
                                <IconButton size="small" onClick={handleOpenLink} color="primary">
                                    <OpenInNewIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>

                            {showDeleteButton && isDraft && onDeleteLink && (
                                <Tooltip title="Delete">
                                    <IconButton
                                        size="small"
                                        onClick={handleDeleteLink}
                                        color="error"
                                        disabled={isProcessing}
                                    >
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            )}
                        </Stack>
                    </Box>
                ) : (
                    /* Main file card wrapped in tooltip */
                    <Tooltip title={tooltipText} placement="top" arrow>
                        <Box>
                            <FileCard
                                file={file}
                                title={file?.name}
                                versionLabel={versionLabel ?? `v${versionIndex + 1}`}
                                sizeLabel={buildFileSizeLabel(file)}
                                metaLabel={buildSubmissionMeta(file, participants)}
                                statusChipLabel={isDraft ? undefined : statusChipLabel}
                                statusChipColor={isDraft ? undefined : statusChipColor}
                                isDraft={isDraft}
                                selected={selected}
                                disabled={disabled || isProcessing}
                                variant="box"
                                onClick={handleCardClick}
                                onDelete={onDelete && file ? () => onDelete(file) : undefined}
                                showDeleteButton={showDeleteButton && !isProcessing}
                                showDownloadButton={Boolean(file?.url)}
                            />
                        </Box>
                    </Tooltip>
                )}

                {/* Approval status chips and expert action buttons */}
                {showApprovalChips && (
                    <Stack
                        direction="row"
                        spacing={1}
                        sx={{ mt: 1.5, ml: 1 }}
                        flexWrap="wrap"
                        useFlexGap
                        alignItems="center"
                        justifyContent="space-between"
                    >
                        {/* Left side: approval status chips */}
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                            <ApprovalStatusChips
                                expertApprovals={expertApprovals}
                                hasStatistician={hasStatistician}
                                status={status}
                            />
                        </Stack>

                        {/* Right side: action buttons */}
                        <Stack direction="row" spacing={1} alignItems="center">
                            {canTakeExpertAction && canApprove && onApprove && (
                                <Button
                                    size="small"
                                    variant="contained"
                                    color="success"
                                    startIcon={isProcessing ? <CircularProgress size={16} /> : <ApproveIcon />}
                                    onClick={handleApprove}
                                    disabled={disabled || isProcessing}
                                    sx={{ height: 28 }}
                                >
                                    {isProcessing ? 'Approving…' : 'Approve'}
                                </Button>
                            )}
                            {canTakeExpertAction && canApprove && onRequestRevision && (
                                <Button
                                    size="small"
                                    variant="outlined"
                                    color="warning"
                                    startIcon={isProcessing ? <CircularProgress size={16} /> : <RevisionIcon />}
                                    onClick={handleRequestRevision}
                                    disabled={disabled || isProcessing}
                                    sx={{ height: 28 }}
                                >
                                    {isProcessing ? 'Processing…' : 'Request Revision'}
                                </Button>
                            )}
                            {canTakeExpertAction && !canApprove && currentExpertRole && (
                                <Typography variant="caption" color="text.secondary">
                                    Waiting for {getNextApprover(expertApprovals, hasStatistician)} approval
                                </Typography>
                            )}
                            {/* Awaiting revision indicator - shown when revision was requested */}
                            {isAwaitingRevision && !isStudent && (
                                <Typography variant="caption" color="warning.main">
                                    Awaiting student revision
                                </Typography>
                            )}
                            {/* Fully approved indicator */}
                            {isFullyApproved && !isStudent && (
                                <Chip
                                    size="small"
                                    icon={<ApproveIcon fontSize="small" />}
                                    label="Fully Approved"
                                    color="success"
                                    variant="filled"
                                />
                            )}
                        </Stack>
                    </Stack>
                )}

                {/* Student actions */}
                {canSubmitDraft && (
                    <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} justifyContent="flex-end">
                        <Button
                            size="small"
                            variant="contained"
                            color="primary"
                            startIcon={isProcessing ? <CircularProgress size={16} /> : <SubmitIcon />}
                            onClick={handleSubmit}
                            disabled={disabled || isProcessing}
                        >
                            {isProcessing ? 'Submitting…' : 'Submit for Review'}
                        </Button>
                    </Stack>
                )}
            </CardContent>
        </Card>
    );
};

export default SubmissionCard;
