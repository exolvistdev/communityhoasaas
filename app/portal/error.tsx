"use client";

export default function PortalError({ reset }: { reset: () => void }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-8 text-center">
      <h1 className="text-base font-semibold text-fg">
        Something went wrong
      </h1>
      <p className="mt-1 text-sm text-fg-muted">
        We couldn&apos;t load your portal just now.
      </p>
      <div className="mt-4 flex justify-center gap-2">
        <button
          onClick={reset}
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:brightness-110"
        >
          Try again
        </button>
        <form action="/auth/signout" method="post">
          <button className="rounded-md border border-border bg-surface px-4 py-2 text-sm hover:bg-surface-2">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
