import { Card } from "@/components/ui/card";
import { PlatformLoginForm } from "./PlatformLoginForm";

export const metadata = { title: "Platform sign in" };

export default function PlatformLoginPage() {
  return (
    <div className="force-dark flex min-h-screen items-center justify-center bg-bg px-6 text-fg">
      <div className="w-full max-w-sm">
        <span className="mb-2 inline-block rounded-md bg-surface-2 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-fg-muted">
          Platform
        </span>
        <h1 className="text-xl font-semibold text-fg">Operator sign in</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Not an HOA login — this is for platform staff only.
        </p>
        <Card className="mt-5 p-6">
          <PlatformLoginForm />
        </Card>
      </div>
    </div>
  );
}
