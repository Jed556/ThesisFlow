import React, { createContext, useContext, useState, useMemo } from 'react';
import type { Theme } from '@mui/material/styles';
import { generateThemeFromSeedColor, isValidHexColor } from '../utils/themeGenerator';
import baseTheme from '../theme';

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
            console.log('🎨 Generating theme from seed color:', seedColor);
            const generatedTheme = generateThemeFromSeedColor(seedColor);
            return generatedTheme;
        }
        console.log('🎨 Using default theme');
        return baseTheme;
    }, [seedColor]);

    const updateThemeFromSeedColor = (color: string) => {
        if (isValidHexColor(color)) {
            console.log('🎨 Updating theme with color:', color);
            setSeedColor(color);
        } else {
            console.warn('❌ Invalid hex color provided:', color);
        }
    };

    const resetTheme = () => {
        setSeedColor(null);
    };

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
