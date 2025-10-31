import { Button, Tooltip, } from '@mui/material';
import { ArrowUpward, ArrowDownward, } from '@mui/icons-material';

/**
 * Props for the SortButton component
 */
interface SortButtonProps {
    /**
     * Current sort order, either 'asc' for ascending or 'desc' for descending
     * @default 'asc'
     */
    sortOrder: 'asc' | 'desc';
    /**
     * Callback when the sort order is toggled
     */
    onToggle: () => void;
    /**
     * Whether to show the sort icon    
     * @default true
     */
    showIcon?: boolean;
    /**
     * Text to display when sorted in ascending order
     * @default 'Ascending'
     */
    ascText?: string;
    /**
     * Text to display when sorted in descending order
     * @default 'Descending'
     */
    descText?: string;

    /**
     * Tooltip text to display when sorted in ascending order
     * @default 'Currently sorted in ascending order. Click to sort in descending order.'
     */
    ascTooltip?: string;
    /**
     * Tooltip text to display when sorted in descending order
     * @default 'Currently sorted in descending order. Click to sort in ascending order.'
     */
    descTooltip?: string;
    /**
     * Size of the button
     * @default 'small'
     */
    size?: 'small' | 'medium' | 'large';
    /**
     * Button variant
     * @default 'outlined'
     */
    variant?: 'text' | 'outlined' | 'contained';
}


/**
 * Button sorting control with icon and tooltip
 * @param sortOrder - Current sort order, either 'asc' for ascending or 'desc' for descending
 * @param onToggle - Callback when the sort order is toggled
 * @param showIcon - Whether to show the sort icon
 * @param ascText - Text to display when sorted in ascending order
 * @param descText - Text to display when sorted in descending order
 * @param ascTooltip - Tooltip text to display when sorted in ascending order   
 * @param descTooltip - Tooltip text to display when sorted in descending order
 * @param size - Size of the button
 * @param variant - Button variant
 */
export default function SortButton({
    sortOrder,
    onToggle,
    showIcon = true,
    ascText = 'Ascending',
    descText = 'Descending',
    ascTooltip = 'Currently sorted in ascending order. Click to sort in descending order.',
    descTooltip = 'Currently sorted in descending order. Click to sort in ascending order.',
    size = 'small',
    variant = 'outlined'
}: SortButtonProps) {
    const isAscending = sortOrder === 'asc';
    const buttonText = isAscending ? ascText : descText;
    const tooltipText = isAscending ? ascTooltip : descTooltip;
    const icon = showIcon ? (isAscending ? <ArrowUpward /> : <ArrowDownward />) : undefined;

    return (
        <Tooltip title={tooltipText} arrow>
            <Button
                size={size}
                startIcon={icon}
                onClick={onToggle}
                variant={variant}
                sx={{
                    minWidth: 'auto',
                    fontSize: size === 'small' ? '0.75rem' : undefined,
                    px: size === 'small' ? 1.5 : undefined,
                    py: size === 'small' ? 0.5 : undefined,
                }}
            >
                {buttonText}
            </Button>
        </Tooltip>
    );
}
