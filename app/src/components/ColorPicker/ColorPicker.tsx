import React, { useState, useEffect } from 'react';
import { Box, TextField, Typography, Paper, Chip, Stack, ToggleButtonGroup, ToggleButton, Tooltip, } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import { materialColors, type MaterialColorPalette } from '../../data/materialColorPalette';
import {
    hexToRgb, rgbToHex, rgbToHsl, hslToRgb, generateMaterialShades, getComplementaryColor, getAnalogousColors,
    getTriadicColors, getTextColor, getContrastRatio, hasGoodContrast, isValidHex, normalizeHex
} from '../../utils/colorUtils';

export interface ColorPickerProps {
    /** Current selected color in hex format */
    value: string;
    /** Callback when color changes */
    onChange?: (color: string) => void;
    /** Callback when color is explicitly selected (e.g., clicked) */
    onSelect?: (color: string) => void;
    /** Whether to show color harmonies section */
    showHarmonies?: boolean;
    /** Whether to show shade variants section */
    showShades?: boolean;
    /** Whether to show accessibility info */
    showAccessibility?: boolean;
}

type InputMode = 'hex' | 'rgb';
type ShadeKey = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

export const ColorPicker: React.FC<ColorPickerProps> = ({
    value,
    onChange,
    onSelect,
    showHarmonies = true,
    showShades = true,
    showAccessibility = true,
}) => {
    const [inputMode, setInputMode] = useState<InputMode>('hex');
    const [hexInput, setHexInput] = useState(normalizeHex(value));
    const [rgbInput, setRgbInput] = useState({ r: 0, g: 0, b: 0 });
    const [selectedPalette, setSelectedPalette] = useState<MaterialColorPalette | null>(null);
    const [customShades, setCustomShades] = useState<Record<ShadeKey, string>>({} as Record<ShadeKey, string>);

    // Initialize RGB input from hex value
    useEffect(() => {
        const rgb = hexToRgb(value);
        if (rgb) {
            setRgbInput(rgb);
        }
        setHexInput(normalizeHex(value));
    }, [value]);

    // Generate custom shades when hex changes
    useEffect(() => {
        if (isValidHex(hexInput)) {
            const shades = generateMaterialShades(hexInput);
            setCustomShades(shades);
        }
    }, [hexInput]);

    const handleHexChange = (newHex: string) => {
        setHexInput(newHex);
        if (isValidHex(newHex)) {
            const normalized = normalizeHex(newHex);
            onChange?.(normalized);
            const rgb = hexToRgb(normalized);
            if (rgb) {
                setRgbInput(rgb);
            }
        }
    };

    const handleRgbChange = (channel: 'r' | 'g' | 'b', value: string) => {
        const numValue = Math.max(0, Math.min(255, parseInt(value) || 0));
        const newRgb = { ...rgbInput, [channel]: numValue };
        setRgbInput(newRgb);
        const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
        setHexInput(hex);
        onChange?.(hex);
    };

    const handleColorSelect = (color: string) => {
        const normalized = normalizeHex(color);
        setHexInput(normalized);
        onChange?.(normalized);
        onSelect?.(normalized);
        const rgb = hexToRgb(normalized);
        if (rgb) {
            setRgbInput(rgb);
        }
    };

    const handlePaletteColorSelect = (palette: MaterialColorPalette, shade: ShadeKey) => {
        const color = palette.shades[shade];
        if (color) {
            setSelectedPalette(palette);
            handleColorSelect(color);
        }
    };

    // Color harmonies
    const complementary = getComplementaryColor(hexInput);
    const analogous = getAnalogousColors(hexInput);
    const triadic = getTriadicColors(hexInput);

    // Accessibility
    const contrastWithWhite = getContrastRatio(hexInput, '#FFFFFF');
    const contrastWithBlack = getContrastRatio(hexInput, '#000000');
    const textColor = getTextColor(hexInput);
    const isAccessible = hasGoodContrast(hexInput, textColor === '#000000' ? '#FFFFFF' : '#000000');

    return (
        <Box sx={{ width: '100%', maxWidth: 800 }}>
            {/* Color Input Section */}
            <Paper elevation={0} sx={{ p: 2, mb: 2, bgcolor: 'background.default' }}>
                <Stack spacing={2}>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                        {/* Color Preview */}
                        <Paper
                            elevation={3}
                            sx={{
                                width: 80,
                                height: 80,
                                bgcolor: hexInput,
                                border: '2px solid',
                                borderColor: 'divider',
                                borderRadius: 1,
                                flexShrink: 0,
                            }}
                        />

                        {/* Input Fields */}
                        <Box sx={{ flex: 1 }}>
                            <ToggleButtonGroup
                                value={inputMode}
                                exclusive
                                onChange={(_, mode) => mode && setInputMode(mode)}
                                size="small"
                                sx={{ mb: 1 }}
                            >
                                <ToggleButton value="hex">HEX</ToggleButton>
                                <ToggleButton value="rgb">RGB</ToggleButton>
                            </ToggleButtonGroup>

                            {inputMode === 'hex' ? (
                                <TextField
                                    fullWidth
                                    label="Hex Color"
                                    value={hexInput}
                                    onChange={(e) => handleHexChange(e.target.value)}
                                    error={!isValidHex(hexInput)}
                                    helperText={!isValidHex(hexInput) ? 'Invalid hex color' : ''}
                                    placeholder="#000000"
                                />
                            ) : (
                                <Stack direction="row" spacing={1}>
                                    <TextField
                                        label="R"
                                        type="number"
                                        value={rgbInput.r}
                                        onChange={(e) => handleRgbChange('r', e.target.value)}
                                        inputProps={{ min: 0, max: 255 }}
                                    />
                                    <TextField
                                        label="G"
                                        type="number"
                                        value={rgbInput.g}
                                        onChange={(e) => handleRgbChange('g', e.target.value)}
                                        inputProps={{ min: 0, max: 255 }}
                                    />
                                    <TextField
                                        label="B"
                                        type="number"
                                        value={rgbInput.b}
                                        onChange={(e) => handleRgbChange('b', e.target.value)}
                                        inputProps={{ min: 0, max: 255 }}
                                    />
                                </Stack>
                            )}
                        </Box>
                    </Box>

                    {/* Accessibility Info */}
                    {showAccessibility && (
                        <Box sx={{ pt: 1 }}>
                            <Typography variant="caption" color="text.secondary" gutterBottom>
                                Accessibility
                            </Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap">
                                <Chip
                                    label={`vs White: ${contrastWithWhite.toFixed(2)}:1`}
                                    size="small"
                                    color={contrastWithWhite >= 4.5 ? 'success' : 'default'}
                                    icon={contrastWithWhite >= 4.5 ? <CheckIcon /> : undefined}
                                />
                                <Chip
                                    label={`vs Black: ${contrastWithBlack.toFixed(2)}:1`}
                                    size="small"
                                    color={contrastWithBlack >= 4.5 ? 'success' : 'default'}
                                    icon={contrastWithBlack >= 4.5 ? <CheckIcon /> : undefined}
                                />
                                <Chip
                                    label={isAccessible ? 'WCAG AA' : 'Not Accessible'}
                                    size="small"
                                    color={isAccessible ? 'success' : 'warning'}
                                />
                            </Stack>
                        </Box>
                    )}
                </Stack>
            </Paper>

            {/* Material Design Palette */}
            <Paper elevation={0} sx={{ p: 2, mb: 2, bgcolor: 'background.default' }}>
                <Typography variant="subtitle2" gutterBottom>
                    Material Design Colors
                </Typography>
                <Box
                    sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 0.5,
                    }}
                >
                    {materialColors.map((palette) => (
                        <Tooltip key={palette.name} title={palette.name}>
                            <Box
                                onClick={() => handlePaletteColorSelect(palette, 500)}
                                sx={{
                                    width: 40,
                                    height: 40,
                                    bgcolor: palette.shades[500],
                                    cursor: 'pointer',
                                    borderRadius: 0.5,
                                    border: '2px solid',
                                    borderColor:
                                        selectedPalette?.name === palette.name
                                            ? 'primary.main'
                                            : 'transparent',
                                    transition: 'all 0.2s',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    '&:hover': {
                                        transform: 'scale(1.1)',
                                        borderColor: 'primary.light',
                                        zIndex: 1,
                                    },
                                }}
                            >
                                {hexInput.toUpperCase() === palette.shades[500].toUpperCase() && (
                                    <CheckIcon
                                        sx={{
                                            color: getTextColor(palette.shades[500]),
                                            fontSize: 20,
                                        }}
                                    />
                                )}
                            </Box>
                        </Tooltip>
                    ))}
                </Box>
            </Paper>

            {/* Shade Variants */}
            {showShades && (
                <Paper elevation={0} sx={{ p: 2, mb: 2, bgcolor: 'background.default' }}>
                    <Typography variant="subtitle2" gutterBottom>
                        Shade Variants
                    </Typography>
                    <Stack spacing={0.5}>
                        {/* Selected Palette Shades */}
                        {selectedPalette && (
                            <>
                                <Typography variant="caption" color="text.secondary">
                                    {selectedPalette.name}
                                </Typography>
                                <Stack direction="row" spacing={0.5}>
                                    {([50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as ShadeKey[]).map(
                                        (shade) => (
                                            <Tooltip key={shade} title={`${shade} - ${selectedPalette.shades[shade]}`}>
                                                <Box
                                                    onClick={() => handlePaletteColorSelect(selectedPalette, shade)}
                                                    sx={{
                                                        flex: 1,
                                                        height: 40,
                                                        bgcolor: selectedPalette.shades[shade],
                                                        cursor: 'pointer',
                                                        borderRadius: 0.5,
                                                        border: '2px solid',
                                                        borderColor:
                                                            hexInput.toUpperCase() ===
                                                                selectedPalette.shades[shade]?.toUpperCase()
                                                                ? 'primary.main'
                                                                : 'transparent',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        transition: 'all 0.2s',
                                                        '&:hover': {
                                                            transform: 'scale(1.05)',
                                                            zIndex: 1,
                                                        },
                                                    }}
                                                >
                                                    {hexInput.toUpperCase() ===
                                                        selectedPalette.shades[shade]?.toUpperCase() && (
                                                            <CheckIcon
                                                                sx={{
                                                                    color: getTextColor(selectedPalette.shades[shade] || '#000000'),
                                                                    fontSize: 16,
                                                                }}
                                                            />
                                                        )}
                                                </Box>
                                            </Tooltip>
                                        )
                                    )}
                                </Stack>
                            </>
                        )}

                        {/* Custom Color Shades */}
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                            Current Color Shades
                        </Typography>
                        <Stack direction="row" spacing={0.5}>
                            {([50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as ShadeKey[]).map((shade) => (
                                <Tooltip key={shade} title={`${shade} - ${customShades[shade]}`}>
                                    <Box
                                        onClick={() => handleColorSelect(customShades[shade])}
                                        sx={{
                                            flex: 1,
                                            height: 40,
                                            bgcolor: customShades[shade],
                                            cursor: 'pointer',
                                            borderRadius: 0.5,
                                            border: '2px solid',
                                            borderColor:
                                                shade === 500 ? 'primary.main' : 'transparent',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            transition: 'all 0.2s',
                                            '&:hover': {
                                                transform: 'scale(1.05)',
                                                zIndex: 1,
                                            },
                                        }}
                                    >
                                        {shade === 500 && (
                                            <CheckIcon
                                                sx={{
                                                    color: getTextColor(customShades[shade] || '#000000'),
                                                    fontSize: 16,
                                                }}
                                            />
                                        )}
                                    </Box>
                                </Tooltip>
                            ))}
                        </Stack>
                    </Stack>
                </Paper>
            )}

            {/* Color Harmonies */}
            {showHarmonies && (
                <Paper elevation={0} sx={{ p: 2, bgcolor: 'background.default' }}>
                    <Typography variant="subtitle2" gutterBottom>
                        Color Harmonies
                    </Typography>
                    <Stack spacing={2}>
                        {/* Complementary */}
                        <Box>
                            <Typography variant="caption" color="text.secondary">
                                Complementary
                            </Typography>
                            <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                                <Tooltip title={hexInput}>
                                    <Box
                                        sx={{
                                            width: 60,
                                            height: 40,
                                            bgcolor: hexInput,
                                            borderRadius: 0.5,
                                            border: '2px solid',
                                            borderColor: 'divider',
                                        }}
                                    />
                                </Tooltip>
                                <Tooltip title={complementary}>
                                    <Box
                                        onClick={() => handleColorSelect(complementary)}
                                        sx={{
                                            width: 60,
                                            height: 40,
                                            bgcolor: complementary,
                                            borderRadius: 0.5,
                                            border: '2px solid',
                                            borderColor: 'divider',
                                            cursor: 'pointer',
                                            transition: 'transform 0.2s',
                                            '&:hover': {
                                                transform: 'scale(1.1)',
                                            },
                                        }}
                                    />
                                </Tooltip>
                            </Stack>
                        </Box>

                        {/* Analogous */}
                        <Box>
                            <Typography variant="caption" color="text.secondary">
                                Analogous
                            </Typography>
                            <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                                {analogous.map((color, index) => (
                                    <Tooltip key={index} title={color}>
                                        <Box
                                            onClick={() => handleColorSelect(color)}
                                            sx={{
                                                width: 60,
                                                height: 40,
                                                bgcolor: color,
                                                borderRadius: 0.5,
                                                border: '2px solid',
                                                borderColor: index === 1 ? 'primary.main' : 'divider',
                                                cursor: 'pointer',
                                                transition: 'transform 0.2s',
                                                '&:hover': {
                                                    transform: 'scale(1.1)',
                                                },
                                            }}
                                        />
                                    </Tooltip>
                                ))}
                            </Stack>
                        </Box>

                        {/* Triadic */}
                        <Box>
                            <Typography variant="caption" color="text.secondary">
                                Triadic
                            </Typography>
                            <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                                {triadic.map((color, index) => (
                                    <Tooltip key={index} title={color}>
                                        <Box
                                            onClick={() => handleColorSelect(color)}
                                            sx={{
                                                width: 60,
                                                height: 40,
                                                bgcolor: color,
                                                borderRadius: 0.5,
                                                border: '2px solid',
                                                borderColor: index === 0 ? 'primary.main' : 'divider',
                                                cursor: 'pointer',
                                                transition: 'transform 0.2s',
                                                '&:hover': {
                                                    transform: 'scale(1.1)',
                                                },
                                            }}
                                        />
                                    </Tooltip>
                                ))}
                            </Stack>
                        </Box>
                    </Stack>
                </Paper>
            )}
        </Box>
    );
};
