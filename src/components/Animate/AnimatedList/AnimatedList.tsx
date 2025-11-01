import * as React from 'react';
import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';

interface AnimatedListProps {
    children: React.ReactNode;
    /**
     * Delay between each item animation in milliseconds
     * @default 50
     */
    staggerDelay?: number;
    /**
     * Initial delay before first item in milliseconds
     * @default 0
     */
    initialDelay?: number;
    /**
     * Animation variant
     * @default 'fade'
     */
    variant?: 'fade' | 'slideUp' | 'slideLeft' | 'scale';
}

/**
 * AnimatedList component provides staggered entrance animations for list items
 * Automatically staggers child elements for a smooth cascading effect
 */
export default function AnimatedList({
    children,
    staggerDelay = 50,
    initialDelay = 0,
    variant = 'fade',
}: AnimatedListProps) {
    const theme = useTheme();
    const [visibleItems, setVisibleItems] = React.useState<Set<number>>(new Set());
    const childrenArray = React.Children.toArray(children);

    React.useEffect(() => {
        childrenArray.forEach((_, index) => {
            const delay = initialDelay + index * staggerDelay;
            setTimeout(() => {
                setVisibleItems((prev) => new Set(prev).add(index));
            }, delay);
        });
    }, [childrenArray.length, initialDelay, staggerDelay]);

    const getItemStyle = (index: number) => {
        const isVisible = visibleItems.has(index);
        const duration = theme.transitions.duration.standard;
        // Use emphasizedDecelerate with fallback to easeOut for M3 entering animations
        const easing = (theme.transitions.easing).emphasizedDecelerate || theme.transitions.easing.easeOut;

        const baseStyle = {
            transition: theme.transitions.create(['opacity', 'transform'], {
                duration: duration,
                easing: easing,
            }),
        };

        switch (variant) {
            case 'fade':
                return {
                    ...baseStyle,
                    opacity: isVisible ? 1 : 0,
                };
            case 'slideUp':
                return {
                    ...baseStyle,
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? 'translateY(0)' : 'translateY(16px)',
                };
            case 'slideLeft':
                return {
                    ...baseStyle,
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? 'translateX(0)' : 'translateX(16px)',
                };
            case 'scale':
                return {
                    ...baseStyle,
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? 'scale(1)' : 'scale(0.9)',
                };
            default:
                return baseStyle;
        }
    };

    return (
        <>
            {childrenArray.map((child, index) => (
                <Box key={index} sx={getItemStyle(index)}>
                    {child}
                </Box>
            ))}
        </>
    );
}
