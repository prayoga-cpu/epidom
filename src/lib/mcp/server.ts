import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { prisma } from "@/lib/prisma";
import { APP_VERSION } from "@/lib/version";
import { resolveStaffAllowedPages } from "@/config/staff-permissions.config";
import { linkedStaffWhere } from "@/lib/auth/staff-link";
import { staffMayUse, type StaffGrant } from "./authorize";
import { MCP_SCOPE_WRITE } from "./config";
import type { McpCallContext, McpTool } from "./define-tool";
import { buildInstructions } from "./instructions";
import { registerPrompts } from "./prompts";
import { MCP_TOOLS } from "./tools";

/**
 * The tools this connection may see. Write tools are listed only when the
 * connection was granted changes, and an account that is only staff (owns no
 * business) sees only what its role and page grants allow at its store — the
 * rules authorizeMcpStore enforces again on every call.
 */
export async function visibleTools(
  call: McpCallContext,
  tools: readonly McpTool[] = MCP_TOOLS
): Promise<McpTool[]> {
  const canWrite = call.principal.scopes.includes(MCP_SCOPE_WRITE);
  const byScope = tools.filter((tool) => tool.kind === "read" || canWrite);

  const [business, staff] = await Promise.all([
    prisma.business.findUnique({ where: { userId: call.principal.userId }, select: { id: true } }),
    prisma.staffMember.findFirst({
      where: linkedStaffWhere(call.principal.userId),
      select: { role: true, allowedPages: true },
    }),
  ]);
  if (business || !staff) return byScope;

  const grant: StaffGrant = {
    role: staff.role,
    pages: resolveStaffAllowedPages(staff.role, staff.allowedPages),
  };
  return byScope.filter((tool) => tool.access === null || staffMayUse(tool.access, grant));
}

/**
 * One MCP server per HTTP request (the route runs stateless): the principal is
 * bound in, so every tool call knows who is asking without session state.
 */
export async function createMcpServer(call: McpCallContext): Promise<McpServer> {
  const tools = await visibleTools(call);
  const canWrite = call.principal.scopes.includes(MCP_SCOPE_WRITE);

  const server = new McpServer(
    { name: "epidom", title: "Epidom", version: APP_VERSION },
    { instructions: buildInstructions({ canWrite }) }
  );

  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.input,
        annotations: tool.annotations,
      },
      (args: Record<string, unknown>) => tool.run(args, call)
    );
  }

  registerPrompts(server, { canWrite });
  return server;
}
