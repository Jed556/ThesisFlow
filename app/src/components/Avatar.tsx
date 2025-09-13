import { Avatar as MuiAvatar, Chip, type AvatarProps as MuiAvatarProps } from '@mui/material';
import React from 'react';
import type { UserProfile } from '../types/profile';
import { getAvatarInitials, getInitialsFromFullName, findProfileByEmail, getDisplayName } from '../utils/avatarUtils';
import { mockUserProfiles } from '../data/mockData';

// Define which name parts to include for initials generation
export enum Name {
    PREFIX = 'prefix',
    FIRST = 'first',
    MIDDLE = 'middle',
    LAST = 'last',
    SUFFIX = 'suffix'
}

// Configuration for which name parts to use for initials
export type InitialsConfig = Name[] | 'auto';

// Common predefined configurations for convenience
export const NAME_PRESETS = {
    firstLast: [Name.FIRST, Name.LAST] as Name[],
    firstMiddle: [Name.FIRST, Name.MIDDLE] as Name[],
    lastFirst: [Name.LAST, Name.FIRST] as Name[],
    all: [Name.PREFIX, Name.FIRST, Name.MIDDLE, Name.LAST, Name.SUFFIX] as Name[],
    academic: [Name.PREFIX, Name.FIRST, Name.LAST] as Name[], // e.g., "Dr. John Doe" → "DJD"
};

// Avatar display modes
export type AvatarMode = 'default' | 'chip';

/**
 * Flexible Avatar component that can handle different data sources and display modes
 * 
 * @example
 * // Basic usage with profile object (chip mode - like in Thesis page)
 * <Avatar 
 *   profile={userProfile} 
 *   mode="chip" 
 *   label="John Doe (Leader)" 
 *   chipProps={{ variant: 'outlined' }}
 * />
 * 
 * @example
 * // Default avatar with name string (like in ChapterFile)
 * <Avatar 
 *   name="Dr. Jane Smith" 
 *   size="small"
 * />
 * 
 * @example
 * // Avatar with custom initials configuration
 * <Avatar 
 *   profile={userProfile}
 *   initials={[Name.FIRST, Name.LAST]}
 *   size="large"
 * />
 * 
 * @example
 * // Using preset configurations
 * <Avatar 
 *   profile={userProfile}
 *   initials={INITIALS_PRESETS.academic} // Dr. John Doe → "DJD"
 * />
 */
export interface AvatarProps {
    // Data sources (use one of these)
    profile?: UserProfile;           // Full profile object
    email?: string;                  // Email to lookup profile
    name?: string;                   // Full name string (fallback)

    // Customization options
    initials?: InitialsConfig;       // Which name parts to use
    mode?: AvatarMode;               // Display mode

    // Chip mode specific props
    label?: string;                  // Chip label text
    chipProps?: {
        variant?: 'filled' | 'outlined';
        size?: 'small' | 'medium';
        color?: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning';
    };

    // Avatar styling props
    sx?: MuiAvatarProps['sx'];
    size?: 'small' | 'medium' | 'large' | number; // Predefined sizes or custom

    // Event handlers
    onClick?: () => void;
}

// Size mappings for predefined sizes
const sizeMap = {
    small: { width: 24, height: 24, fontSize: '0.75rem' },
    medium: { width: 32, height: 32, fontSize: '0.875rem' },
    large: { width: 40, height: 40, fontSize: '1rem' }
};

// Generate initials based on configuration
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

export default function Avatar({
    profile,
    email,
    name,
    initials = NAME_PRESETS.firstLast,
    mode = 'default',
    label,
    chipProps,
    sx,
    size = 'medium',
    onClick,
}: AvatarProps) {
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
    const avatarElement = (
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

    // Return chip mode if requested
    if (mode === 'chip') {
        return (
            <Chip
                avatar={avatarElement}
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
    }

    // Return default avatar
    return avatarElement;
}

// Convenience components for common use cases
export function ProfileAvatar({ profile, ...props }: Omit<AvatarProps, 'profile'> & { profile: UserProfile }) {
    return <Avatar profile={profile} {...props} />;
}

export function EmailAvatar({ email, ...props }: Omit<AvatarProps, 'email'> & { email: string }) {
    return <Avatar email={email} {...props} />;
}

export function NameAvatar({ name, ...props }: Omit<AvatarProps, 'name'> & { name: string }) {
    return <Avatar name={name} {...props} />;
}

export function ChipAvatar({ label, ...props }: AvatarProps & { label?: string }) {
    return <Avatar mode="chip" label={label} {...props} />;
}