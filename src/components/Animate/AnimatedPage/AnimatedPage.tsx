import * as React from 'react';
import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';

interface AnimatedPageProps {
    children: React.ReactNode;
    /**
     * Animation variant
     * @default 'fade'
     */
    variant?: 'fade' | 'slide' | 'scale' | 'slideUp' | 'slideDown';
    /**
     * Animation delay in milliseconds
     * @default 0
     */
    delay?: number;
    /**
     * Animation duration preset
     * @default 'standard'
     */
    duration?: 'shortest' | 'shorter' | 'short' | 'standard' | 'complex' | 'enteringScreen';
}

/**
 * AnimatedPage component provides smooth entrance animations for page content
 * Uses theme-based easing and duration for consistency
 */
export default function AnimatedPage({
    children,
    variant = 'fade',
    delay = 0,
    duration = 'standard',
}: AnimatedPageProps) {
    const theme = useTheme();
    const [isVisible, setIsVisible] = React.useState(false);

    React.useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(true);
        }, delay);

        return () => clearTimeout(timer);
    }, [delay]);

    const getAnimationStyles = () => {
        const baseDuration = theme.transitions.duration[duration];
        // Use emphasizedDecelerate with fallback to easeOut for M3 entering animations
        const easing = (theme.transitions.easing).emphasizedDecelerate || theme.transitions.easing.easeOut;

        const baseStyle = {
            transition: theme.transitions.create(['opacity', 'transform'], {
                duration: baseDuration,
                easing: easing,
            }),
        };

        switch (variant) {
            case 'fade':
                return {
                    ...baseStyle,
                    opacity: isVisible ? 1 : 0,
                };
            case 'slide':
                return {
                    ...baseStyle,
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? 'translateX(0)' : 'translateX(-24px)',
                };
            case 'slideUp':
                return {
                    ...baseStyle,
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? 'translateY(0)' : 'translateY(24px)',
                };
            case 'slideDown':
                return {
                    ...baseStyle,
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? 'translateY(0)' : 'translateY(-24px)',
                };
            case 'scale':
                return {
                    ...baseStyle,
                    opacity: isVisible ? 1 : 0,
                    transform: isVisible ? 'scale(1)' : 'scale(0.95)',
                };
            default:
                return baseStyle;
        }
    };

    return (
        <Box
            sx={{
                height: '100%',
                width: '100%',
                ...getAnimationStyles(),
            }}
        >
            {children}
        </Box>
    );
}
