import { pickStaffHomePage } from "@/config/staff-permissions.config";

/** Which line of guidance sits above the "Send sign-in invite" button. */
export type StaffInviteHint = "needEmail" | "saveFirst" | "posOnly" | "pending" | "default";

export interface StaffInviteUi {
  canSend: boolean;
  hint: StaffInviteHint;
  /** An invite is already out — the button re-sends (replacing the old link). */
  isResend: boolean;
}

/**
 * What the Staff dialog's "Sign-in account" block offers for a staff member
 * who has no linked account yet. Order matters: the hint names the FIRST thing
 * standing in the owner's way, and any of them disables the button.
 *
 *  - no email, or one that fails validation: nothing to send to;
 *  - an unsaved email edit: the invite goes to the SAVED address (the server
 *    snapshots it), so sending now would target something other than what the
 *    owner sees typed;
 *  - no POS Mode page in their grants: accounts are POS-only for now, so a
 *    back-office-only role would sign in to nowhere;
 *  - deactivated: they'd be locked out the moment they got in.
 */
export function getStaffInviteUi(input: {
  email: string;
  savedEmail: string | null;
  emailError?: string | null;
  isActive: boolean;
  allowedPages: readonly string[];
  hasPendingInvite: boolean;
}): StaffInviteUi {
  const emailUnsaved = input.email !== (input.savedEmail ?? "");
  const noPosPages = pickStaffHomePage(input.allowedPages) === null;

  const canSend =
    !!input.email && !input.emailError && !emailUnsaved && !noPosPages && input.isActive;

  const hint: StaffInviteHint = !input.email
    ? "needEmail"
    : emailUnsaved
      ? "saveFirst"
      : noPosPages
        ? "posOnly"
        : input.hasPendingInvite
          ? "pending"
          : "default";

  return { canSend, hint, isResend: input.hasPendingInvite };
}
