import * as React from 'react';
import { Fade, Grow, Slide, Zoom } from '@mui/material';
import type { TransitionProps } from '@mui/material/transitions';

interface AnimatedDialogTransitionProps extends TransitionProps {
    children: React.ReactElement;
    /**
     * Animation variant
     * @default 'fade'
     */
    variant?: 'fade' | 'grow' | 'slide' | 'zoom';
}

/**
 * Reusable animated transitions for MUI Dialogs
 * Provides consistent animation behavior across all dialogs
 */
export const FadeTransition = React.forwardRef<unknown, TransitionProps>(
    function FadeTransition(props, ref) {
        const { children, ...other } = props;
        return <Fade ref={ref} {...other} timeout={300}>{children as React.ReactElement}</Fade>;
    }
);

export const GrowTransition = React.forwardRef<unknown, TransitionProps>(
    function GrowTransition(props, ref) {
        const { children, ...other } = props;
        return <Grow ref={ref} {...other} timeout={300}>{children as React.ReactElement}</Grow>;
    }
);

export const SlideUpTransition = React.forwardRef<unknown, TransitionProps>(
    function SlideUpTransition(props, ref) {
        const { children, ...other } = props;
        return <Slide direction="up" ref={ref} {...other} timeout={300}>{children as React.ReactElement}</Slide>;
    }
);

export const ZoomTransition = React.forwardRef<unknown, TransitionProps>(
    function ZoomTransition(props, ref) {
        const { children, ...other } = props;
        return <Zoom ref={ref} {...other} timeout={300}>{children as React.ReactElement}</Zoom>;
    }
);

/**
 * AnimatedDialogTransition provides configurable dialog animations
 * Use this with MUI Dialog's slots.transition prop (e.g., slots={{ transition: GrowTransition }})
 */
export default React.forwardRef<unknown, AnimatedDialogTransitionProps>(
    function AnimatedDialogTransition({ variant = 'fade', ...props }, ref) {
        switch (variant) {
            case 'grow':
                return <GrowTransition ref={ref} {...props} />;
            case 'slide':
                return <SlideUpTransition ref={ref} {...props} />;
            case 'zoom':
                return <ZoomTransition ref={ref} {...props} />;
            case 'fade':
            default:
                return <FadeTransition ref={ref} {...props} />;
        }
    }
);
