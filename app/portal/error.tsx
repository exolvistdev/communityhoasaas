"use client";

export default function PortalError({ reset }: { reset: () => void }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
      <h1 className="text-base font-semibold text-gray-900">
        Something went wrong
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        We couldn&apos;t load your portal just now.
      </p>
      <div className="mt-4 flex justify-center gap-2">
        <button
          onClick={reset}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          Try again
        </button>
        <form action="/auth/signout" method="post">
          <button className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
