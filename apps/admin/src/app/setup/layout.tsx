/**
 * Setup Layout
 * 
 * Pass-through layout — the setup page handles its own authentication
 * via magic link token. No server-side auth guard needed here.
 */

export default function SetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
