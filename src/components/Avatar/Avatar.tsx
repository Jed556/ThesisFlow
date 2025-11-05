import React from 'react';
import { getAvatarInitials } from '../../utils/avatarUtils';
import { getProfile, getDisplayName as getDisplayNameAsync } from '../../utils/firebase/firestore/profile';
import type { UserProfile } from '../../types/profile';
import MuiAvatar, { type AvatarProps as MuiAvatarProps } from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import Skeleton from '@mui/material/Skeleton';

/**
 * Define which name parts to include for initials generation
 */
export enum Name {
    PREFIX = 'prefix',
    FIRST = 'first',
    MIDDLE = 'middle',
    LAST = 'last',
    SUFFIX = 'suffix'
}

// Configuration for which name parts to use for initials
export type InitialsConfig = Name[] | 'auto';

/**
 * Common predefined name configurations for convenience 
 */
export const NAME_PRESETS = {
    firstLast: [Name.FIRST, Name.LAST] as Name[],
    firstMiddle: [Name.FIRST, Name.MIDDLE] as Name[],
    lastFirst: [Name.LAST, Name.FIRST] as Name[],
    all: [Name.PREFIX, Name.FIRST, Name.MIDDLE, Name.LAST, Name.SUFFIX] as Name[],
    academic: [Name.PREFIX, Name.FIRST, Name.LAST] as Name[], // e.g., "Dr. John Doe" → "DJD"
};

/**
 * Avatar display modes
 */
export type AvatarMode = 'default' | 'chip';

/**
 * Flexible Avatar component that can handle different data sources and display modes
 */
export interface AvatarProps {
    // Data sources (use one of these)

    /**
     * User ID string to lookup profile
     * If `profile` is not provided, this will be used to find the profile
     */
    uid: string;

    // Customization options
    /**
     * Which name parts to use for initials generation
     * Can be an array of `Name` enum values or 'auto' to default to first + last
     * Defaults to `NAME_PRESETS.firstLast`
     */
    initials?: InitialsConfig;
    /**
     * Display mode of the avatar
     * - 'default': Standard avatar display
     * - 'chip': Avatar within a Chip component with optional label
     * @default 'default'
     */
    mode?: AvatarMode;
    /**
     * Tooltip display options
     * - 'email': Show email in tooltip (if available)
     * - 'full': Show full name in tooltip
     * - 'none': No tooltip
     * @default 'none'
     */
    tooltip?: 'email' | 'full' | 'none';

    // Chip mode specific props
    /**
     * Chip label text (for chip mode)
     */
    label?: string;
    /**
     * Additional props to pass to the MUI Chip component when in 'chip' mode
     * Allows customization of variant, size, color, etc.
     * @see {@link https://mui.com/material-ui/api/chip/#props}
     */
    chipProps?: {
        variant?: 'filled' | 'outlined';
        size?: 'small' | 'medium';
        color?: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
    };

    /**
     * Avatar styling props
     * @see {@link https://mui.com/material-ui/api/avatar/#props}
     */
    sx?: MuiAvatarProps['sx'];

    /**
     * Avatar size  
     * - Predefined sizes: 'small' (24px), 'medium' (32px), 'large' (40px)
     * @default 'medium'        
     */
    size?: 'small' | 'medium' | 'large' | number; // Predefined sizes or custom

    // Event handlers
    /**
     * Click event handler
     */
    onClick?: () => void;
    // Optional custom tooltip text to show on hover (takes precedence over `tooltip`)

    /**
     * Custom tooltip text to show on hover (overrides `tooltip` option)
     * If provided, this text will be shown in the tooltip regardless of the `tooltip` setting
     * If not provided, the `tooltip` setting will determine what text (if any) to show
     */
    tooltipText?: string;

    /**
     * Whether the avatar is still loading
     * @default false
     */
    loading?: boolean;
}

// Size mappings for predefined sizes
const sizeMap = {
    small: { width: 24, height: 24, fontSize: '0.75rem' },
    medium: { width: 32, height: 32, fontSize: '0.875rem' },
    large: { width: 40, height: 40, fontSize: '1rem' }
};

/**
 * Generate initials based on configuration
 * @param profile - User profile object
 * @param config - Initials configuration
 * @returns Generated initials
 */
