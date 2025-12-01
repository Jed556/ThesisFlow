import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import type { Theme } from '@mui/material/styles';
import { generateThemeFromSeedColor, isValidHexColor } from '../utils/themeGenerator';
import baseTheme from '../theme';
import { devLog, devWarn } from '../utils/devUtils';

interface ThemeContextType {
    theme: Theme;
    seedColor: string | null;
    updateThemeFromSeedColor: (color: string) => void;
    resetTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [seedColor, setSeedColor] = useState<string | null>(null);

    // Generate theme from seed color
    const theme = useMemo(() => {
        if (seedColor && isValidHexColor(seedColor)) {
            devLog('🎨 Generating theme from seed color:', seedColor);
            const generatedTheme = generateThemeFromSeedColor(seedColor);
            return generatedTheme;
        }
        devLog('🎨 Using default theme');
        return baseTheme;
    }, [seedColor]);

    const updateThemeFromSeedColor = useCallback((color: string) => {
        if (isValidHexColor(color)) {
            devLog('🎨 Updating theme with color:', color);
            setSeedColor(color);
        } else {
            devWarn('❌ Invalid hex color provided:', color);
        }
    }, [setSeedColor]);

    const resetTheme = useCallback(() => {
        setSeedColor(null);
    }, [setSeedColor]);

    const value = useMemo(
        () => ({
            theme,
            seedColor,
            updateThemeFromSeedColor,
            resetTheme,
        }),
        [theme, seedColor]
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
