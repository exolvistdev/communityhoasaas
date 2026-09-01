import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentOrgContext } from "@/lib/tenant";
import { ProfileForm } from "./ProfileForm";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { ContactForm } from "./ContactForm";
import { NotificationToggle } from "./NotificationToggle";
import { BlockedResidents } from "./BlockedResidents";

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

  const homeowner =
    user.role === "HOMEOWNER"
      ? await prisma.homeowner.findFirst({ where: { userId: user.id } })
      : null;

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
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← Back
        </Link>
        <h1 className="mt-1 text-lg font-semibold text-gray-900">Account</h1>
        <p className="text-sm text-gray-500">
          {org.name} · {ROLE_LABEL[user.role] ?? user.role}
        </p>
      </div>

      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Profile</h2>
        <p className="text-sm text-gray-500">
          Login email: <span className="text-gray-900">{user.email}</span>
        </p>
        <ProfileForm fullName={user.fullName} />
      </section>

      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Password</h2>
        <ChangePasswordForm />
      </section>

      <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Notifications</h2>
        <NotificationToggle enabled={user.emailNotifications} />
      </section>

      {user.role === "HOMEOWNER" && (
        <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">
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

      {homeowner && (
        <section className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Contact info
            </h2>
            <p className="text-xs text-gray-400">
              Shown to your HOA office — separate from your login email.
            </p>
          </div>
          <ContactForm phone={homeowner.phone} email={homeowner.email} />
        </section>
      )}
    </main>
  );
}
