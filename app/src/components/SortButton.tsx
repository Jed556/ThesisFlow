import * as React from 'react';
import {
    Button,
    Tooltip,
} from '@mui/material';
import {
    ArrowUpward,
    ArrowDownward,
} from '@mui/icons-material';

interface SortButtonProps {
    sortOrder: 'asc' | 'desc';
    onToggle: () => void;
    showIcon?: boolean;
    ascText?: string;
    descText?: string;
    ascTooltip?: string;
    descTooltip?: string;
    size?: 'small' | 'medium' | 'large';
    variant?: 'text' | 'outlined' | 'contained';
}

export function SortButton({
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
