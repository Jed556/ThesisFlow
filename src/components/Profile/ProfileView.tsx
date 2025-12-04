import * as React from 'react';
import {
    Avatar as MuiAvatar, Box, Button, Card, CardContent, Chip, Divider, Fab, Grid, LinearProgress,
    List, ListItem, ListItemAvatar, ListItemText, Paper, Stack, Tooltip, Typography,
} from '@mui/material';
import {
    Email as EmailIcon, Apartment as ApartmentIcon, ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import type { SxProps, Theme } from '@mui/material/styles';
import { alpha, useTheme } from '@mui/material/styles';
import ProfileHeader from './ProfileHeader';
import { getInitialsFromFullName } from '../../utils/avatarUtils';
import type { HistoricalThesisEntry, SkillRating, UserProfile, UserRole } from '../../types/profile';
import type { ThesisGroup } from '../../types/group';
import GroupCard from '../Group/GroupCard';

export interface ProfilePrimaryAction {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
    disabled?: boolean;
}

export interface ProfileBackAction {
    label: string;
    onClick: () => void;
}

export interface ProfileViewSections {
    expertise: boolean;
    contacts: boolean;
    currentTheses: boolean;
    timeline: boolean;
}

const DEFAULT_SECTIONS: ProfileViewSections = {
    expertise: true,
    contacts: true,
    currentTheses: true,
    timeline: true,
};

const EXPERT_ROLES = new Set<UserRole>(['adviser', 'editor', 'statistician']);

const ROLE_SECTION_OVERRIDES: Partial<Record<UserRole, Partial<ProfileViewSections>>> = {
    panel: { currentTheses: false, timeline: false },
    moderator: { currentTheses: false, timeline: false },
    head: { currentTheses: false, timeline: false },
};

export interface ProfileViewProps {
    profile: UserProfile;
    /** Active groups to display in the current assignments section */
    currentGroups?: ThesisGroup[];
    skills?: string[];
    skillRatings?: SkillRating[];
    timeline?: HistoricalThesisEntry[];
    contacts?: { icon: React.ReactNode; text: string; href?: string }[];
    primaryAction?: ProfilePrimaryAction;
    backAction?: ProfileBackAction;
    assignmentsEmptyMessage?: string;
    timelineEmptyMessage?: string;
    additionalSections?: React.ReactNode;
    headerCaption?: string;
    sectionVisibility?: Partial<ProfileViewSections>;
    floatingBackButton?: boolean;
    headerActions?: React.ReactNode;
    /** Optional group info to show a team card for the profile */
    group?: ThesisGroup | null;
    groupUsers?: Map<string, UserProfile> | null;
}

function deriveContactItems(
    profile: UserProfile,
    customContacts?: ProfileViewProps['contacts'],
): { icon: React.ReactNode; text: string; href?: string }[] {
    if (customContacts && customContacts.length > 0) {
        return customContacts;
    }
    const contactList: { icon: React.ReactNode; text: string; href?: string }[] = [];
    if (profile.email) {
        contactList.push({
            icon: <EmailIcon fontSize="small" color="primary" />,
            text: profile.email,
            href: `mailto:${profile.email}`,
        });
    }
    if (profile.department) {
        contactList.push({ icon: <ApartmentIcon fontSize="small" color="primary" />, text: profile.department });
    }
    if (profile.course) {
        contactList.push({ icon: <ApartmentIcon fontSize="small" color="primary" />, text: profile.course });
    }
    return contactList;
}

// (banner styling delegated to ProfileBanner component)

export default function ProfileView({
    profile, currentGroups, skills, skillRatings, timeline, contacts, primaryAction, backAction,
    assignmentsEmptyMessage = 'No active theses found.',
    timelineEmptyMessage = 'No historical records available yet.',
    additionalSections, headerCaption, sectionVisibility,
    floatingBackButton = false,
    headerActions, group, groupUsers,
}: ProfileViewProps) {
    const theme = useTheme();
    const accentColor = profile.preferences?.themeColor ?? theme.palette.primary.main;
    const bannerImage = profile.banner;
    const contrastText = theme.palette.getContrastText(accentColor);

    const contactItems = React.useMemo(() => deriveContactItems(profile, contacts), [contacts, profile]);
    const roleLabel = React.useMemo(
        () => profile.role.charAt(0).toUpperCase() + profile.role.slice(1),
        [profile.role]
    );

    const sections = React.useMemo(() => {
        const defaults: ProfileViewSections = { ...DEFAULT_SECTIONS };

        // Only advisers should show expertise by default
        defaults.expertise = profile.role === 'adviser';

        // Show current theses + timeline for experts and students
        const showsTheses = EXPERT_ROLES.has(profile.role) || profile.role === 'student';
        defaults.currentTheses = showsTheses;
        defaults.timeline = showsTheses;

        // Apply any per-role overrides (keeps existing overrides for special roles)
        const overrides = ROLE_SECTION_OVERRIDES[profile.role];
        if (overrides) {
            Object.assign(defaults, overrides);
        }
        if (sectionVisibility) {
            Object.assign(defaults, sectionVisibility);
        }
        return defaults;
    }, [profile.role, sectionVisibility]);

    const normalizedSkillRatings = React.useMemo(() => {
        if (!skillRatings || skillRatings.length === 0) {
            return [] as SkillRating[];
        }
        return skillRatings.map((entry) => ({
            ...entry,
            rating: Math.max(0, Math.min(typeof entry.rating === 'number' ? entry.rating : 0, 5)),
        }));
    }, [skillRatings]);

    const avatarStyles: SxProps<Theme> = React.useMemo(() => ({
        bgcolor: profile.avatar ? undefined : accentColor,
        color: profile.avatar ? undefined : contrastText,
        fontSize: '2rem',
        border: `4px solid ${theme.palette.background.paper}`,
    }), [accentColor, contrastText, profile.avatar, theme.palette.background.paper]);

    const combinedHeaderActions = React.useMemo(() => {
        if (!headerActions && !primaryAction) {
            return null;
        }

        return (
            <Stack direction="row" spacing={2} alignItems="center">
                {headerActions}
                {primaryAction ? (
                    <Button
                        variant="contained"
                        size="large"
                        onClick={primaryAction.onClick}
                        disabled={primaryAction.disabled}
                        startIcon={primaryAction.icon}
                    >
                        {primaryAction.label}
                    </Button>
                ) : null}
            </Stack>
        );
    }, [headerActions, primaryAction]);

    return (
        <Box sx={{ position: 'relative' }}>
            {floatingBackButton && backAction ? (
                <Tooltip title={backAction.label} placement="right">
                    <Fab
                        color="primary"
                        size="medium"
                        onClick={backAction.onClick}
                        aria-label={backAction.label}
                        sx={{
                            position: 'absolute',
                            top: { xs: 16, md: 24 },
                            left: { xs: 16, md: 24 },
                            zIndex: (themeArg) => themeArg.zIndex.appBar,
                        }}
                    >
                        <ArrowBackIcon />
                    </Fab>
                </Tooltip>
            ) : null}

            <Stack spacing={3}>
                <Paper variant="outlined" sx={{ overflow: 'hidden', position: 'relative' }}>
                    <ProfileHeader
                        profile={profile}
                        banner={bannerImage}
                        accentColor={accentColor}
                        showMeta={true}
                        avatarEditable={false}
                        avatarSx={avatarStyles}
                        headerActions={combinedHeaderActions}
                        backButton={backAction}
                        showBackButton={Boolean(backAction) && !floatingBackButton}
                        metaChildren={(
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                <Chip label={roleLabel} color="primary" size="small" />
                                {profile.department && (
                                    <Chip label={profile.department} variant="outlined" size="small" />
                                )}
                                {headerCaption && (
                                    <Chip label={headerCaption} size="small" variant="outlined" color="secondary" />
                                )}
                            </Stack>
                        )}
                    />
                </Paper>

                <Grid container spacing={3}>
                    <Grid size={{ xs: 12, md: 4 }}>
                        <Stack spacing={3}>
                            {sections.expertise ? (
                                <Card variant="outlined">
                                    <CardContent>
                                        <Typography variant="h6" gutterBottom>Expertise</Typography>
                                        <Divider sx={{ mb: 2 }} />
                                        {normalizedSkillRatings.length > 0 ? (
                                            <Stack spacing={2}>
                                                {normalizedSkillRatings.map((skill) => {
                                                    const ratingValue = skill.rating;
                                                    const ratingLabel = Number.isInteger(ratingValue)
                                                        ? ratingValue.toString()
                                                        : ratingValue.toFixed(1);
                                                    return (
                                                        <Stack key={`${skill.name}-${ratingLabel}`} spacing={0.75}>
                                                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                                                <Typography variant="body2" fontWeight={600}>
                                                                    {skill.name}
                                                                </Typography>
                                                                <Typography variant="caption" color="text.secondary">
                                                                    {ratingLabel}/5
                                                                </Typography>
                                                            </Stack>
                                                            <LinearProgress
                                                                variant="determinate"
                                                                value={(ratingValue / 5) * 100}
                                                                sx={{ height: 6, borderRadius: 999 }}
                                                            />
                                                            {(() => {
                                                                const eCount = typeof skill.endorsements === 'number'
                                                                    ? skill.endorsements
                                                                    : 0;
                                                                const endorsements = eCount > 0
                                                                    ? `${eCount} endorsement${eCount === 1 ? '' : 's'}`
                                                                    : null;
                                                                return endorsements ? (
                                                                    <Typography variant="caption" color="text.secondary">
                                                                        {endorsements}
                                                                    </Typography>
                                                                ) : null;
                                                            })()}
                                                        </Stack>
                                                    );
                                                })}
                                            </Stack>
                                        ) : skills && skills.length > 0 ? (
                                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                                {skills.map((skill) => (
                                                    <Chip key={skill} label={skill} variant="outlined" color="primary" size="small" />
                                                ))}
                                            </Stack>
                                        ) : (
                                            <Typography variant="body2" color="text.secondary">
                                                No expertise data available yet.
                                            </Typography>
                                        )}
                                    </CardContent>
                                </Card>
                            ) : null}

                            {sections.contacts ? (
                                <Card variant="outlined">
                                    <CardContent>
                                        <Typography variant="h6" gutterBottom>Contact & Details</Typography>
                                        <Divider sx={{ mb: 2 }} />
                                        <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                            {contactItems.map((item, idx) => (
                                                <ListItem key={`${item.text}-${idx}`} sx={{ p: 0 }}>
                                                    <ListItemText
                                                        primary={(
                                                            <Stack direction="row" spacing={1} alignItems="center">
                                                                {item.icon}
                                                                {item.href ? (
                                                                    <Typography
                                                                        variant="body2"
                                                                        component="a"
                                                                        href={item.href}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        sx={{ color: 'inherit', textDecoration: 'none' }}
                                                                    >
                                                                        {item.text}
                                                                    </Typography>
                                                                ) : (
                                                                    <Typography variant="body2">{item.text}</Typography>
                                                                )}
                                                            </Stack>
                                                        )}
                                                    />
                                                </ListItem>
                                            ))}
                                        </List>
                                    </CardContent>
                                </Card>
                            ) : null}
                        </Stack>
                    </Grid>

                    <Grid size={{ xs: 12, md: 8 }}>
                        <Stack spacing={3}>
                            {group ? (
                                <Box>
                                    <Typography variant="h6" gutterBottom>Group</Typography>
                                    <Divider sx={{ mb: 2 }} />
                                    <GroupCard group={group} usersByUid={groupUsers ?? new Map()} />
                                </Box>
                            ) : null}

                            {sections.currentTheses ? (
                                <Card variant="outlined">
                                    <CardContent>
                                        <Typography variant="h6" gutterBottom>Current theses</Typography>
                                        <Divider sx={{ mb: 2 }} />
                                        {currentGroups && currentGroups.length > 0 ? (
                                            <List disablePadding>
                                                {currentGroups.map((groupItem) => {
                                                    // Thesis title comes from approved topic proposals, use group name as fallback
                                                    const title = groupItem.name;
                                                    return (
                                                        <ListItem key={groupItem.id} sx={{ alignItems: 'flex-start' }}>
                                                            <ListItemAvatar>
                                                                <MuiAvatar
                                                                    sx={{
                                                                        bgcolor: alpha(accentColor, 0.2),
                                                                        color: accentColor,
                                                                        width: 40,
                                                                        height: 40,
                                                                    }}
                                                                >
                                                                    {getInitialsFromFullName(title)}
                                                                </MuiAvatar>
                                                            </ListItemAvatar>
                                                            <ListItemText
                                                                primary={(
                                                                    <Typography variant="subtitle1" fontWeight={600}>
                                                                        {title}
                                                                    </Typography>
                                                                )}
                                                                secondary={(
                                                                    <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                                                                        <Typography variant="body2" color="text.secondary">
                                                                            Status: {groupItem.status}
                                                                        </Typography>
                                                                        <Typography variant="body2" color="text.secondary">
                                                                            Updated: {groupItem.updatedAt
                                                                                ? new Date(groupItem.updatedAt).toLocaleDateString()
                                                                                : 'TBD'}
                                                                        </Typography>
                                                                    </Stack>
                                                                )}
                                                            />
                                                        </ListItem>
                                                    );
                                                })}
                                            </List>
                                        ) : (
                                            <Typography variant="body2" color="text.secondary">
                                                {assignmentsEmptyMessage}
                                            </Typography>
                                        )}
                                    </CardContent>
                                </Card>
                            ) : null}

                            {sections.timeline ? (
                                <Card variant="outlined">
                                    <CardContent>
                                        <Typography variant="h6" gutterBottom>Previous theses timeline</Typography>
                                        <Divider sx={{ mb: 2 }} />
                                        {timeline && timeline.length > 0 ? (
                                            <Stack spacing={3} sx={{ position: 'relative', pl: 2 }}>
                                                <Box
                                                    sx={{
                                                        position: 'absolute',
                                                        inset: '6px  auto 6px 9px',
                                                        width: '2px',
                                                        bgcolor: alpha(accentColor, 0.2),
                                                    }}
                                                />
                                                {timeline.map((entry) => (
                                                    <Stack
                                                        key={`${entry.year}-${entry.title}`}
                                                        direction="row"
                                                        spacing={2}
                                                        alignItems="flex-start"
                                                    >
                                                        <Box
                                                            sx={{
                                                                width: 20,
                                                                height: 20,
                                                                borderRadius: '50%',
                                                                mt: 0.5,
                                                                bgcolor: accentColor,
                                                                boxShadow: `0 0 0 4px ${alpha(accentColor, 0.15)}`,
                                                            }}
                                                        />
                                                        <Box sx={{ flex: 1 }}>
                                                            <Typography variant="caption" color="text.secondary">
                                                                {entry.year}
                                                            </Typography>
                                                            <Typography variant="subtitle1" fontWeight={600}>
                                                                {entry.title}
                                                            </Typography>
                                                            <Typography variant="body2" color="text.secondary">
                                                                {entry.role} · {entry.outcome}
                                                            </Typography>
                                                        </Box>
                                                    </Stack>
                                                ))}
                                            </Stack>
                                        ) : (
                                            <Typography variant="body2" color="text.secondary">
                                                {timelineEmptyMessage}
                                            </Typography>
                                        )}
                                    </CardContent>
                                </Card>
                            ) : null}

                            {additionalSections}
                        </Stack>
                    </Grid>
                </Grid>
            </Stack>
        </Box>
    );
}
