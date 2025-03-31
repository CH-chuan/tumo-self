"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Icons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);

  useEffect(() => {
    // Only check setup status if not already in the process of logging in
    if (!isLoading) {
      const checkSetupStatus = async () => {
        try {
          const response = await fetch("/api/auth/user-exists");
          const data = await response.json();

          if (!data.exists) {
            setSetupRequired(true);
            // Redirect to setup page if no users exist
            router.push("/setup");
          } else {
            // Users exist, just mark setup as not required
            setSetupRequired(false);
            setCheckingSetup(false);
          }
        } catch (error) {
          console.error("Error checking user existence:", error);
          // If we can't determine if users exist, assume setup is required
          setSetupRequired(true);
          router.push("/setup");
        } finally {
          setCheckingSetup(false);
        }
      };

      checkSetupStatus();
    }
  }, [router, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prevent multiple submissions
    if (isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log("Attempting sign in...");
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      console.log("Sign in result:", result);

      if (result?.error) {
        console.error("Sign in error:", result.error);
        setError("Invalid email or password");
        setIsLoading(false);
        return;
      }

      if (!result?.ok) {
        console.error("Sign in not OK", result);
        setError("Authentication failed. Please try again.");
        setIsLoading(false);
        return;
      }

      console.log("Sign in successful, navigating to home");

      // Use window.location for a full page reload instead of client-side navigation
      // This ensures the session is fully established before rendering the dashboard
      window.location.href = "/";
    } catch (error) {
      console.error("Sign in exception:", error);
      setError("Something went wrong. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("grid gap-6", className)} {...props}>
      {checkingSetup ? (
        <div className="flex justify-center items-center py-8">
          <Icons.spinner className="h-8 w-8 animate-spin" />
        </div>
      ) : setupRequired ? (
        <div className="text-center py-8">
          <h2 className="text-xl font-semibold mb-2">System Setup Required</h2>
          <p className="text-muted-foreground mb-4">
            No users found. Please set up the first admin user.
          </p>
          <Button onClick={() => router.push("/setup")}>Go to Setup</Button>
        </div>
      ) : (
        <>
          {error && (
            <div className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  placeholder="name@example.com"
                  type="email"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect="off"
                  disabled={isLoading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  disabled={isLoading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <div className="flex justify-end">
                  <Link
                    href="/forgot-password"
                    className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
              </div>

              <Button disabled={isLoading} type="submit" className="w-full">
                {isLoading && <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />}
                Sign In
              </Button>
            </div>
          </form>

          <div className="text-center text-sm">
            <Link
              href="/register"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Don't have an account? Sign up
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
