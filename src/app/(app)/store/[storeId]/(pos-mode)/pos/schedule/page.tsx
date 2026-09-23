import { redirect } from "next/navigation";
import { MyScheduleList } from "@/features/dashboard/schedule/components/my-schedule-list";
import { requireStaffPageAccess } from "@/lib/auth/require-staff-page-access";
import { getActiveStaffSession } from "@/lib/staff-session";

// POS Mode's light "my shift" view — clock in/out, current status, nothing
// else (docs/dashboard-revamp.md: "don't ship one /schedule page and try to
// make it context-aware"). The full roster builder stays exclusively in
// Back Office at /schedule. getActiveStaffSession() reads the same
// StaffSession cookie the verify-pin API sets, so it reflects a POS Mode PIN
// login the same way it already reflects Back Office's picker — no client
// state needed here.
export default async function PosModeSchedulePage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  await requireStaffPageAccess(storeId, "/pos/schedule");

  const staffSession = await getActiveStaffSession();
  // Owner (no StaffSession cookie — PosStaffGate's bypass logs in client-side
  // only) or a session from another store has no "my shift" to view here.
  if (!staffSession || staffSession.storeId !== storeId) {
    redirect(`/store/${storeId}/schedule`);
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-2 md:p-6">
      <MyScheduleList storeId={storeId} staffMemberId={staffSession.staffMemberId} />
    </div>
  );
}
