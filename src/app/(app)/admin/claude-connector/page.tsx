import { requireAdminSection } from "@/lib/auth/require-admin-page";
import { getConnectorUsage, parseUsageRange } from "@/lib/mcp/usage";
import { ConnectorUsageView } from "@/features/admin/components/connector-usage";

export const metadata = { title: "Claude connector | Admin | Epidom" };
export const dynamic = "force-dynamic";

export default async function AdminClaudeConnectorPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  await requireAdminSection("claude-connector");

  const { days } = await searchParams;
  const usage = await getConnectorUsage(parseUsageRange(days));

  return <ConnectorUsageView usage={usage} />;
}
