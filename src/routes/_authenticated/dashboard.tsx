import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { BookMarked, CalendarCheck, CheckCircle2, Flame, Trophy } from "lucide-react";
import { toast } from "sonner";

import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useProfile, useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import {
  currentStreak,
  formatMinutes,
  formatPassage,
  isThisMonth,
  lastNDays,
  longestStreak,
  percent,
  planDayNumber,
  todayKey,
} from "@/lib/stats";


export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "My dashboard — FaithTrack" },
      {
        name: "description",
        content: "Today's reading, your streaks and recent Bible study activity on FaithTrack.",
      },
      { property: "og:title", content: "My dashboard — FaithTrack" },
      { property: "og:description", content: "Today's reading and your study streaks." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useSession();
  const { data: profileData } = useProfile();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const logs = useQuery({
    queryKey: ["my-logs", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_logs")
        .select("*")
        .eq("user_id", userId!)
        .order("studied_on", { ascending: false })
        .limit(400);
      if (error) throw error;
      return data;
    },
  });

  const plan = useQuery({
    queryKey: ["my-plan", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data: memberships, error: memberError } = await supabase
        .from("group_members")
        .select("group_id, groups(id, name, plan_id)")
        .eq("user_id", userId!);
      if (memberError) throw memberError;
      const group = (memberships ?? []).map((m) => m.groups).find((g) => g?.plan_id);
      if (!group?.plan_id) return null;
      const [planRes, assignmentsRes] = await Promise.all([
        supabase.from("reading_plans").select("*").eq("id", group.plan_id).maybeSingle(),
        supabase
          .from("reading_assignments")
          .select("*")
          .eq("plan_id", group.plan_id)
          .order("day_number"),
      ]);
      if (planRes.error) throw planRes.error;
      if (assignmentsRes.error) throw assignmentsRes.error;
      if (!planRes.data) return null;
      const assignments = assignmentsRes.data ?? [];
      const day = planDayNumber(planRes.data.start_date, assignments.length);
      return {
        groupName: group.name,
        plan: planRes.data,
        assignments,
        day,
        today: assignments.find((a) => a.day_number === day) ?? null,
      };
    },
  });

  const dateKeys = (logs.data ?? []).map((l) => l.studied_on);
  const streak = currentStreak(dateKeys);
  const best = longestStreak(dateKeys);
  const monthChapters = (logs.data ?? []).filter((l) => isThisMonth(l.studied_on)).length;
  const week = lastNDays(7);
  const weekDone = week.filter((d) => dateKeys.includes(d)).length;

  const todayAssignment = plan.data?.today ?? null;
  const completedToday = (logs.data ?? []).some(
    (l) =>
      l.studied_on === todayKey() &&
      (todayAssignment ? l.assignment_id === todayAssignment.id : true),
  );

  const markComplete = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase.from("study_logs").insert({
        user_id: userId,
        book: todayAssignment?.book ?? "Bible",
        chapter: todayAssignment?.chapter_start ?? 1,
        minutes: 0,
        source: "in_app",
        assignment_id: todayAssignment?.id ?? null,
        reflection: "",
        studied_on: todayKey(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marked complete. Well done!");
      queryClient.invalidateQueries({ queryKey: ["my-logs", userId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reference = todayAssignment
    ? todayAssignment.reference ||
      `${todayAssignment.book} ${todayAssignment.chapter_start}${
        todayAssignment.chapter_end > todayAssignment.chapter_start
          ? `-${todayAssignment.chapter_end}`
          : ""
      }`
    : null;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
        <h1 className="mt-1 text-2xl text-foreground sm:text-3xl">
          Peace be with you, {profileData?.profile?.full_name?.split(" ")[0] || "friend"}.
        </h1>
      </div>

      <section className="surface-card overflow-hidden">
        <div className="bg-hero px-5 py-6 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-accent-soft text-accent-foreground hover:bg-accent-soft">
              Today's reading
            </Badge>
            {plan.data ? (
              <span className="text-xs text-primary-foreground/70">
                {plan.data.plan.name} · Day {plan.data.day} of {plan.data.assignments.length}
              </span>
            ) : null}
          </div>
          <h2 className="font-display mt-3 text-3xl text-primary-foreground">
            {reference ?? "No plan assigned yet"}
          </h2>
          <p className="mt-2 text-sm text-primary-foreground/75">
            {plan.data
              ? `Assigned through ${plan.data.groupName}`
              : "Your group leader will assign a reading plan soon. You can still read and log study."}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button
              className="bg-gold text-accent-foreground hover:opacity-90"
              disabled={completedToday || markComplete.isPending}
              onClick={() => markComplete.mutate()}
            >
              {completedToday ? (
                <>
                  <CheckCircle2 className="mr-1 size-4" /> Completed today
                </>
              ) : (
                "Mark completed"
              )}
            </Button>
            <Button
              asChild
              variant="outline"
              className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
            >
              <Link
                to="/bible"
                search={{
                  book: todayAssignment?.book ?? "John",
                  chapter: todayAssignment?.chapter_start ?? 1,
                  version: "KJV",
                }}
              >
                Open Bible reader
              </Link>
            </Button>
          </div>
        </div>
        <div className="px-5 py-5 sm:px-6">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">This week's progress</span>
            <span className="text-muted-foreground">
              {weekDone} of 7 days · {percent(weekDone, 7)}%
            </span>
          </div>
          <Progress value={percent(weekDone, 7)} className="mt-3" />
          <div className="mt-4 flex gap-1.5">
            {week.map((day) => (
              <div
                key={day}
                title={day}
                className={`h-2 flex-1 rounded-full ${
                  dateKeys.includes(day) ? "bg-accent" : "bg-secondary"
                }`}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Current streak" value={`${streak}d`} icon={Flame} tone="gold" />
        <StatCard label="Longest streak" value={`${best}d`} icon={Trophy} />
        <StatCard label="Total sessions" value={logs.data?.length ?? 0} icon={CalendarCheck} />
        <StatCard label="Chapters this month" value={monthChapters} icon={BookMarked} />
      </section>

      <section className="surface-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg text-foreground">Recent activity</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/log-study">Log study</Link>
          </Button>
        </div>
        <div className="mt-4 divide-y divide-border">
          {(logs.data ?? []).slice(0, 8).map((log) => (
            <div key={log.id} className="flex items-start justify-between gap-3 py-3">
              <div>
                <p className="text-sm font-medium">{formatPassage(log)}</p>
                {log.reflection ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {log.reflection}
                  </p>
                ) : null}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs text-muted-foreground">{log.studied_on}</p>
                <p className="text-xs text-muted-foreground">
                  {log.minutes
                    ? formatMinutes(log.minutes)
                    : log.source === "in_app"
                      ? "In app"
                      : "—"}
                </p>
              </div>
            </div>

          ))}
          {!logs.isLoading && (logs.data ?? []).length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              No study logged yet. Open the Bible reader or log a study session to begin your streak.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}