import { describe, it, expect, vi, beforeEach } from "vitest";

// Vitest hoists `vi.mock` calls above every import in the file (including the
// one below), so `generateInviteLink` sees these mocks regardless of source
// order. `vi.hoisted()` is the documented way to define variables a hoisted
// factory can safely reference — a plain `const` here would hoist the
// `vi.mock` calls above the declaration and throw a TDZ error.
const { mockGenerateLink, mockFindPlatformAdmin } = vi.hoisted(() => ({
  mockGenerateLink: vi.fn(),
  mockFindPlatformAdmin: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ auth: { admin: { generateLink: mockGenerateLink } } }),
}));
vi.mock("@/lib/url", () => ({ siteOrigin: () => "https://app.example" }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { platformAdmin: { findFirst: mockFindPlatformAdmin } },
}));

import { inviteEmailHtml, generateInviteLink } from "@/lib/invites";

const LINK =
  "https://ref.supabase.co/auth/v1/verify?token=abc123&type=invite&redirect_to=https%3A%2F%2Fapp.example%2Faccept-invite";

describe("inviteEmailHtml", () => {
  it("names the org and greets the person", () => {
    const html = inviteEmailHtml({
      orgName: "Sample Subdivision HOA",
      fullName: "Maria Santos",
      actionLink: LINK,
    });
    expect(html).toContain("Sample Subdivision HOA");
    expect(html).toContain("Hi Maria Santos");
  });

  it("uses the action link verbatim as the CTA href", () => {
    const html = inviteEmailHtml({ orgName: "X HOA", actionLink: LINK });
    expect(html).toContain(`href="${LINK}"`);
    expect(html).toContain("Set your password");
  });

  it("includes the role clause only when given", () => {
    const withRole = inviteEmailHtml({
      orgName: "X HOA",
      role: "the treasurer",
      actionLink: LINK,
    });
    expect(withRole).toContain("as the treasurer");

    const without = inviteEmailHtml({ orgName: "X HOA", actionLink: LINK });
    expect(without).not.toContain(" as ");
  });

  it("escapes HTML in the name and org", () => {
    const html = inviteEmailHtml({
      orgName: "A & B <HOA>",
      fullName: 'Bad "Name" <x>',
      actionLink: LINK,
    });
    expect(html).toContain("A &amp; B &lt;HOA&gt;");
    expect(html).not.toContain("<HOA>");
    expect(html).toContain("Bad &quot;Name&quot; &lt;x&gt;");
  });

  it("falls back to a generic greeting without a name", () => {
    const html = inviteEmailHtml({ orgName: "X HOA", actionLink: LINK });
    expect(html).toContain("Hi there,");
  });

  it("does not carry the notification opt-out footer", () => {
    const html = inviteEmailHtml({ orgName: "X HOA", actionLink: LINK });
    expect(html).not.toMatch(/turn these emails off|account settings/i);
    expect(html).toContain("ask your HOA admin to resend it");
  });
});

// CR1 regression: generateInviteLink must never fall back to a magic link
// when an "invite" link can't be issued (most commonly because `email`
// already has a Supabase auth account) — a magic link is a working login for
// whatever account already owns that address, and every caller only reaches
// this branch after its own "does a local User exist" check has already
// missed (e.g. a PlatformAdmin, who by design has no local User row).
describe("generateInviteLink", () => {
  beforeEach(() => {
    mockGenerateLink.mockReset();
    mockFindPlatformAdmin.mockReset();
    mockFindPlatformAdmin.mockResolvedValue(null); // no match by default
  });

  it("rejects a PlatformAdmin's email without ever calling Supabase — the account belongs to no org, so no caller's own 'existing User' check can ever see it", async () => {
    mockFindPlatformAdmin.mockResolvedValueOnce({ id: "pa-1" });

    const result = await generateInviteLink("superadmin@hoasaas.ph");

    expect(result).toEqual({
      ok: false,
      error: "Couldn't send an invite to that address.",
    });
    expect(mockGenerateLink).not.toHaveBeenCalled();
  });

  it("returns a generic failure — and calls generateLink exactly once — when the invite link fails", async () => {
    mockGenerateLink.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "User already registered" },
    });

    const result = await generateInviteLink("superadmin@hoasaas.ph");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      // Generic — never echoes Supabase's "already registered" (account
      // enumeration), and never a login link for the existing account.
      expect(result.error).not.toMatch(/already registered|already exists/i);
    }
    // The whole vulnerability was a second call with `type: "magiclink"` —
    // assert it's never made at all.
    expect(mockGenerateLink).toHaveBeenCalledTimes(1);
    expect(mockGenerateLink).toHaveBeenCalledWith(
      expect.objectContaining({ type: "invite" })
    );
  });

  it("succeeds normally when the invite link is issued", async () => {
    mockGenerateLink.mockResolvedValueOnce({
      data: { user: { id: "auth-123" }, properties: { action_link: LINK } },
      error: null,
    });

    const result = await generateInviteLink("new-person@example.com");

    expect(result).toEqual({ ok: true, authId: "auth-123", actionLink: LINK });
    expect(mockGenerateLink).toHaveBeenCalledTimes(1);
  });
});
