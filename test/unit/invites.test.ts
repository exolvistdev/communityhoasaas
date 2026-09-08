import { describe, it, expect } from "vitest";
import { inviteEmailHtml } from "@/lib/invites";

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
