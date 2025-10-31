import { Box } from '@mui/material';
import { HexColorPicker } from 'react-colorful';

interface ColorPickerInputProps {
    /** Current hex color value */
    value: string;
    /** Callback when color changes (while dragging) */
    onChange: (color: string) => void;
    /** Callback when user finishes selecting (releases pointer) */
    onCommit: () => void;
}

/**
 * Interactive color picker using react-colorful
 */
export function ColorPickerInput({ value, onChange, onCommit }: ColorPickerInputProps) {
    return (
        <Box
            sx={{
                flexShrink: 0,
                width: { xs: '100%', sm: 236 },
                '& .react-colorful': {
                    width: '100%',
                    height: 220,
                    borderRadius: 2,
                    boxShadow: (theme) => theme.shadows[3],
                    backgroundColor: (theme) => theme.palette.background.paper,
                },
                '& .react-colorful__saturation': {
                    borderRadius: 2,
                },
                '& .react-colorful__hue, & .react-colorful__alpha': {
                    height: 14,
                    borderRadius: 999,
                },
            }}
            onPointerUp={onCommit}
            onPointerCancel={onCommit}
        >
            <HexColorPicker color={value} onChange={onChange} />
        </Box>
    );
}
