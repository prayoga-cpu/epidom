import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CustomDevelopmentClient } from "@/features/dashboard/custom-development/components/custom-development-client";
import { requireStaffPageAccess } from "@/lib/auth/require-staff-page-access";

export default async function CustomDevelopmentPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }
  await requireStaffPageAccess(storeId, "/custom-development");

  return <CustomDevelopmentClient storeId={storeId} />;
}
