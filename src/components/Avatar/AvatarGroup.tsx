import { Tooltip } from '@mui/material';
import MuiAvatarGroup from '@mui/material/AvatarGroup';
import { Avatar } from './index';

/**
 * Event participant with status
 */
interface Participant {
    uid: string;
    role?: string;
    status?: 'accepted' | 'declined' | 'pending' | 'tentative';
}

/**
 * Props for AvatarGroup component
 */
interface AvatarGroupProps {
    /**
     * Array of participants to display
     */
    participants: Participant[];
    /**
     * Maximum number of avatars to show before showing "+X"
     * @default 5
     */
    max?: number;
    /**
     * Size of the avatars
     * @default "medium"
     */
    size?: 'small' | 'medium' | 'large' | number;
    /**
     * Spacing between avatars
     * @default "medium"
     */
    spacing?: 'small' | 'medium' | number;
    /**
     * Whether to show role in tooltip
     * @default true
     */
    showRole?: boolean;
}

/**
 * AvatarGroup component displays a list of participant avatars
 * using MUI's AvatarGroup for consistent styling and overflow handling
 */
export default function AvatarGroup({
    participants,
    max = 5,
    size = 'medium',
    spacing = 'medium',
    showRole = true
}: AvatarGroupProps) {
    if (!participants || participants.length === 0) {
        return null;
    }

    return (
        <MuiAvatarGroup
            max={max}
            spacing={spacing}
        >
            {participants.map((participant, index) => {
                const tooltipText = showRole && participant.role
                    ? `${participant.uid} (${participant.role})`
                    : participant.uid;

                return (
                    <Tooltip key={participant.uid || index} title={tooltipText} arrow>
                        <Avatar
                            uid={participant.uid}
                            size={size}
                            sx={{
                                ...(participant.status === 'declined' && { opacity: 0.5 })
                            }}
                        />
                    </Tooltip>
                );
            })}
        </MuiAvatarGroup>
    );
}
