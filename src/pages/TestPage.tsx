import { useState } from 'react';
import {
    Box, Button, TextField, Typography, LinearProgress, Dialog, DialogTitle, DialogContent,
    DialogContentText, DialogActions, IconButton, Alert, Snackbar, Stack, Chip,
    Switch, FormControlLabel, Radio, RadioGroup, Checkbox, MenuItem, Slider, Divider, Paper,
} from '@mui/material';
import { Analytics, Notifications, Colorize, Delete, Edit, Save, Add, } from '@mui/icons-material';
import type { NavigationItem } from '../types/navigation';
import { ColorPickerDialog } from '../components/ColorPicker';

export const metadata: NavigationItem = {
    // group: 'main',
    index: 99,
    title: 'Test Page',
    segment: 'test',
    icon: <Analytics />,
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

    const handleDialogOpen = () => setDialogOpen(true);
    const handleDialogClose = () => setDialogOpen(false);

    const handleColorPickerOpen = () => setColorPickerOpen(true);
    const handleColorPickerClose = () => setColorPickerOpen(false);
    const handleColorChange = (color: string) => {
        setSelectedColor(color);
        showNotification('Color changed to ' + color, 'success');
    };

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
                        <Button variant="contained" color="error" startIcon={<Delete />}>
                            Delete
                        </Button>
                        <Button variant="contained" color="warning" startIcon={<Edit />}>
                            Edit
                        </Button>
                        <Button variant="contained" color="info" startIcon={<Save />}>
                            Save
                        </Button>
                        <Button variant="outlined" startIcon={<Add />}>
                            Add New
                        </Button>
                        <IconButton color="primary">
                            <Notifications />
                        </IconButton>
                        <IconButton color="secondary">
                            <Colorize />
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
                            startIcon={<Colorize />}
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
            </Stack>
        </Box>
    );
}
