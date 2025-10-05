# Color Picker Component

A comprehensive Material Design color picker component with palette, shades, harmonies, and accessibility features.

## Features

- 🎨 **Material Design Palette**: All 19 standard Material Design color families
- 🎚️ **Shade Variants**: 10 shades (50-900) for each color
- 🌈 **Color Harmonies**: Complementary, Analogous, and Triadic color schemes
- ♿ **Accessibility**: WCAG AA contrast ratio checking and indicators
- 🔄 **Dual Input Modes**: HEX and RGB input support
- 📱 **Dialog Mode**: Can be used inline or in a modal dialog
- 🎯 **Type Safe**: Full TypeScript support with proper types

## Installation

The components are located in:
- `src/components/ColorPicker.tsx` - Main color picker component
- `src/components/ColorPickerDialog.tsx` - Dialog wrapper
- `src/data/materialColorPalette.ts` - Material Design color data
- `src/utils/colorUtils.ts` - Color manipulation utilities

## Usage

### Inline Color Picker

```tsx
import { ColorPicker } from '../components';

function MyComponent() {
    const [color, setColor] = useState('#2196F3');

    return (
        <ColorPicker
            value={color}
            onChange={setColor}
            showHarmonies={true}
            showShades={true}
            showAccessibility={true}
        />
    );
}
```

### Dialog Color Picker

```tsx
import { ColorPickerDialog } from '../components';

function MyComponent() {
    const [color, setColor] = useState('#E91E63');
    const [open, setOpen] = useState(false);

    return (
        <>
            <Button onClick={() => setOpen(true)}>
                Choose Color
            </Button>

            <ColorPickerDialog
                open={open}
                onClose={() => setOpen(false)}
                value={color}
                onConfirm={setColor}
                title="Choose Color"
            />
        </>
    );
}
```

## API Reference

### ColorPicker Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | Required | Current color in hex format (e.g., "#2196F3") |
| `onChange` | `(color: string) => void` | - | Callback when color changes |
| `onSelect` | `(color: string) => void` | - | Callback when color is explicitly selected |
| `showHarmonies` | `boolean` | `true` | Show color harmonies section |
| `showShades` | `boolean` | `true` | Show shade variants section |
| `showAccessibility` | `boolean` | `true` | Show accessibility information |

### ColorPickerDialog Props

Extends `ColorPicker` props with:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `open` | `boolean` | Required | Whether dialog is open |
| `onClose` | `() => void` | Required | Callback when dialog closes |
| `onConfirm` | `(color: string) => void` | Required | Callback when color is confirmed |
| `title` | `string` | `"Choose Color"` | Dialog title |
| `cancelText` | `string` | `"Cancel"` | Cancel button text |
| `confirmText` | `string` | `"Select"` | Confirm button text |

## Features Explained

### Material Design Palette

The picker includes all 19 standard Material Design color families:
- Red, Pink, Purple, Deep Purple, Indigo
- Blue, Light Blue, Cyan, Teal
- Green, Light Green, Lime, Yellow
- Amber, Orange, Deep Orange
- Brown, Grey, Blue Grey

Each color displays the 500 shade by default and can be expanded to show all shades.

### Shade Variants

When a color is selected or entered, the picker generates 10 Material Design shades:
- **50**: Very light (45% lighter)
- **100-400**: Progressive lightening
- **500**: Base color (your selected color)
- **600-900**: Progressive darkening (900 is darkest)

### Color Harmonies

The picker shows three types of color harmonies based on color theory:

1. **Complementary**: Color opposite on the color wheel (180° apart)
2. **Analogous**: Colors adjacent on the color wheel (±30°)
3. **Triadic**: Three colors evenly spaced on the color wheel (120° apart)

### Accessibility Features

The picker automatically calculates:
- **Contrast ratio vs White**: Shows if the color has good contrast with white text
- **Contrast ratio vs Black**: Shows if the color has good contrast with black text
- **WCAG AA Compliance**: Indicates if the color meets WCAG AA standards (≥4.5:1)

Green chips with checkmarks indicate accessible combinations.

