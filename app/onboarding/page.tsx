import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { tryGetOrgContext } from "@/lib/tenant";
import { OnboardingWizard } from "./wizard";

export const metadata = { title: "Get started · HOA SaaS" };

export default async function OnboardingPage() {
  const ctx = await tryGetOrgContext();

  // Fully onboarded (member of an HOA that already has properties) -> dashboard.
  if (ctx?.user) {
    const propertyCount = await prisma.property.count({
      where: { orgId: ctx.org!.id },
    });
    if (propertyCount > 0) redirect("/dashboard");
  }

  // signedIn but no HOA row -> finished step 1, resume at step 2.
  // signedIn + HOA row but no properties -> resume at step 2 (import).
  const resumeAtImport = Boolean(ctx?.authUser);

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6 py-12">
      <OnboardingWizard signedIn={resumeAtImport} />
    </main>
  );
}
