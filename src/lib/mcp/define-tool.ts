import { after } from "next/server";
import { ZodError, type z } from "zod";
import { AppError } from "@/lib/errors";
import type { AuditSeverity } from "@prisma/client";
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/middleware/rate-limit";
import { runWithAuditScope, type AuditRequestMeta } from "@/lib/audit/actor-scope";
import { writeActivityEvent } from "@/lib/audit/activity";
import {
  authorizeMcpStore,
  McpAccessError,
  type McpStoreContext,
  type McpToolAccess,
} from "./authorize";
import { McpToolError } from "./errors";
import type { McpPrincipal } from "./principal";

/**
 * One Claude connector tool: its schema, who may call it, and a handler that
 * calls the same services the app's own routes use.
 *
 * Every call goes through runTool below, in this order: write rate limit →
 * authorizeMcpStore (write scope, store access, plan, staff rules) → the
 * handler inside an audit scope (so services that record a Layer 2 action
 * attribute it to the person, not SYSTEM) → an ActivityEvent for writes → one
 * usage row. Handlers never see a request, a cookie or a session.
 */

export { McpToolError };

/** What every call carries, whatever the tool. */
export interface McpCallContext {
  principal: McpPrincipal;
  /** Request metadata of the HTTP request the call arrived on. */
  meta: AuditRequestMeta;
}

type ToolHints = Omit<ToolAnnotations, "title" | "readOnlyHint">;

interface ToolBase<S extends z.AnyZodObject> {
  name: string;
  title: string;
  /** Written for Claude: what it returns, when to use it, what to watch for. */
  description: string;
  input: S;
  hints?: ToolHints;
}

export interface StoreToolDefinition<S extends z.AnyZodObject> extends ToolBase<S> {
  kind: "read" | "write";
  access: McpToolAccess;
  /** Severity of the ActivityEvent a write leaves. Defaults to NOTICE. */
  severity?: AuditSeverity;
  handler: (input: z.infer<S>, ctx: McpStoreContext) => Promise<unknown>;
}

export interface AccountToolDefinition<S extends z.AnyZodObject> extends ToolBase<S> {
  handler: (input: z.infer<S>, call: McpCallContext) => Promise<unknown>;
}

/** The registered form the server iterates over. */
export interface McpTool {
  name: string;
  title: string;
  description: string;
  input: z.AnyZodObject;
  kind: "read" | "write";
  /** Null for account-level tools (list_stores), which need no store. */
  access: McpToolAccess | null;
  annotations: ToolAnnotations;
  run: (args: Record<string, unknown>, call: McpCallContext) => Promise<CallToolResult>;
}

/** A tool that acts on one store: its input must carry `storeId`. */
export function defineStoreTool<S extends z.AnyZodObject>(
  def: StoreToolDefinition<S> & (z.infer<S> extends { storeId: string } ? unknown : never)
): McpTool {
  return {
    name: def.name,
    title: def.title,
    description: def.description,
    input: def.input,
    kind: def.kind,
    access: def.access,
    annotations: {
      title: def.title,
      readOnlyHint: def.kind === "read",
      // Writes in this connector change one store's data, nothing outside it.
      openWorldHint: false,
      ...def.hints,
    },
    // The SDK has already parsed `args` against `input`, which carries storeId.
    run: (args, call) => runStoreTool(def, args as z.infer<S> & { storeId: string }, call),
  };
}

/** A tool about the account itself (which stores it can reach). */
export function defineAccountTool<S extends z.AnyZodObject>(
  def: AccountToolDefinition<S>
): McpTool {
  return {
    name: def.name,
    title: def.title,
    description: def.description,
    input: def.input,
    kind: "read",
    access: null,
    annotations: { title: def.title, readOnlyHint: true, openWorldHint: false, ...def.hints },
    run: async (args, call) => {
      const startedAt = Date.now();
      try {
        const result = await def.handler(args as z.infer<S>, call);
        logUsage(call, def.name, null, startedAt, null);
        return toolResult(result);
      } catch (error) {
        const failure = describeFailure(error, call.meta.requestId, def.name);
        logUsage(call, def.name, null, startedAt, failure.code);
        return failure.result;
      }
    },
  };
}

