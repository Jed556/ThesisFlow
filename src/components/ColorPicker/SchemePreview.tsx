import { Box, Paper, Stack, Typography } from '@mui/material';
import { getTextColor } from '../../utils/colorUtils';

interface SchemePreviewProps {
    label: string;
    scheme: Record<string, string>;
    onSelect: (color: string) => void;
}

/**
 * Previews a Material 3 color scheme (light or dark mode) with interactive swatches
 */
export function SchemePreview({ label, scheme, onSelect }: SchemePreviewProps) {
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
        {
            label: 'Surface Variant', background: scheme.surfaceVariant ?? surface,
            foreground: scheme.onSurfaceVariant ?? onSurface, border: scheme.outline ?? outline
        },
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
}
