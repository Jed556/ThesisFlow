# Animation Quick Reference (Material Design 3)

## Quick Start

### Animate a Page
```tsx
import AnimatedPage from '../components/AnimatedPage/AnimatedPage';

<AnimatedPage variant="slideUp">
    {/* Your content */}
</AnimatedPage>
```

### Animate a List
```tsx
import AnimatedList from '../components/AnimatedList/AnimatedList';

<AnimatedList variant="slideUp" staggerDelay={40}>
    {items.map(item => <ItemCard key={item.id} {...item} />)}
</AnimatedList>
```

### Animate a Dialog
```tsx
import { GrowTransition } from '../components';

<Dialog TransitionComponent={GrowTransition}>
    {/* Dialog content */}
</Dialog>
```

## Material Design 3 Easing

### When to Use Each Easing

- **`emphasizedDecelerate`** - Entering elements ⭐ M3 Recommended
- **`emphasizedAccelerate`** - Exiting elements
- **`emphasized`** - Important transitions
- **`smooth`** - Standard transitions
- **`easeInOut`** - Legacy/compatibility

### Example Usage
```tsx
sx={{
    transition: (theme) => 
        theme.transitions.create(['transform', 'opacity'], {
            duration: theme.transitions.duration.medium1,
            easing: theme.transitions.easing.emphasizedDecelerate,
        })
}}
```

## Animation Variants

### AnimatedPage
- `fade` - Simple fade in
- `slide` - Slide from left
- `slideUp` - Slide from bottom ⭐ Recommended for content pages
- `slideDown` - Slide from top
- `scale` - Scale up from center

### AnimatedList
- `fade` - Simple fade in
- `slideUp` - Slide from bottom ⭐ Recommended
- `slideLeft` - Slide from right
- `scale` - Scale up

### Dialog Transitions
- `FadeTransition` - Simple fade
- `GrowTransition` - Expand from center ⭐ Recommended for forms
- `SlideUpTransition` - Slide from bottom
- `ZoomTransition` - Zoom effect

## M3 Duration Tokens

```tsx
// Use M3 duration tokens
duration: theme.transitions.duration.medium1  // 250ms - Most transitions ⭐
duration: theme.transitions.duration.medium2  // 300ms - Complex transitions
duration: theme.transitions.duration.short3   // 150ms - Quick feedback
duration: theme.transitions.duration.long2    // 500ms - Screen transitions
```

### Duration Guidelines
- **Simple UI changes**: `short3` (150ms)
- **Standard transitions**: `medium1` (250ms) ⭐ Default
- **Complex animations**: `medium3` (350ms)
- **Screen transitions**: `long2` (500ms)

## Common Patterns

### Content Page with Animated Items
```tsx
<AnimatedPage variant="fade">
    <Typography variant="h4">My Page</Typography>
    <AnimatedList variant="slideUp" staggerDelay={50}>
        {data.map(item => <Card key={item.id}>{item.content}</Card>)}
    </AnimatedList>
</AnimatedPage>
```

### Form Dialog (M3 Pattern)
```tsx
<Dialog 
    open={open} 
    onClose={handleClose}
    TransitionComponent={GrowTransition}
>
    <DialogTitle>Edit Item</DialogTitle>
    <DialogContent>{/* form fields */}</DialogContent>
</Dialog>
```

### Custom Animation with theme.transitions.create()
```tsx
<Box
    sx={{
        transition: (theme) => 
            theme.transitions.create(['transform', 'box-shadow'], {
                duration: theme.transitions.duration.medium1,
                easing: theme.transitions.easing.emphasizedDecelerate,
            }),
        '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: 6,
        }
    }}
>
    {content}
</Box>
```

## Tips (Material Design 3)

✅ **DO**
- Use `emphasizedDecelerate` for entering elements (M3 standard)
- Use `medium1` (250ms) for most transitions
- Specify exact properties in `create()` for performance
- Use `GrowTransition` for dialogs (M3 pattern)
- Keep stagger delays 30-60ms

❌ **DON'T**
- Use `'all'` in transitions (bad performance)
- Exceed 600ms duration (feels sluggish)
- Animate layout properties (width, height, margin)
- Stack multiple AnimatedPages
- Use string concatenation for transitions

## M3 Resources

- [M3 Motion Guidelines](https://m3.material.io/styles/motion)
- [M3 Easing & Duration Specs](https://m3.material.io/styles/motion/easing-and-duration/tokens-specs)
- [MUI Theme Transitions](https://mui.com/material-ui/customization/transitions/)

---

For detailed documentation, see [ANIMATIONS.md](../ANIMATIONS.md)
