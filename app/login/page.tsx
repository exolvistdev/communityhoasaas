import { Suspense } from "react";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in · HOA SaaS" };

export default function LoginPage() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      {/* Left hero */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-12 text-slate-200 lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-950/40">
            <Building2 className="h-5 w-5" />
          </span>
          <span className="text-sm font-semibold text-white">HOA Manager</span>
        </div>

        <div className="max-w-sm">
          <p className="text-2xl font-semibold leading-snug text-white">
            Billing, records and gate security for your subdivision — in one
            place.
          </p>
          <p className="mt-3 text-sm text-slate-400">
            Accurate dues, an auditable ledger, and a portal your homeowners
            actually use.
          </p>
        </div>

        <p className="text-xs text-slate-500">
          Multi-tenant HOA management · Philippine market
        </p>
      </div>

      {/* Right form */}
      <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-50/50 p-6 sm:p-8">
        <div className="w-full max-w-md space-y-6">
          <div className="flex flex-col items-center text-center">
            <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/25">
              <Building2 className="h-7 w-7" />
            </span>
            <p className="text-sm font-medium text-slate-500">HOA Manager</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">Sign in</h1>
            <p className="mt-2 text-sm text-slate-500">
              Welcome back to your HOA workspace.
            </p>
          </div>

          <Suspense>
            <LoginForm />
          </Suspense>

          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span>
              New HOA?{" "}
              <Link
                href="/onboarding"
                className="font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
              >
                Start your free 30-day trial
              </Link>
            </span>
            <span aria-hidden="true" className="text-slate-300">
              •
            </span>
            <Link
              href="/forgot-password"
              className="whitespace-nowrap font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
            >
              Forgot password?
            </Link>
            <span aria-hidden="true" className="text-slate-300">
              •
            </span>
            <Link
              href="/privacy"
              className="font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
            >
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
