import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ImportRequestError, useAnalyzeImport, useExecuteImport } from "../use-ai-import";

function setup<T>(hook: () => T) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(hook, { wrapper }).result;
}

const respond = (body: string, status: number, type = "application/json") =>
  vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(body, { status, headers: { "Content-Type": type } }));

const file = new File(["name\nFlan"], "menu.csv", { type: "text/csv" });

afterEach(() => vi.restoreAllMocks());

describe("import requests that fail", () => {
  it("carries the route's own reason", async () => {
    respond(JSON.stringify({ error: "Analysis failed", message: "Rate limit reached" }), 500);
    const analyze = setup(() => useAnalyzeImport());

    const error = await analyze.current.mutateAsync({ storeId: "s1", file }).catch((e) => e);

    expect(error).toBeInstanceOf(ImportRequestError);
    expect(error.message).toBe("Rate limit reached");
    expect(error.timedOut).toBe(false);
  });

  it("falls back to `error` when the route sent no message", async () => {
    respond(JSON.stringify({ error: "Unauthorized" }), 401);
    const analyze = setup(() => useAnalyzeImport());

    const error = await analyze.current.mutateAsync({ storeId: "s1", file }).catch((e) => e);

    expect(error.message).toBe("Unauthorized");
  });

  // A platform timeout answers with an HTML page; response.json() on it used to
  // surface "Unexpected token '<'" as the reason.
  it("reads a gateway timeout page as a timeout, not a JSON parse error", async () => {
    respond("<html><body>504 Gateway Timeout</body></html>", 504, "text/html");
    const execute = setup(() => useExecuteImport());

    const error = await execute.current
      .mutateAsync({ sessionId: "x", storeId: "s1", entityType: "product", data: [] })
      .catch((e) => e);

    expect(error).toBeInstanceOf(ImportRequestError);
    expect(error.message).toBe("Import failed");
    expect(error.timedOut).toBe(true);
  });

  it("sends the type picked in the dialog as the fallback for rows nothing identifies", async () => {
    const fetchSpy = respond(JSON.stringify({ success: true, summary: {} }), 200);
    const execute = setup(() => useExecuteImport());

    await execute.current.mutateAsync({
      sessionId: "x",
      storeId: "s1",
      entityType: "product",
      fallbackEntityType: "product",
      data: [{ name: "Flan" }],
    });

    expect(JSON.parse(fetchSpy.mock.calls[0][1]!.body as string)).toMatchObject({
      fallbackEntityType: "product",
    });
  });
});
