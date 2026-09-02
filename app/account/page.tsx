import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { ProfileForm } from "./ProfileForm";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { ContactForm } from "./ContactForm";
import { NotificationPreferences } from "./NotificationPreferences";
import { BlockedResidents } from "./BlockedResidents";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { CATEGORIES, defaultPrefs } from "@/lib/notifications";

export const metadata = { title: "Account · HOA SaaS" };

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  TREASURER: "Treasurer",
  BOARD_MEMBER: "Board member",
  GUARD: "Guard",
  HOMEOWNER: "Homeowner",
};

const HOME_HREF: Record<string, string> = {
  ADMIN: "/dashboard",
  TREASURER: "/dashboard",
  BOARD_MEMBER: "/dashboard",
  GUARD: "/guard",
  HOMEOWNER: "/portal",
};

export default async function AccountPage() {
  const { user, org } = await getCurrentOrgContext();

  const homeownerLinks = await prisma.homeowner.findMany({
    where: { userId: user.id },
    include: { property: { select: { unitNumber: true } } },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });

  const base = defaultPrefs();
  const stored = (user.notificationPrefs ?? {}) as Record<
    string,
    { email?: boolean; inApp?: boolean }
  >;
  const prefs = Object.fromEntries(
    CATEGORIES.map((c) => [
      c.key,
      {
        email: stored[c.key]?.email ?? base[c.key].email,
        inApp: stored[c.key]?.inApp ?? base[c.key].inApp,
      },
    ])
  );

  const blocked =
    user.role === "HOMEOWNER"
      ? await prisma.marketplaceBlock.findMany({
          where: { blockerId: user.id },
          include: { blocked: { select: { id: true, fullName: true } } },
          orderBy: { createdAt: "desc" },
        })
      : [];

  return (
    <main className="mx-auto max-w-md space-y-6 px-6 py-8">
      <div>
        <Link
          href={HOME_HREF[user.role] ?? "/"}
          className="text-sm text-fg-muted hover:text-fg"
        >
          ← Back
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-fg">Account</h1>
        <p className="text-sm text-fg-muted">
          {org.name} · {ROLE_LABEL[user.role] ?? user.role}
        </p>
      </div>

      <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-fg">Profile</h2>
        <p className="text-sm text-fg-muted">
          Login email: <span className="text-fg">{user.email}</span>
        </p>
        <ProfileForm fullName={user.fullName} />
      </section>

      <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-fg">Password</h2>
        <ChangePasswordForm />
      </section>

      <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-fg">Appearance</h2>
        <div className="flex items-center justify-between">
          <span className="text-sm text-fg-muted">Theme</span>
          <ThemeToggle />
        </div>
      </section>

      <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-fg">Notifications</h2>
        <NotificationPreferences
          categories={CATEGORIES.map((c) => ({ ...c }))}
          emailNotifications={user.emailNotifications}
          prefs={prefs}
        />
      </section>

      {user.role === "HOMEOWNER" && (
        <section className="space-y-3 rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold text-fg">
            Blocked residents
          </h2>
          <BlockedResidents
            blocked={blocked.map((b) => ({
              id: b.blocked.id,
              name: b.blocked.fullName,
            }))}
          />
        </section>
      )}

      {homeownerLinks.map((h) => (
        <section
          key={h.id}
          className="space-y-3 rounded-lg border border-border bg-surface p-4"
        >
          <div>
            <h2 className="text-sm font-semibold text-fg">
              Contact info
              {homeownerLinks.length > 1 && (
                <span className="ml-2 font-normal text-fg-muted">
                  · {h.property.unitNumber}
                </span>
              )}
            </h2>
            <p className="text-xs text-fg-subtle">
              Shown to your HOA office — separate from your login email.
            </p>
          </div>
          <ContactForm
            homeownerId={h.id}
            phone={h.phone}
            email={h.email}
          />
        </section>
      ))}
    </main>
  );
}
