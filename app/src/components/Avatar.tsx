import { Avatar as MuiAvatar, Chip, type AvatarProps as MuiAvatarProps, Tooltip } from '@mui/material';
import React from 'react';
import type { UserProfile } from '../types/profile';
import { getAvatarInitials, getInitialsFromFullName, findProfileByEmail, getDisplayName } from '../utils/avatarUtils';
import { mockUserProfiles } from '../data/mockData';

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
     * User profile object to derive avatar from
     * If not provided, `email` or `name` can be used as fallbacks
     * If multiple are provided, `profile` takes precedence over `email`, which takes precedence over `name`
     */
    profile?: UserProfile;

    /**
     * User email string to lookup profile
     * If `profile` is not provided, this will be used to find the profile
     * If neither `profile` nor `email` is provided, `name` will be used as a fallback
     */
    email?: string;

    /**
     * Full name string to derive initials from
     * Used as a fallback if neither `profile` nor `email` is provided
     * Note: This does not support detailed initials configuration like `profile` does
     * and will simply use the first letters of the first and last words in the name
     * If you need more control over initials, provide a `profile` or `email` instead
     */
    name?: string;

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
 * @param name - Fallback name string
 * @param config - Initials configuration
 * @returns Generated initials
 */
function generateInitials(profile: UserProfile | null, name: string | null, config: InitialsConfig): string {
    if (profile) {
        // Handle 'auto' mode - defaults to first + last
        if (config === 'auto') {
            return getAvatarInitials(profile.firstName, profile.lastName);
        }

        // Handle array of name parts
        if (Array.isArray(config)) {
            const initials: string[] = [];

            config.forEach(part => {
                switch (part) {
                    case Name.PREFIX:
                        if (profile.prefix) {
                            initials.push(profile.prefix.charAt(0));
                        }
                        break;
                    case Name.FIRST:
                        initials.push(profile.firstName.charAt(0));
                        break;
                    case Name.MIDDLE:
                        if (profile.middleName) {
                            initials.push(profile.middleName.charAt(0));
                        }
                        break;
                    case Name.LAST:
                        initials.push(profile.lastName.charAt(0));
                        break;
                    case Name.SUFFIX:
                        if (profile.suffix) {
                            initials.push(profile.suffix.charAt(0));
                        }
                        break;
                }
            });

            return initials.join('').toUpperCase();
        }
    } else if (name) {
        // For name strings, use existing utility
        return getInitialsFromFullName(name);
    }
    return '';
}

/**
 * Display for user profile pictures or initials
 * @param profile - User profile object
 * @param email - User email string
 * @param name - Full name string
 * @param initials - Initials configuration
 * @param mode - Display mode ('default' or 'chip')
 * @param label - Chip label text (for chip mode)
 * @param chipProps - Additional props for Chip component
 * @param sx - Custom styles for Avatar
 * @param size - Predefined sizes ('small', 'medium', 'large') or custom number
 * @param onClick - Click event handler
 * @param tooltip - Quick tooltip selection ('email', 'full', 'none')
 * @param tooltipText - Optional custom tooltip text (overrides `tooltip`)
 */
export default function Avatar({ profile, email, name, initials = NAME_PRESETS.firstLast, mode = 'default',
    label, chipProps, sx, size = 'medium', onClick, tooltip = 'none', tooltipText, }: AvatarProps) {
    // Resolve profile from email if needed
    const resolvedProfile = profile || (email ? findProfileByEmail(mockUserProfiles, email) : null);

    // Generate display name and initials
    const displayName = resolvedProfile ? getDisplayName(resolvedProfile) : (name || 'Unknown');
    const avatarInitials = generateInitials(resolvedProfile, name || null, initials);

    // Calculate avatar size
    const avatarSize = typeof size === 'number'
        ? { width: size, height: size, fontSize: `${size * 0.4}px` }
        : sizeMap[size];

    // Create the avatar element
    const avatarCore = (
        <MuiAvatar
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
        finalTooltip = resolvedProfile?.email ?? name ?? undefined;
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
                label={label || displayName}
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

// Convenience components for common use cases

/**
 * ProfileAvatar component for displaying user profile pictures or initials
 * @param profile - User profile object
 * @param AvatarProps - Avatar props
 */
export function ProfileAvatar({ profile, ...props }: Omit<AvatarProps, 'profile'> & { profile: UserProfile }) {
    return <Avatar profile={profile} {...props} />;
}

/**
 * EmailAvatar component for displaying user email initials
 * @param email - User email string
 * @param AvatarProps - Avatar props
 * @returns EmailAvatar element
 */
export function EmailAvatar({ email, ...props }: Omit<AvatarProps, 'email'> & { email: string }) {
    return <Avatar email={email} {...props} />;
}

/**
 * NameAvatar component for displaying user name initials
 * @param name - Full name string
 * @param AvatarProps - Avatar props
 * @returns NameAvatar element
 */
export function NameAvatar({ name, ...props }: Omit<AvatarProps, 'name'> & { name: string }) {
    return <Avatar name={name} {...props} />;
}

/**
 * ChipAvatar component for displaying user initials in a chip
 * @param label - Optional label for the chip
 * @param AvatarProps - Avatar props
 * @returns ChipAvatar element
 */
export function ChipAvatar({ label, ...props }: AvatarProps & { label?: string }) {
    return <Avatar mode="chip" label={label} {...props} />;
}