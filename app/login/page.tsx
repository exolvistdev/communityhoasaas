import { Suspense } from "react";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in · HOA SaaS" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="text-xl font-semibold text-gray-900">Sign in</h1>
      <p className="mt-1 text-sm text-gray-500">HOA management portal</p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
