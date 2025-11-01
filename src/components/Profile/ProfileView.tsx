import * as React from 'react';
import {
    Box, Button, Card, CardContent, Chip, Divider, Grid, List, ListItem,
    ListItemAvatar, ListItemText, Paper, Stack, Typography,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import ApartmentIcon from '@mui/icons-material/Apartment';
import type { SxProps, Theme } from '@mui/material/styles';
import { alpha, lighten, useTheme } from '@mui/material/styles';
import Avatar from '../Avatar/Avatar';
import type { UserProfile, HistoricalThesisEntry } from '../../types/profile';
import type { ThesisData } from '../../types/thesis';

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

export interface ProfileViewProps {
    profile: UserProfile;
    currentTheses?: ThesisData[];
    skills?: string[];
    timeline?: HistoricalThesisEntry[];
    contacts?: Array<{ icon: React.ReactNode; text: string }>;
    primaryAction?: ProfilePrimaryAction;
    backAction?: ProfileBackAction;
    assignmentsEmptyMessage?: string;
    timelineEmptyMessage?: string;
    additionalSections?: React.ReactNode;
    headerCaption?: string;
}

function buildContacts(profile: UserProfile, custom?: ProfileViewProps['contacts']): Array<{ icon: React.ReactNode; text: string }> {
    if (custom && custom.length > 0) {
        return custom;
    }
    const contacts: Array<{ icon: React.ReactNode; text: string }> = [];
    contacts.push({ icon: <EmailIcon fontSize="small" color="primary" />, text: profile.email });
    if (profile.department) {
        contacts.push({ icon: <ApartmentIcon fontSize="small" color="primary" />, text: profile.department });
    }
    return contacts;
}

/**
 * Compute a pleasant gradient background from a base color.
 */
function createBannerStyles(baseColor: string): { background: string; overlay: string } {
    const lightShade = lighten(baseColor, 0.35);
    const overlay = alpha(baseColor, 0.2);
    return {
        background: `linear-gradient(135deg, ${lightShade}, ${baseColor})`,
        overlay,
    };
}

/**
 * Primary profile layout component shared across profile pages.
 */
export default function ProfileView({
    profile,
    currentTheses,
    skills,
    timeline,
    contacts,
    primaryAction,
    backAction,
    assignmentsEmptyMessage = 'No active theses found.',
    timelineEmptyMessage = 'No historical records available yet.',
    additionalSections,
    headerCaption,
}: ProfileViewProps) {
    const theme = useTheme();
    const accentColor = profile.preferences?.themeColor ?? theme.palette.primary.main;
    const bannerImage = profile.banner;
    const { background, overlay } = React.useMemo(() => createBannerStyles(accentColor), [accentColor]);
    const contrastText = theme.palette.getContrastText(accentColor);

    const contactItems = React.useMemo(() => buildContacts(profile, contacts), [contacts, profile]);
    const roleLabel = React.useMemo(() => profile.role.charAt(0).toUpperCase() + profile.role.slice(1), [profile.role]);

    const avatarStyles: SxProps<Theme> = React.useMemo(() => ({
        bgcolor: profile.avatar ? undefined : accentColor,
        color: profile.avatar ? undefined : contrastText,
        width: 96,
        height: 96,
        fontSize: '2rem',
        border: `4px solid ${theme.palette.background.paper}`,
    }), [accentColor, contrastText, profile.avatar, theme.palette.background.paper]);

    return (
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
                        <Avatar profile={profile} tooltip="full" sx={avatarStyles} size={96} />
                        <Box sx={{ flex: 1 }}>
                            <Typography variant="h4" component="h1" gutterBottom>
                                {`${profile.prefix ? `${profile.prefix} ` : ''}${profile.firstName} ${profile.lastName}`}
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
                            {backAction ? (
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
                        <Card variant="outlined">
                            <CardContent>
                                <Typography variant="h6" gutterBottom>Expertise</Typography>
                                <Divider sx={{ mb: 2 }} />
                                {skills && skills.length > 0 ? (
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

                        <Card variant="outlined">
                            <CardContent>
                                <Typography variant="h6" gutterBottom>Contact & Details</Typography>
                                <Divider sx={{ mb: 2 }} />
                                <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    {contactItems.map((item, idx) => (
                                        <ListItem key={idx} sx={{ p: 0 }}>
                                            <ListItemAvatar>
                                                <Avatar
                                                    name={item.text}
                                                    sx={{ bgcolor: alpha(accentColor, 0.15), color: accentColor }}
                                                    size="small"
                                                />
                                            </ListItemAvatar>
                                            <ListItemText
                                                primary={
                                                    <Stack direction="row" spacing={1} alignItems="center">
                                                        {item.icon}
                                                        <Typography variant="body2">{item.text}</Typography>
                                                    </Stack>
                                                }
                                            />
                                        </ListItem>
                                    ))}
                                </List>
                            </CardContent>
                        </Card>
                    </Stack>
                </Grid>

                <Grid size={{ xs: 12, md: 8 }}>
                    <Stack spacing={3}>
                        <Card variant="outlined">
                            <CardContent>
                                <Typography variant="h6" gutterBottom>Current theses</Typography>
                                <Divider sx={{ mb: 2 }} />
                                {currentTheses && currentTheses.length > 0 ? (
                                    <List disablePadding>
                                        {currentTheses.map((thesis) => (
                                            <ListItem key={thesis.title} sx={{ alignItems: 'flex-start' }}>
                                                <ListItemAvatar>
                                                    <Avatar
                                                        name={thesis.title}
                                                        sx={{ bgcolor: alpha(accentColor, 0.2), color: accentColor }}
                                                        size="medium"
                                                    />
                                                </ListItemAvatar>
                                                <ListItemText
                                                    primary={
                                                        <Typography variant="subtitle1" fontWeight={600}>
                                                            {thesis.title}
                                                        </Typography>
                                                    }
                                                    secondary={
                                                        <Stack spacing={0.5} sx={{ mt: 0.5 }}>
                                                            <Typography variant="body2" color="text.secondary">
                                                                Status: {thesis.overallStatus}
                                                            </Typography>
                                                            <Typography variant="body2" color="text.secondary">
                                                                Updated: {thesis.lastUpdated ?? 'TBD'}
                                                            </Typography>
                                                        </Stack>
                                                    }
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

                        {additionalSections}
                    </Stack>
                </Grid>
            </Grid>
        </Stack>
    );
}
