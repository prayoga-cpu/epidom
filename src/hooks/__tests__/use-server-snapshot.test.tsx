import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useServerSnapshot } from "../use-server-snapshot";

interface Page {
  rows: string[];
  total: number;
}

const SERVER_PAGE_1: Page = { rows: ["a", "b"], total: 4 };

function setup(fetchPage: (skip: number) => Promise<Page>, seedEveryKey = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(
    ({ skip }: { skip: number }) => {
      const queryKey = ["list", { skip, take: 2 }];
      const snapshot = useServerSnapshot(queryKey, SERVER_PAGE_1);
      return useQuery({
        queryKey,
        queryFn: () => fetchPage(skip),
        initialData: seedEveryKey ? SERVER_PAGE_1 : snapshot,
        staleTime: 20_000,
      });
    },
    { wrapper, initialProps: { skip: 0 } }
  );
}

describe("useServerSnapshot", () => {
  it("seeds the key the server rendered, with no request", () => {
    const fetchPage = vi.fn();
    const { result } = setup(fetchPage);

    expect(result.current.data).toEqual(SERVER_PAGE_1);
    expect(fetchPage).not.toHaveBeenCalled();
  });

  it("fetches the next page instead of showing page 1 again", async () => {
    const fetchPage = vi.fn().mockResolvedValue({ rows: ["c", "d"], total: 4 });
    const { result, rerender } = setup(fetchPage);

    rerender({ skip: 2 });

    // Never the first page under the second page's key.
    expect(result.current.data).toBeUndefined();
    await waitFor(() => expect(result.current.data?.rows).toEqual(["c", "d"]));
    expect(fetchPage).toHaveBeenCalledWith(2);
  });

  it("gives the snapshot back when paging returns to the first key", async () => {
    const fetchPage = vi.fn().mockResolvedValue({ rows: ["c", "d"], total: 4 });
    const { result, rerender } = setup(fetchPage);

    rerender({ skip: 2 });
    await waitFor(() => expect(result.current.data?.rows).toEqual(["c", "d"]));
    rerender({ skip: 0 });

    expect(result.current.data).toEqual(SERVER_PAGE_1);
  });

  // The behaviour this hook exists to prevent, pinned so a future "simplify"
  // back to a bare `initialData` shows up as a failing expectation here.
  it("documents the bug: an unconditional initialData shows page 1 on every page", () => {
    const fetchPage = vi.fn().mockResolvedValue({ rows: ["c", "d"], total: 4 });
    const { result, rerender } = setup(fetchPage, true);

    rerender({ skip: 2 });

    expect(result.current.data).toEqual(SERVER_PAGE_1);
    expect(fetchPage).not.toHaveBeenCalled();
  });
});
