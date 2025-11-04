type ErrorRecord = Record<string, unknown>;

const isErrorRecord = (value: unknown): value is ErrorRecord =>
    typeof value === 'object' && value !== null;

export const getErrorMessage = (
    error: unknown,
    fallback = 'An unexpected error occurred',
): string => {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    if (typeof error === 'string' && error.trim()) {
        return error;
    }

    if (isErrorRecord(error) && typeof error.message === 'string' && error.message.trim()) {
        return error.message;
    }

    return fallback;
};

export const getErrorCode = (error: unknown): string | undefined => {
    if (isErrorRecord(error) && typeof error.code === 'string' && error.code.trim()) {
        return error.code;
    }
    return undefined;
};

export const getError = <
    TExtras extends Record<string, unknown> = Record<string, unknown>
>(
    error: unknown,
    fallback = 'An unexpected error occurred',
): { message: string; code?: string; raw: unknown } & TExtras => {
    const base: Record<string, unknown> = isErrorRecord(error) ? { ...error } : {};

    if (error instanceof Error) {
        base.name = error.name;
        base.stack = error.stack;
        if ('cause' in error) {
            base.cause = (error as Error & { cause?: unknown }).cause;
        }
    }

    const message = getErrorMessage(error, fallback);
    const code = getErrorCode(error);

    base.message = message;
    if (code) {
        base.code = code;
    }

    base.raw = error;

    return base as { message: string; code?: string; raw: unknown } & TExtras;
};
