import { deepmerge } from '@mui/utils';
import { createTheme } from '@mui/material/styles';

// Extend MUI theme types to include custom animation properties
declare module '@mui/material/styles' {
    interface Palette {
        tertiary: Palette['primary'];
    }
    interface PaletteOptions {
        tertiary?: PaletteOptions['primary'];
    }
    interface Easing {
        // Material Design 3 easings
        smooth?: string;
        emphasized?: string;
        emphasizedDecelerate?: string;
        emphasizedAccelerate?: string;
        legacy?: string;
    }
    interface Duration {
        // Material Design 3 duration tokens
        short1?: number;
        short2?: number;
        short3?: number;
        short4?: number;
        medium1?: number;
        medium2?: number;
        medium3?: number;
        medium4?: number;
        long1?: number;
        long2?: number;
        long3?: number;
        long4?: number;
        extraLong1?: number;
        extraLong2?: number;
        extraLong3?: number;
        extraLong4?: number;
    }
}

/**
 * Base application theme
 */
const base = createTheme({
    cssVariables: {
        colorSchemeSelector: 'data-toolpad-color-scheme',
    },
    colorSchemes: {
        light: {
            palette: {
                mode: 'light',
                common: {
                    black: '#000',
                    white: '#fff'
                },
                primary: {
                    main: '#1976d2',
                    light: '#42a5f5',
                    dark: '#1565c0',
                    contrastText: '#fff'
                },
                secondary: {
                    main: '#9c27b0',
                    light: '#ba68c8',
                    dark: '#7b1fa2',
                    contrastText: '#fff'
                },
                tertiary: {
                    main: '#7c4dff',
                    light: '#b47cff',
                    dark: '#3f1dcb',
                    contrastText: '#fff'
                },
                error: {
                    main: '#d32f2f',
                    light: '#ef5350',
                    dark: '#c62828',
                    contrastText: '#fff'
                },
                warning: {
                    main: '#ed6c02',
                    light: '#ff9800',
                    dark: '#e65100',
                    contrastText: '#fff'
                },
                info: {
                    main: '#0288d1',
                    light: '#03a9f4',
                    dark: '#01579b',
                    contrastText: '#fff'
                },
                success: {
                    main: '#2e7d32',
                    light: '#4caf50',
                    dark: '#1b5e20',
                    contrastText: '#fff'
                },
                grey: {
                    50: '#fafafa',
                    100: '#f5f5f5',
                    200: '#eeeeee',
                    300: '#e0e0e0',
                    400: '#bdbdbd',
                    500: '#9e9e9e',
                    600: '#757575',
                    700: '#616161',
                    800: '#424242',
                    900: '#212121',
                    A100: '#f5f5f5',
                    A200: '#eeeeee',
                    A400: '#bdbdbd',
                    A700: '#616161'
                },
                contrastThreshold: 3,
                tonalOffset: 0.2,
                text: {
                    primary: 'rgba(0, 0, 0, 0.87)',
                    secondary: 'rgba(0, 0, 0, 0.6)',
                    disabled: 'rgba(0, 0, 0, 0.38)'
                },
                divider: 'rgba(0, 0, 0, 0.12)',
                background: {
                    paper: '#fff',
                    default: '#fff'
                },
                action: {
                    active: 'rgba(0, 0, 0, 0.54)',
                    hover: 'rgba(0, 0, 0, 0.04)',
                    hoverOpacity: 0.04,
                    selected: 'rgba(0, 0, 0, 0.08)',
                    selectedOpacity: 0.08,
                    disabled: 'rgba(0, 0, 0, 0.26)',
                    disabledBackground: 'rgba(0, 0, 0, 0.12)',
                    disabledOpacity: 0.38,
                    focus: 'rgba(0, 0, 0, 0.12)',
                    focusOpacity: 0.12,
                    activatedOpacity: 0.12
                }
            }
        },
        dark: {
            palette: {
                mode: 'dark',
                common: {
                    black: '#000',
                    white: '#fff'
                },
                primary: {
                    main: '#90caf9',
                    light: '#e3f2fd',
                    dark: '#42a5f5',
                    contrastText: 'rgba(0, 0, 0, 0.87)'
                },
                secondary: {
                    main: '#ce93d8',
                    light: '#f3e5f5',
                    dark: '#ab47bc',
                    contrastText: 'rgba(0, 0, 0, 0.87)'
                },
                tertiary: {
                    main: '#bb86fc',
                    light: '#e7b9ff',
                    dark: '#8858c8',
                    contrastText: 'rgba(0, 0, 0, 0.87)'
                },
                error: {
                    main: '#f44336',
                    light: '#e57373',
                    dark: '#d32f2f',
                    contrastText: '#fff'
                },
                warning: {
                    main: '#ffa726',
                    light: '#ffb74d',
                    dark: '#f57c00',
                    contrastText: 'rgba(0, 0, 0, 0.87)'
                },
                info: {
                    main: '#29b6f6',
                    light: '#4fc3f7',
                    dark: '#0288d1',
                    contrastText: 'rgba(0, 0, 0, 0.87)'
                },
                success: {
                    main: '#66bb6a',
                    light: '#81c784',
                    dark: '#388e3c',
                    contrastText: 'rgba(0, 0, 0, 0.87)'
                },
                grey: {
                    50: '#fafafa',
                    100: '#f5f5f5',
                    200: '#eeeeee',
                    300: '#e0e0e0',
                    400: '#bdbdbd',
                    500: '#9e9e9e',
                    600: '#757575',
                    700: '#616161',
                    800: '#424242',
                    900: '#212121',
                    A100: '#f5f5f5',
                    A200: '#eeeeee',
                    A400: '#bdbdbd',
                    A700: '#616161'
                },
                contrastThreshold: 3,
                tonalOffset: 0.2,
                text: {
                    primary: '#fff',
                    secondary: 'rgba(255, 255, 255, 0.7)',
                    disabled: 'rgba(255, 255, 255, 0.5)',
                },
                divider: 'rgba(255, 255, 255, 0.12)',
                background: {
                    paper: '#0f0f0f',
                    default: '#0f0f0f'
                },
                action: {
                    active: '#fff',
                    hover: 'rgba(255, 255, 255, 0.08)',
                    hoverOpacity: 0.08,
                    selected: 'rgba(255, 255, 255, 0.16)',
                    selectedOpacity: 0.16,
                    disabled: 'rgba(255, 255, 255, 0.3)',
                    disabledBackground: 'rgba(255, 255, 255, 0.12)',
                    disabledOpacity: 0.38,
                    focus: 'rgba(255, 255, 255, 0.12)',
                    focusOpacity: 0.12,
                    activatedOpacity: 0.24
                }
            }
        }
    },
    breakpoints: {
        values: {
            xs: 0,
            sm: 600,
            md: 900,
            lg: 1200,
            xl: 1536,
        },
    },
    shape: {
        borderRadius: 8
    },
    shadows: [
        'none',
        '0px 2px 1px -1px rgba(0,0,0,0.2),0px 1px 1px 0pxrgba(0,0,0,0.14),0px 1px 3px 0px rgba(0,0,0,0.12)',
        '0px 3px 1px -2px rgba(0,0,0,0.2),0px 2px 2px 0pxrgba(0,0,0,0.14),0px 1px 5px 0px rgba(0,0,0,0.12)',
        '0px 3px 3px -2px rgba(0,0,0,0.2),0px 3px 4px 0pxrgba(0,0,0,0.14),0px 1px 8px 0px rgba(0,0,0,0.12)',
        '0px 2px 4px -1px rgba(0,0,0,0.2),0px 4px 5px 0pxrgba(0,0,0,0.14),0px 1px 10px 0px rgba(0,0,0,0.12)',
        '0px 3px 5px -1px rgba(0,0,0,0.2),0px 5px 8px 0pxrgba(0,0,0,0.14),0px 1px 14px 0px rgba(0,0,0,0.12)',
        '0px 3px 5px -1px rgba(0,0,0,0.2),0px 6px 10px 0pxrgba(0,0,0,0.14),0px 1px 18px 0px rgba(0,0,0,0.12)',
        '0px 4px 5px -2px rgba(0,0,0,0.2),0px 7px 10px 1pxrgba(0,0,0,0.14),0px 2px 16px 1px rgba(0,0,0,0.12)',
        '0px 5px 5px -3px rgba(0,0,0,0.2),0px 8px 10px 1pxrgba(0,0,0,0.14),0px 3px 14px 2px rgba(0,0,0,0.12)',
        '0px 5px 6px -3px rgba(0,0,0,0.2),0px 9px 12px 1pxrgba(0,0,0,0.14),0px 3px 16px 2px rgba(0,0,0,0.12)',
        '0px 6px 6px -3px rgba(0,0,0,0.2),0px 10px 14px 1pxrgba(0,0,0,0.14),0px 4px 18px 3px rgba(0,0,0,0.12)',
        '0px 6px 7px -4px rgba(0,0,0,0.2),0px 11px 15px 1pxrgba(0,0,0,0.14),0px 4px 20px 3px rgba(0,0,0,0.12)',
        '0px 7px 8px -4px rgba(0,0,0,0.2),0px 12px 17px 2pxrgba(0,0,0,0.14),0px 5px 22px 4px rgba(0,0,0,0.12)',
        '0px 7px 8px -4px rgba(0,0,0,0.2),0px 13px 19px 2pxrgba(0,0,0,0.14),0px 5px 24px 4px rgba(0,0,0,0.12)',
        '0px 7px 9px -4px rgba(0,0,0,0.2),0px 14px 21px 2pxrgba(0,0,0,0.14),0px 5px 26px 4px rgba(0,0,0,0.12)',
        '0px 8px 9px -5px rgba(0,0,0,0.2),0px 15px 22px 2pxrgba(0,0,0,0.14),0px 6px 28px 5px rgba(0,0,0,0.12)',
        '0px 8px 10px -5px rgba(0,0,0,0.2),0px 16px 24px 2pxrgba(0,0,0,0.14),0px 6px 30px 5px rgba(0,0,0,0.12)',
        '0px 8px 11px -5px rgba(0,0,0,0.2),0px 17px 26px 2pxrgba(0,0,0,0.14),0px 6px 32px 5px rgba(0,0,0,0.12)',
        '0px 9px 11px -5px rgba(0,0,0,0.2),0px 18px 28px 2pxrgba(0,0,0,0.14),0px 7px 34px 6px rgba(0,0,0,0.12)',
        '0px 9px 12px -6px rgba(0,0,0,0.2),0px 19px 29px 2pxrgba(0,0,0,0.14),0px 7px 36px 6px rgba(0,0,0,0.12)',
        '0px 10px 13px -6px rgba(0,0,0,0.2),0px 20px 31px 3pxrgba(0,0,0,0.14),0px 8px 38px 7px rgba(0,0,0,0.12)',
        '0px 10px 13px -6px rgba(0,0,0,0.2),0px 21px 33px 3pxrgba(0,0,0,0.14),0px 8px 40px 7px rgba(0,0,0,0.12)',
        '0px 10px 14px -6px rgba(0,0,0,0.2),0px 22px 35px 3pxrgba(0,0,0,0.14),0px 8px 42px 7px rgba(0,0,0,0.12)',
        '0px 11px 14px -7px rgba(0,0,0,0.2),0px 23px 36px 3pxrgba(0,0,0,0.14),0px 9px 44px 8px rgba(0,0,0,0.12)',
        '0px 11px 15px -7px rgba(0,0,0,0.2),0px 24px 38px 3pxrgba(0,0,0,0.14),0px 9px 46px 8px rgba(0,0,0,0.12)'
    ],
    typography: {
        htmlFontSize: 16,
        fontFamily: 'Roboto, Helvetica, Arial, sans-serif',
        fontSize: 14,
        fontWeightLight: 300,
        fontWeightRegular: 400,
        fontWeightMedium: 500,
        fontWeightBold: 700,
        h1: {
            fontFamily: 'Roboto, Helvetica, Arial, sans-serif',
            fontWeight: 300,
            fontSize: '6rem',
            lineHeight: 1.167,
            letterSpacing: '-0.01562em'
        },
        h2: {
            fontFamily: 'Roboto, Helvetica, Arial, sans-serif',
            fontWeight: 300,
            fontSize: '3.75rem',
            lineHeight: 1.2,
            letterSpacing: '-0.00833em'
        },
        h3: {
            fontFamily: 'Roboto, Helvetica, Arial, sans-serif',
            fontWeight: 400,
            fontSize: '3rem',
            lineHeight: 1.167,
            letterSpacing: '0em'
        },
        h4: {
            fontFamily: 'Roboto, Helvetica, Arial, sans-serif',
            fontWeight: 400,
            fontSize: '2.125rem',
            lineHeight: 1.235,
            letterSpacing: '0.00735em'
        },
        h5: {
            fontFamily: 'Roboto, Helvetica, Arial, sans-serif',
            fontWeight: 400,
            fontSize: '1.5rem',
            lineHeight: 1.334,
            letterSpacing: '0em'
        },
        h6: {
            fontFamily: 'Roboto, Helvetica, Arial, sans-serif',
            fontWeight: 500,
            fontSize: '1.25rem',
            lineHeight: 1.6,
            letterSpacing: '0.0075em'
        },
        subtitle1: {
            fontFamily: 'Roboto, Helvetica, Arial, sans-serif',
            fontWeight: 400,
            fontSize: '1rem',
            lineHeight: 1.75,
            letterSpacing: '0.00938em'
        },
        subtitle2: {
            fontFamily: 'Roboto, Helvetica, Arial, sans-serif',
            fontWeight: 500,
            fontSize: '0.875rem',
            lineHeight: 1.57,
            letterSpacing: '0.00714em'
        },
        body1: {
            fontFamily: 'Roboto, Helvetica, Arial, sans-serif',
            fontWeight: 400,
            fontSize: '1rem',
            lineHeight: 1.5,
            letterSpacing: '0.00938em'
        },
        body2: {
            fontFamily: 'Roboto, Helvetica, Arial, sans-serif',
            fontWeight: 400,
            fontSize: '0.875rem',
            lineHeight: 1.43,
            letterSpacing: '0.01071em'
        },
        button: {
            fontFamily: 'Roboto, Helvetica, Arial, sans-serif',
            fontWeight: 500,
            fontSize: '0.875rem',
            lineHeight: 1.75,
            letterSpacing: '0.02857em',
            textTransform: 'uppercase'
        },
        caption: {
            fontFamily: 'Roboto, Helvetica, Arial, sans-serif',
            fontWeight: 400,
            fontSize: '0.75rem',
            lineHeight: 1.66,
            letterSpacing: '0.03333em'
        },
        overline: {
            fontFamily: 'Roboto, Helvetica, Arial, sans-serif',
            fontWeight: 400,
            fontSize: '0.75rem',
            lineHeight: 2.66,
            letterSpacing: '0.08333em',
            textTransform: 'uppercase'
        },
    },
    transitions: {
        easing: {
            // Standard Material Design easings
            easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
            easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
            easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
            sharp: 'cubic-bezier(0.4, 0, 0.6, 1)',
            // Material Design 3 (M3) motion easings
            // https://m3.material.io/styles/motion/easing-and-duration/tokens-specs
            smooth: 'cubic-bezier(0.4, 0.0, 0.2, 1)', // Standard easing
            emphasized: 'cubic-bezier(0.2, 0.0, 0, 1.0)', // Emphasized easing for important transitions
            emphasizedDecelerate: 'cubic-bezier(0.05, 0.7, 0.1, 1.0)', // Entering elements
            emphasizedAccelerate: 'cubic-bezier(0.3, 0.0, 0.8, 0.15)', // Exiting elements
            legacy: 'cubic-bezier(0.4, 0.0, 0.6, 1)', // Legacy standard for compatibility
        },
        duration: {
            // Basic durations
            shortest: 150,
            shorter: 200,
            short: 250,
            standard: 300,
            complex: 375,
            enteringScreen: 225,
            leavingScreen: 195,
            // Material Design 3 duration tokens
            // https://m3.material.io/styles/motion/easing-and-duration/tokens-specs
            short1: 50,   // Extra short for simple transitions
            short2: 100,  // Short for quick state changes
            short3: 150,  // Short for expanding/collapsing
            short4: 200,  // Short for small/simple
            medium1: 250, // Medium for most transitions
            medium2: 300, // Medium for complex transitions
            medium3: 350, // Medium for elaborate transitions
            medium4: 400, // Medium for very complex transitions
            long1: 450,   // Long for large/complex elements
            long2: 500,   // Long for screen transitions
            long3: 550,   // Long for elaborate screen transitions
            long4: 600,   // Long for full-screen transitions
            extraLong1: 700, // Extra long for special emphasis
            extraLong2: 800, // Extra long for dramatic reveals
            extraLong3: 900, // Extra long for complex animations
            extraLong4: 1000, // Extra long for page transitions
        }
    },
    zIndex: {
        mobileStepper: 1000,
        fab: 1050,
        speedDial: 1050,
        appBar: 1100,
        drawer: 1200,
        modal: 1300,
        snackbar: 1400,
        tooltip: 1500
    },
});

