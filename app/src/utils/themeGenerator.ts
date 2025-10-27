import { themeFromSourceColor, argbFromHex, hexFromArgb, Scheme, TonalPalette } from '@material/material-color-utilities';
import { createTheme, Theme, PaletteOptions } from '@mui/material/styles';
import { deepmerge } from '@mui/utils';
import baseTheme from '../theme';

/**
 * Converts a Material Color Utilities scheme to MUI palette colors
 */
function schemeToMuiColors(scheme: Scheme) {
    const colors = scheme.toJSON();
    return {
        primary: hexFromArgb(colors.primary),
        onPrimary: hexFromArgb(colors.onPrimary),
        primaryContainer: hexFromArgb(colors.primaryContainer),
        onPrimaryContainer: hexFromArgb(colors.onPrimaryContainer),
        secondary: hexFromArgb(colors.secondary),
        onSecondary: hexFromArgb(colors.onSecondary),
        secondaryContainer: hexFromArgb(colors.secondaryContainer),
        onSecondaryContainer: hexFromArgb(colors.onSecondaryContainer),
        tertiary: hexFromArgb(colors.tertiary),
        onTertiary: hexFromArgb(colors.onTertiary),
        tertiaryContainer: hexFromArgb(colors.tertiaryContainer),
        onTertiaryContainer: hexFromArgb(colors.onTertiaryContainer),
        error: hexFromArgb(colors.error),
        onError: hexFromArgb(colors.onError),
        errorContainer: hexFromArgb(colors.errorContainer),
        onErrorContainer: hexFromArgb(colors.onErrorContainer),
        background: hexFromArgb(colors.background),
        onBackground: hexFromArgb(colors.onBackground),
        surface: hexFromArgb(colors.surface),
        onSurface: hexFromArgb(colors.onSurface),
        surfaceVariant: hexFromArgb(colors.surfaceVariant),
        onSurfaceVariant: hexFromArgb(colors.onSurfaceVariant),
        outline: hexFromArgb(colors.outline),
        outlineVariant: hexFromArgb(colors.outlineVariant),
    };
}

const GREY_TONE_MAP: Record<string, number> = {
    '50': 98,
    '100': 96,
    '200': 94,
    '300': 90,
    '400': 80,
    '500': 60,
    '600': 49,
    '700': 40,
    '800': 30,
    '900': 20,
    A100: 98,
    A200: 90,
    A400: 70,
    A700: 50,
};

function hexToRgb(hexColor: string) {
    const hex = hexColor.replace('#', '');
    const normalized = hex.length === 3
        ? hex.split('').map((c) => c + c).join('')
        : hex.padStart(6, '0');
    const int = parseInt(normalized, 16);
    return {
        r: (int >> 16) & 255,
        g: (int >> 8) & 255,
        b: int & 255,
    };
}

