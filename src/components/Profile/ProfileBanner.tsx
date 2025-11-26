import * as React from 'react';
import { Box, IconButton, CircularProgress } from '@mui/material';
import { alpha, lighten, useTheme } from '@mui/material/styles';
import type { SxProps, Theme } from '@mui/material/styles';
import { PhotoCamera as PhotoCameraIcon } from '@mui/icons-material';

export interface ProfileBannerProps {
    banner?: string | null;
    /** base color used to build gradient background when banner image is absent */
    accentColor?: string;
    /** CSS height/ratio for the banner container (keeps compatibility with existing callers) */
    height?: number | string;
    /** Whether the banner supports inline editing */
    editable?: boolean;
    /** Callback fired when the user selects a new banner image */
    onBannerChange?: (file: File) => void;
    /** Loading flag shown while a banner upload is pending */
    uploading?: boolean;
}

function buildBannerStyles(baseColor: string) {
    const lightShade = lighten(baseColor, 0.35);
    const overlay = alpha(baseColor, 0.2);
    return {
        background: `linear-gradient(135deg, ${lightShade}, ${baseColor})`,
        overlay,
    };
}

export default function ProfileBanner({
    banner, accentColor,
    height = '140px',
    editable = false,
    onBannerChange,
    uploading = false,
}: ProfileBannerProps) {
    const theme = useTheme();
    const baseColor = accentColor ?? theme.palette.primary.main;
    const { background, overlay } = React.useMemo(() => buildBannerStyles(baseColor), [baseColor]);
    const fileInputRef = React.useRef<HTMLInputElement | null>(null);

    // Preload/validate banner URL so we never render a broken-image icon.
    // null = loading, true = valid image, false = invalid/missing -> fallback to gradient
    const [validImage, setValidImage] = React.useState<boolean | null>(() => !!banner || null);
    // Controls the image opacity transition. We flip this to true after an image
    // is determined valid so it can fade in smoothly.
    const [showImage, setShowImage] = React.useState(false);

    React.useEffect(() => {
        if (!banner) {
            setValidImage(false);
            return;
        }

        let cancelled = false;
        setValidImage(null);

        const probe = new Image();
        probe.onload = () => { if (!cancelled) setValidImage(true); };
        probe.onerror = () => { if (!cancelled) setValidImage(false); };
        probe.src = banner;

        return () => {
            cancelled = true;
            probe.onload = null;
            probe.onerror = null;
        };
    }, [banner]);

    // When the banner URL becomes valid, trigger a micro-task to flip showImage
    // to true so the image element can transition its opacity from 0 -> 1.
    React.useEffect(() => {
        if (validImage) {
            // reset then show on next frame to ensure the CSS transition runs
            setShowImage(false);
            const id = window.setTimeout(() => setShowImage(true), 8);
            return () => window.clearTimeout(id);
        }
        setShowImage(false);
    }, [validImage]);

    const editAnchor: SxProps<Theme> = React.useMemo(() => ({
        right: { xs: 12, md: 24 },
        top: { xs: 12, md: 16 },
    }), []);

    const handleChooseBanner = React.useCallback(() => {
        if (!editable || uploading) return;
        fileInputRef.current?.click();
    }, [editable, uploading]);

    const handleBannerInputChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file && onBannerChange) {
            onBannerChange(file);
        }
        event.target.value = '';
    }, [onBannerChange]);

    return (
        <Box sx={{ position: 'relative', height }}>
            {banner && validImage ? (
                <Box
                    component="img"
                    src={banner}
                    sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                        // start hidden and fade in when showImage becomes true
                        opacity: showImage ? 1 : 0,
                        transition: 'opacity 400ms cubic-bezier(.2,.7,.2,1)'
                    }}
                    alt=""
                />
            ) : (
                <Box sx={{ width: '100%', height: '100%', background }} />
            )}

            {/* overlay to tint an image or gradient */}
            <Box sx={{ position: 'absolute', inset: 0, bgcolor: banner ? overlay : 'transparent' }} />

            {editable ? (
                <Box
                    sx={{
                        position: 'absolute',
                        zIndex: 3,
                        display: 'flex',
                        justifyContent: 'flex-end',
                        ...editAnchor,
                    }}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleBannerInputChange}
                        style={{ display: 'none' }}
                        disabled={uploading}
                    />
                    <IconButton
                        color="default"
                        onClick={handleChooseBanner}
                        disabled={uploading}
                        sx={{
                            bgcolor: 'background.paper',
                            '&:hover': { bgcolor: 'background.default' },
                        }}
                        aria-label="Change banner image"
                    >
                        {uploading ? <CircularProgress size={20} /> : <PhotoCameraIcon />}
                    </IconButton>
                </Box>
            ) : null}
        </Box>
    );
}
