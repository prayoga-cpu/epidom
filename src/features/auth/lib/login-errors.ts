/**
 * Sentinel message thrown by the login mutation when the sign-in endpoint fails
 * server-side (5xx) or is unreachable. Kept apart from the hook so the form can
 * match on it without importing the (heavier, mocked-in-tests) hook module.
 */
export const LOGIN_SERVICE_UNAVAILABLE = "LOGIN_SERVICE_UNAVAILABLE";

/**
 * English fallback messages the auth mutations throw when the auth server sent
 * no message of its own. The forms swap them for the translated copy, so the
 * visitor never reads English they did not choose.
 */
export const AUTH_INVALID_CREDENTIALS_FALLBACK = "Invalid email or password";
export const AUTH_REGISTRATION_FAILED_FALLBACK = "Registration failed";
