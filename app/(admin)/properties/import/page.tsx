import { requirePermission } from "@/lib/rbac";
import { ImportClient } from "./ImportClient";

export const metadata = { title: "Import properties · HOA SaaS" };

export default async function ImportPropertiesPage() {
  await requirePermission("property:write");
  return <ImportClient />;
}
