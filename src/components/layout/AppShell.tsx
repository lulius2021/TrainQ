// src/components/layout/AppShell.tsx
type AppShellProps = {
  children: React.ReactNode;
  bottomNav?: React.ReactNode;
};

export function AppShell({ children, bottomNav }: AppShellProps) {
  return (
    <div className="min-h-screen w-full flex flex-col" style={{ background: "transparent", color: "var(--text)" }}>
      <main
        className="flex-1 overflow-auto px-4 pt-4"
        style={{
          paddingBottom: "calc(84px + env(safe-area-inset-bottom))",
          background: "transparent",
        }}
      >
        <div className="mx-auto w-full max-w-md">{children}</div>
      </main>

      {bottomNav}
    </div>
  );
}