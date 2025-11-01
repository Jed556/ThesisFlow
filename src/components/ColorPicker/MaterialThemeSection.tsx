import { useMemo } from 'react';
import { Stack } from '@mui/material';
import { type themeFromSourceColor, hexFromArgb } from '@material/material-color-utilities';
import { TonalPaletteRow } from './TonalPaletteRow';
import { SchemePreview } from './SchemePreview';

type MaterialThemeResult = ReturnType<typeof themeFromSourceColor>;

function convertSchemeToHex(scheme: { toJSON: () => Record<string, number> }): Record<string, string> {
    const json = scheme.toJSON();
    return Object.fromEntries(
        Object.entries(json).map(([key, value]) => [key, hexFromArgb(value)])
    );
}

interface MaterialThemeSectionProps {
    theme: MaterialThemeResult;
    onSelect: (color: string) => void;
}

/**
 * Displays Material 3 theme palettes, tonal steps, and light/dark scheme previews
 */
export function MaterialThemeSection({ theme, onSelect }: MaterialThemeSectionProps) {
    const tonalPalettes = useMemo(
        () => [
            { label: 'Primary', palette: theme.palettes.primary },
            { label: 'Secondary', palette: theme.palettes.secondary },
            { label: 'Tertiary', palette: theme.palettes.tertiary },
            { label: 'Neutral', palette: theme.palettes.neutral },
            { label: 'Neutral Variant', palette: theme.palettes.neutralVariant },
        ],
        [theme],
    );

    const lightScheme = useMemo(() => convertSchemeToHex(theme.schemes.light), [theme]);
    const darkScheme = useMemo(() => convertSchemeToHex(theme.schemes.dark), [theme]);

    return (
        <Stack spacing={2}>
            <Stack spacing={1.5}>
                {tonalPalettes.map(({ label, palette }) => (
                    <TonalPaletteRow key={label} label={label} palette={palette} onSelect={onSelect} />
                ))}
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <SchemePreview label="Light" scheme={lightScheme} onSelect={onSelect} />
                <SchemePreview label="Dark" scheme={darkScheme} onSelect={onSelect} />
            </Stack>
        </Stack>
    );
}
