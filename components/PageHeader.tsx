/**
 * Shared page-header: title (+ optional description) on the left, an optional
 * action on the right. Stacks vertically on mobile (action drops below the
 * title as a full-width button); side-by-side from `sm` up.
 *
 * `action` can be a bare <button>/<Link>, a fragment of several, or a feature
 * client component whose render root is a trigger button. The action wrapper is
 * a flex container: on mobile it stacks its children full-width (flex items are
 * blockified, so even an unstyled <a> stretches); from `sm` up they sit inline
 * at content width. Centering is scoped to direct <button>/<a> so it never
 * reaches into a Manager's open-state modal (a `fixed` <div> root).
 */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold text-fg">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-fg-muted">{description}</p>
        )}
      </div>
      {action && (
        <div className="flex shrink-0 flex-col gap-2 [&>a]:text-center [&>button]:justify-center [&>button]:text-center sm:flex-row sm:items-center sm:[&>a]:text-left sm:[&>button]:justify-start sm:[&>button]:text-left">
          {action}
        </div>
      )}
    </div>
  );
}
