import * as React from 'react';
import type { ButtonProps } from '@mui/material/Button';

/**
 * Page action definition
 */
export interface PageAction {
    /** Unique key for the action */
    key: string;
    /** Button label */
    label: string;
    /** Click handler */
    onClick: () => void;
    /** Icon to display before the label */
    icon?: React.ReactNode;
    /** Button variant (defaults to outlined) */
    variant?: ButtonProps['variant'];
    /** Button color */
    color?: ButtonProps['color'];
    /** Whether the button is disabled */
    disabled?: boolean;
    /** Whether to hide the action */
    hidden?: boolean;
}

/**
 * Context for managing page-level actions
 */
interface PageActionsContextValue {
    /** Current page actions */
    actions: PageAction[];
    /** Set page actions */
    setActions: (actions: PageAction[]) => void;
    /** Clear all actions */
    clearActions: () => void;
}

const PageActionsContext = React.createContext<PageActionsContextValue | undefined>(undefined);

/**
 * Provider for page actions context
 */
export function PageActionsProvider({ children }: { children: React.ReactNode }) {
    const [actions, setActions] = React.useState<PageAction[]>([]);

    const clearActions = React.useCallback(() => {
        setActions([]);
    }, []);

    const value = React.useMemo(
        () => ({
            actions,
            setActions,
            clearActions,
        }),
        [actions, clearActions]
    );

    return (
        <PageActionsContext.Provider value={value}>
            {children}
        </PageActionsContext.Provider>
    );
}

/**
 * Hook to access page actions context
 */
export function usePageActionsContext(): PageActionsContextValue {
    const context = React.useContext(PageActionsContext);
    if (!context) {
        throw new Error('usePageActionsContext must be used within PageActionsProvider');
    }
    return context;
}

/**
 * Hook for pages to register their actions
 * Automatically clears actions when component unmounts
 */
export function usePageActions(actions: PageAction[]) {
    const { setActions, clearActions } = usePageActionsContext();

    React.useEffect(() => {
        setActions(actions);
        return () => {
            clearActions();
        };
    }, [actions, setActions, clearActions]);
}
