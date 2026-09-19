import { ShiftPage } from "@/features/pos/components/shift/shift-page";
import { requireStaffPageAccess } from "@/lib/auth/require-staff-page-access";

// POS Mode's till-session page: open a shift, see who is on charge, finish it.
// Separate from /pos/schedule (clock in/out and the roster), which used to carry
// these controls. Granted by the "/pos" page — the same grant the till APIs
// already require (see staff-principal-policy.ts) — so whoever can ring up a
// sale can open and close their own till, with no new permission to hand out.
//
// No server-side persona lookup, unlike /pos/schedule: the account owner
// (PosStaffGate's synthetic "owner" persona, no StaffSession cookie) works the
// till too, and ShiftPage resolves whose shift it is from the client session.
export default async function PosModeShiftPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  await requireStaffPageAccess(storeId, "/pos");

  return <ShiftPage storeId={storeId} />;
}
