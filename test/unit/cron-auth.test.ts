import { describe, it, expect, afterEach, vi } from "vitest";
import { cronAuthorized, requireCronAuth } from "@/lib/cron-auth";

function req(authorization?: string): Request {
  return new Request("http://localhost/api/cron/x", {
    headers: authorization ? { authorization } : {},
  });
}

describe("cronAuthorized", () => {
  it("accepts the exact bearer token", () => {
    expect(cronAuthorized(req("Bearer s3cr3t"), "s3cr3t")).toBe(true);
  });

  it("rejects a wrong token", () => {
    expect(cronAuthorized(req("Bearer wrong"), "s3cr3t")).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(cronAuthorized(req(), "s3cr3t")).toBe(false);
  });

  it("rejects a token that's a prefix or superstring of the real one", () => {
    expect(cronAuthorized(req("Bearer s3cr3"), "s3cr3t")).toBe(false);
    expect(cronAuthorized(req("Bearer s3cr3txx"), "s3cr3t")).toBe(false);
  });

  it("is case-sensitive and scheme-sensitive", () => {
    expect(cronAuthorized(req("bearer s3cr3t"), "s3cr3t")).toBe(false);
    expect(cronAuthorized(req("s3cr3t"), "s3cr3t")).toBe(false);
  });
});

describe("requireCronAuth", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("503s when CRON_SECRET isn't configured, even with a token supplied", () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = requireCronAuth(req("Bearer anything"));
    expect(res?.status).toBe(503);
  });

  it("401s on a wrong token", () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t");
    const res = requireCronAuth(req("Bearer wrong"));
    expect(res?.status).toBe(401);
  });

  it("returns null (proceed) on the correct token", () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t");
    expect(requireCronAuth(req("Bearer s3cr3t"))).toBeNull();
  });
});
