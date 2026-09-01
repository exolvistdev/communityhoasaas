import { redirect } from "next/navigation";
import { tryGetOrgContext } from "@/lib/tenant";

export default async function Home() {
  const ctx = await tryGetOrgContext();
  if (!ctx?.authUser) redirect("/login");
  if (!ctx.user) redirect("/onboarding");

  switch (ctx.user.role) {
    case "GUARD":
      redirect("/guard");
    case "HOMEOWNER":
      redirect("/portal");
    default:
      redirect("/dashboard");
  }
}
