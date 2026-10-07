import { describe, it, expect, vi, afterEach } from "vitest";
import { ApiClient, ApiClientError, ApiNetworkError } from "../client";

const client = new ApiClient({ baseURL: "/api" });

/** The error a call rejected with (fails the test if it resolved). */
async function rejection<E>(call: Promise<unknown>): Promise<E> {
  try {
    await call;
  } catch (error) {
    return error as E;
  }
  throw new Error("expected the call to fail");
}

function respond(body: unknown, status = 200) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(
      new Response(typeof body === "string" ? body : JSON.stringify(body), { status })
    );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("ApiClient", () => {
  it("returns the data payload", async () => {
    respond({ success: true, data: { id: "o1" } });
    await expect(client.post("/orders", { a: 1 })).resolves.toEqual({ id: "o1" });
  });

  it("an answer from our API that is an error is an ApiClientError with its status", async () => {
    respond({ success: false, error: { code: "INVALID_INPUT", message: "Nope" } }, 422);
    const error = await rejection<ApiClientError>(client.post("/orders"));
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error.status).toBe(422);
  });

  it("no connection at all is an ApiNetworkError", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    const error = await rejection<ApiNetworkError>(client.post("/orders"));
    expect(error).toBeInstanceOf(ApiNetworkError);
    expect(error.timedOut).toBe(false);
    expect(error.message).toBe("Failed to fetch");
  });

  // A captive portal's login page, or a gateway's 502 page.
  it("something other than our API answering is an ApiNetworkError too", async () => {
    respond("<html>Sign in to the wifi</html>", 200);
    const error = await rejection<ApiNetworkError>(client.post("/orders"));
    expect(error).toBeInstanceOf(ApiNetworkError);
    expect(error.status).toBe(200);
  });

  it("gives up after timeoutMs", async () => {
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError"))
          );
        })
    );
    const pending = rejection<ApiNetworkError>(client.post("/orders", {}, { timeoutMs: 1000 }));
    await vi.advanceTimersByTimeAsync(1000);
    const error = await pending;
    expect(error).toBeInstanceOf(ApiNetworkError);
    expect(error.timedOut).toBe(true);
  });

  it("sends no abort signal unless a timeout is asked for", async () => {
    const fetchSpy = respond({ success: true, data: null });
    await client.post("/orders");
    expect(fetchSpy.mock.calls[0][1]).not.toHaveProperty("signal");
  });
});
