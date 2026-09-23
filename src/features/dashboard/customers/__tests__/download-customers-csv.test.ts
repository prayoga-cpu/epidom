import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  downloadCustomersCsv,
  filenameFromContentDisposition,
} from "../lib/download-customers-csv";

describe("filenameFromContentDisposition", () => {
  it("reads the quoted filename the export route sends", () => {
    expect(filenameFromContentDisposition('attachment; filename="customers-2026-09-19.csv"')).toBe(
      "customers-2026-09-19.csv"
    );
  });

  it("returns null when there is no header or no filename in it", () => {
    expect(filenameFromContentDisposition(null)).toBeNull();
    expect(filenameFromContentDisposition("attachment")).toBeNull();
  });
});

describe("downloadCustomersCsv", () => {
  const fetchMock = vi.fn();
  const createObjectURL = vi.fn(() => "blob:customers");
  const revokeObjectURL = vi.fn();
  let clicked: HTMLAnchorElement[];

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    Object.assign(window.URL, { createObjectURL, revokeObjectURL });
    clicked = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      clicked.push(this);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    fetchMock.mockReset();
  });

  it("downloads the CSV under the server's filename and forwards the search", async () => {
    fetchMock.mockResolvedValue(
      new Response("Name\nMarie", {
        status: 200,
        headers: { "Content-Disposition": 'attachment; filename="customers-2026-09-19.csv"' },
      })
    );

    await downloadCustomersCsv("store_1", "marie dupont");

    expect(fetchMock).toHaveBeenCalledWith("/api/stores/store_1/customers/export?q=marie+dupont");
    expect(clicked).toHaveLength(1);
    expect(clicked[0].download).toBe("customers-2026-09-19.csv");
    expect(clicked[0].href).toContain("blob:customers");
  });

  it("omits the query string when nothing is searched and falls back to a dated filename", async () => {
    fetchMock.mockResolvedValue(new Response("Name", { status: 200 }));

    await downloadCustomersCsv("store_1");

    expect(fetchMock).toHaveBeenCalledWith("/api/stores/store_1/customers/export");
    expect(clicked[0].download).toMatch(/^customers-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it("surfaces the API's message when the export is refused", async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ success: false, error: { code: "FORBIDDEN", message: "Managers only" } }),
        { status: 403 }
      )
    );

    await expect(downloadCustomersCsv("store_1")).rejects.toThrow("Managers only");
    expect(clicked).toHaveLength(0);
  });
});
