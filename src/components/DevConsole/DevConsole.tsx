import * as React from 'react';
import { Box, Paper, IconButton, Collapse, Divider, Button, Tooltip, InputBase } from '@mui/material';
import { ExpandMore, ClearAll, Send, VerticalAlignBottom } from '@mui/icons-material';
import { formatLogTimestamp, useTick } from '../../utils/dateUtils';

export interface DevConsoleProps {
    logs: string[];
    onSend: (input: string) => void;
    onClear?: () => void;
    defaultExpanded?: boolean;
    showSendButton?: boolean;
    /** If true, console will auto-scroll to bottom when the logs change. Also enables the UI toggle. Defaults to true. */
    autoScroll?: boolean;
    /** Use 'short' or 'long' relative time style. Default 'long' */
    relativeStyle?: 'short' | 'long';
    /** If true and style='short' or 'long', show seconds for sub-minute values */
    relativeShowSeconds?: boolean;
    relativeRealTime?: boolean; // if true, relative times update in real-time; if false, they are static
    relativeOmitAgo?: boolean; // if true, omit the 'ago' suffix in relative times
}

export default function DevConsole(
    { logs,
        onSend,
        onClear,
        defaultExpanded = false,
        showSendButton = false,
        autoScroll = true,
        relativeStyle = 'short',
        relativeShowSeconds = false,
        relativeRealTime = true
    }: DevConsoleProps) {
    const [expanded, setExpanded] = React.useState<boolean>(defaultExpanded);
    const [input, setInput] = React.useState('');
    const [autoScrollEnabled, setAutoScrollEnabled] = React.useState<boolean>(() => {
        try {
            const raw = localStorage.getItem('devconsole.autoscroll');
            if (raw !== null) return JSON.parse(raw) as boolean;
        } catch {
            // ignore
        }
        return autoScroll;
    });
    const logsRef = React.useRef<HTMLDivElement | null>(null);
    const [logTimes, setLogTimes] = React.useState<Date[]>(() => logs.map(() => new Date()));
    // Get a single ticking 'now' from the hook. We convert the component's `relativeRealTime`
    // prop to the hook's `conservative` parameter: when relativeRealTime is true we want
    // aggressive continuous ticks (conservative=false). When false we use conservative mode
    // which degrades frequency over time.
    const now = useTick(!relativeRealTime, 1);

    // Try to extract an ISO timestamp from the log text (e.g. 2025-09-28T12:34:56Z)
    const extractIsoTimestamp = (text: string): Date | null => {
        const isoRe = /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)/;
        const m = text.match(isoRe);
        if (m && m[1]) {
            const d = new Date(m[1]);
            if (!isNaN(d.getTime())) return d;
        }
        // fallback: look for ThesisFlow date format like 'YYYY-MM-DD at H:MM AM/PM'
        try {
            // the parseThesisDate is robust; try to import dynamically to avoid circulars
            // but we can attempt a Date parse as a last resort
            const d2 = new Date(text);
            if (!isNaN(d2.getTime())) return d2;
        } catch { }
        return null;
    };

    const handleSend = () => {
        const raw = (input || '').trim();
        if (!raw) return;
        onSend(raw);
        setInput('');
        // ensure we scroll to bottom when user sends a message if enabled
        if (autoScrollEnabled) {
            // a tiny timeout helps when logs are appended asynchronously by parent
            setTimeout(() => {
                const el = logsRef.current;
                if (!el) return;
                try { el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); } catch { el.scrollTop = el.scrollHeight; }
            }, 50);
        }
    };

    React.useEffect(() => {
        if (!autoScrollEnabled) return;
        const el = logsRef.current;
        if (!el) return;
        // keep view pinned to bottom when new logs arrive
        el.scrollTop = el.scrollHeight;
    }, [logs, autoScrollEnabled]);

    // Keep a parallel array of timestamps for each log entry. If a log contains an ISO timestamp,
    // use that; otherwise timestamp when the log first appears.
    React.useEffect(() => {
        setLogTimes(prev => {
            // trim if logs shortened
            const next: Date[] = [];
            for (let i = 0; i < logs.length; i++) {
                const text = logs[i] ?? '';
                // try to reuse existing time
                if (prev[i]) {
                    next[i] = prev[i];
                    continue;
                }
                const extracted = extractIsoTimestamp(text);
                next[i] = extracted ?? new Date();
            }
            return next;
        });
    }, [logs]);


    return (
        <Box sx={{ position: 'fixed', left: 12, right: 12, bottom: 12, zIndex: 1400 }}>
            <Paper elevation={6} sx={{ overflow: 'hidden' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', px: 1, py: 0.5 }}>
                    <Box component="span" sx={{ flex: 1, pl: 1, fontWeight: 500 }}>Console</Box>
                    <Tooltip title="Clear logs">
                        <IconButton size="small" aria-label="clear logs" onClick={() => onClear?.()}>
                            <ClearAll fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title={autoScrollEnabled ? 'Autoscroll: on' : 'Autoscroll: off'}>
                        <IconButton
                            size="small"
                            aria-label={autoScrollEnabled ? 'disable autoscroll' : 'enable autoscroll'}
                            aria-pressed={autoScrollEnabled}
                            onClick={() => {
                                try {
                                    setAutoScrollEnabled(prev => {
                                        const next = !prev;
                                        try { localStorage.setItem('devconsole.autoscroll', JSON.stringify(next)); } catch { }
                                        return next;
                                    });
                                } catch { }
                            }}
                        >
                            <VerticalAlignBottom fontSize="small" color={autoScrollEnabled ? 'primary' : 'inherit'} />
                        </IconButton>
                    </Tooltip>
                    <IconButton
                        size="small"
                        aria-label={expanded ? 'collapse' : 'expand'}
                        onClick={() => setExpanded(e => !e)}
                        sx={() => ({ padding: 0.5 })}
                    >
                        <ExpandMore
                            fontSize="small"
                            sx={(theme) => ({
                                transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                transition: `transform ${theme.transitions.duration.shorter}ms ${theme.transitions.easing.easeInOut}`,
                            })}
                        />
                    </IconButton>
                </Box>

                <Collapse in={expanded} timeout="auto" unmountOnExit>
                    <Divider />
                    <Box ref={logsRef} sx={[
                        {
                            maxHeight: 280,
                            overflow: 'auto',
                            px: 1,
                            backgroundColor: '#0f1724',
                            color: (theme) => theme.palette.getContrastText(theme.palette.background.paper),
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, "Roboto Mono", "Segoe UI Mono", monospace',
                            fontSize: 13,
                            py: 1
                        },
                        (theme) => theme.applyStyles('dark', {
                            backgroundColor: '#0b1220',
                        }),
                    ]}>
                        {logs.length === 0 ? (
                            <Box sx={{ px: 1, color: (theme) => theme.palette.text.disabled }}>No logs yet</Box>
                        ) : (
                            logs.map((l, i) => {
                                const ts = logTimes[i] ?? new Date();
                                const tsText = formatLogTimestamp(ts,
                                    { style: relativeStyle, omitAgo: relativeStyle === 'short', showSeconds: relativeShowSeconds },
                                    now);
                                return (
                                    <Box key={i}
                                        sx={{
                                            display: 'flex', alignItems: 'baseline',
                                            justifyContent: 'space-between', px: 1, py: '2px'
                                        }}>
                                        <Box sx={{ whiteSpace: 'pre-wrap', color: '#cfd8dc', pr: 1 }}>{l}</Box>
                                        <Box sx={{
                                            ml: 1, pl: 1, color: (theme) =>
                                                theme.palette.text.secondary, opacity: 0.6, fontSize: 12, whiteSpace: 'nowrap'
                                        }}>{tsText}</Box>
                                    </Box>
                                );
                            })
                        )}
                    </Box>
                    <Divider />
                    <Box sx={[
                        {
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            p: 1,
                            backgroundColor: '#f5f7fa'
                        },
                        (theme) => theme.applyStyles('dark', {
                            backgroundColor: '#071019',
                        }),
                    ]}>
                        <Box component="span"
                            sx={{
                                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, "Roboto Mono", "Segoe UI Mono", monospace',
                                px: 1, color: 'text.primary'
                            }}>&gt;</Box>
                        <InputBase
                            sx={{ ml: 1, flex: 1, fontFamily: 'inherit' }}
                            placeholder="Enter command (type 'clear')"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSend(); } }}
                        />
                        {showSendButton ? (
                            <Button variant="contained" size="small" onClick={handleSend} startIcon={<Send />}>Send</Button>
                        ) : null}
                    </Box>
                </Collapse>
            </Paper>
        </Box>
    );
}
