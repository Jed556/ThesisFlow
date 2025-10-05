# ThesisFlow Animation System

## Overview

The ThesisFlow application features a comprehensive animation system built on **Material Design 3 (Material You)** principles. All animations follow [M3 motion guidelines](https://m3.material.io/styles/motion) with carefully tuned easing functions and durations for a polished, modern user experience.

## Core Components

### 1. Enhanced Theme Configuration (`theme.ts`)

The theme follows Material Design 3 motion tokens and specifications:

#### Material Design 3 Easing Functions
Following [M3 easing and duration specs](https://m3.material.io/styles/motion/easing-and-duration/tokens-specs):

- **`emphasized`**: `cubic-bezier(0.2, 0.0, 0, 1.0)` - M3's emphasized easing for important transitions
- **`emphasizedDecelerate`**: `cubic-bezier(0.05, 0.7, 0.1, 1.0)` - For entering elements (recommended)
- **`emphasizedAccelerate`**: `cubic-bezier(0.3, 0.0, 0.8, 0.15)` - For exiting elements
- **`smooth`**: `cubic-bezier(0.4, 0.0, 0.2, 1)` - Standard Material easing
- **`legacy`**: `cubic-bezier(0.4, 0.0, 0.6, 1)` - Legacy compatibility

#### Material Design 3 Duration Tokens
Comprehensive duration scale following M3 specifications:

**Short durations (50-200ms):**
- `short1`: 50ms - Extra short for simple transitions
- `short2`: 100ms - Quick state changes
- `short3`: 150ms - Expanding/collapsing
- `short4`: 200ms - Small/simple transitions

**Medium durations (250-400ms):**
- `medium1`: 250ms - Most transitions (recommended)
- `medium2`: 300ms - Complex transitions
- `medium3`: 350ms - Elaborate transitions
- `medium4`: 400ms - Very complex transitions

**Long durations (450-600ms):**
- `long1`: 450ms - Large/complex elements
- `long2`: 500ms - Screen transitions
- `long3`: 550ms - Elaborate screen transitions
- `long4`: 600ms - Full-screen transitions

**Extra long durations (700-1000ms):**
- `extraLong1`: 700ms - Special emphasis
- `extraLong2`: 800ms - Dramatic reveals
- `extraLong3`: 900ms - Complex animations
- `extraLong4`: 1000ms - Page transitions

#### Component Animations (Following M3 Patterns)

All components use `theme.transitions.create()` utility for proper animation composition:

```typescript
transition: theme.transitions.create(['transform', 'box-shadow'], {
    duration: theme.transitions.duration.short,
    easing: theme.transitions.easing.emphasizedDecelerate,
})
```

Enhanced components:
- **Buttons**: Emphasized decelerate for hover, emphasized accelerate for press
- **Cards**: Emphasized easing with elevation on hover
- **Dialogs**: Emphasized decelerate entrance (M3 recommended)
- **Drawers**: Emphasized easing for smooth slide
- **List Items**: Standard easing for navigation feedback
- **Icon Buttons**: Emphasized easing for interactive feedback
- **Chips**: Emphasized easing for hover scale
- **Accordions**: Emphasized easing for expand/collapse

### 2. AnimatedPage Component

**Location**: `src/components/AnimatedPage/AnimatedPage.tsx`

A wrapper component that adds entrance animations to entire page layouts.

#### Props
- `variant` (optional): Animation style
  - `'fade'` - Fade in (default)
  - `'slide'` - Slide from left
  - `'slideUp'` - Slide from bottom
  - `'slideDown'` - Slide from top
  - `'scale'` - Scale up
- `delay` (optional): Delay before animation starts (ms)
- `duration` (optional): Animation duration preset

#### Usage Example
```tsx
import AnimatedPage from '../components/AnimatedPage/AnimatedPage';

export default function MyPage() {
    return (
        <AnimatedPage variant="slideUp" duration="standard">
            {/* Page content */}
        </AnimatedPage>
    );
}
```

### 3. AnimatedList Component

**Location**: `src/components/AnimatedList/AnimatedList.tsx`

Provides staggered entrance animations for list items, creating a cascading effect.

#### Props
- `staggerDelay` (optional): Delay between each item (ms, default: 50)
- `initialDelay` (optional): Delay before first item (ms, default: 0)
- `variant` (optional): Animation style
  - `'fade'` - Fade in (default)
  - `'slideUp'` - Slide from bottom
  - `'slideLeft'` - Slide from right
  - `'scale'` - Scale up

#### Usage Example
```tsx
import AnimatedList from '../components/AnimatedList/AnimatedList';

export default function EventList({ events }) {
    return (
        <AnimatedList variant="slideUp" staggerDelay={40}>
            {events.map(event => (
                <EventCard key={event.id} event={event} />
            ))}
        </AnimatedList>
    );
}
```

### 4. AnimatedDialog Transitions

**Location**: `src/components/AnimatedDialog/AnimatedDialog.tsx`

Reusable transition components for MUI Dialogs.

#### Available Transitions
- `FadeTransition` - Smooth fade in/out
- `GrowTransition` - Expand from center
- `SlideUpTransition` - Slide from bottom
- `ZoomTransition` - Zoom in/out

#### Usage Example
```tsx
import { GrowTransition } from '../components/AnimatedDialog/AnimatedDialog';

<Dialog
    open={open}
    onClose={handleClose}
    TransitionComponent={GrowTransition}
>
    {/* Dialog content */}
</Dialog>
```

## Implementation Details

### Pages with Animations

#### Dashboard (`pages/Dashboard.tsx`)
- Wrapped in `AnimatedPage` with `slideUp` variant
- Content fades and slides in from bottom

#### Calendar (`pages/Calendar.tsx`)
- Page wrapper with `fade` variant
- Event lists use `AnimatedList` with `slideUp` variant and 40ms stagger
- Both calendar view and list view have staggered animations

### Enhanced Components

#### EventCard (`components/EventCard/EventCard.tsx`)
- Hover effect: Slides right 4px with elevated shadow
- Smooth transitions on all state changes
- Maintains accessibility during animations

#### Global Components
All MUI components inherit smooth transitions:
- Color changes (background, text, borders)
- Transform effects (translate, scale, rotate)
- Shadow elevation changes
- Opacity transitions

## Best Practices

### Following Material Design 3 Motion Principles

1. **Use the Right Easing**
   - **Entering elements**: Use `emphasizedDecelerate` (recommended by M3)
   - **Exiting elements**: Use `emphasizedAccelerate`
   - **State changes**: Use `smooth` or standard `easeInOut`
   - **Important transitions**: Use `emphasized`

2. **Duration Guidelines** (M3 Recommendations)
   - **Simple transitions**: 50-150ms (short1-short3)
   - **Standard transitions**: 250-300ms (medium1-medium2) ⭐ Most common
   - **Complex animations**: 350-450ms (medium3-long1)
   - **Screen transitions**: 500-600ms (long2-long4)
   - **Avoid**: Durations over 600ms unless for special emphasis

3. **Use `theme.transitions.create()`**
   ```typescript
   // ✅ DO: Use the create utility
   transition: theme.transitions.create(['transform', 'opacity'], {
       duration: theme.transitions.duration.medium1,
       easing: theme.transitions.easing.emphasizedDecelerate,
   })
   
   // ❌ DON'T: Use string concatenation
   transition: `all 250ms cubic-bezier(0.4, 0, 0.2, 1)`
   ```

4. **Specify Animated Properties**
   ```typescript
   // ✅ DO: List specific properties for better performance
   theme.transitions.create(['transform', 'box-shadow'])
   
   // ❌ DON'T: Use 'all' (causes unnecessary repaints)
   theme.transitions.create('all')
   ```

### When to Use Each Animation

1. **Page Transitions** (`AnimatedPage`)
   - Use `fade` for general page loads
   - Use `slideUp` for content-heavy pages ⭐ Recommended
   - Use `scale` for modal-like pages

2. **List Animations** (`AnimatedList`)
   - Use `slideUp` for vertical lists ⭐ Recommended
   - Use `slideLeft` for horizontal items
   - Keep `staggerDelay` between 30-60ms for best effect
   - Use `fade` for simple lists

3. **Dialog Animations**
   - Use `GrowTransition` for forms and confirmations ⭐ M3 recommended
   - Use `SlideUpTransition` for bottom sheets
   - Use `FadeTransition` for simple notifications
   - Use `ZoomTransition` for emphasis

### Performance Considerations

1. **Hardware Acceleration**
   - All animations use `transform` and `opacity` for GPU acceleration
   - Avoid animating layout properties (width, height, top, left, margin, padding)
   - Use `theme.transitions.create()` to specify only needed properties

2. **M3 Duration Guidelines**
   - Most UI transitions: 250-300ms (medium1-medium2)
   - Keep interactions snappy: under 350ms
   - Use longer durations (400ms+) sparingly for emphasis
   - Never exceed 600ms unless for full-screen transitions

3. **Stagger Timing**
   - Keep stagger delays between 30-60ms
   - Reduce stagger for long lists (>10 items)
   - Consider disabling on lower-end devices

4. **Optimization Tips**
   - Animate only visible elements
   - Use `will-change` sparingly (MUI handles this)
   - Test on low-end devices
   - Monitor performance with DevTools

### Accessibility

All animations respect user preferences:
- Respects `prefers-reduced-motion` media query (implemented in MUI)
- Maintains focus management during transitions
- Preserves keyboard navigation
- Ensures content is never hidden due to animation

## Customization

### Adding New Easing Functions

Edit `theme.ts` to add custom easing:

```typescript
transitions: {
    easing: {
        // ... existing
        myCustomEase: "cubic-bezier(0.4, 0, 0.2, 1)",
    }
}
```

Don't forget to extend the type definition:

```typescript
declare module '@mui/material/styles' {
    interface Easing {
        myCustomEase?: string;
    }
}
```

### Adding New Duration Presets

```typescript
transitions: {
    duration: {
        // ... existing
        myCustomDuration: 450,
    }
}
```

And extend the type:

```typescript
declare module '@mui/material/styles' {
    interface Duration {
        myCustomDuration?: number;
    }
}
```

### Customizing Component Animations

Override MUI component styles in `theme.ts`:

```typescript
components: {
    MuiButton: {
        styleOverrides: {
            root: {
                transition: `all ${theme.transitions.duration.shorter}ms ${theme.transitions.easing.easeInOut}`,
                '&:hover': {
                    // Custom hover animation
                }
            }
        }
    }
}
```

## Testing

To verify animations are working:

1. **Page Transitions**: Navigate between pages and observe entrance effects
2. **List Animations**: Open Calendar page and watch events cascade in
3. **Hover Effects**: Hover over EventCards, buttons, and interactive elements
4. **Dialog Animations**: Open/close dialogs to see transition effects
5. **Responsive Behavior**: Resize window to ensure animations adapt smoothly

## Future Enhancements

Potential additions to the animation system:

1. **Route Transition Animations**: Animate between page routes
2. **Loading Skeletons**: Animated placeholders during data fetch
3. **Micro-interactions**: Enhanced feedback for form inputs
4. **Gesture Animations**: Swipe-to-delete, drag-to-reorder
5. **Data Visualization**: Animated charts and graphs
6. **Notification System**: Toast notifications with animations
7. **Theme Switching**: Smooth color transitions when switching themes

## Browser Support

All animations are fully supported in:
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Modern mobile browsers

Fallbacks are provided for older browsers through MUI's built-in polyfills.

---

**Version**: 1.0.0  
**Last Updated**: January 2025  
**Maintainer**: ThesisFlow Development Team