/**
 * Component style overrides
 */
const components = {
    MuiCssBaseline: {
        styleOverrides: {
            html: { height: '100%' },
            body: {
                height: '100%',
                overflow: 'hidden',
            },
            '#root': {
                height: '100%',
            },
            '.rdp-root': {
                '--rdp-accent-color': base.palette?.primary?.main,
            },
        },
    },
    MuiTypography: {
        styleOverrides: {
            root: {
                cursor: 'default',
            },
        },
    },
    MuiTextField: {
        styleOverrides: {
            root: {
                '& input': { cursor: 'text' },
                '& .MuiOutlinedInput-root': {
                    transition: base.transitions.create(['border-color', 'box-shadow'], {
                        duration: base.transitions.duration.short,
                        easing: base.transitions.easing.easeInOut,
                    }),
                    '&:hover:not(.Mui-disabled) .MuiOutlinedInput-notchedOutline': {
                        borderColor: base.palette?.primary?.main,
                    },
                    '&.Mui-focused': {
                        transition: base.transitions.create(['border-color', 'box-shadow'], {
                            duration: base.transitions.duration.short,
                            easing: base.transitions.easing.emphasizedDecelerate,
                        }),
                    },
                },
            },
        },
    },
    MuiOutlinedInput: {
        styleOverrides: {
            root: {
                transition: base.transitions.create(['border-color', 'background-color'], {
                    duration: base.transitions.duration.short,
                    easing: base.transitions.easing.easeInOut,
                }),
                '&:hover:not(.Mui-disabled) .MuiOutlinedInput-notchedOutline': {
                    transition: base.transitions.create(['border-color'], {
                        duration: base.transitions.duration.short,
                        easing: base.transitions.easing.emphasizedDecelerate,
                    }),
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    transition: base.transitions.create(['border-color', 'border-width'], {
                        duration: base.transitions.duration.short,
                        easing: base.transitions.easing.emphasizedDecelerate,
                    }),
                },
            },
            notchedOutline: {
                transition: base.transitions.create(['border-color', 'border-width'], {
                    duration: base.transitions.duration.short,
                    easing: base.transitions.easing.easeInOut,
                }),
            },
        },
    },
    MuiInputBase: {
        styleOverrides: {
            root: {
                transition: base.transitions.create(['border-color', 'background-color'], {
                    duration: base.transitions.duration.short,
                    easing: base.transitions.easing.easeInOut,
                }),
                '&.Mui-focused': {
                    transition: base.transitions.create(['border-color', 'background-color'], {
                        duration: base.transitions.duration.short,
                        easing: base.transitions.easing.emphasizedDecelerate,
                    }),
                },
            },
        },
    },
    MuiButton: {
        styleOverrides: {
            root: {
                transition: base.transitions.create(
                    ['background-color', 'box-shadow', 'transform'],
                    {
                        duration: base.transitions.duration.short,
                        easing: base.transitions.easing.emphasizedDecelerate,
                    }
                ),
                '&:hover': {
                    // transform: 'translateY(-1px)',
                    boxShadow: base.shadows?.[4],
                },
                '&:active': {
                    transform: 'translateY(0)',
                    transition: base.transitions.create('transform', {
                        duration: base.transitions.duration.shortest,
                        easing: base.transitions.easing.emphasizedAccelerate,
                    }),
                },
            },
        },
    },
    MuiPaper: {
        styleOverrides: {
            root: {
                transition: base.transitions.create(['box-shadow', 'transform', 'width', 'height'], {
                    duration: base.transitions.duration.short,
                    easing: base.transitions.easing.easeInOut,
                }),
                borderRadius: base.shape?.borderRadius ?? 8,
            },
        },
    },
    MuiCard: {
        styleOverrides: {
            root: {
                transition: base.transitions.create(['box-shadow', 'transform', 'width', 'height'], {
                    duration: base.transitions.duration.short,
                    easing: base.transitions.easing.emphasized,
                }),
                '&:hover': {
                    // transform: 'translateY(-2px)',
                    boxShadow: base.shadows?.[8],
                },
            },
        },
    },
    MuiDialog: {
        styleOverrides: {
            root: {
                '& .MuiBackdrop-root': {
                    transition: base.transitions.create('opacity', {
                        duration: base.transitions.duration.enteringScreen,
                        easing: base.transitions.easing.easeInOut,
                    }),
                },
            },
            paper: {
                transition: base.transitions.create(['transform', 'opacity'], {
                    duration: base.transitions.duration.medium2,
                    easing: base.transitions.easing.emphasizedDecelerate,
                }),
            },
        },
    },
    MuiDrawer: {
        styleOverrides: {
            paper: {
                transition: base.transitions.create('transform', {
                    duration: base.transitions.duration.enteringScreen,
                    easing: base.transitions.easing.emphasized,
                }) + ' !important',
                // Target only the first direct child Box component inside Drawer
                '& > .MuiBox-root:first-of-type': {
                    paddingTop: 0,
                    paddingBottom: base.spacing(2),
                    paddingLeft: base.spacing(2),
                    paddingRight: base.spacing(2),
                },
            },
        },
    },
    MuiList: {
        styleOverrides: {
            root: {
                marginTop: base.spacing(1),
                gap: base.spacing(1),
                transition: base.transitions.create(['width'], {
                    duration: base.transitions.duration.shorter,
                    easing: base.transitions.easing.easeInOut,
                })
            },
        },
    },
    MuiListItem: {
        styleOverrides: {
            root: {
                height: 'auto',
                overflow: 'hidden',
                marginBottom: base.spacing(0.5),
                // Add top margin to first ListItem not preceded by a ListSubheader & not nested inside collapsed sections or other ListItems
                // eslint-disable-next-line max-len
                '&:first-of-type:not(.MuiListSubheader-root + *):not(.MuiListItem-root .MuiListItem-root):not(.MuiCollapse-root .MuiListItem-root)': {
                    marginTop: base.spacing(2),
                },
            },
        },
    },
    MuiListItemButton: {
        styleOverrides: {
            root: {
                height: 'auto',
                transition: base.transitions.create(['background-color', 'transform'], {
                    duration: base.transitions.duration.shorter,
                    easing: base.transitions.easing.easeInOut,
                }),
                '&:hover': {
                    transform: 'scale(1.02) translateX(1px)',
                },
            },
        },
    },
    MuiAccordion: {
        styleOverrides: {
            root: {
                marginTop: base.spacing(1),
                marginBottom: base.spacing(1),
                borderRadius: base.shape?.borderRadius ?? 8,
                '&:before, &:after': { display: 'none' },
                boxShadow: base.shadows?.[3] ?? 'none',
                transition: base.transitions.create(['margin', 'box-shadow'], {
                    duration: base.transitions.duration.standard,
                    easing: base.transitions.easing.emphasized,
                }),
                '&.Mui-expanded': {
                    marginTop: base.spacing(1),
                    marginBottom: base.spacing(1),
                    minHeight: 80,
                },
                '&:first-of-type, &:last-of-type': {
                    borderRadius: base.shape?.borderRadius ?? 8,
                },
                '&:first-of-type': {
                    marginTop: 0,
                },
            },
        },
    },
    MuiAccordionSummary: {
        styleOverrides: {
            root: {
                backgroundColor: base.palette?.background?.paper,
                borderRadius: base.shape?.borderRadius ?? 8,
                position: 'sticky',
                top: 0,
                zIndex: (base.zIndex?.appBar ?? 1100) - 1,
                cursor: 'pointer',
                minHeight: 80,
                transition: base.transitions.create('background-color', {
                    duration: base.transitions.duration.shorter,
                    easing: base.transitions.easing.easeInOut,
                }),
                '& .MuiTypography-root': {
                    cursor: 'pointer',
                },
                '&.Mui-expanded': {
                    minHeight: 80,
                },
                '& .MuiAccordionSummary-content': {
                    margin: 0,
                    '&.Mui-expanded': {
                        minHeight: 80,
                    },
                },
            },
        },
    },
    MuiChip: {
        styleOverrides: {
            root: {
                transition: base.transitions.create(['transform', 'box-shadow'], {
                    duration: base.transitions.duration.short,
                    easing: base.transitions.easing.emphasized,
                }),
                // '&:hover': {
                //     transform: 'scale(1.05)',
                // },
            },
        },
    },
    MuiIconButton: {
        styleOverrides: {
            root: {
                transition: base.transitions.create('transform', {
                    duration: base.transitions.duration.shortest,
                    easing: base.transitions.easing.emphasized,
                }),
                '&:hover': {
                    transform: 'scale(1.1)',
                },
                '&:active': {
                    transform: 'scale(0.95)',
                },
            },
        },
    },
    MuiTableRow: {
        styleOverrides: {
            root: {
                transition: base.transitions.create('background-color', {
                    duration: base.transitions.duration.shorter,
                    easing: base.transitions.easing.easeInOut,
                }),
            },
        },
    },
    MuiAlert: {
        styleOverrides: {
            root: {
                transition: base.transitions.create(['opacity', 'transform'], {
                    duration: base.transitions.duration.standard,
                    easing: base.transitions.easing.emphasizedDecelerate,
                }),
            },
        },
    },
};

const theme = createTheme(deepmerge(base, { components }));

export default theme;
