import * as React from 'react';
import {
    Box, Card, CardActionArea, CardContent, Chip, Divider, IconButton, Stack, Typography,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import GitHubIcon from '@mui/icons-material/GitHub';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import TwitterIcon from '@mui/icons-material/Twitter';
import Avatar from '../Avatar';
import type { UserProfile } from '../../types/profile';

/**
 * Stat item to display below the divider
 */
export interface ProfileCardStat {
    label: string;
    value: string | number;
    icon?: React.ReactNode;
    color?: string;
}

/**
 * Social link configuration
 */
export interface SocialLink {
    type: 'email' | 'github' | 'linkedin' | 'twitter' | 'custom';
    url: string;
    icon?: React.ReactNode;
    label?: string;
}

/**
 * ProfileCard component props
 */
export interface ProfileCardProps {
    /** User profile data */
    profile: UserProfile;

    /** Optional role label (e.g., 'Adviser', 'Editor', 'Student') */
    roleLabel?: string;

    /** Skills/expertise tags to display */
    skills?: string[];

    /** Stats to display below the divider */
    stats?: ProfileCardStat[];

    /** Number to show in upper right corner (e.g., rank) */
    cornerNumber?: number;

    /** Whether to show email address */
    showEmail?: boolean;

    /** Social links to display */
    socialLinks?: SocialLink[];

    /** Whether to show the skills section */
    showSkills?: boolean;

    /** Whether to show the divider */
    showDivider?: boolean;

    /** Click handler for the card */
    onClick?: () => void;

    /** Custom action button */
    actionButton?: React.ReactNode;

    /** Card elevation */
    elevation?: number;

    /** Card variant */
    variant?: 'outlined' | 'elevation';
}

/**
 * Get icon for social link type
 */
function getSocialIcon(type: SocialLink['type']): React.ReactNode {
    switch (type) {
        case 'email':
            return <EmailIcon fontSize="small" />;
        case 'github':
            return <GitHubIcon fontSize="small" />;
        case 'linkedin':
            return <LinkedInIcon fontSize="small" />;
        case 'twitter':
            return <TwitterIcon fontSize="small" />;
        default:
            return null;
    }
}

/**
 * Modular ProfileCard component for displaying user profiles
 * with configurable sections and data
 */
export default function ProfileCard({
    profile,
    roleLabel,
    skills = [],
    stats = [],
    cornerNumber,
    showEmail = false,
    socialLinks = [],
    showSkills = true,
    showDivider = true,
    onClick,
    actionButton,
    elevation = 0,
    variant = 'outlined',
}: ProfileCardProps) {
    const hasContent = stats.length > 0 || showEmail || socialLinks.length > 0;

    const formattedName = React.useMemo(() => {
        const parts: string[] = [];
        if (profile.name.prefix) {
            parts.push(profile.name.prefix);
        }
        parts.push(profile.name.first);
        if (profile.name.middle) {
            parts.push(profile.name.middle);
        }
        parts.push(profile.name.last);
        if (profile.name.suffix) {
            parts.push(profile.name.suffix);
        }
        return parts.join(' ');
    }, [profile.name]);

    const cardContent = (
        <CardContent>
            {/* Header with avatar and name */}
            <Stack direction="row" spacing={2} alignItems="center">
                <Avatar uid={profile.uid} size={48} tooltip="full" sx={{ flexShrink: 0 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="h6" component="div" noWrap>
                        {formattedName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>
                        {roleLabel && `${roleLabel} · `}
                        {profile.department ?? 'Department TBD'}
                    </Typography>
                </Box>
            </Stack>

            {/* Email section */}
            {showEmail && profile.email && (
                <Box sx={{ mt: 1.5 }}>
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                        }}
                    >
                        <EmailIcon fontSize="small" />
                        {profile.email}
                    </Typography>
                </Box>
            )}

            {/* Skills/Expertise tags */}
            {showSkills && skills.length > 0 && (
                <Stack
                    direction="row"
                    flexWrap="wrap"
                    spacing={1}
                    useFlexGap
                    sx={{ mt: 2 }}
                >
                    {skills.map((skill, index) => (
                        <Chip
                            key={`${skill}-${index}`}
                            label={skill}
                            size="small"
                            color="primary"
                            variant="outlined"
                        />
                    ))}
                </Stack>
            )}

            {/* Divider */}
            {showDivider && hasContent && <Divider sx={{ my: 2 }} />}

            {/* Stats section */}
            {stats.length > 0 && (
                <Stack direction="row" spacing={2} flexWrap="wrap">
                    {stats.map((stat, index) => (
                        <Stack key={`${stat.label}-${index}`} spacing={0.5}>
                            <Typography variant="caption" color="text.secondary">
                                {stat.label}
                            </Typography>
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 0.5,
                                }}
                            >
                                {stat.icon}
                                <Typography
                                    variant="subtitle1"
                                    fontWeight={600}
                                    sx={stat.color ? { color: stat.color } : undefined}
                                >
                                    {stat.value}
                                </Typography>
                            </Box>
                        </Stack>
                    ))}
                </Stack>
            )}

            {/* Social links */}
            {socialLinks.length > 0 && (
                <Stack
                    direction="row"
                    spacing={1}
                    sx={{ mt: stats.length > 0 ? 2 : 0 }}
                >
                    {socialLinks.map((link, index) => (
                        <IconButton
                            key={`${link.type}-${index}`}
                            size="small"
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            aria-label={link.label || link.type}
                        >
                            {link.icon || getSocialIcon(link.type)}
                        </IconButton>
                    ))}
                </Stack>
            )}

            {/* Custom action button */}
            {actionButton}
        </CardContent>
    );

    return (
        <Card
            elevation={elevation}
            variant={variant}
            sx={{ height: '100%', position: 'relative' }}
        >
            {/* Corner number */}
            {cornerNumber !== undefined && (
                <Box
                    sx={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        zIndex: 1,
                    }}
                >
                    <Typography
                        variant="h6"
                        sx={{
                            color: 'text.disabled',
                            fontWeight: 500,
                        }}
                    >
                        {cornerNumber}
                    </Typography>
                </Box>
            )}

            {/* Card content - clickable if onClick is provided */}
            {onClick ? (
                <CardActionArea onClick={onClick} sx={{ height: '100%' }}>
                    {cardContent}
                </CardActionArea>
            ) : (
                cardContent
            )}
        </Card>
    );
}
