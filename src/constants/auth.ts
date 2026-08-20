
export const SESSION_DURATION_REMEMBER_ME_MS = 5 * 24 * 60 * 60 * 1000;
export const SESSION_DURATION_DEFAULT_MS = 1 * 24 * 60 * 60 * 1000;

export const SESSION_COOKIE_MAX_AGE_SECONDS = 5 * 24 * 60 * 60;

export const PASSWORD_RESET_EXPIRATION_MINUTES = 3;


export function isSessionExpired(sessionExpiresAt?: number): boolean {
        return (
                typeof sessionExpiresAt !== "number" ||
                !Number.isFinite(sessionExpiresAt) ||
                Date.now() >= sessionExpiresAt
        );
}


