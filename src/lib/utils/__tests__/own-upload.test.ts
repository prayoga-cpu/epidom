import { describe, it, expect } from "vitest";
import { isOwnUpload } from "../own-upload";

const HOST = "https://abc123.public.blob.vercel-storage.com";

describe("isOwnUpload", () => {
  it("accepts what /api/upload writes for this account", () => {
    expect(isOwnUpload(`${HOST}/users/u1/images/1700000000000-roster.png`, "u1")).toBe(true);
  });

  it("refuses another account's file on the same host", () => {
    expect(isOwnUpload(`${HOST}/users/u2/images/1-logo.png`, "u1")).toBe(false);
  });

  it("does not confuse an id that merely starts the same (u1 vs u10)", () => {
    expect(isOwnUpload(`${HOST}/users/u10/images/1-x.png`, "u1")).toBe(false);
  });

  it("refuses this account's other folders — only the images folder is an upload of this kind", () => {
    expect(isOwnUpload(`${HOST}/users/u1/exports/data.csv`, "u1")).toBe(false);
  });

  it("looks at the PATH, so the id can't be smuggled in a query string or fragment", () => {
    expect(isOwnUpload(`${HOST}/other/x.png?p=/users/u1/images/`, "u1")).toBe(false);
    expect(isOwnUpload(`${HOST}/other/x.png#/users/u1/images/`, "u1")).toBe(false);
  });

  it("refuses anything that is not a URL", () => {
    expect(isOwnUpload("users/u1/images/x.png", "u1")).toBe(false);
    expect(isOwnUpload("", "u1")).toBe(false);
  });
});
