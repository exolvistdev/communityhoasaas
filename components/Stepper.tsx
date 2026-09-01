export function Stepper({
  steps,
  current,
}: {
  steps: string[];
  current: number; // 1-based
}) {
  return (
    <ol className="flex items-center gap-3 text-sm">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} className="flex items-center gap-3">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                active
                  ? "bg-gray-900 text-white"
                  : done
                  ? "bg-green-600 text-white"
                  : "bg-gray-200 text-gray-500"
              }`}
            >
              {done ? "✓" : n}
            </span>
            <span
              className={active ? "font-medium text-gray-900" : "text-gray-500"}
            >
              {label}
            </span>
            {n < steps.length && (
              <span className="ml-1 h-px w-8 bg-gray-300" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}
