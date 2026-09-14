import { describe, it, expect } from "vitest";
import { emailShell } from "@/lib/email";

describe("emailShell", () => {
  it("escapes heading, since it can carry resident-controlled text (e.g. a marketplace listing title)", () => {
    const html = emailShell({
      heading: `<img src=x onerror=alert(1)>`,
      bodyHtml: "<p>body</p>",
      ctaHref: "/x",
      ctaLabel: "Open",
    });
    expect(html).not.toContain("<img src=x onerror=alert(1)>");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("escapes ctaLabel", () => {
    const html = emailShell({
      heading: "Heading",
      bodyHtml: "<p>body</p>",
      ctaHref: "/x",
      ctaLabel: `"><script>alert(1)</script>`,
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("leaves bodyHtml raw, since callers are expected to pre-escape/compose it", () => {
    const html = emailShell({
      heading: "Heading",
      bodyHtml: "<p><strong>Bold</strong></p>",
      ctaHref: "/x",
      ctaLabel: "Open",
    });
    expect(html).toContain("<p><strong>Bold</strong></p>");
  });
});
