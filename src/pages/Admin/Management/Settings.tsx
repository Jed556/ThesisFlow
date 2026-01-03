/**
 * Admin System Settings Page
 * Allows administrators to configure global submission and chat settings
 */

import * as React from 'react';
import {
    Box, Card, CardContent, Divider, FormControlLabel, Paper,
    Skeleton, Stack, Switch, TextField, Typography, Alert, Chip,
    alpha
} from '@mui/material';
import {
    Settings as SettingsIcon,
    Link as LinkIcon,
    CloudUpload as FileUploadIcon,
    Chat as ChatIcon,
    Assignment as TerminalIcon,
    Description as ChapterIcon,
    AttachFile as AttachmentIcon,
    Info as InfoIcon,
} from '@mui/icons-material';
import { AnimatedPage } from '../../../components/Animate';
import { useSnackbar } from '../../../contexts/SnackbarContext';
import type { NavigationItem } from '../../../types/navigation';
import type { Session } from '../../../types/session';
import type { SystemSettings, SubmissionMode } from '../../../types/systemSettings';
import { DEFAULT_SYSTEM_SETTINGS } from '../../../types/systemSettings';
import {
    listenSystemSettings, updateChapterSubmissionSettings,
    updateTerminalRequirementSettings, updateChatSettings
} from '../../../utils/firebase/firestore/systemSettings';
import { useSession } from '@toolpad/core/useSession';

export const metadata: NavigationItem = {
    group: 'management',
    index: 98,
    title: 'Settings',
    segment: 'system-settings',
    icon: <SettingsIcon />,
    roles: ['admin', 'developer'],
};

/**
 * Settings section card component
 */
interface SettingsSectionProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    children: React.ReactNode;
}

