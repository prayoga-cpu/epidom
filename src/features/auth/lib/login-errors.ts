/**
 * Sentinel message thrown by the login mutation when the sign-in endpoint fails
 * server-side (5xx) or is unreachable. Kept apart from the hook so the form can
 * match on it without importing the (heavier, mocked-in-tests) hook module.
 */
export const LOGIN_SERVICE_UNAVAILABLE = "LOGIN_SERVICE_UNAVAILABLE";
