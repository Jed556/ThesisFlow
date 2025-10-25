import { themeFromSourceColor, argbFromHex, hexFromArgb, Scheme } from '@material/material-color-utilities';
import { createTheme, Theme, PaletteOptions } from '@mui/material/styles';
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

/**
 * Generates a complete MUI theme from a seed color using Material 3 color system
 * @param seedColor - Hex color string (e.g., '#1976d2')
 * @returns MUI Theme object with generated color palette
 */
export function generateThemeFromSeedColor(seedColor: string): Theme {
    try {
        // Generate Material 3 theme from seed color
        const materialTheme = themeFromSourceColor(argbFromHex(seedColor));

        // Extract light and dark schemes
        const lightColors = schemeToMuiColors(materialTheme.schemes.light);
        const darkColors = schemeToMuiColors(materialTheme.schemes.dark);

        // Create MUI theme with generated colors
        const customTheme = createTheme({
            ...baseTheme,
            colorSchemes: {
                light: {
                    palette: {
                        mode: 'light',
                        primary: {
                            main: lightColors.primary,
                            light: lightColors.primaryContainer,
                            dark: hexFromArgb(materialTheme.palettes.primary.tone(30)),
                            contrastText: lightColors.onPrimary,
                        },
                        secondary: {
                            main: lightColors.secondary,
                            light: lightColors.secondaryContainer,
                            dark: hexFromArgb(materialTheme.palettes.secondary.tone(30)),
                            contrastText: lightColors.onSecondary,
                        },
                        error: {
                            main: lightColors.error,
                            light: lightColors.errorContainer,
                            dark: hexFromArgb(materialTheme.palettes.error.tone(30)),
                            contrastText: lightColors.onError,
                        },
                        warning: {
                            main: '#ed6c02',
                            light: '#ff9800',
                            dark: '#e65100',
                            contrastText: '#fff',
                        },
                        info: {
                            main: lightColors.tertiary,
                            light: lightColors.tertiaryContainer,
                            dark: hexFromArgb(materialTheme.palettes.tertiary.tone(30)),
                            contrastText: lightColors.onTertiary,
                        },
                        success: {
                            main: '#2e7d32',
                            light: '#4caf50',
                            dark: '#1b5e20',
                            contrastText: '#fff',
                        },
                        background: {
                            default: lightColors.background,
                            paper: lightColors.surface,
                        },
                        text: {
                            primary: lightColors.onBackground,
                            secondary: lightColors.onSurfaceVariant,
                        },
                        divider: lightColors.outlineVariant,
                    } as PaletteOptions,
                },
                dark: {
                    palette: {
                        mode: 'dark',
                        primary: {
                            main: darkColors.primary,
                            light: darkColors.primaryContainer,
                            dark: hexFromArgb(materialTheme.palettes.primary.tone(80)),
                            contrastText: darkColors.onPrimary,
                        },
                        secondary: {
                            main: darkColors.secondary,
                            light: darkColors.secondaryContainer,
                            dark: hexFromArgb(materialTheme.palettes.secondary.tone(80)),
                            contrastText: darkColors.onSecondary,
                        },
                        error: {
                            main: darkColors.error,
                            light: darkColors.errorContainer,
                            dark: hexFromArgb(materialTheme.palettes.error.tone(80)),
                            contrastText: darkColors.onError,
                        },
                        warning: {
                            main: '#ffa726',
                            light: '#ffb74d',
                            dark: '#f57c00',
                            contrastText: 'rgba(0, 0, 0, 0.87)',
                        },
                        info: {
                            main: darkColors.tertiary,
                            light: darkColors.tertiaryContainer,
                            dark: hexFromArgb(materialTheme.palettes.tertiary.tone(80)),
                            contrastText: darkColors.onTertiary,
                        },
                        success: {
                            main: '#66bb6a',
                            light: '#81c784',
                            dark: '#388e3c',
                            contrastText: 'rgba(0, 0, 0, 0.87)',
                        },
                        background: {
                            default: darkColors.background,
                            paper: darkColors.surface,
                        },
                        text: {
                            primary: darkColors.onBackground,
                            secondary: darkColors.onSurfaceVariant,
                        },
                        divider: darkColors.outlineVariant,
                    } as PaletteOptions,
                },
            },
        });

        return customTheme;
    } catch (error) {
        console.error('Failed to generate theme from seed color:', error);
        return baseTheme;
    }
}

/**
 * Validates if a string is a valid hex color
 */
export function isValidHexColor(color: string): boolean {
    return /^#([0-9A-F]{3}){1,2}$/i.test(color);
}
