import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { EyeOff, Flame, Lock, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { currentStreak, lastNDays, percent, todayKey } from "@/lib/stats";

export const Route = createFileRoute("/_authenticated/groups")({
  head: () => ({
    meta: [
      { title: "My groups — FaithTrack" },
      {
        name: "description",
        content:
          "See your Bible study groups on FaithTrack and the participation your group's visibility mode allows.",
      },
      { property: "og:title", content: "My groups — FaithTrack" },
      { property: "og:description", content: "Group participation and streaks." },
    ],
  }),
  component: GroupsPage,
});

type MemberStat = {
  userId: string;
  name: string;
  doneToday: boolean;
  streak: number;
  weekDays: number;
  lastStudied: string | null;
};

function GroupsPage() {
  const { user } = useSession();
  const userId = user?.id;

  const groups = useQuery({
    queryKey: ["my-groups", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data: memberships, error } = await supabase
        .from("group_members")
        .select("group_id, is_leader, groups(id, name, description, visibility_mode)")
        .eq("user_id", userId!);
      if (error) throw error;

      const week = lastNDays(7);
      const results = [];
      for (const membership of memberships ?? []) {
        const group = membership.groups;
        if (!group) continue;
        const [membersRes, logsRes] = await Promise.all([
          supabase
            .from("group_members")
            .select("user_id, is_leader, profiles:user_id(full_name)")
            .eq("group_id", group.id),
          supabase.from("study_logs").select("user_id, studied_on"),
        ]);
        const members = membersRes.data ?? [];
        const memberIds = new Set(members.map((m) => m.user_id));
        const logs = (logsRes.data ?? []).filter((l) => memberIds.has(l.user_id));

        const stats: MemberStat[] = members.map((member) => {
          const dates = logs.filter((l) => l.user_id === member.user_id).map((l) => l.studied_on);
          const profile = member.profiles as { full_name: string } | null;
          return {
            userId: member.user_id,
            name: profile?.full_name || "Member",
            doneToday: dates.includes(todayKey()),
            streak: currentStreak(dates),
            weekDays: week.filter((d) => dates.includes(d)).length,
            lastStudied: [...dates].sort().pop() ?? null,
          };
        });

        const completedToday = stats.filter((s) => s.doneToday).length;
        const weeklyRate = percent(
          stats.reduce((sum, s) => sum + s.weekDays, 0),
          Math.max(1, stats.length * 7),
        );
        const groupStreak = week
          .slice()
          .reverse()
          .reduce((run, day, index) => {
            const anyDone = logs.some((l) => l.studied_on === day);
            return anyDone && run === index ? run + 1 : run;
          }, 0);

        results.push({
          group,
          isLeader: membership.is_leader,
          stats,
          completedToday,
          total: stats.length,
          weeklyRate,
          groupStreak,
        });
      }
      return results;
    },
  });

  if (groups.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading your groups…</p>;
  }

  if ((groups.data ?? []).length === 0) {
    return (
      <div className="surface-card p-6">
        <h1 className="text-2xl text-foreground">My groups</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You are not in a group yet. An administrator will add you to your church's study group.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl text-foreground sm:text-3xl">My groups</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          What you can see depends on each group's visibility mode.
        </p>
      </div>

      {(groups.data ?? []).map((entry) => {
        const mode = entry.group.visibility_mode;
        const canSeeNames = mode === "group" || entry.isLeader;
        return (
          <section key={entry.group.id} className="surface-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg text-foreground">{entry.group.name}</h2>
                {entry.group.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">{entry.group.description}</p>
                ) : null}
              </div>
              <Badge variant="secondary" className="capitalize">
                {mode === "private" ? (
                  <Lock className="mr-1 size-3" />
                ) : mode === "anonymous" ? (
                  <EyeOff className="mr-1 size-3" />
                ) : (
                  <Users className="mr-1 size-3" />
                )}
                {mode} mode
              </Badge>
            </div>

            {mode === "private" && !entry.isLeader ? (
              <p className="mt-4 rounded-lg bg-secondary p-4 text-sm text-muted-foreground">
                This group is in private mode. Only your own progress is visible to you — leaders and
                administrators can see the full group.
              </p>
            ) : (
              <>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-secondary p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Completed today
                    </p>
                    <p className="font-display mt-1 text-2xl">
                      {entry.completedToday} of {entry.total}
                    </p>
                  </div>
                  <div className="rounded-xl bg-secondary p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Group streak
                    </p>
                    <p className="font-display mt-1 flex items-center gap-1 text-2xl">
                      <Flame className="size-5 text-accent" />
                      {entry.groupStreak} days
                    </p>
                  </div>
                  <div className="rounded-xl bg-secondary p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Weekly completion
                    </p>
                    <p className="font-display mt-1 text-2xl">{entry.weeklyRate}%</p>
                    <Progress value={entry.weeklyRate} className="mt-2" />
                  </div>
                </div>

                {canSeeNames ? (
                  <div className="mt-5 divide-y divide-border">
                    {entry.stats.map((member) => (
                      <div
                        key={member.userId}
                        className="flex items-center justify-between gap-3 py-3"
                      >
                        <div>
                          <p className="text-sm font-medium">{member.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Last studied {member.lastStudied ?? "never"}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">
                            {member.weekDays}/7 this week
                          </span>
                          <Badge variant="secondary">
                            <Flame className="mr-1 size-3 text-accent" />
                            {member.streak}d
                          </Badge>
                          <Badge
                            className={
                              member.doneToday
                                ? "bg-success text-success-foreground hover:bg-success"
                                : "bg-secondary text-muted-foreground hover:bg-secondary"
                            }
                          >
                            {member.doneToday ? "Done today" : "Pending"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-muted-foreground">
                    Anonymous mode: group statistics only, no names displayed.
                  </p>
                )}
              </>
            )}
          </section>
        );
      })}
    </div>
  );
}
