/**
 * Strip a filename to a safe charset before it lands in a `Content-Disposition`
 * header — a stray `"` or control character in a DB-sourced value (a unit
 * number, a person's name) could otherwise break out of the header's quoted
 * filename parameter. Shared by every downloadable-file route (CSV and
 * otherwise), so a future export can't reintroduce this by hand.
 */
export function safeFilename(name: string) {
  return name.replace(/[^A-Za-z0-9._-]/g, "_");
}
