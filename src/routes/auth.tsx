import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSession } from "@/hooks/use-session";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — FaithTrack" },
      {
        name: "description",
        content:
          "Sign in or create your FaithTrack account to track Bible study, join your group and follow your reading plan.",
      },
      { property: "og:title", content: "Sign in — FaithTrack" },
      {
        property: "og:description",
        content: "Access your FaithTrack Bible study dashboard.",
      },
    ],
  }),
  component: AuthPage,
});

const credentials = z.object({
  email: z.string().trim().email("Enter a valid email address").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [busy, setBusy] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard", replace: true });
  }, [loading, session, navigate]);

  function validate() {
    const result = credentials.safeParse({ email, password });
    if (!result.success) {
      toast.error(result.error.issues[0]?.message ?? "Check your details");
      return null;
    }
    return result.data;
  }

  async function signIn() {
    const data = validate();
    if (!data) return;
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword(data);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }

  async function signUp() {
    const data = validate();
    if (!data) return;
    if (fullName.trim().length < 2) {
      toast.error("Please enter your full name");
      return;
    }
    setBusy(true);
    const { data: result, error } = await supabase.auth.signUp({
      ...data,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName.trim() },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (result.session) {
      navigate({ to: "/dashboard", replace: true });
      return;
    }
    setPendingEmail(data.email);
  }

  async function resetPassword() {
    const parsed = z.string().trim().email().safeParse(email);
    if (!parsed.success) {
      toast.error("Enter the email address on your account");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password reset link sent. Check your inbox.");
  }

  async function googleSignIn() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed. Please try again.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="bg-hero px-4 py-10 text-center">
        <Link to="/" className="inline-flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary-foreground/15 text-primary-foreground">
            <BookOpen className="size-4" />
          </span>
          <span className="font-display text-lg text-primary-foreground">FaithTrack</span>
        </Link>
        <h1 className="mt-5 text-2xl text-primary-foreground sm:text-3xl">
          Welcome to your study circle
        </h1>
        <p className="mt-2 text-sm text-primary-foreground/75">
          Bible study accountability for your church family.
        </p>
      </div>

      <div className="mx-auto -mt-8 w-full max-w-md px-4 pb-16">
        <div className="surface-card p-5 sm:p-6">
          {pendingEmail ? (
            <div className="text-center">
              <h2 className="text-xl text-foreground">Confirm your email</h2>
              <p className="mt-3 text-sm text-muted-foreground">
                We sent a verification link to <span className="font-medium">{pendingEmail}</span>.
                Click it to activate your account, then sign in.
              </p>
              <Button className="mt-6 w-full" variant="outline" onClick={() => setPendingEmail(null)}>
                Back to sign in
              </Button>
            </div>
          ) : (
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Register</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="mt-5 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button className="w-full" disabled={busy} onClick={signIn}>
                  Sign in
                </Button>
                <button
                  type="button"
                  onClick={resetPassword}
                  className="w-full text-center text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                >
                  Forgot your password?
                </button>
              </TabsContent>

              <TabsContent value="signup" className="mt-5 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full name</Label>
                  <Input
                    id="signup-name"
                    value={fullName}
                    maxLength={100}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">At least 8 characters.</p>
                </div>
                <Button className="w-full" disabled={busy} onClick={signUp}>
                  Create account
                </Button>
              </TabsContent>
            </Tabs>
          )}

          {!pendingEmail ? (
            <>
              <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                or
                <span className="h-px flex-1 bg-border" />
              </div>
              <Button variant="outline" className="w-full" onClick={googleSignIn}>
                Continue with Google
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}