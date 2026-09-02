/** Tiny classNames joiner — filters falsy, joins with a space. */
export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}
