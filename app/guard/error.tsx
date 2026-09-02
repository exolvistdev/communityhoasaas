"use client";

export default function GuardError({ reset }: { reset: () => void }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-8 text-center">
      <h1 className="text-base font-semibold text-fg">
        Something went wrong
      </h1>
      <p className="mt-1 text-sm text-fg-muted">
        The gate screen couldn&apos;t load.
      </p>
      <button
        onClick={reset}
        className="mt-4 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:brightness-110"
      >
        Try again
      </button>
    </div>
  );
}
