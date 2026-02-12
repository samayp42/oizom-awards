export const logger = {
    info: (...args) => {
        if (import.meta.env.DEV) {
            console.log('[INFO]', ...args);
        }
    },
    warn: (...args) => {
        console.warn('[WARN]', ...args);
    },
    error: (...args) => {
        console.error('[ERROR]', ...args);
    },
    debug: (...args) => {
        if (import.meta.env.DEV) {
            console.debug('[DEBUG]', ...args);
        }
    }
};
