import { useState } from 'react';
import {
    Box, Button, TextField, Typography, LinearProgress, Dialog, DialogTitle, DialogContent,
    DialogContentText, DialogActions, IconButton, Alert, Snackbar, Stack, Chip,
    Switch, FormControlLabel, Radio, RadioGroup, Checkbox, MenuItem, Slider, Divider, Paper,
    CircularProgress, Link, InputAdornment, Collapse,
} from '@mui/material';
import {
    Analytics as AnalyticsIcon, Notifications as NotificationsIcon,
    Colorize as ColorizeIcon, Delete as DeleteIcon, Edit as EditIcon,
    Save as SaveIcon, Add as AddIcon, Email as EmailIcon, Send as SendIcon,
    OpenInNew as OpenInNewIcon, Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon, Settings as SettingsIcon,
} from '@mui/icons-material';
import type { NavigationItem } from '../types/navigation';
import { ColorPickerDialog } from '../components/ColorPicker';

export const metadata: NavigationItem = {
    // group: 'main',
    index: 99,
    title: 'Test Page',
    segment: 'test',
    icon: <AnalyticsIcon />,
    children: [],
    roles: ['developer'],
    hidden: false,
};

/**
 * Test page for development and debugging purposes
 */
export default function TestPage() {
    // State for dialog
    const [dialogOpen, setDialogOpen] = useState(false);

    // State for color picker
    const [colorPickerOpen, setColorPickerOpen] = useState(false);
    const [selectedColor, setSelectedColor] = useState('#2196F3');

    // State for notification
    const [snackbarOpen, setSnackbarOpen] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState('');
    const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error' | 'warning' | 'info'>('info');

    // State for progress
    const [progress, setProgress] = useState(30);

    // State for inputs
    const [textValue, setTextValue] = useState('');
    const [switchChecked, setSwitchChecked] = useState(true);
    const [radioValue, setRadioValue] = useState('option1');
    const [checkboxChecked, setCheckboxChecked] = useState(false);
    const [selectValue, setSelectValue] = useState('option1');
    const [sliderValue, setSliderValue] = useState(50);

    // State for email testing
    const [emailTo, setEmailTo] = useState('');
    const [emailSubject, setEmailSubject] = useState('Test Email from ThesisFlow');
    const [emailBody, setEmailBody] = useState('This is a test email sent from the ThesisFlow test page.');
    const [emailSending, setEmailSending] = useState(false);
    const [emailPreviewUrl, setEmailPreviewUrl] = useState<string | null>(null);
    const [emailResult, setEmailResult] = useState<{
        success: boolean;
        message: string;
        messageId?: string;
    } | null>(null);

    // State for SMTP configuration
    const [useEthereal, setUseEthereal] = useState(true);
    const [smtpHost, setSmtpHost] = useState('smtp.gmail.com');
    const [smtpPort, setSmtpPort] = useState(587);
    const [smtpSecure, setSmtpSecure] = useState(false);
    const [smtpUser, setSmtpUser] = useState('');
    const [smtpPass, setSmtpPass] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleDialogOpen = () => setDialogOpen(true);
    const handleDialogClose = () => setDialogOpen(false);

    const handleColorPickerOpen = () => setColorPickerOpen(true);
    const handleColorPickerClose = () => setColorPickerOpen(false);

    const showNotification = (message: string, severity: 'success' | 'error' | 'warning' | 'info') => {
        setSnackbarMessage(message);
        setSnackbarSeverity(severity);
        setSnackbarOpen(true);
    };

    const handleSnackbarClose = () => setSnackbarOpen(false);

    const increaseProgress = () => {
        setProgress((prev) => Math.min(prev + 10, 100));
    };

    const decreaseProgress = () => {
        setProgress((prev) => Math.max(prev - 10, 0));
    };

    /**
     * Sends a test email via the configured SMTP or Ethereal
     */
    const handleSendTestEmail = async () => {
        if (!emailTo || !emailSubject || !emailBody) {
            showNotification('Please fill in all email fields', 'warning');
            return;
        }

        if (!useEthereal && (!smtpHost || !smtpUser || !smtpPass)) {
            showNotification('Please fill in SMTP credentials', 'warning');
            return;
        }

        setEmailSending(true);
        setEmailResult(null);
        setEmailPreviewUrl(null);

        try {
            const requestBody: Record<string, unknown> = {
                to: emailTo,
                subject: emailSubject,
                text: emailBody,
                html: `<div style="font-family: Arial, sans-serif; padding: 20px;">
                    <h2 style="color: #1976d2;">ThesisFlow Test Email</h2>
                    <p>${emailBody.replace(/\n/g, '<br/>')}</p>
                    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
                    <p style="color: #666; font-size: 12px;">
                        This is a test email sent from the ThesisFlow development environment.
                    </p>
                </div>`,
                useEthereal,
            };

            if (!useEthereal) {
                requestBody.smtp = {
                    host: smtpHost,
                    port: smtpPort,
                    secure: smtpSecure,
                    user: smtpUser,
                    pass: smtpPass,
                };
            }

            const response = await fetch('/api/email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            const data = await response.json();

            if (data.success) {
                setEmailResult({
                    success: true,
                    message: data.message ?? 'Email sent successfully!',
                    messageId: data.messageId,
                });
                setEmailPreviewUrl(data.previewUrl ?? null);
                showNotification('Test email sent successfully!', 'success');
            } else {
                setEmailResult({
                    success: false,
                    message: data.error ?? 'Failed to send email',
                });
                showNotification(data.error ?? 'Failed to send email', 'error');
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Network error';
            setEmailResult({
                success: false,
                message: errorMessage,
            });
            showNotification(errorMessage, 'error');
        } finally {
            setEmailSending(false);
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h4" gutterBottom>
                Component Test Page
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
                Testing various MUI components and interactions
            </Typography>

            <Stack spacing={4}>
                {/* Buttons Section */}
                <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        Buttons
                    </Typography>
                    <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                        <Button variant="contained" color="primary">
                            Contained
                        </Button>
                        <Button variant="outlined" color="secondary">
                            Outlined
                        </Button>
                        <Button variant="text" color="success">
                            Text
                        </Button>
                        <Button variant="contained" color="error" startIcon={<DeleteIcon />}>
                            Delete
                        </Button>
                        <Button variant="contained" color="warning" startIcon={<EditIcon />}>
                            Edit
                        </Button>
                        <Button variant="contained" color="info" startIcon={<SaveIcon />}>
                            Save
                        </Button>
                        <Button variant="outlined" startIcon={<AddIcon />}>
                            Add New
                        </Button>
                        <IconButton color="primary">
                            <NotificationsIcon />
                        </IconButton>
                        <IconButton color="secondary">
                            <ColorizeIcon />
                        </IconButton>
                    </Stack>
                </Paper>

                {/* Progress Bar Section */}
                <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        Progress Bar
                    </Typography>
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                            Progress: {progress}%
                        </Typography>
                        <LinearProgress variant="determinate" value={progress} sx={{ mb: 2 }} />
                        <LinearProgress sx={{ mb: 2 }} />
                        <Stack direction="row" spacing={2}>
                            <Button variant="outlined" onClick={decreaseProgress}>
                                Decrease
                            </Button>
                            <Button variant="outlined" onClick={increaseProgress}>
                                Increase
                            </Button>
                        </Stack>
                    </Box>
                </Paper>

                {/* Dialog Launcher Section */}
                <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        Dialog
                    </Typography>
                    <Button variant="contained" onClick={handleDialogOpen}>
                        Open Dialog
                    </Button>
                    <Dialog open={dialogOpen} onClose={handleDialogClose}>
                        <DialogTitle>Test Dialog</DialogTitle>
                        <DialogContent>
                            <DialogContentText>
                                This is a test dialog with sample content. You can add any components here.
                            </DialogContentText>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={handleDialogClose} color="inherit">
                                Cancel
                            </Button>
                            <Button onClick={handleDialogClose} variant="contained" autoFocus>
                                Confirm
                            </Button>
                        </DialogActions>
                    </Dialog>
                </Paper>

                {/* Color Picker Launcher Section */}
                <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        Color Picker
                    </Typography>
                    <Stack direction="row" spacing={2} alignItems="center">
                        <Button
                            variant="contained"
                            startIcon={<ColorizeIcon />}
                            onClick={handleColorPickerOpen}
                        >
                            Pick Color
                        </Button>
                        <Box
                            sx={{
                                width: 40,
                                height: 40,
                                borderRadius: 1,
                                bgcolor: selectedColor,
                                border: '2px solid',
                                borderColor: 'divider',
                            }}
                        />
                        <Typography variant="body2">{selectedColor}</Typography>
                    </Stack>

                    {/* Use centralized ColorPickerDialog component */}
                    <ColorPickerDialog
                        open={colorPickerOpen}
                        onClose={handleColorPickerClose}
                        value={selectedColor}
                        onConfirm={(color: string) => {
                            setSelectedColor(color);
                            showNotification('Color changed to ' + color, 'success');
                        }}
                        title="Pick a Color"
                        cancelText="Cancel"
                        confirmText="Apply"
                    />
                </Paper>

                {/* Notification Launcher Section */}
                <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        Notifications
                    </Typography>
                    <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                        <Button
                            variant="outlined"
                            color="success"
                            onClick={() => showNotification('Success message!', 'success')}
                        >
                            Success
                        </Button>
                        <Button
                            variant="outlined"
                            color="error"
                            onClick={() => showNotification('Error message!', 'error')}
                        >
                            Error
                        </Button>
                        <Button
                            variant="outlined"
                            color="warning"
                            onClick={() => showNotification('Warning message!', 'warning')}
                        >
                            Warning
                        </Button>
                        <Button
                            variant="outlined"
                            color="info"
                            onClick={() => showNotification('Info message!', 'info')}
                        >
                            Info
                        </Button>
                    </Stack>
                    <Snackbar
                        open={snackbarOpen}
                        autoHideDuration={3000}
                        onClose={handleSnackbarClose}
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    >
                        <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} sx={{ width: '100%' }}>
                            {snackbarMessage}
                        </Alert>
                    </Snackbar>
                </Paper>

                {/* Input Fields Section */}
                <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        Input Fields
                    </Typography>
                    <Stack spacing={3}>
                        {/* Text Input */}
                        <TextField
                            label="Text Input"
                            value={textValue}
                            onChange={(e) => setTextValue(e.target.value)}
                            placeholder="Enter some text..."
                            fullWidth
                        />

                        {/* Text Input with Helper */}
                        <TextField
                            label="Email"
                            type="email"
                            helperText="We'll never share your email"
                            fullWidth
                        />

                        {/* Multiline */}
                        <TextField
                            label="Multiline Input"
                            multiline
                            rows={4}
                            placeholder="Enter multiple lines..."
                            fullWidth
                        />

                        <Divider />

                        {/* Switch */}
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={switchChecked}
                                    onChange={(e) => setSwitchChecked(e.target.checked)}
                                />
                            }
                            label="Toggle Switch"
                        />

                        {/* Checkbox */}
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={checkboxChecked}
                                    onChange={(e) => setCheckboxChecked(e.target.checked)}
                                />
                            }
                            label="Checkbox Option"
                        />

                        <Divider />

                        {/* Radio Group */}
                        <Box>
                            <Typography variant="body2" sx={{ mb: 1 }}>
                                Radio Group
                            </Typography>
                            <RadioGroup
                                value={radioValue}
                                onChange={(e) => setRadioValue(e.target.value)}
                            >
                                <FormControlLabel value="option1" control={<Radio />} label="Option 1" />
                                <FormControlLabel value="option2" control={<Radio />} label="Option 2" />
                                <FormControlLabel value="option3" control={<Radio />} label="Option 3" />
                            </RadioGroup>
                        </Box>

                        <Divider />

                        {/* Select */}
                        <TextField
                            select
                            label="Select Option"
                            value={selectValue}
                            onChange={(e) => setSelectValue(e.target.value)}
                            fullWidth
                        >
                            <MenuItem value="option1">Option 1</MenuItem>
                            <MenuItem value="option2">Option 2</MenuItem>
                            <MenuItem value="option3">Option 3</MenuItem>
                            <MenuItem value="option4">Option 4</MenuItem>
                        </TextField>

                        <Divider />

                        {/* Slider */}
                        <Box>
                            <Typography variant="body2" gutterBottom>
                                Slider: {sliderValue}
                            </Typography>
                            <Slider
                                value={sliderValue}
                                onChange={(_, value) => setSliderValue(value as number)}
                                valueLabelDisplay="auto"
                                min={0}
                                max={100}
                            />
                        </Box>
                    </Stack>
                </Paper>

                {/* Chips Section */}
                <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        Chips
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Chip label="Default" />
                        <Chip label="Primary" color="primary" />
                        <Chip label="Secondary" color="secondary" />
                        <Chip label="Success" color="success" />
                        <Chip label="Error" color="error" />
                        <Chip label="Warning" color="warning" />
                        <Chip label="Info" color="info" />
                        <Chip label="Clickable" onClick={() => showNotification('Chip clicked!', 'info')} />
                        <Chip label="Deletable" onDelete={() => showNotification('Chip deleted!', 'warning')} />
                    </Stack>
                </Paper>

                {/* Alert Section */}
                <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>
                        Alerts
                    </Typography>
                    <Stack spacing={2}>
                        <Alert severity="success">This is a success alert</Alert>
                        <Alert severity="info">This is an info alert</Alert>
                        <Alert severity="warning">This is a warning alert</Alert>
                        <Alert severity="error">This is an error alert</Alert>
                        <Alert severity="success" variant="outlined">Outlined success alert</Alert>
                        <Alert severity="info" variant="filled">Filled info alert</Alert>
                    </Stack>
                </Paper>

                {/* Email Testing Section */}
                <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <EmailIcon /> Email Testing (SMTP)
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Send test emails using Ethereal (fake SMTP) or your own SMTP credentials.
                    </Typography>

                    <Stack spacing={3}>
                        {/* SMTP Mode Toggle */}
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={useEthereal}
                                    onChange={(e) => setUseEthereal(e.target.checked)}
                                />
                            }
                            label={
                                <Stack direction="row" spacing={1} alignItems="center">
                                    <Typography>
                                        {useEthereal ? 'Using Ethereal (Test Mode)' : 'Using Custom SMTP'}
                                    </Typography>
                                    <SettingsIcon fontSize="small" color="action" />
                                </Stack>
                            }
                        />

                        {/* Custom SMTP Configuration */}
                        <Collapse in={!useEthereal}>
                            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
                                <Typography variant="subtitle2" gutterBottom sx={{ mb: 2 }}>
                                    SMTP Configuration
                                </Typography>
                                <Stack spacing={2}>
                                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                        <TextField
                                            label="SMTP Host"
                                            value={smtpHost}
                                            onChange={(e) => setSmtpHost(e.target.value)}
                                            placeholder="smtp.gmail.com"
                                            fullWidth
                                            size="small"
                                        />
                                        <TextField
                                            label="Port"
                                            type="number"
                                            value={smtpPort}
                                            onChange={(e) => setSmtpPort(Number(e.target.value))}
                                            sx={{ minWidth: 100 }}
                                            size="small"
                                        />
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={smtpSecure}
                                                    onChange={(e) => setSmtpSecure(e.target.checked)}
                                                    size="small"
                                                />
                                            }
                                            label="SSL/TLS"
                                        />
                                    </Stack>
                                    <TextField
                                        label="Username / Email"
                                        value={smtpUser}
                                        onChange={(e) => setSmtpUser(e.target.value)}
                                        placeholder="your-email@gmail.com"
                                        fullWidth
                                        size="small"
                                    />
                                    <TextField
                                        label="Password / App Password"
                                        type={showPassword ? 'text' : 'password'}
                                        value={smtpPass}
                                        onChange={(e) => setSmtpPass(e.target.value)}
                                        placeholder="Your app password"
                                        fullWidth
                                        size="small"
                                        slotProps={{
                                            input: {
                                                endAdornment: (
                                                    <InputAdornment position="end">
                                                        <IconButton
                                                            onClick={() => setShowPassword(!showPassword)}
                                                            edge="end"
                                                            size="small"
                                                        >
                                                            {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                                        </IconButton>
                                                    </InputAdornment>
                                                ),
                                            },
                                        }}
                                    />
                                    <Alert severity="info" sx={{ mt: 1 }}>
                                        For Gmail, use an App Password instead of your regular password.{' '}
                                        <Link
                                            href="https://support.google.com/accounts/answer/185833"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                        >
                                            Learn more
                                        </Link>
                                    </Alert>
                                </Stack>
                            </Paper>
                        </Collapse>

                        <Divider />

                        {/* Email Fields */}
                        <TextField
                            label="To (Email Address)"
                            type="email"
                            value={emailTo}
                            onChange={(e) => setEmailTo(e.target.value)}
                            placeholder="recipient@example.com"
                            fullWidth
                            required
                        />

                        <TextField
                            label="Subject"
                            value={emailSubject}
                            onChange={(e) => setEmailSubject(e.target.value)}
                            fullWidth
                            required
                        />

                        <TextField
                            label="Email Body"
                            value={emailBody}
                            onChange={(e) => setEmailBody(e.target.value)}
                            multiline
                            rows={4}
                            fullWidth
                            required
                        />

                        <Stack direction="row" spacing={2} alignItems="center">
                            <Button
                                variant="contained"
                                color="primary"
                                startIcon={emailSending ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
                                onClick={handleSendTestEmail}
                                disabled={
                                    emailSending ||
                                    !emailTo ||
                                    !emailSubject ||
                                    !emailBody ||
                                    (!useEthereal && (!smtpHost || !smtpUser || !smtpPass))
                                }
                            >
                                {emailSending ? 'Sending...' : 'Send Test Email'}
                            </Button>
                            <Chip
                                label={useEthereal ? 'Ethereal' : smtpHost}
                                size="small"
                                color={useEthereal ? 'info' : 'default'}
                                variant="outlined"
                            />
                        </Stack>

                        {/* Email Result Display */}
                        {emailResult && (
                            <Alert
                                severity={emailResult.success ? 'success' : 'error'}
                                sx={{ mt: 2 }}
                            >
                                <Typography variant="body2">{emailResult.message}</Typography>
                                {emailResult.messageId && (
                                    <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                                        Message ID: {emailResult.messageId}
                                    </Typography>
                                )}
                            </Alert>
                        )}

                        {/* Email Preview Link (Ethereal only) */}
                        {emailPreviewUrl && useEthereal && (
                            <Alert severity="info" icon={<OpenInNewIcon />}>
                                <Typography variant="body2">
                                    View your test email:{' '}
                                    <Link
                                        href={emailPreviewUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        sx={{ fontWeight: 'medium' }}
                                    >
                                        Open in Ethereal Mail
                                    </Link>
                                </Typography>
                            </Alert>
                        )}
                    </Stack>
                </Paper>
            </Stack>
        </Box>
    );
}
