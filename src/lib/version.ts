/**
 * Current Epidom release version.
 *
 * Kept in sync with package.json "version" and the newest CHANGELOG.md entry.
 * Bump this with every release (see AGENTS.md "Changelog & versioning").
 * Used for the footer/dashboard version badge and the "What's new" bell prompt.
 */
export const APP_VERSION = "3.9.0";

/**
 * The day APP_VERSION was released: the date on its CHANGELOG.md header, bumped
 * with it (src/lib/__tests__/version.test.ts fails when they disagree). The home
 * page shows it as the "latest release" fact, so it always matches the build
 * that is actually running.
 */
export const APP_RELEASE_DATE = "2026-10-07";
