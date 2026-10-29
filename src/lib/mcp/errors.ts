/**
 * A refusal or failure inside a Claude connector tool that Claude should relay
 * to the person as is: the message is written for them. Anything else a tool
 * throws is logged and answered with a generic message and a reference.
 */
export class McpToolError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "McpToolError";
  }
}

/**
 * Services report expected refusals as plain `Error`s with fixed messages
 * ("Stock cannot be negative", "Material not found", ...). Turn the ones a
 * tool expects into McpToolErrors Claude can relay; anything else is
 * rethrown untouched and ends up logged as an internal failure.
 */
export function relayKnownError(
  error: unknown,
  known: ReadonlyArray<readonly [pattern: RegExp, code: string, message: string]>
): never {
  if (error instanceof Error) {
    for (const [pattern, code, message] of known) {
      if (pattern.test(error.message)) throw new McpToolError(code, message);
    }
  }
  throw error;
}

/** Shared mapping for stock-item lookups (material or product by id). */
export const STOCK_ITEM_ERRORS = [
  [/must be provided/i, "INVALID_INPUT", "Give a materialId or a productId."],
  [
    /not found|does not belong/i,
    "NOT_FOUND",
    "No such material or product in this store. Use list_inventory to find it.",
  ],
  [
    /cannot be negative/i,
    "NEGATIVE_STOCK",
    "That would take stock below zero. Check the current stock with list_inventory first.",
  ],
] as const;
