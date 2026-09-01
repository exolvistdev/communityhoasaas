"use client";

export default function GuardError({ reset }: { reset: () => void }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
      <h1 className="text-base font-semibold text-gray-900">
        Something went wrong
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        The gate screen couldn&apos;t load.
      </p>
      <button
        onClick={reset}
        className="mt-4 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
      >
        Try again
      </button>
    </div>
  );
}