function rgbaFromHex(hexColor: string, alpha: number) {
    const { r, g, b } = hexToRgb(hexColor);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildGreyPalette(neutral: TonalPalette) {
    const grey: Record<string, string> = {};
    Object.entries(GREY_TONE_MAP).forEach(([key, tone]) => {
        grey[key] = hexFromArgb(neutral.tone(tone));
    });
    return grey;
}

function buildActionPalette(onSurface: string, mode: 'light' | 'dark') {
    const isDark = mode === 'dark';
    const disabledOpacity = isDark ? 0.5 : 0.38;
    const hoverOpacity = isDark ? 0.12 : 0.08;
    const selectedOpacity = isDark ? 0.24 : 0.16;
    const focusOpacity = isDark ? 0.24 : 0.12;
    const activatedOpacity = isDark ? 0.24 : 0.12;
    const disabledBgOpacity = isDark ? 0.24 : 0.12;
    const activeOpacity = isDark ? 0.8 : 0.6;

    return {
        active: rgbaFromHex(onSurface, activeOpacity),
        hover: rgbaFromHex(onSurface, hoverOpacity),
        hoverOpacity,
        selected: rgbaFromHex(onSurface, selectedOpacity),
        selectedOpacity,
        disabled: rgbaFromHex(onSurface, disabledOpacity),
        disabledBackground: rgbaFromHex(onSurface, disabledBgOpacity),
        disabledOpacity,
        focus: rgbaFromHex(onSurface, focusOpacity),
        focusOpacity,
        activatedOpacity,
    };
}

function buildPalette(
    materialTheme: ReturnType<typeof themeFromSourceColor>,
    colors: ReturnType<typeof schemeToMuiColors>,
    mode: 'light' | 'dark',
) {
    const isDark = mode === 'dark';
    const palette: PaletteOptions = {
        mode,
        primary: {
            main: colors.primary,
            light: colors.primaryContainer,
            dark: hexFromArgb(materialTheme.palettes.primary.tone(isDark ? 40 : 30)),
            contrastText: colors.onPrimary,
        },
        secondary: {
            main: colors.secondary,
            light: colors.secondaryContainer,
            dark: hexFromArgb(materialTheme.palettes.secondary.tone(isDark ? 40 : 30)),
            contrastText: colors.onSecondary,
        },
        // Keep error colors constant (not affected by theme)
        error: {
            main: isDark ? '#f44336' : '#d32f2f',
            light: isDark ? '#e57373' : '#ef5350',
            dark: isDark ? '#d32f2f' : '#c62828',
            contrastText: '#fff',
        },
        // Keep warning colors constant (not affected by theme)
        warning: {
            main: isDark ? '#ffa726' : '#ed6c02',
            light: isDark ? '#ffb74d' : '#ff9800',
            dark: isDark ? '#f57c00' : '#e65100',
            contrastText: isDark ? 'rgba(0, 0, 0, 0.87)' : '#fff',
        },
        info: {
            main: colors.tertiary,
            light: colors.tertiaryContainer,
            dark: hexFromArgb(materialTheme.palettes.tertiary.tone(isDark ? 40 : 30)),
            contrastText: colors.onTertiary,
        },
        success: {
            main: isDark ? '#66bb6a' : '#2e7d32',
            light: isDark ? '#81c784' : '#4caf50',
            dark: isDark ? '#388e3c' : '#1b5e20',
            contrastText: isDark ? 'rgba(0, 0, 0, 0.87)' : '#fff',
        },
        tertiary: {
            main: colors.tertiary,
            light: colors.tertiaryContainer,
            dark: hexFromArgb(materialTheme.palettes.tertiary.tone(isDark ? 40 : 30)),
            contrastText: colors.onTertiary,
        } as any,
        background: {
            default: colors.background,
            paper: colors.surface,
        },
        text: {
            primary: colors.onBackground,
            secondary: colors.onSurfaceVariant,
            disabled: rgbaFromHex(colors.onSurface, isDark ? 0.5 : 0.38),
        },
        divider: colors.outlineVariant,
        grey: buildGreyPalette(materialTheme.palettes.neutral),
        action: buildActionPalette(colors.onSurface, mode),
    };

    (palette as any).surface = colors.surface;
    (palette as any).surfaceVariant = colors.surfaceVariant;
    (palette as any).outline = colors.outline;
    (palette as any).outlineVariant = colors.outlineVariant;
    (palette as any).inverseSurface = hexFromArgb(materialTheme.palettes.neutral.tone(isDark ? 90 : 20));
    (palette as any).inverseOnSurface = hexFromArgb(materialTheme.palettes.neutral.tone(isDark ? 20 : 95));
    (palette as any).inversePrimary = hexFromArgb(materialTheme.palettes.primary.tone(isDark ? 80 : 40));

    return palette;
}

/**
 * Generates a complete MUI theme from a seed color using Material 3 color system
 * @param seedColor - Hex color string (e.g., '#1976d2')
 * @returns MUI Theme object with generated color palette
 */
export function generateThemeFromSeedColor(seedColor: string): Theme {
    try {
        console.log('themeGenerator: Generating theme from seed color:', seedColor);

        // Generate Material 3 theme from seed color
        const materialTheme = themeFromSourceColor(argbFromHex(seedColor));

        // Extract light and dark schemes
        const lightColors = schemeToMuiColors(materialTheme.schemes.light);
        const darkColors = schemeToMuiColors(materialTheme.schemes.dark);

        console.log('themeGenerator: Light primary color:', lightColors.primary);
        console.log('themeGenerator: Dark primary color:', darkColors.primary);

        const lightPalette = buildPalette(materialTheme, lightColors, 'light');
        const darkPalette = buildPalette(materialTheme, darkColors, 'dark');

        // Create component overrides with theme colors
        const componentOverrides = {
            MuiLinearProgress: {
                styleOverrides: {
                    root: ({ theme }: { theme: Theme }) => ({
                        backgroundColor: rgbaFromHex(
                            theme.palette.mode === 'light' ? lightColors.primary : darkColors.primary,
                            0.15
                        ),
                    }),
                },
            },
            MuiListItemButton: {
                styleOverrides: {
                    root: ({ theme }: { theme: Theme }) => ({
                        height: 'auto',
                        transition: theme.transitions.create(['background-color', 'transform'], {
                            duration: theme.transitions.duration.shorter,
                            easing: theme.transitions.easing.easeInOut,
                        }),
                        '&:hover': {
                            transform: 'scale(1.02) translateX(1px)',
                        },
                        '&.Mui-selected': {
                            transition: theme.transitions.create(['background-color', 'transform'], {
                                duration: theme.transitions.duration.shorter,
                                easing: theme.transitions.easing.easeInOut,
                            }),
                            backgroundColor: rgbaFromHex(
                                theme.palette.mode === 'light' ? lightColors.primary : darkColors.primary,
                                theme.palette.mode === 'light' ? 0.16 : 0.24
                            ),
                            '&:hover': {
                                backgroundColor: rgbaFromHex(
                                    theme.palette.mode === 'light' ? lightColors.primary : darkColors.primary,
                                    theme.palette.mode === 'light' ? 0.20 : 0.30
                                ),
                            },
                        },
                    }),
                },
            },
        };

        // Create MUI theme with generated colors
        const customTheme = createTheme(
            deepmerge(baseTheme, {
                cssVariables: {
                    colorSchemeSelector: 'data-toolpad-color-scheme',
                },
                palette: lightPalette,
                colorSchemes: {
                    light: {
                        palette: lightPalette,
                    },
                    dark: {
                        palette: darkPalette,
                    },
                },
                components: componentOverrides,
            })
        );

        console.log('themeGenerator: Theme created successfully');

        return customTheme;
    } catch (error) {
        console.error('themeGenerator: Failed to generate theme from seed color:', error);
        return baseTheme;
    }
}

/**
 * Validates if a string is a valid hex color
 */
export function isValidHexColor(color: string): boolean {
    return /^#([0-9A-F]{3}){1,2}$/i.test(color);
}
