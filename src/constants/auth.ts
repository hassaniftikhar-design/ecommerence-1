// these tell whehter the custom session of jtw in cookie is epired or not 
export const SESSION_DURATION_REMEMBER_ME_MS = 5 * 24 * 60 * 60 * 1000; // 5 Days
export const SESSION_DURATION_DEFAULT_MS = 1 * 24 * 60 * 60 * 1000; // 1 Day

// this tell at how much long jwt exists in cookie 
export const SESSION_COOKIE_MAX_AGE_SECONDS = 5 * 24 * 60 * 60; // 5 Days

export const PASSWORD_RESET_EXPIRATION_MINUTES = 5;

/**
 * Single source of truth helper to check if a session has expired.
 */
export function isSessionExpired(sessionExpiresAt?: number): boolean {
    return (
        typeof sessionExpiresAt !== "number" ||
        !Number.isFinite(sessionExpiresAt) ||
        Date.now() >= sessionExpiresAt
    );
}



/*


Browser sends cookie
        ↓
NextAuth can still read JWT
        ↓
sessionExpiresAt says:
"Expired"
        ↓
middleware/server-auth rejects it



*/