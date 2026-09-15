/**
 * Validate a post-action redirect target (e.g. `/login?next=...`) as a
 * same-site relative path, for use before `router.push`/`redirect`. No
 * imports — safe from both client and server components.
 *
 * Strips ASCII tab/newline/CR first: the WHATWG URL parser (and hence a
 * browser navigation) strips those characters from anywhere in the string
 * before parsing, so `"/\t/evil.com"` would otherwise sail past a naive
 * `!startsWith("//")` check and still resolve to a protocol-relative
 * `//evil.com` once the browser gets its hands on it.
 */
export function safeRelativePath(raw: string | null | undefined): string {
  const stripped = (raw ?? "").replace(/[\t\r\n]/g, "");
  return stripped.startsWith("/") && !/^\/[\\/]/.test(stripped) ? stripped : "/";
}
