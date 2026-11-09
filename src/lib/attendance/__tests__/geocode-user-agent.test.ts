import { describe, it, expect, vi, afterEach } from "vitest";
import { SUPPORT_EMAIL_PRIMARY } from "@/lib/constants/contact";
import { reverseGeocode } from "../geocode";

/** The headers the geocoder sent on its one fetch. */
async function sentHeaders(): Promise<Record<string, string>> {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ display_name: "Jl. Sudirman, Jakarta" }),
  });
  vi.stubGlobal("fetch", fetchMock);

  await reverseGeocode(-6.2, 106.8);

  expect(fetchMock).toHaveBeenCalledTimes(1);
  return fetchMock.mock.calls[0][1].headers;
}

describe("reverseGeocode User-Agent", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("names the support inbox as the contact", async () => {
    const headers = await sentHeaders();

    expect(headers["User-Agent"]).toContain(`contact: ${SUPPORT_EMAIL_PRIMARY})`);
  });

  it("names no Prionation address: that studio inbox is for new-development clients only", async () => {
    const headers = await sentHeaders();

    expect(headers["User-Agent"]).not.toContain("prionation.io");
  });

  it("still identifies the app and the purpose, as Nominatim's usage policy asks", async () => {
    const headers = await sentHeaders();

    expect(headers["User-Agent"]).toMatch(
      /^epidom-app\/1\.0 \(attendance-clock-in; contact: .+@.+\)$/
    );
    expect(headers.Accept).toBe("application/json");
  });
});
