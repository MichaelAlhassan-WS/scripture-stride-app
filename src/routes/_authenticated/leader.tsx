import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, ChevronDown, Flame } from "lucide-react";
import { useState } from "react";

import { RoleGate } from "@/components/RoleGate";
import { SessionLogList } from "@/components/SessionLogList";
import { LogRangeFilter } from "@/components/LogRangeFilter";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { filterByRange, groupSessions, type RangeKey } from "@/lib/log-groups";
import {
  currentStreak,
  formatMinutes,
  lastNDays,
  percent,
  todayKey,
} from "@/lib/stats";



export const Route = createFileRoute("/_authenticated/leader")({
  head: () => ({
    meta: [
      { title: "Leader dashboard — FaithTrack" },
      {
        name: "description",
        content:
          "Group leaders track completion rates, member activity, reading streaks and missed study days.",
      },
      { property: "og:title", content: "Leader dashboard — FaithTrack" },
      { property: "og:description", content: "Completion rates and member activity per group." },
    ],
  }),
  component: () => (
    <RoleGate require="leader">
      <LeaderPage />
    </RoleGate>
  ),
});

function LeaderPage() {
  const { user } = useSession();
  const userId = user?.id;

  const overview = useQuery({
    queryKey: ["leader-groups", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data: leading, error } = await supabase
        .from("group_members")
        .select("group_id, is_leader, groups(id, name, description)")
        .eq("user_id", userId!)
        .eq("is_leader", true);
      if (error) throw error;

      const week = lastNDays(7);
      const groups = [];
      for (const row of leading ?? []) {
        const group = row.groups;
        if (!group) continue;
        const [membersRes, logsRes] = await Promise.all([
          supabase
            .from("group_members")
            .select("user_id")
            .eq("group_id", group.id),
          supabase
            .from("study_logs")
            .select("user_id, studied_on, book, chapter, chapter_end, minutes, reflection, source")
            .order("studied_on", { ascending: false }),
        ]);
        const members = membersRes.data ?? [];
        const ids = new Set(members.map((m) => m.user_id));
        const logs = (logsRes.data ?? []).filter((l) => ids.has(l.user_id));
        const { data: profileRows } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", [...ids]);
        const profileById = new Map((profileRows ?? []).map((p) => [p.id, p]));

        const stats = members.map((member) => {
          const memberLogs = logs.filter((l) => l.user_id === member.user_id);
          const dates = memberLogs.map((l) => l.studied_on);
          const profile = profileById.get(member.user_id);
          const weekDays = week.filter((d) => dates.includes(d)).length;
          return {
            userId: member.user_id,
            name: profile?.full_name || profile?.email || "Member",
            streak: currentStreak(dates),
            weekDays,
            missedDays: 7 - weekDays,
            doneToday: dates.includes(todayKey()),
            lastStudied: [...dates].sort().pop() ?? null,
            chapters: memberLogs.reduce((sum, l) => sum + chaptersRead(l), 0),
            minutes: memberLogs.reduce((sum, l) => sum + (l.minutes ?? 0), 0),
            recent: memberLogs.slice(0, 5),
          };
        });

        groups.push({
          group,
          stats,
          completionRate: percent(
            stats.reduce((sum, s) => sum + s.weekDays, 0),
            Math.max(1, stats.length * 7),
          ),
          doneToday: stats.filter((s) => s.doneToday).length,
        });
      }
      return groups;
    },
  });


  const groups = overview.data ?? [];
  const totalMembers = groups.reduce((sum, g) => sum + g.stats.length, 0);
  const avgRate = groups.length
    ? Math.round(groups.reduce((sum, g) => sum + g.completionRate, 0) / groups.length)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl text-foreground sm:text-3xl">Leader dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Encourage your members — here is how the groups you lead are doing.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Groups led" value={groups.length} />
        <StatCard label="Members" value={totalMembers} />
        <StatCard label="Avg weekly completion" value={`${avgRate}%`} tone="gold" />
        <StatCard
          label="Completed today"
          value={groups.reduce((sum, g) => sum + g.doneToday, 0)}
          icon={Flame}
          tone="gold"
        />
      </div>

      {groups.length === 0 ? (
        <div className="surface-card p-6 text-sm text-muted-foreground">
          You have not been assigned a group to lead yet.
        </div>
      ) : null}

      {groups.map((entry) => (
        <section key={entry.group.id} className="surface-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg text-foreground">{entry.group.name}</h2>
              <p className="text-sm text-muted-foreground">
                {entry.doneToday} of {entry.stats.length} completed today
              </p>
            </div>
            <div className="w-40">
              <p className="text-right text-xs text-muted-foreground">
                {entry.completionRate}% weekly
              </p>
              <Progress value={entry.completionRate} className="mt-1" />
            </div>
          </div>

          <div className="mt-4 divide-y divide-border">
            {entry.stats.map((member) => (
              <div key={member.userId} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">{member.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Last studied {member.lastStudied ?? "never"} · {member.chapters} chapters ·{" "}
                      {formatMinutes(member.minutes)} total
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Badge variant="secondary">
                      <Flame className="mr-1 size-3 text-accent" />
                      {member.streak}d streak
                    </Badge>
                    <Badge variant="secondary">{member.weekDays}/7 days</Badge>
                    {member.missedDays >= 3 ? (
                      <Badge className="bg-accent-soft text-accent-foreground hover:bg-accent-soft">
                        <AlertTriangle className="mr-1 size-3" />
                        {member.missedDays} missed
                      </Badge>
                    ) : null}
                  </div>
                </div>

                {member.recent.length ? (
                  <ul className="mt-2 space-y-1 rounded-lg bg-secondary/50 px-3 py-2">
                    {member.recent.map((log, i) => (
                      <li key={`${member.userId}-${i}`} className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{formatPassage(log)}</span>
                        {" · "}
                        {formatMinutes(log.minutes)}
                        {" · "}
                        {log.studied_on}
                        {log.source === "in_app" ? " · in app" : ""}
                        {log.reflection ? (
                          <span className="mt-0.5 block line-clamp-2 italic">{log.reflection}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">No study recorded yet.</p>
                )}
              </div>
            ))}

          </div>
        </section>
      ))}
    </div>
  );
}
