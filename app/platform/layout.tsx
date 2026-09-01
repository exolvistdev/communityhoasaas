// Bare wrapper. Auth lives in (console)/layout.tsx so /platform/login — which
// is also under /platform — is reachable without a platform-admin session.
export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
