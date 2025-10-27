import React, { useState, useEffect } from 'react';
import { Box, TextField, Typography, Paper, Stack, Tooltip, IconButton, InputAdornment } from '@mui/material';
import { themeFromSourceColor, argbFromHex, hexFromArgb } from '@material/material-color-utilities';
import { Shuffle, ContentCopy } from '@mui/icons-material';
import { getTextColor, isValidHex, normalizeHex } from '../../utils/colorUtils';

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

export const ColorPicker: React.FC<ColorPickerProps> = ({
    value,
    onChange,
    onSelect,
}) => {
    const [hexInput, setHexInput] = useState(normalizeHex(value));
    const [copied, setCopied] = useState(false);

    // Update hex input when value prop changes
    useEffect(() => {
        setHexInput(normalizeHex(value));
    }, [value]);

    // Update hex input when value prop changes
    useEffect(() => {
        setHexInput(normalizeHex(value));
    }, [value]);

    // Generate Material 3 theme
    const materialTheme = React.useMemo(() => {
        if (!isValidHex(hexInput)) {
            return null;
        }
        try {
            const normalized = normalizeHex(hexInput);
            return themeFromSourceColor(argbFromHex(normalized));
        } catch (error) {
            console.warn('Material theme generation failed', error);
            return null;
        }
    }, [hexInput]);

    const handleHexChange = (newHex: string) => {
        setHexInput(newHex);
        if (isValidHex(newHex)) {
            const normalized = normalizeHex(newHex);
            onChange?.(normalized);
        }
    };

    const handleColorSelect = (color: string) => {
        const normalized = normalizeHex(color);
        setHexInput(normalized);
        onChange?.(normalized);
        onSelect?.(normalized);
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

                <Stack direction="row" spacing={3} alignItems="center">
                    {/* Large Color Preview */}
                    <Paper
                        elevation={3}
                        sx={{
                            width: 120,
                            height: 120,
                            bgcolor: hexInput,
                            border: '2px solid',
                            borderColor: 'divider',
                            borderRadius: 2,
                            flexShrink: 0,
                            cursor: 'pointer',
                            transition: 'transform 0.2s ease',
                            '&:hover': {
                                transform: 'scale(1.05)',
                            },
                        }}
                        component="label"
                    >
                        <input
                            type="color"
                            value={hexInput}
                            onChange={(e) => handleColorSelect(e.target.value)}
                            style={{
                                opacity: 0,
                                width: 0,
                                height: 0,
                                position: 'absolute',
                            }}
                        />
                    </Paper>

                    {/* Hex Input */}
                    <Box sx={{ flex: 1 }}>
                        <TextField
                            fullWidth
                            label="Hex Color"
                            value={hexInput.toUpperCase()}
                            onChange={(e) => handleHexChange(e.target.value)}
                            error={!isValidHex(hexInput)}
                            helperText={!isValidHex(hexInput) ? 'Invalid hex color' : 'Click the color box or type a hex value'}
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
};

type MaterialThemeResult = ReturnType<typeof themeFromSourceColor>;

const TONAL_STEPS: readonly number[] = [100, 95, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0] as const;

const convertSchemeToHex = (scheme: { toJSON(): Record<string, number> }): Record<string, string> => {
    const json = scheme.toJSON();
    return Object.fromEntries(
        Object.entries(json).map(([key, value]) => [key, hexFromArgb(value)])
    );
};

interface MaterialThemeSectionProps {
    theme: MaterialThemeResult;
    onSelect: (color: string) => void;
}

const MaterialThemeSection: React.FC<MaterialThemeSectionProps> = ({ theme, onSelect }) => {
    const tonalPalettes = React.useMemo(
        () => [
            { label: 'Primary', palette: theme.palettes.primary },
            { label: 'Secondary', palette: theme.palettes.secondary },
            { label: 'Tertiary', palette: theme.palettes.tertiary },
            { label: 'Neutral', palette: theme.palettes.neutral },
            { label: 'Neutral Variant', palette: theme.palettes.neutralVariant },
            // { label: 'Error', palette: theme.palettes.error },
        ],
        [theme],
    );

    const lightScheme = React.useMemo(() => convertSchemeToHex(theme.schemes.light), [theme]);
    const darkScheme = React.useMemo(() => convertSchemeToHex(theme.schemes.dark), [theme]);

    return (
        <Stack spacing={2}>
            <Box>
                <Typography variant="subtitle2" gutterBottom>
                    Material 3 Theme Builder
                </Typography>
            </Box>

            <Stack spacing={1.5}>
                {tonalPalettes.map(({ label, palette }) => (
                    <TonalPaletteRow key={label} label={label} palette={palette} onSelect={onSelect} />
                ))}
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <MaterialSchemePreview label="Light" scheme={lightScheme} onSelect={onSelect} />
                <MaterialSchemePreview label="Dark" scheme={darkScheme} onSelect={onSelect} />
            </Stack>
        </Stack>
    );
};

interface TonalPaletteRowProps {
    label: string;
    palette: MaterialThemeResult['palettes'][keyof MaterialThemeResult['palettes']];
    onSelect: (color: string) => void;
}

const TonalPaletteRow: React.FC<TonalPaletteRowProps> = ({ label, palette, onSelect }) => (
    <Box>
        <Typography variant="caption" color="text.secondary">
            {label} tonal steps
        </Typography>
        <Stack
            direction="row"
            spacing={0.5}
            sx={{ mt: 0.5, overflowX: 'auto', pb: 0.5 }}
        >
            {TONAL_STEPS.map((tone) => {
                const toneColor = hexFromArgb(palette.tone(tone));
                return (
                    <Tooltip key={tone} title={`T${tone} • ${toneColor}`}>
                        <Box
                            onClick={() => onSelect(toneColor)}
                            sx={{
                                width: 44,
                                height: 44,
                                bgcolor: toneColor,
                                borderRadius: 1,
                                border: '1px solid',
                                borderColor: tone >= 50 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.3)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                '&:hover': {
                                    transform: 'translateY(-2px)',
                                    boxShadow: 3,
                                },
                            }}
                        >
                            <Typography
                                variant="caption"
                                sx={{ color: getTextColor(toneColor), fontSize: 10, fontWeight: 600 }}
                            >
                                {tone}
                            </Typography>
                        </Box>
                    </Tooltip>
                );
            })}
        </Stack>
    </Box>
);

