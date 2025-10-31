import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, TextField, Typography, Paper, Stack, Tooltip, IconButton, InputAdornment } from '@mui/material';
import { themeFromSourceColor, argbFromHex } from '@material/material-color-utilities';
import { Shuffle, ContentCopy } from '@mui/icons-material';
import { isValidHex, normalizeHex } from '../../utils/colorUtils';
import { ColorPickerInput } from './ColorPickerInput';
import { MaterialThemeSection } from './MaterialThemeSection';

// Helper function to convert HSL to Hex
function hslToHex(h: number, s: number, l: number): string {
    l /= 100;
    const a = s * Math.min(l, 1 - l) / 100;
    const f = (n: number) => {
        const k = (n + h / 30) % 12;
        const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
        return Math.round(255 * color).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
}

export interface ColorPickerProps {
    /** Current selected color in hex format */
    value: string;
    /** Callback when color changes */
    onChange?: (color: string) => void;
    /** Callback when color is explicitly selected (e.g., clicked) */
    onSelect?: (color: string) => void;
}

export function ColorPicker({ value, onChange, onSelect }: ColorPickerProps) {
    const [hexInput, setHexInput] = useState(normalizeHex(value));
    const [copied, setCopied] = useState(false);
    const [debouncedHex, setDebouncedHex] = useState(normalizeHex(value));
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Keep local state in sync with incoming value
    useEffect(() => {
        const normalized = normalizeHex(value);
        setHexInput(normalized);
        setDebouncedHex(normalized);
    }, [value]);

    // Clear pending timers when component unmounts
    useEffect(() => () => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
    }, []);

    // Generate Material 3 theme from debounced value to prevent lag
    const materialTheme = useMemo(() => {
        if (!isValidHex(debouncedHex)) {
            return null;
        }
        try {
            const normalized = normalizeHex(debouncedHex);
            return themeFromSourceColor(argbFromHex(normalized));
        } catch (error) {
            console.warn('Material theme generation failed', error);
            return null;
        }
    }, [debouncedHex]);

    const scheduleColorUpdate = (
        color: string,
        { immediate = false, notifySelect = false }: { immediate?: boolean; notifySelect?: boolean } = {},
    ) => {
        if (!isValidHex(color)) {
            return;
        }
        const normalized = normalizeHex(color);
        setHexInput(normalized);

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        const commit = () => {
            setDebouncedHex(normalized);
            onChange?.(normalized);
            if (notifySelect) {
                onSelect?.(normalized);
            }
        };

        if (immediate) {
            commit();
        } else {
            debounceTimerRef.current = setTimeout(commit, 180);
        }
    };

    const handleHexChange = (newHex: string) => {
        setHexInput(newHex);
        if (isValidHex(newHex)) {
            scheduleColorUpdate(newHex, { immediate: true });
        }
    };

    const handlePickerChange = (color: string) => {
        scheduleColorUpdate(color);
    };

    const handlePickerCommit = () => {
        if (isValidHex(hexInput)) {
            scheduleColorUpdate(hexInput, { immediate: true, notifySelect: true });
        }
    };

    const handleColorSelect = (color: string) => {
        scheduleColorUpdate(color, { immediate: true, notifySelect: true });
    };

    const handleShuffle = () => {
        // Generate random vibrant color
        const hue = Math.floor(Math.random() * 360);
        const saturation = 60 + Math.floor(Math.random() * 40); // 60-100%
        const lightness = 40 + Math.floor(Math.random() * 20); // 40-60%

        const randomColor = hslToHex(hue, saturation, lightness);
        handleColorSelect(randomColor);
    };

    const handleCopyHex = async () => {
        try {
            await navigator.clipboard.writeText(hexInput.toUpperCase());
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    };

    return (
        <Box sx={{ width: '100%', maxWidth: 800 }}>
            {/* Header with large color preview and input */}
            <Paper elevation={0} sx={{ p: 3, mb: 2, bgcolor: 'background.default' }}>
                <Typography variant="h6" gutterBottom fontWeight={600}>
                    Source Color
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Pick a color to generate your Material 3 theme
                </Typography>

                <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={3}
                    alignItems={{ xs: 'stretch', sm: 'flex-start' }}
                >
                    <ColorPickerInput
                        value={hexInput}
                        onChange={handlePickerChange}
                        onCommit={handlePickerCommit}
                    />

                    {/* Hex Input */}
                    <Box sx={{ flex: 1 }}>
                        <TextField
                            fullWidth
                            label="Hex Color"
                            value={hexInput.toUpperCase()}
                            onChange={(e) => handleHexChange(e.target.value)}
                            error={!isValidHex(hexInput)}
                            helperText={!isValidHex(hexInput) ? 'Invalid hex color' : 'Use the picker or type a hex value'}
                            placeholder="#1976D2"
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Box
                                            sx={{
                                                width: 24,
                                                height: 24,
                                                bgcolor: hexInput,
                                                border: '1px solid',
                                                borderColor: 'divider',
                                                borderRadius: 0.5,
                                            }}
                                        />
                                    </InputAdornment>
                                ),
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <Tooltip title={copied ? 'Copied!' : 'Copy hex'}>
                                            <IconButton
                                                size="small"
                                                onClick={handleCopyHex}
                                                edge="end"
                                            >
                                                <ContentCopy fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Random color">
                                            <IconButton
                                                size="small"
                                                onClick={handleShuffle}
                                                edge="end"
                                            >
                                                <Shuffle fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </InputAdornment>
                                ),
                            }}
                        />
                    </Box>
                </Stack>
            </Paper>

            {/* Material 3 Theme Preview */}
            {materialTheme && (
                <MaterialThemeSection theme={materialTheme} onSelect={handleColorSelect} />
            )}
        </Box>
    );
}
