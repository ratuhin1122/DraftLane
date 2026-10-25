export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="auth-shell flex min-w-0 flex-1 items-center justify-center px-4 py-8 sm:px-6">{children}</div>;
}
