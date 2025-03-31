export default function SetupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center pt-16 sm:pt-24">
      <div className="mx-auto w-full max-w-sm space-y-6 px-4">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Admin Account Setup</h1>
          <p className="text-sm text-muted-foreground">Set up your admin account to get started</p>
        </div>
        {children}
      </div>
    </div>
  );
}