function SettingsSection({ icon, title, description, children }: SettingsSectionProps) {
    return (
        <Card variant="outlined" sx={{ mb: 3 }}>
            <CardContent>
                <Stack direction="row" spacing={2} alignItems="flex-start" mb={2}>
                    <Box
                        sx={(theme) => ({
                            p: 1,
                            borderRadius: 1,
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                            color: 'primary.main',
                        })}
                    >
                        {icon}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" gutterBottom>
                            {title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {description}
                        </Typography>
                    </Box>
                </Stack>
                <Divider sx={{ my: 2 }} />
                {children}
            </CardContent>
        </Card>
    );
}

/**
 * Submission mode toggle component
 */
interface SubmissionModeToggleProps {
    mode: SubmissionMode;
    onChange: (mode: SubmissionMode) => void;
    disabled?: boolean;
    linkLabel?: string;
    fileLabel?: string;
    linkDescription?: string;
    fileDescription?: string;
}

function SubmissionModeToggle({
    mode,
    onChange,
    disabled = false,
    linkLabel = 'Link Submission',
    fileLabel = 'File Upload',
    linkDescription = 'Students provide URLs to their documents (e.g., Google Docs)',
    fileDescription = 'Students upload files directly to Firebase Storage',
}: SubmissionModeToggleProps) {
    const isLinkMode = mode === 'link';

    return (
        <Stack spacing={2}>
            <Stack direction="row" spacing={2} alignItems="center">
                <Chip
                    icon={<FileUploadIcon />}
                    label={fileLabel}
                    color={!isLinkMode ? 'primary' : 'default'}
                    variant={!isLinkMode ? 'filled' : 'outlined'}
                    onClick={() => onChange('file')}
                    disabled={disabled}
                    sx={{ minWidth: 140 }}
                />
                <Switch
                    checked={isLinkMode}
                    onChange={(e) => onChange(e.target.checked ? 'link' : 'file')}
                    disabled={disabled}
                    color="primary"
                />
                <Chip
                    icon={<LinkIcon />}
                    label={linkLabel}
                    color={isLinkMode ? 'primary' : 'default'}
                    variant={isLinkMode ? 'filled' : 'outlined'}
                    onClick={() => onChange('link')}
                    disabled={disabled}
                    sx={{ minWidth: 140 }}
                />
            </Stack>
            <Typography variant="caption" color="text.secondary">
                {isLinkMode ? linkDescription : fileDescription}
            </Typography>
        </Stack>
    );
}

/**
 * Loading skeleton for settings
 */
function SettingsSkeleton() {
    return (
        <Stack spacing={3}>
            {[1, 2, 3].map((i) => (
                <Card key={i} variant="outlined">
                    <CardContent>
                        <Stack direction="row" spacing={2} alignItems="center" mb={2}>
                            <Skeleton variant="rounded" width={48} height={48} />
                            <Box sx={{ flex: 1 }}>
                                <Skeleton variant="text" width="40%" height={32} />
                                <Skeleton variant="text" width="60%" />
                            </Box>
                        </Stack>
                        <Divider sx={{ my: 2 }} />
                        <Skeleton variant="rectangular" height={60} />
                    </CardContent>
                </Card>
            ))}
        </Stack>
    );
}

/**
 * Admin Settings Page Component
 */
export default function AdminSettingsPage() {
    const session = useSession<Session>();
    const userUid = session?.user?.uid ?? null;
    const { showNotification } = useSnackbar();

    const [settings, setSettings] = React.useState<SystemSettings | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState<string | null>(null);

    // Listen to settings changes
    React.useEffect(() => {
        const unsubscribe = listenSystemSettings({
            onData: (newSettings: SystemSettings) => {
                setSettings(newSettings);
                setLoading(false);
            },
            onError: (error: Error) => {
                console.error('Failed to load settings:', error);
                showNotification('Failed to load settings', 'error');
                setLoading(false);
            },
        });

        return () => unsubscribe();
    }, [showNotification]);

    // Handle chapter submission mode change
    const handleChapterModeChange = React.useCallback(async (mode: SubmissionMode) => {
        if (!userUid) return;
        setSaving('chapter');
        try {
            await updateChapterSubmissionSettings({ mode }, userUid);
            showNotification(
                `Chapter submission mode changed to ${mode === 'link' ? 'Link' : 'File Upload'}`,
                'success'
            );
        } catch (error) {
            console.error('Failed to update chapter settings:', error);
            showNotification('Failed to update settings', 'error');
        } finally {
            setSaving(null);
        }
    }, [userUid, showNotification]);

    // Handle terminal requirement mode change
    const handleTerminalModeChange = React.useCallback(async (mode: SubmissionMode) => {
        if (!userUid) return;
        setSaving('terminal');
        try {
            await updateTerminalRequirementSettings({ mode }, userUid);
            showNotification(
                `Terminal requirements mode changed to ${mode === 'link' ? 'Link/Checklist' : 'File Upload'}`,
                'success'
            );
        } catch (error) {
            console.error('Failed to update terminal settings:', error);
            showNotification('Failed to update settings', 'error');
        } finally {
            setSaving(null);
        }
    }, [userUid, showNotification]);

    // Handle chat attachments toggle
    const handleChatAttachmentsChange = React.useCallback(async (enabled: boolean) => {
        if (!userUid) return;
        setSaving('chat');
        try {
            await updateChatSettings({ attachmentsEnabled: enabled }, userUid);
            showNotification(
                `Chat attachments ${enabled ? 'enabled' : 'disabled'}`,
                'success'
            );
        } catch (error) {
            console.error('Failed to update chat settings:', error);
            showNotification('Failed to update settings', 'error');
        } finally {
            setSaving(null);
        }
    }, [userUid, showNotification]);

    // Handle link placeholder change
    const handleLinkPlaceholderChange = React.useCallback(async (placeholder: string) => {
        if (!userUid) return;
        try {
            await updateChapterSubmissionSettings({ linkPlaceholder: placeholder }, userUid);
        } catch (error) {
            console.error('Failed to update placeholder:', error);
        }
    }, [userUid]);

    // Handle default drive URL change
    const handleDefaultDriveUrlChange = React.useCallback(async (url: string) => {
        if (!userUid) return;
        try {
            await updateTerminalRequirementSettings({ defaultDriveFolderUrl: url }, userUid);
        } catch (error) {
            console.error('Failed to update drive URL:', error);
        }
    }, [userUid]);

    // Debounce text input changes
    const [linkPlaceholder, setLinkPlaceholder] = React.useState('');
    const [driveUrl, setDriveUrl] = React.useState('');

    React.useEffect(() => {
        if (settings) {
            setLinkPlaceholder(settings.chapterSubmissions.linkPlaceholder ?? '');
            setDriveUrl(settings.terminalRequirements.defaultDriveFolderUrl ?? '');
        }
    }, [settings]);

    // Debounced save for text inputs
    React.useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (
                settings &&
                linkPlaceholder !== (settings.chapterSubmissions.linkPlaceholder ?? '')
            ) {
                void handleLinkPlaceholderChange(linkPlaceholder);
            }
        }, 1000);
        return () => clearTimeout(timeoutId);
    }, [linkPlaceholder, settings, handleLinkPlaceholderChange]);

    React.useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (
                settings &&
                driveUrl !== (settings.terminalRequirements.defaultDriveFolderUrl ?? '')
            ) {
                void handleDefaultDriveUrlChange(driveUrl);
            }
        }, 1000);
        return () => clearTimeout(timeoutId);
    }, [driveUrl, settings, handleDefaultDriveUrlChange]);

    const currentSettings = settings ?? {
        ...DEFAULT_SYSTEM_SETTINGS,
        id: 'global',
    };

    return (
        <AnimatedPage>
            <Paper sx={{ p: 3, mb: 3 }}>
                <Stack direction="row" spacing={2} alignItems="center" mb={1}>
                    <SettingsIcon color="primary" />
                    <Typography variant="h5" fontWeight={600}>
                        System Settings
                    </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                    Configure global application settings for submissions and chat features.
                    Changes are applied immediately across all users.
                </Typography>
            </Paper>

            {loading ? (
                <SettingsSkeleton />
            ) : (
                <>
                    {/* Chapter Submission Settings */}
                    <SettingsSection
                        icon={<ChapterIcon />}
                        title="Chapter Submissions"
                        description={
                            'Configure how students submit thesis chapter documents. ' +
                            'Link mode (default) uses external URLs to reduce storage costs.'
                        }
                    >
                        <Stack spacing={3}>
                            <SubmissionModeToggle
                                mode={currentSettings.chapterSubmissions.mode}
                                onChange={handleChapterModeChange}
                                disabled={saving === 'chapter'}
                                linkDescription="Students provide Google Docs/Drive URLs. No storage costs, easy collaboration."
                                fileDescription="Students upload files directly. Uses Firebase Storage with associated costs."
                            />

                            {currentSettings.chapterSubmissions.mode === 'link' && (
                                <>
                                    <Alert severity="info" icon={<InfoIcon />}>
                                        When using link mode, students will paste URLs to their documents
                                        (e.g., Google Docs, Google Drive). Ensure students set appropriate
                                        sharing permissions on their documents.
                                    </Alert>
                                    <TextField
                                        label="Link Input Placeholder"
                                        value={linkPlaceholder}
                                        onChange={(e) => setLinkPlaceholder(e.target.value)}
                                        helperText="Placeholder text shown in the URL input field"
                                        fullWidth
                                        size="small"
                                    />
                                </>
                            )}
                        </Stack>
                    </SettingsSection>

                    {/* Terminal Requirement Settings */}
                    <SettingsSection
                        icon={<TerminalIcon />}
                        title="Terminal Requirements"
                        description={
                            'Configure how students submit terminal requirement documents. ' +
                            'Link mode uses a shared folder with checklist workflow.'
                        }
                    >
                        <Stack spacing={3}>
                            <SubmissionModeToggle
                                mode={currentSettings.terminalRequirements.mode}
                                onChange={handleTerminalModeChange}
                                disabled={saving === 'terminal'}
                                linkLabel="Checklist Mode"
                                fileLabel="File Upload"
                                linkDescription={
                                    'Groups set a shared GDrive folder. ' +
                                    'Students mark items complete, admins verify and accept.'
                                }
                                fileDescription="Students upload individual files for each requirement."
                            />

                            {currentSettings.terminalRequirements.mode === 'link' && (
                                <>
                                    <Alert severity="info" icon={<InfoIcon />}>
                                        <strong>Checklist Workflow:</strong>
                                        <ol style={{ margin: '8px 0', paddingLeft: '20px' }}>
                                            <li>Admin or group sets a shared Google Drive folder URL</li>
                                            <li>
                                                Students upload documents to the folder and mark
                                                requirements as &quot;Submitted&quot;
                                            </li>
                                            <li>
                                                Admins review the folder and accept or
                                                request revisions for each item
                                            </li>
                                        </ol>
                                    </Alert>
                                    <TextField
                                        label="Default Drive Folder URL Template"
                                        value={driveUrl}
                                        onChange={(e) => setDriveUrl(e.target.value)}
                                        helperText="Optional default URL template. Groups can override with their own folder."
                                        fullWidth
                                        size="small"
                                        placeholder="https://drive.google.com/drive/folders/..."
                                    />
                                </>
                            )}
                        </Stack>
                    </SettingsSection>

                    {/* Chat Settings */}
                    <SettingsSection
                        icon={<ChatIcon />}
                        title="Chat Features"
                        description="Configure chat functionality including file attachments."
                    >
                        <Stack spacing={3}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={currentSettings.chat.attachmentsEnabled}
                                        onChange={(e) => handleChatAttachmentsChange(e.target.checked)}
                                        disabled={saving === 'chat'}
                                    />
                                }
                                label={
                                    <Stack direction="row" spacing={1} alignItems="center">
                                        <AttachmentIcon fontSize="small" />
                                        <Typography>Enable Chat Attachments</Typography>
                                    </Stack>
                                }
                            />
                            <Typography variant="caption" color="text.secondary">
                                {currentSettings.chat.attachmentsEnabled
                                    ? 'Users can attach files in chat conversations. Files are stored in Firebase Storage.'
                                    : 'File attachments are disabled in chat. Users can only send text messages.'}
                            </Typography>

                            {currentSettings.chat.attachmentsEnabled && (
                                <Alert severity="warning">
                                    Enabling chat attachments will increase Firebase Storage usage and costs.
                                    Maximum file size: {currentSettings.chat.maxAttachmentSizeMb ?? 10}MB
                                </Alert>
                            )}
                        </Stack>
                    </SettingsSection>

                    {/* Last Updated Info */}
                    {settings?.updatedAt && (
                        <Typography variant="caption" color="text.secondary">
                            Last updated: {new Date(settings.updatedAt).toLocaleString()}
                            {settings.updatedBy && ` by ${settings.updatedBy}`}
                        </Typography>
                    )}
                </>
            )}
        </AnimatedPage>
    );
}