## Color Utilities

The `colorUtils.ts` file provides comprehensive color manipulation functions:

### Conversions
```tsx
import { hexToRgb, rgbToHex, rgbToHsl, hslToRgb } from '../utils/colorUtils';

const rgb = hexToRgb('#2196F3'); // { r: 33, g: 150, b: 243 }
const hex = rgbToHex(33, 150, 243); // "#2196F3"
```

### Accessibility
```tsx
import { getContrastRatio, hasGoodContrast, getTextColor } from '../utils/colorUtils';

const ratio = getContrastRatio('#2196F3', '#FFFFFF'); // 3.54
const isAccessible = hasGoodContrast('#2196F3', '#FFFFFF'); // false
const textColor = getTextColor('#2196F3'); // "#FFFFFF"
```

### Material Design Shades
```tsx
import { generateMaterialShades } from '../utils/colorUtils';

const shades = generateMaterialShades('#2196F3');
// { 50: "#E3F2FD", 100: "#BBDEFB", ..., 900: "#0D47A1" }
```

### Color Harmonies
```tsx
import { 
    getComplementaryColor, 
    getAnalogousColors, 
    getTriadicColors 
} from '../utils/colorUtils';

const complementary = getComplementaryColor('#2196F3'); // "#F39C21"
const analogous = getAnalogousColors('#2196F3'); // ["#2196F3", "#2196F3", "#9C21F3"]
const triadic = getTriadicColors('#2196F3'); // ["#2196F3", "#F32196", "#96F321"]
```

## Examples

### Use in Form

```tsx
function ColorFormField() {
    const [color, setColor] = useState('#2196F3');
    const [open, setOpen] = useState(false);

    return (
        <Box>
            <Typography variant="subtitle2">Primary Color</Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Box
                    onClick={() => setOpen(true)}
                    sx={{
                        width: 40,
                        height: 40,
                        bgcolor: color,
                        border: '2px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        cursor: 'pointer',
                    }}
                />
                <TextField
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    size="small"
                />
            </Box>
            <ColorPickerDialog
                open={open}
                onClose={() => setOpen(false)}
                value={color}
                onConfirm={setColor}
            />
        </Box>
    );
}
```

### Theme Customization

```tsx
function ThemeCustomizer() {
    const [primaryColor, setPrimaryColor] = useState('#2196F3');
    const [secondaryColor, setSecondaryColor] = useState('#E91E63');

    return (
        <Box>
            <Typography variant="h6">Customize Theme</Typography>
            
            <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2">Primary Color</Typography>
                <ColorPicker
                    value={primaryColor}
                    onChange={setPrimaryColor}
                    showShades={true}
                />
            </Box>

            <Box>
                <Typography variant="subtitle2">Secondary Color</Typography>
                <ColorPicker
                    value={secondaryColor}
                    onChange={setSecondaryColor}
                    showShades={true}
                />
            </Box>
        </Box>
    );
}
```

## Demo Page

A comprehensive demo page is available at `src/pages/ColorPickerDemo.tsx` showing:
- Inline color picker with live preview
- Dialog color picker with button trigger
- Code examples for both modes

## Algorithm Details

The color picker uses Material Design 2 algorithms for:

1. **Shade Generation**: Based on HSL color space manipulation
   - Lighter shades: Increase lightness by percentage
   - Darker shades: Decrease lightness by percentage

2. **Contrast Calculation**: Uses relative luminance formula from WCAG 2.0
   - Converts RGB to relative luminance (0-1)
   - Calculates contrast ratio: (L1 + 0.05) / (L2 + 0.05)
   - WCAG AA requires ≥4.5:1 for normal text

3. **Color Harmonies**: Based on HSL color wheel
   - Complementary: Rotate hue by 180°
   - Analogous: Rotate hue by ±30°
   - Triadic: Rotate hue by 0°, 120°, 240°

## Browser Support

Works in all modern browsers that support:
- CSS custom properties
- ES6+ JavaScript
- Material-UI v6+

## License

Part of ThesisFlow project.
