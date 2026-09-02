import { Eye } from "lucide-react";
import { stopImpersonation } from "@/app/platform/actions";

export function ImpersonationBanner({
  name,
  role,
}: {
  name: string;
  role: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 bg-brand px-4 py-1.5 text-xs font-medium text-brand-fg">
      <span className="flex items-center gap-1.5">
        <Eye className="h-3.5 w-3.5" />
        Viewing as {name} ({role.toLowerCase().replace("_", " ")})
      </span>
      <form action={stopImpersonation}>
        <button className="rounded-md bg-white/15 px-2 py-0.5 hover:bg-white/25">
          Stop impersonating
        </button>
      </form>
    </div>
  );
}
