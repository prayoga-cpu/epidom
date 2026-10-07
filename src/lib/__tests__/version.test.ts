import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_RELEASE_DATE, APP_VERSION } from "../version";

/**
 * A release bumps three places together (AGENTS.md "Changelog & versioning"):
 * package.json, src/lib/version.ts and a new CHANGELOG.md header. The home page
 * shows APP_VERSION and APP_RELEASE_DATE as its "latest release" fact, so they
 * must describe the build that is actually running.
 */
const root = resolve(__dirname, "../../..");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as { version: string };
const changelog = readFileSync(resolve(root, "CHANGELOG.md"), "utf8");
const headers = [...changelog.matchAll(/^## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})/gm)];

describe("release version", () => {
  it("matches package.json", () => {
    expect(APP_VERSION).toBe(pkg.version);
  });

  it("is the newest CHANGELOG.md entry", () => {
    expect(headers.length).toBeGreaterThan(0);
    expect(headers[0][1]).toBe(APP_VERSION);
  });

  it("carries the date on its CHANGELOG.md header", () => {
    const header = headers.find(([, version]) => version === APP_VERSION);
    expect(header, `no CHANGELOG.md header for ${APP_VERSION}`).toBeDefined();
    expect(APP_RELEASE_DATE).toBe(header![2]);
  });
});
