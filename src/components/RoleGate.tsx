import { Link } from "@tanstack/react-router";
import { Loader2, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-session";

type Requirement = "member" | "leader" | "admin";

export function useHasAccess(require: Requirement) {
  const { data, isPending } = useProfile();
  const allowed =
    require === "admin"
      ? Boolean(data?.isAdmin)
      : require === "leader"
        ? Boolean(data?.isLeader)
        : true;
  return { allowed, loading: isPending, role: data?.role ?? "member" };
}

const copy: Record<Requirement, { title: string; body: string }> = {
  member: { title: "Access restricted", body: "You do not have access to this page." },
  leader: {
    title: "Leaders only",
    body: "This area is for group leaders. Ask an administrator if you should have leader access.",
  },
  admin: {
    title: "Administrators only",
    body: "This area is restricted to administrators of your church community.",
  },
};

export function RoleGate({ require, children }: { require: Requirement; children: ReactNode }) {
  const { allowed, loading } = useHasAccess(require);

  if (loading) {
    return (
      <div className="surface-card flex items-center gap-3 p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Checking your permissions…
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="surface-card max-w-xl space-y-3 p-6">
        <span className="bg-primary-soft flex size-10 items-center justify-center rounded-xl text-primary">
          <ShieldAlert className="size-5" />
        </span>
        <h1 className="text-2xl">{copy[require].title}</h1>
        <p className="text-sm text-muted-foreground">{copy[require].body}</p>
        <Button asChild variant="secondary">
          <Link to="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
