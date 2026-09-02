import { Suspense } from "react";
import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in · HOA SaaS" };

export default function LoginPage() {
  return (
    <AuthShell
      title="Sign in"
      subtitle="Welcome back to your HOA workspace."
      footer={
        <>
          New HOA?{" "}
          <Link href="/onboarding" className="text-brand-accent hover:underline">
            Set one up
          </Link>
          <span className="mx-1.5 text-fg-subtle">·</span>
          <Link href="/privacy" className="text-brand-accent hover:underline">
            Privacy
          </Link>
        </>
      }
    >
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