interface MaterialSchemePreviewProps {
    label: string;
    scheme: Record<string, string>;
    onSelect: (color: string) => void;
}

const MaterialSchemePreview: React.FC<MaterialSchemePreviewProps> = ({ label, scheme, onSelect }) => {
    const outline = scheme.outline ?? '#757575';
    const surface = scheme.surface ?? '#ffffff';
    const onSurface = scheme.onSurface ?? getTextColor(surface);
    const background = scheme.background ?? surface;
    const onBackground = scheme.onBackground ?? getTextColor(background);

    const sampleCards: Array<{ label: string; background?: string; foreground?: string; border?: string }> = [
        { label: 'Primary', background: scheme.primary, foreground: scheme.onPrimary },
        { label: 'Primary Container', background: scheme.primaryContainer, foreground: scheme.onPrimaryContainer },
        { label: 'Secondary', background: scheme.secondary, foreground: scheme.onSecondary },
        { label: 'Secondary Container', background: scheme.secondaryContainer, foreground: scheme.onSecondaryContainer },
        { label: 'Tertiary', background: scheme.tertiary, foreground: scheme.onTertiary },
        { label: 'Surface', background: surface, foreground: onSurface, border: scheme.outlineVariant ?? outline },
        { label: 'Surface Variant', background: scheme.surfaceVariant ?? surface, foreground: scheme.onSurfaceVariant ?? onSurface, border: scheme.outline ?? outline },
    ];

    const filteredCards = sampleCards.reduce<Array<{ label: string; background: string; foreground: string; border?: string }>>(
        (acc, card) => {
            if (card.background && card.foreground) {
                acc.push({
                    label: card.label,
                    background: card.background,
                    foreground: card.foreground,
                    border: card.border,
                });
            }
            return acc;
        },
        [],
    );

    return (
        <Paper
            variant="outlined"
            sx={{ flex: 1, minWidth: 260, borderRadius: 2, overflow: 'hidden', borderColor: outline }}
        >
            <Box sx={{ p: 2, bgcolor: background, color: onBackground }}>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                    {label} scheme
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                    Tap a swatch to update the seed color.
                </Typography>
            </Box>
            <Stack spacing={1.25} sx={{ p: 2, bgcolor: surface, color: onSurface }}>
                {filteredCards.map((card) => (
                    <Box
                        key={card.label}
                        onClick={() => onSelect(card.background)}
                        sx={{
                            bgcolor: card.background,
                            color: card.foreground,
                            p: 1.25,
                            borderRadius: 1.5,
                            border: '1px solid',
                            borderColor: card.border ?? outline,
                            cursor: 'pointer',
                            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                            '&:hover': {
                                transform: 'translateY(-2px)',
                                boxShadow: 4,
                            },
                        }}
                    >
                        <Typography variant="body2" fontWeight={600}>
                            {card.label}
                        </Typography>
                        <Typography variant="caption" sx={{ opacity: 0.85 }}>
                            {card.background}
                        </Typography>
                    </Box>
                ))}
            </Stack>
        </Paper>
    );
};
