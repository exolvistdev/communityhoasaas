import { requirePermission } from "@/lib/rbac";
import { toTypeRateDefaults } from "@/lib/rate";
import { ImportClient } from "./ImportClient";

export const metadata = { title: "Import properties · HOA SaaS" };

export default async function ImportPropertiesPage() {
  const { org } = await requirePermission("property:write");
  return <ImportClient typeDefaults={toTypeRateDefaults(org)} />;
}
