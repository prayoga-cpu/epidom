import { describe, it, expect, vi, beforeEach } from "vitest";

const getSignedUrl = vi.fn();
vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: (...a: unknown[]) => getSignedUrl(...a),
}));
const isR2Configured = vi.fn();
vi.mock("@/lib/backup/r2-client", () => ({
  isR2Configured: () => isR2Configured(),
  getR2Client: () => ({ client: true }),
}));

import { GET } from "@/app/api/public/sales-pages/video/route";

describe("GET /api/public/sales-pages/video", () => {
  beforeEach(() => {
    getSignedUrl.mockReset();
    isR2Configured.mockReset();
    delete process.env.R2_MEDIA_BUCKET;
  });

  it("redirects to a short-lived signed link to the one video object", async () => {
    isR2Configured.mockReturnValue(true);
    getSignedUrl.mockResolvedValue(
      "https://acc.r2.cloudflarestorage.com/epidom/videos/VSL.mp4?X-Amz-Signature=abc"
    );

    const res = await GET();

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/epidom/videos/VSL.mp4?X-Amz-Signature=abc");
    const [, command, options] = getSignedUrl.mock.calls[0];
    expect(command.input).toEqual({ Bucket: "epidom", Key: "videos/VSL.mp4" });
    expect(options).toEqual({ expiresIn: 6 * 60 * 60 });
  });

  it("404 when R2 isn't configured, 503 when signing fails", async () => {
    isR2Configured.mockReturnValue(false);
    expect((await GET()).status).toBe(404);
    isR2Configured.mockReturnValue(true);
    getSignedUrl.mockRejectedValue(new Error("boom"));
    expect((await GET()).status).toBe(503);
  });
});
