import { redirect } from "next/navigation";
import { tryGetOrgContext } from "@/lib/tenant";
import { isOrgLocked } from "@/lib/trial";

export const metadata = { title: "Trial ended · HOA SaaS" };

const fmt = (d: Date) =>
  d.toLocaleDateString("en-PH", { day: "numeric", month: "long", year: "numeric" });

// TODO: replace with your real sales/support contact before go-live.
const SUPPORT_EMAIL = "hello@hoasaas.ph";

export default async function TrialEndedPage() {
  // tryGetOrgContext() never redirects — safe to call from the page a locked
  // org gets redirected TO (getCurrentOrgContext() would loop here otherwise).
  const ctx = await tryGetOrgContext();

  // Nothing to see here unless this org is actually locked right now.
  if (!ctx?.org || !isOrgLocked(ctx.org)) redirect("/");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 py-12 text-center">
      <div className="max-w-sm space-y-4">
        <h1 className="text-xl font-semibold text-fg">Your trial has ended</h1>
        <p className="text-sm text-fg-muted">
          {ctx.org.name}&rsquo;s free 30-day trial of HOA Manager ended on{" "}
          {ctx.org.trialEndsAt ? fmt(ctx.org.trialEndsAt) : "the trial deadline"}.
          Get in touch to continue — we&rsquo;ll pick up right where you left off.
        </p>
        <a
          href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
            `Continue our HOA Manager trial — ${ctx.org.name}`
          )}`}
          className="inline-block rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white hover:brightness-110"
        >
          Contact us to continue
        </a>
        <form action="/auth/signout" method="post" className="pt-2">
          <button className="text-sm text-fg-subtle hover:text-fg hover:underline">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
