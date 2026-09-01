import { PlatformLoginForm } from "./PlatformLoginForm";

export const metadata = { title: "Platform sign in" };

export default function PlatformLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-950 px-6">
      <div className="w-full max-w-sm">
        <div className="mb-2 inline-block rounded bg-gray-800 px-2 py-0.5 text-xs font-medium tracking-wide text-gray-300">
          PLATFORM
        </div>
        <h1 className="text-xl font-semibold text-white">Operator sign in</h1>
        <p className="mt-1 text-sm text-gray-400">
          Not an HOA login — this is for platform staff only.
        </p>
        <PlatformLoginForm />
      </div>
    </main>
  );
}
