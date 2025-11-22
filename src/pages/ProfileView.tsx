import * as React from 'react';
import {
    Box, Button, Card, CardContent, Chip, Divider, Fab, Grid, LinearProgress,
    List, ListItem, ListItemText, Paper, Stack, Tooltip, Typography,
} from '@mui/material';
import { Email as EmailIcon, Apartment as ApartmentIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import type { SxProps, Theme } from '@mui/material/styles';
import { alpha, lighten, useTheme } from '@mui/material/styles';
import Avatar from '../components/Avatar/Avatar';
import type { HistoricalThesisEntry, SkillRating, UserProfile, UserRole } from '../types/profile';
import type { ThesisData } from '../types/thesis';

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

const MENTOR_ROLES = new Set<UserRole>(['adviser', 'editor', 'statistician']);

const ROLE_SECTION_OVERRIDES: Partial<Record<UserRole, Partial<ProfileViewSections>>> = {
    student: { currentTheses: false, timeline: false },
    panel: { currentTheses: false, timeline: false },
    moderator: { currentTheses: false, timeline: false },
    head: { currentTheses: false, timeline: false },
};

export interface ProfileViewProps {
    profile: UserProfile;
    currentTheses?: ThesisData[];
    skills?: string[];
    skillRatings?: SkillRating[];
    timeline?: HistoricalThesisEntry[];
    contacts?: { icon: React.ReactNode; text: string }[];
    primaryAction?: ProfilePrimaryAction;
    backAction?: ProfileBackAction;
    assignmentsEmptyMessage?: string;
    timelineEmptyMessage?: string;
    additionalSections?: React.ReactNode;
    headerCaption?: string;
    sectionVisibility?: Partial<ProfileViewSections>;
    floatingBackButton?: boolean;
}

function deriveContactItems(
    profile: UserProfile,
    customContacts?: ProfileViewProps['contacts'],
): { icon: React.ReactNode; text: string }[] {
    if (customContacts && customContacts.length > 0) {
        return customContacts;
    }
    const contactList: { icon: React.ReactNode; text: string }[] = [];
    contactList.push({ icon: <EmailIcon fontSize="small" color="primary" />, text: profile.email });
    if (profile.department) {
        contactList.push({ icon: <ApartmentIcon fontSize="small" color="primary" />, text: profile.department });
    }
    return contactList;
}

function createBannerStyles(baseColor: string): { background: string; overlay: string } {
    const lightShade = lighten(baseColor, 0.35);
    const overlay = alpha(baseColor, 0.2);
    return {
        background: `linear-gradient(135deg, ${lightShade}, ${baseColor})`,
        overlay,
    };
}

export default function ProfileView({
    profile,
    currentTheses,
    skills,
    skillRatings,
    timeline,
    contacts,
    primaryAction,
    backAction,
    assignmentsEmptyMessage = 'No active theses found.',
    timelineEmptyMessage = 'No historical records available yet.',
    additionalSections,
    headerCaption,
    sectionVisibility,
    floatingBackButton = false,
}: ProfileViewProps) {
    const theme = useTheme();
    const accentColor = profile.preferences?.themeColor ?? theme.palette.primary.main;
    const bannerImage = profile.banner;
    const { background, overlay } = React.useMemo(() => createBannerStyles(accentColor), [accentColor]);
    const contrastText = theme.palette.getContrastText(accentColor);

    const contactItems = React.useMemo(() => deriveContactItems(profile, contacts), [contacts, profile]);
    const roleLabel = React.useMemo(
        () => profile.role.charAt(0).toUpperCase() + profile.role.slice(1),
        [profile.role]
    );

    const sections = React.useMemo(() => {
        const defaults: ProfileViewSections = { ...DEFAULT_SECTIONS };
        if (!MENTOR_ROLES.has(profile.role)) {
            defaults.currentTheses = false;
            defaults.timeline = false;
        }
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
        width: 96,
        height: 96,
        fontSize: '2rem',
        border: `4px solid ${theme.palette.background.paper}`,
    }), [accentColor, contrastText, profile.avatar, theme.palette.background.paper]);

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
                <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
                    <Box sx={{ position: 'relative', height: 140, background: bannerImage ? undefined : background }}>
                        {bannerImage ? (
                            <Box
                                sx={{
                                    position: 'absolute',
                                    inset: 0,
                                    backgroundImage: `url(${bannerImage})`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                    filter: 'brightness(0.8)',
                                }}
                            />
                        ) : null}
                        <Box
                            sx={{
                                position: 'absolute',
                                inset: 0,
                                bgcolor: bannerImage ? overlay : 'transparent',
                            }}
                        />
                    </Box>
                    <Box sx={{ p: { xs: 3, md: 4 } }}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                            <Avatar uid={profile.uid} tooltip="full" sx={avatarStyles} size={96} />
                            <Box sx={{ flex: 1 }}>
                                <Typography variant="h4" component="h1" gutterBottom>
                                    {`${profile.name.prefix ? `${profile.name.prefix} ` : ''}${profile.name.first} ${profile.name.last}`}
                                </Typography>
                                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                    <Chip label={roleLabel} color="primary" size="small" />
                                    {profile.department && (
                                        <Chip label={profile.department} variant="outlined" size="small" />
                                    )}
                                    {headerCaption && (
                                        <Chip label={headerCaption} size="small" variant="outlined" color="secondary" />
                                    )}
                                </Stack>
                            </Box>
                            <Stack direction="row" spacing={2} alignItems="center">
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
                                {backAction && !floatingBackButton ? (
                                    <Button variant="text" onClick={backAction.onClick}>
                                        {backAction.label}
                                    </Button>
                                ) : null}
                            </Stack>
                        </Stack>
                    </Box>
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
                                                            {typeof skill.endorsements === 'number' && skill.endorsements > 0 ? (
                                                                <Typography variant="caption" color="text.secondary">
                                                                    {skill.endorsements} endorsement{skill.endorsements === 1 ? '' : 's'}
                                                                </Typography>
                                                            ) : null}
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
                                                                <Typography variant="body2">{item.text}</Typography>
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
                            {sections.currentTheses ? (
                                <Card variant="outlined">
                                    <CardContent>
                                        <Typography variant="h6" gutterBottom>Current theses</Typography>
                                        <Divider sx={{ mb: 2 }} />
                                        {currentTheses && currentTheses.length > 0 ? (
                                            <List disablePadding>
                                                {currentTheses.map((thesis) => (
                                                    <ListItem key={thesis.id ?? thesis.title} sx={{ alignItems: 'flex-start' }}>
                                                        <ListItemText
                                                            primary={(
                                                                <Typography variant="subtitle1" fontWeight={600}>
                                                                    {thesis.title}
                                                                </Typography>
                                                            )}
                                                            secondary={(
                                                                <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                                                                    <Typography variant="body2" color="text.secondary">
                                                                        Status: {thesis.overallStatus}
                                                                    </Typography>
                                                                    <Typography variant="body2" color="text.secondary">
                                                                        Updated: {thesis.lastUpdated ?? 'TBD'}
                                                                    </Typography>
                                                                </Stack>
                                                            )}
                                                        />
                                                    </ListItem>
                                                ))}
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
