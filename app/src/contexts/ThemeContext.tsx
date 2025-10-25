import React, { createContext, useContext, useState, useMemo } from 'react';
import { Theme } from '@mui/material/styles';
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
            return generateThemeFromSeedColor(seedColor);
        }
        return baseTheme;
    }, [seedColor]);

    const updateThemeFromSeedColor = (color: string) => {
        if (isValidHexColor(color)) {
            setSeedColor(color);
        } else {
            console.warn('Invalid hex color provided:', color);
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