function generateInitials(profile: UserProfile, config: InitialsConfig): string {
    if (profile) {
        // Handle 'auto' mode - defaults to first + last
        if (config === 'auto') {
            return getAvatarInitials(profile.name.first, profile.name.last);
        }

        // Handle array of name parts
        if (Array.isArray(config)) {
            const initials: string[] = [];

            config.forEach(part => {
                switch (part) {
                    case Name.PREFIX:
                        if (profile.name.prefix) {
                            initials.push(profile.name.prefix.charAt(0));
                        }
                        break;
                    case Name.FIRST:
                        initials.push(profile.name.first.charAt(0));
                        break;
                    case Name.MIDDLE:
                        if (profile.name.middle) {
                            initials.push(profile.name.middle.charAt(0));
                        }
                        break;
                    case Name.LAST:
                        initials.push(profile.name.last.charAt(0));
                        break;
                    case Name.SUFFIX:
                        if (profile.name.suffix) {
                            initials.push(profile.name.suffix.charAt(0));
                        }
                        break;
                }
            });

            return initials.join('').toUpperCase();
        }
    }
    return '';
}

/**
 * Display for user profile pictures or initials
 * @param uid - User ID
 * @param initials - Initials configuration
 * @param mode - Display mode ('default' or 'chip')
 * @param label - Chip label text (for chip mode)
 * @param chipProps - Additional props for Chip component
 * @param sx - Custom styles for Avatar
 * @param size - Predefined sizes ('small', 'medium', 'large') or custom number
 * @param onClick - Click event handler
 * @param tooltip - Quick tooltip selection ('email', 'full', 'none')
 * @param tooltipText - Optional custom tooltip text (overrides `tooltip`)
 * @param loading - Whether the avatar is still loading
 */
export default function Avatar({ uid, initials = NAME_PRESETS.firstLast, mode = 'default',
    label, chipProps, sx, size = 'medium', onClick, tooltip = 'none', tooltipText, loading = false }: AvatarProps) {
    const [resolvedProfile, setResolvedProfile] = React.useState<UserProfile | null>(null);
    const [displayName, setDisplayName] = React.useState<string>('');
    const [isLoading, setIsLoading] = React.useState(true);

    // Fetch profile and display name
    React.useEffect(() => {
        let isMounted = true;

        async function fetchData() {
            setIsLoading(true);
            try {
                const profile = await getProfile(uid);
                if (isMounted && profile) {
                    setResolvedProfile(profile);
                    const name = await getDisplayNameAsync(uid);
                    if (isMounted) {
                        setDisplayName(name);
                    }
                }
            } catch (error) {
                console.error('Error fetching profile:', error);
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        }

        fetchData();

        return () => {
            isMounted = false;
        };
    }, [uid]);

    // Generate avatar initials
    const avatarInitials = resolvedProfile ? generateInitials(resolvedProfile, initials) : '??';

    // Calculate avatar size
    const avatarSize = typeof size === 'number'
        ? { width: size, height: size, fontSize: `${size * 0.4}px` }
        : sizeMap[size];

    // Create the avatar element with embedded skeleton
    const avatarCore = (loading || isLoading) ? (
        <Skeleton
            variant="circular"
            width={avatarSize.width}
            height={avatarSize.height}
            sx={sx}
        />
    ) : (
        <MuiAvatar
            src={resolvedProfile?.avatar}
            sx={{
                ...avatarSize,
                cursor: onClick ? 'pointer' : 'default',
                ...sx
            }}
            onClick={onClick}
        >
            {avatarInitials}
        </MuiAvatar>
    );

    // Tooltip logic: `tooltipText` takes precedence. Otherwise compute from `tooltip`.
    let finalTooltip: string | undefined = undefined;
    if (tooltipText) {
        finalTooltip = tooltipText;
    } else if (tooltip === 'email') {
        finalTooltip = resolvedProfile?.email ?? undefined;
    } else if (tooltip === 'full') {
        finalTooltip = displayName || undefined;
    }

    const avatarElement = finalTooltip
        ? (
            <Tooltip title={finalTooltip} arrow>
                {avatarCore}
            </Tooltip>
        )
        : avatarCore;

    // Return chip mode if requested
    if (mode === 'chip') {
        const chipCore = (
            <Chip
                avatar={avatarCore}
                label={(loading || isLoading) ? <Skeleton variant="text" width={80} /> : (label || displayName)}
                variant={chipProps?.variant || 'outlined'}
                size={chipProps?.size || 'small'}
                color={chipProps?.color || 'default'}
                onClick={onClick}
                sx={{
                    cursor: onClick ? 'pointer' : 'default'
                }}
            />
        );
        return finalTooltip
            ? <Tooltip title={finalTooltip} arrow>{chipCore}</Tooltip>
            : chipCore;
    }

    // Return default avatar
    return avatarElement;
}