async function runStoreTool<S extends z.AnyZodObject>(
  def: StoreToolDefinition<S>,
  args: z.infer<S> & { storeId: string },
  call: McpCallContext
): Promise<CallToolResult> {
  const startedAt = Date.now();
  const storeId = args.storeId;

  if (def.kind === "write") {
    const limit = await checkRateLimit(`user:${call.principal.userId}`, "/api/mcp#write");
    if (!limit.success) {
      logUsage(call, def.name, storeId, startedAt, "RATE_LIMITED");
      return errorResult(
        "Too many changes in a short time. Wait a minute, then try again with fewer, larger changes."
      );
    }
  }

  let ctx: McpStoreContext;
  try {
    ctx = await authorizeMcpStore(call.principal, storeId, def.access, def.kind);
  } catch (error) {
    const failure = describeFailure(error, call.meta.requestId, def.name);
    logUsage(call, def.name, storeId, startedAt, failure.code);
    return failure.result;
  }

  const meta: AuditRequestMeta = {
    ...call.meta,
    method: def.kind === "write" ? "POST" : "GET",
    route: `mcp:${def.name}`,
  };
  const scope = { actor: ctx.actor, meta, storeId, recordedActionIds: [] as string[] };

  try {
    const result = await runWithAuditScope(scope, () => def.handler(args, ctx));
    if (def.kind === "write") recordWrite(def, ctx, meta, "SUCCESS", scope.recordedActionIds[0]);
    logUsage(call, def.name, storeId, startedAt, null);
    return toolResult(result);
  } catch (error) {
    const failure = describeFailure(error, call.meta.requestId, def.name);
    if (def.kind === "write") recordWrite(def, ctx, meta, "FAILED", scope.recordedActionIds[0]);
    logUsage(call, def.name, storeId, startedAt, failure.code);
    return failure.result;
  }
}

/** Layer 1 trail row for a write, shown in the Activity log as mcp.<tool>. */
function recordWrite<S extends z.AnyZodObject>(
  def: StoreToolDefinition<S>,
  ctx: McpStoreContext,
  meta: AuditRequestMeta,
  outcome: "SUCCESS" | "FAILED",
  actionLogId: string | undefined
): void {
  defer(() =>
    writeActivityEvent({
      actor: ctx.actor,
      meta,
      actionCode: `mcp.${def.name}`,
      severity: def.severity ?? "NOTICE",
      outcome,
      statusCode: outcome === "SUCCESS" ? 200 : 500,
      storeId: ctx.storeId,
      businessId: ctx.store.businessId,
      actionLogId: actionLogId ?? null,
    })
  );
}

/** One McpToolCall row: never the arguments or the result. */
function logUsage(
  call: McpCallContext,
  tool: string,
  storeId: string | null,
  startedAt: number,
  errorCode: string | null
): void {
  defer(() =>
    prisma.mcpToolCall
      .create({
        data: {
          tool,
          userId: call.principal.userId,
          clientId: call.principal.clientId,
          storeId,
          ok: errorCode === null,
          errorCode,
          durationMs: Math.max(0, Date.now() - startedAt),
        },
      })
      .then(() => undefined)
      .catch((error) => console.error("[mcp] usage row write failed:", error))
  );
}

/**
 * Run bookkeeping after the response is sent. Outside a request (tests,
 * scripts) `after` throws, and the work simply runs now.
 */
function defer(work: () => Promise<void>): void {
  try {
    after(work);
  } catch {
    void work();
  }
}

/** JSON the model reads: Decimals and Dates come out as strings already. */
export function toMcpJson(value: unknown): string {
  return JSON.stringify(value, (_key, v) => (typeof v === "bigint" ? v.toString() : v));
}

/**
 * Claude.ai accepts about 150k characters per result and Claude Code about
 * 25k tokens; stay well under both. Tools page their lists, so this only
 * trips on an unexpectedly large answer.
 */
const MAX_RESULT_CHARS = 90_000;

export function toolResult(value: unknown): CallToolResult {
  const text = toMcpJson(value ?? { ok: true });
  if (text.length > MAX_RESULT_CHARS) {
    return errorResult(
      "The answer is too large to return at once. Ask for a shorter period, a filter, or a smaller page (limit)."
    );
  }
  return { content: [{ type: "text", text }] };
}

export function errorResult(message: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

function describeFailure(
  error: unknown,
  requestId: string,
  tool: string
): { code: string; result: CallToolResult } {
  if (error instanceof McpAccessError || error instanceof McpToolError) {
    return { code: error.code, result: errorResult(error.message) };
  }
  // The app's own refusals (not found, already taken, invalid) carry messages
  // written for people, the same ones its forms show.
  if (error instanceof AppError && error.statusCode < 500) {
    return { code: String(error.code), result: errorResult(error.message) };
  }
  if (error instanceof ZodError) {
    return {
      code: "INVALID_INPUT",
      result: errorResult(
        error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")
      ),
    };
  }
  console.error(`[mcp] ${tool} failed (ref ${requestId}):`, error);
  return {
    code: "INTERNAL",
    result: errorResult(
      `Something went wrong on Epidom's side (ref ${requestId}). If this was a change, check in ` +
        "Epidom whether it went through before trying again; if it keeps failing, give the Epidom " +
        "team this reference."
    ),
  };
}
