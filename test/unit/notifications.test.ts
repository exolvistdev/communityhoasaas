import { describe, it, expect } from "vitest";
import {
  defaultPrefs,
  prefFor,
  esc,
  NOTIFICATION_CATALOG,
  type Recipient,
} from "@/lib/notifications";

const user = (over: Partial<Recipient> = {}): Recipient => ({
  id: "u1",
  email: "a@b.ph",
  emailNotifications: true,
  deactivatedAt: null,
  notificationPrefs: null,
  ...over,
});

describe("defaultPrefs", () => {
  it("is all-on across every category", () => {
    const p = defaultPrefs();
    for (const c of Object.values(p)) expect(c).toEqual({ email: true, inApp: true });
  });
});

describe("prefFor", () => {
  it("uses the catalog default when the user has no stored prefs", () => {
    expect(prefFor(user(), "MARKETPLACE_MESSAGE")).toEqual({
      email: NOTIFICATION_CATALOG.MARKETPLACE_MESSAGE.defaultEmail,
      inApp: NOTIFICATION_CATALOG.MARKETPLACE_MESSAGE.defaultInApp,
    });
  });

  it("silences a deactivated user on every channel", () => {
    expect(prefFor(user({ deactivatedAt: new Date() }), "DUES_ISSUED")).toEqual({
      email: false,
      inApp: false,
    });
  });

  it("the global email switch overrides a category opt-in", () => {
    const u = user({
      emailNotifications: false,
      notificationPrefs: { billing: { email: true, inApp: true } },
    });
    expect(prefFor(u, "DUES_ISSUED")).toEqual({ email: false, inApp: true });
  });

  it("a stored category opt-out wins over the catalog default", () => {
    const u = user({ notificationPrefs: { billing: { email: false, inApp: false } } });
    expect(prefFor(u, "PAYMENT_CONFIRMED")).toEqual({ email: false, inApp: false });
  });
});

describe("esc", () => {
  it("escapes the five HTML-significant characters", () => {
    expect(esc(`<a href="x" title='y'>Tom & Jerry</a>`)).toBe(
      "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;Tom &amp; Jerry&lt;/a&gt;"
    );
  });
});

describe("NOTIFICATION_CATALOG", () => {
  it("every entry names a category that has a prefs default", () => {
    const known = new Set(Object.keys(defaultPrefs()));
    for (const entry of Object.values(NOTIFICATION_CATALOG)) {
      expect(known.has(entry.category)).toBe(true);
    }
  });
});
