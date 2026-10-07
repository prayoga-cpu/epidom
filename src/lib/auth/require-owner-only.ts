import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getActiveStaffSession } from "@/lib/staff-session";
import { ApiErrorCode, createErrorResponse } from "@/types/api/responses";
import { getStoreViewer } from "./store-viewer";
import { linkedStaffHomePath } from "./staff-home";

/**
 * Server-side gate for owner-only pages (Profile, Billing, Staff). Redirects
 * away if the current browser has an active staff PIN session for this
 * store — i.e. someone switched to a restricted staff persona — since only
 * the real account owner (no staff session at all) should reach these.
 *
 * Call at the top of the page/layout, alongside requirePlan if present.
 */
export async function requireOwnerOnly(storeId: string): Promise<void> {
  // "No staff session" only ever meant "the owner" while the owner was the
  // sole Better Auth account that could reach a store. A linked staff account
  // (StaffMember.userId) has a session of its own and no persona until it
  // enters a PIN — it must be turned away here whatever its PIN state, or
  // these owner-only pages (and their server-fetched data) would render for it.
  const viewer = await getStoreViewer(storeId);
  if (viewer.kind === "none") redirect("/stores");
  if (viewer.kind === "staff") redirect(await linkedStaffHomePath(storeId, viewer.staffMemberId));

  const staffSession = await getActiveStaffSession();
  // role === "OWNER" covers a StaffMember row that is itself the owner (e.g.
  // seeded accounts) — functionally the same as no staff session at all.
  if (staffSession && staffSession.storeId === storeId && staffSession.role !== "OWNER") {
    // Send them to a page they can actually see, not just "/pos" — a Kitchen
    // persona (say) doesn't have /pos either, which would just bounce again.
    const fallback = staffSession.allowedPages[0] ?? "/pos";
    redirect(`/store/${storeId}${fallback}`);
  }
}

/**
 * Server-side gate for the account-level Profile page (/profile — no
 * storeId). That route now only redirects into the store-scoped Profile,
 * except for deactivated accounts, which it still renders in full. It shows
 * the same account contact info, business details, and subscription/billing
 * as the store-scoped Profile page that requireOwnerOnly protects, so any
 * active staff PIN persona — for any store — must be sent to the store
 * picker instead, never shown or able to edit this data. It runs before the
 * redirect too, because requireOwnerOnly only checks the persona of the one
 * store the launcher happens to pick.
 */
export async function requireNoActiveStaffPersona(): Promise<void> {
  const staffSession = await getActiveStaffSession();
  if (staffSession && staffSession.role !== "OWNER") {
    redirect("/stores");
  }
}

/**
 * API-route twin of requireOwnerOnly, for mutating endpoints only the real
 * account owner may call — no staff persona, Manager included (contrast
 * requireManagerOrOwnerApi, which lets a MANAGER persona through). Sending
 * someone a sign-in link that grants store access is the canonical example:
 * the owner's device stays signed in while a cashier or manager persona is
 * layered on top of it, and that persona must not be able to mint access.
 *
 * @returns an error NextResponse to return immediately, or null to proceed.
 */
export async function requireOwnerOnlyApi(storeId: string): Promise<NextResponse | null> {
  if (await isOwnerActing(storeId)) return null;
  return NextResponse.json(
    createErrorResponse(ApiErrorCode.FORBIDDEN, "Only the account owner can do this"),
    { status: 403 }
  );
}

/**
 * The same test as requireOwnerOnlyApi, as a boolean — for a page every
 * persona may open that shows one owner-only control (the Back Office Shifts
 * page's "Close shift"): the real account owner, with no cashier or manager
 * persona layered on their device.
 */
export async function isOwnerActing(storeId: string): Promise<boolean> {
  const viewer = await getStoreViewer(storeId);
  if (viewer.kind !== "owner") return false;
  const staffSession = await getActiveStaffSession();
  // role === "OWNER": a StaffMember row that is itself the owner — the same as
  // no persona at all.
  return !(staffSession && staffSession.storeId === storeId && staffSession.role !== "OWNER");
}

/**
 * requireOwnerOnlyApi for routes about money owed to people (salaries, pay
 * rates, allowances): the real owner, and no non-owner staff persona active on
 * this device for ANY store. requireOwnerOnlyApi on its own only refuses a
 * persona of THIS store, so a cashier signed in on another of the owner's
 * outlets would pass it — the same permissive default requireManagerOrOwnerApi
 * has (see DELETE cash-movements for the original explicit check).
 *
 * @returns an error NextResponse to return immediately, or null to proceed.
 */
export async function requireOwnerWithoutStaffPersonaApi(
  storeId: string
): Promise<NextResponse | null> {
  const staffSession = await getActiveStaffSession();
  if (staffSession && staffSession.role !== "OWNER") {
    return NextResponse.json(
      createErrorResponse(ApiErrorCode.FORBIDDEN, "Only the account owner can do this"),
      { status: 403 }
    );
  }
  return requireOwnerOnlyApi(storeId);
}

/**
 * May this request see staff pay (rates, overtime, allowances, salary)? Only
 * the account owner as themselves: no cashier or manager persona on the device
 * for ANY store — the same test as requireOwnerWithoutStaffPersonaApi, which
 * guards the pay writes — and not a linked staff account.
 */
export async function canSeeStaffPay(storeId: string): Promise<boolean> {
  const staffSession = await getActiveStaffSession();
  if (staffSession && staffSession.role !== "OWNER") return false;
  return isOwnerActing(storeId);
}
