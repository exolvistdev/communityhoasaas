import { stopImpersonation } from "@/app/platform/actions";

export function ImpersonationBanner({
  name,
  role,
}: {
  name: string;
  role: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 bg-amber-500 px-4 py-1.5 text-xs font-medium text-amber-950">
      <span>
        🕵️ Viewing as {name} ({role.toLowerCase().replace("_", " ")})
      </span>
      <form action={stopImpersonation}>
        <button className="underline hover:no-underline">
          Stop impersonating
        </button>
      </form>
    </div>
  );
}
