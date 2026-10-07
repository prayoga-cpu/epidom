/**
 * `error.details.reason` on the 403 a POS close returns when the caller didn't
 * open the shift — the client keys its "only {name} can end this shift" copy
 * off it instead of matching the English message.
 */
export const NOT_SHIFT_OPENER = "NOT_SHIFT_OPENER";
