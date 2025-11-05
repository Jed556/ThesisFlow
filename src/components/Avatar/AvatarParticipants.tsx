import { Box, Tooltip, Stack, Typography } from '@mui/material';
import { Avatar, Name } from './index';

/**
 * Event participant with status
 */
interface Participant {
    uid: string;
    role?: string;
    status?: 'accepted' | 'declined' | 'pending' | 'tentative';
}

/**
 * Props for AvatarParticipants component
 */
interface AvatarParticipantsProps {
    /**
     * Array of participants to display
     */
    participants: Participant[];
    /**
     * Maximum number of avatars to show before showing "+X"
     * @default 5
     */
    maxVisible?: number;
    /**
     * Size of the avatars
     * @default "medium"
     */
    size?: 'small' | 'medium' | 'large';
    /**
     * Whether to show role in tooltip
     * @default true
     */
    showRole?: boolean;
}

/**
 * AvatarParticipants component displays a list of participant avatars
 * with overflow handling and tooltip showing all participants
 */
export default function AvatarParticipants({
    participants,
    maxVisible = 5,
    size = 'medium',
    showRole = true
}: AvatarParticipantsProps) {
    if (!participants || participants.length === 0) {
        return null;
    }

    const visibleParticipants = participants.slice(0, maxVisible);
    const remainingParticipants = participants.slice(maxVisible);
    const remainingCount = remainingParticipants.length;

    /**
     * Render tooltip content showing all remaining participants
     */
    const renderRemainingTooltip = () => (
        <Stack spacing={0.5} sx={{ p: 0.5 }}>
            {remainingParticipants.map((participant, index) => (
                <Box
                    key={participant.uid || index}
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        py: 0.5
                    }}
                >
                    <Avatar
                        uid={participant.uid}
                        initials={[Name.FIRST]}
                        size="small"
                        sx={{
                            ...(participant.status === 'declined' && { opacity: 0.5 })
                        }}
                    />
                    <Box>
                        <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                            {participant.uid}
                        </Typography>
                        {showRole && participant.role && (
                            <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ fontSize: '0.75rem' }}
                            >
                                {participant.role}
                            </Typography>
                        )}
                    </Box>
                </Box>
            ))}
        </Stack>
    );

    return (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {/* Visible participants */}
            {visibleParticipants.map((participant, index) => {
                const tooltipText = showRole && participant.role
                    ? `${participant.uid} (${participant.role})`
                    : participant.uid;

                return (
                    <Avatar
                        key={participant.uid || index}
                        uid={participant.uid}
                        initials={[Name.FIRST]}
                        size={size}
                        tooltipText={tooltipText}
                        sx={{
                            ...(participant.status === 'declined' && { opacity: 0.5 })
                        }}
                    />
                );
            })}

            {/* Remaining participants indicator with tooltip */}
            {remainingCount > 0 && (
                <Tooltip
                    title={renderRemainingTooltip()}
                    placement="top"
                    arrow
                    slotProps={{
                        tooltip: {
                            sx: {
                                maxWidth: 300,
                                bgcolor: 'background.paper',
                                color: 'text.primary',
                                border: 1,
                                borderColor: 'divider',
                                boxShadow: 4,
                                p: 1
                            }
                        }
                    }}
                >
                    <Box>
                        <Avatar
                            uid={`+${remainingCount}`}
                            size={size}
                            sx={{
                                fontSize: size === 'small' ? '0.7rem' : '0.75rem',
                                cursor: 'pointer',
                                '&:hover': {
                                    opacity: 0.8
                                }
                            }}
                        />
                    </Box>
                </Tooltip>
            )}
        </Box>
    );
}
