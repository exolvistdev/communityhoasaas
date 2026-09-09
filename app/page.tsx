import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { tryGetOrgContext } from "@/lib/tenant";
import { MarketingShell } from "@/components/marketing/MarketingShell";
import { HomeSections } from "@/components/marketing/HomeSections";

export const metadata: Metadata = {
  title: "HOA Manager — HOA & condo management for the Philippines",
  description:
    "Dues billing, an auditable ledger, a resident portal, and gate security in one system built for Philippine subdivisions, villages and condominiums — GCash, Maya, and pesos.",
  alternates: { canonical: "/" },
};

export default async function Home() {
  const ctx = await tryGetOrgContext();

  if (ctx?.authUser) {
    if (!ctx.user) redirect("/onboarding");
    if (ctx.user.role === "GUARD") redirect("/guard");
    if (ctx.user.role === "HOMEOWNER") redirect("/portal");
    redirect("/dashboard");
  }

  return (
    <MarketingShell>
      <HomeSections />
    </MarketingShell>
  );
}
