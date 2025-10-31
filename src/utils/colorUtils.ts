/**
 * Color utility functions for Material Design color picker
 * Based on Material Design color system
 */

/**
 * Convert hex color to RGB
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

/**
 * Convert RGB to hex
 */
export function rgbToHex(r: number, g: number, b: number): string {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

/**
 * Convert RGB to HSL
 */
export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }

    return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * Convert HSL to RGB
 */
export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    h /= 360;
    s /= 100;
    l /= 100;

    let r, g, b;

    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;

        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    };
}

/**
 * Calculate relative luminance for contrast calculations
 */
export function getLuminance(r: number, g: number, b: number): number {
    const [rs, gs, bs] = [r, g, b].map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 */
export function getContrastRatio(hex1: string, hex2: string): number {
    const rgb1 = hexToRgb(hex1);
    const rgb2 = hexToRgb(hex2);

    if (!rgb1 || !rgb2) return 0;

    const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
    const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);

    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);

    return (brightest + 0.05) / (darkest + 0.05);
}

/**
 * Check if text color has sufficient contrast with background (WCAG AA)
 */
export function hasGoodContrast(backgroundColor: string, textColor: string): boolean {
    const ratio = getContrastRatio(backgroundColor, textColor);
    return ratio >= 4.5; // WCAG AA standard for normal text
}

/**
 * Generate lighter shade of a color
 */
export function lightenColor(hex: string, amount: number): string {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;

    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    hsl.l = Math.min(100, hsl.l + amount);

    const newRgb = hslToRgb(hsl.h, hsl.s, hsl.l);
    return rgbToHex(newRgb.r, newRgb.g, newRgb.b);
}

/**
 * Generate darker shade of a color
 */
export function darkenColor(hex: string, amount: number): string {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;

    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    hsl.l = Math.max(0, hsl.l - amount);

    const newRgb = hslToRgb(hsl.h, hsl.s, hsl.l);
    return rgbToHex(newRgb.r, newRgb.g, newRgb.b);
}

/**
 * Generate Material Design color shades from a base color
 * Returns shades: 50, 100, 200, 300, 400, 500 (base), 600, 700, 800, 900
 */
export function generateMaterialShades(baseHex: string): Record<number, string> {
    const rgb = hexToRgb(baseHex);
    if (!rgb) return { 500: baseHex };

    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

    // Material Design shade generation algorithm
    const shades: Record<number, string> = {
        50: lightenColor(baseHex, 45),
        100: lightenColor(baseHex, 37),
        200: lightenColor(baseHex, 26),
        300: lightenColor(baseHex, 16),
        400: lightenColor(baseHex, 8),
        500: baseHex, // Base color
        600: darkenColor(baseHex, 8),
        700: darkenColor(baseHex, 16),
        800: darkenColor(baseHex, 24),
        900: darkenColor(baseHex, 32)
    };

    return shades;
}

/**
 * Generate complementary color (opposite on color wheel)
 */
export function getComplementaryColor(hex: string): string {
    const rgb = hexToRgb(hex);
    if (!rgb) return hex;

    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    hsl.h = (hsl.h + 180) % 360;

    const newRgb = hslToRgb(hsl.h, hsl.s, hsl.l);
    return rgbToHex(newRgb.r, newRgb.g, newRgb.b);
}

/**
 * Generate analogous colors (adjacent on color wheel)
 */
export function getAnalogousColors(hex: string): [string, string, string] {
    const rgb = hexToRgb(hex);
    if (!rgb) return [hex, hex, hex];

    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

    // 30 degrees apart
    const hsl1 = { ...hsl, h: (hsl.h - 30 + 360) % 360 };
    const hsl2 = { ...hsl, h: (hsl.h + 30) % 360 };

    const rgb1 = hslToRgb(hsl1.h, hsl1.s, hsl1.l);
    const rgb2 = hslToRgb(hsl2.h, hsl2.s, hsl2.l);

    return [
        rgbToHex(rgb1.r, rgb1.g, rgb1.b),
        hex,
        rgbToHex(rgb2.r, rgb2.g, rgb2.b)
    ];
}

/**
 * Generate triadic colors (evenly spaced on color wheel)
 */
export function getTriadicColors(hex: string): [string, string, string] {
    const rgb = hexToRgb(hex);
    if (!rgb) return [hex, hex, hex];

    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

    // 120 degrees apart
    const hsl1 = { ...hsl, h: (hsl.h + 120) % 360 };
    const hsl2 = { ...hsl, h: (hsl.h + 240) % 360 };

    const rgb1 = hslToRgb(hsl1.h, hsl1.s, hsl1.l);
    const rgb2 = hslToRgb(hsl2.h, hsl2.s, hsl2.l);

    return [
        hex,
        rgbToHex(rgb1.r, rgb1.g, rgb1.b),
        rgbToHex(rgb2.r, rgb2.g, rgb2.b)
    ];
}

/**
 * Validate hex color format
 */
export function isValidHex(hex: string): boolean {
    return /^#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex);
}

/**
 * Normalize hex color (ensure # prefix and 6 digits)
 */
export function normalizeHex(hex: string): string {
    hex = hex.replace('#', '');

    // Convert 3-digit to 6-digit
    if (hex.length === 3) {
        hex = hex.split('').map(char => char + char).join('');
    }

    return '#' + hex.toUpperCase();
}

/**
 * Get best text color (black or white) for a background color
 */
export function getTextColor(backgroundColor: string): string {
    const rgb = hexToRgb(backgroundColor);
    if (!rgb) return '#000000';

    const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
}
