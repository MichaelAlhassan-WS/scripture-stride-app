import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  LayoutDashboard,
  LogOut,
  Menu,
  NotebookPen,
  Shield,
  Users,
  UsersRound,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useProfile, useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const links = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, role: "member" },
  { to: "/bible", label: "Bible", icon: BookOpen, role: "member" },
  { to: "/log-study", label: "Log study", icon: NotebookPen, role: "member" },
  { to: "/groups", label: "My groups", icon: UsersRound, role: "member" },
  { to: "/leader", label: "Leader", icon: Users, role: "leader" },
  { to: "/admin", label: "Admin", icon: Shield, role: "admin" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { data } = useProfile();
  const { user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const visible = links.filter((link) =>
    link.role === "admin"
      ? data?.isAdmin
      : link.role === "leader"
        ? data?.isLeader
        : true,
  );

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const nav = (mobile = false) => (
    <nav className={cn("flex gap-1", mobile ? "flex-col" : "hidden items-center md:flex")}>
      {visible.map((link) => {
        const active = pathname === link.to;
        return (
          <Link
            key={link.to}
            to={link.to}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-primary-soft text-primary"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <link.icon className="size-4" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="bg-hero flex size-9 items-center justify-center rounded-xl text-primary-foreground">
              <BookOpen className="size-4" />
            </span>
            <span className="font-display text-lg text-primary">FaithTrack</span>
          </Link>
          <div className="ml-4">{nav()}</div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">
                {data?.profile?.full_name || user?.email}
              </p>
              <p className="text-xs capitalize text-muted-foreground">{data?.role ?? "member"}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
              <LogOut className="size-4" />
            </Button>
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="outline" size="icon" aria-label="Open menu">
                  <Menu className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64 p-6">
                <p className="font-display mb-4 text-lg text-primary">Menu</p>
                {nav(true)}
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}