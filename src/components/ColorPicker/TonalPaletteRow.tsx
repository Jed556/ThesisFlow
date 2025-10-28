import { Box, Typography, Stack, Tooltip } from '@mui/material';
import { hexFromArgb } from '@material/material-color-utilities';
import { getTextColor } from '../../utils/colorUtils';

const TONAL_STEPS: readonly number[] = [100, 95, 90, 80, 70, 60, 50, 40, 30, 20, 10, 0] as const;

interface TonalPaletteRowProps {
    label: string;
    palette: {
        tone: (tone: number) => number;
    };
    onSelect: (color: string) => void;
}

/**
 * Displays a row of tonal color steps for a Material 3 palette
 */
export function TonalPaletteRow({ label, palette, onSelect }: TonalPaletteRowProps) {
    return (
        <Box>
            <Typography variant="caption" color="text.secondary">
                {label} tonal steps
            </Typography>
            <Stack
                direction="row"
                spacing={0.5}
                sx={{ mt: 0.5, overflowX: 'auto', pb: 0.5 }}
            >
                {TONAL_STEPS.map((tone) => {
                    const toneColor = hexFromArgb(palette.tone(tone));
                    return (
                        <Tooltip key={tone} title={`T${tone} • ${toneColor}`}>
                            <Box
                                onClick={() => onSelect(toneColor)}
                                sx={{
                                    width: 44,
                                    height: 44,
                                    bgcolor: toneColor,
                                    borderRadius: 1,
                                    border: '1px solid',
                                    borderColor: tone >= 50 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.3)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                    '&:hover': {
                                        transform: 'translateY(-2px)',
                                        boxShadow: 3,
                                    },
                                }}
                            >
                                <Typography
                                    variant="caption"
                                    sx={{ color: getTextColor(toneColor), fontSize: 10, fontWeight: 600 }}
                                >
                                    {tone}
                                </Typography>
                            </Box>
                        </Tooltip>
                    );
                })}
            </Stack>
        </Box>
    );
}
