import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { ColorPicker, type ColorPickerProps } from './ColorPicker';

export interface ColorPickerDialogProps extends Omit<ColorPickerProps, 'onChange' | 'onSelect'> {
    /** Whether the dialog is open */
    open: boolean;
    /** Callback when dialog should close */
    onClose: () => void;
    /** Dialog title */
    title?: string;
    /** Callback when color is selected and confirmed */
    onConfirm: (color: string) => void;
    /** Cancel button text */
    cancelText?: string;
    /** Confirm button text */
    confirmText?: string;
}

export const ColorPickerDialog: React.FC<ColorPickerDialogProps> = ({
    open,
    onClose,
    title = 'Choose Color',
    value,
    onConfirm,
    cancelText = 'Cancel',
    confirmText = 'Select',
    showHarmonies = true,
    showShades = true,
    showAccessibility = true,
}) => {
    const [tempColor, setTempColor] = useState(value);

    // Update temp color when dialog opens with new value
    React.useEffect(() => {
        if (open) {
            setTempColor(value);
        }
    }, [open, value]);

    const handleConfirm = () => {
        onConfirm(tempColor);
        onClose();
    };

    const handleCancel = () => {
        setTempColor(value); // Reset to original value
        onClose();
    };

    return (
        <Dialog
            open={open}
            onClose={handleCancel}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: {
                    maxHeight: '90vh',
                },
            }}
        >
            <DialogTitle
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}
            >
                {title}
                <IconButton
                    edge="end"
                    onClick={handleCancel}
                    aria-label="close"
                    size="small"
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers sx={{ p: 2 }}>
                <ColorPicker
                    value={tempColor}
                    onChange={setTempColor}
                    showHarmonies={showHarmonies}
                    showShades={showShades}
                    showAccessibility={showAccessibility}
                />
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2 }}>
                <Button onClick={handleCancel} color="inherit">
                    {cancelText}
                </Button>
                <Button onClick={handleConfirm} variant="contained" color="primary">
                    {confirmText}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
