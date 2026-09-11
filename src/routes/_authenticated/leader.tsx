import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, ChevronDown, Flame } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { GroupMemberActions } from "@/components/GroupMemberActions";
import { RoleGate } from "@/components/RoleGate";
import { SessionLogList } from "@/components/SessionLogList";
import { LogRangeFilter } from "@/components/LogRangeFilter";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { filterByRange, groupSessions, type RangeKey } from "@/lib/log-groups";
import { currentStreak, formatMinutes, lastNDays, percent, todayKey } from "@/lib/stats";

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
  const queryClient = useQueryClient();

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
          supabase.from("group_members").select("user_id, is_leader").eq("group_id", group.id),
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
            isLeader: member.is_leader,
            name: profile?.full_name || profile?.email || "Member",
            streak: currentStreak(dates),
            weekDays,
            missedDays: 7 - weekDays,
            doneToday: dates.includes(todayKey()),
            lastStudied: [...dates].sort().pop() ?? null,
            logs: memberLogs,
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

  const manageGroupMember = useMutation({
    mutationFn: async ({
      action,
      groupId,
      memberId,
      targetGroupId,
    }: {
      action: "promote" | "demote" | "remove" | "move";
      groupId: string;
      memberId: string;
      targetGroupId?: string;
    }) => {
      const { error } = await supabase.rpc("manage_group_member", {
        _action: action,
        _group_id: groupId,
        _user_id: memberId,
        _target_group_id: targetGroupId,
      });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success(
        variables.action === "remove"
          ? "Member removed from group"
          : variables.action === "move"
            ? "Member moved to the new group"
            : variables.action === "promote"
              ? "Member promoted to group leader"
              : "Member changed to group member",
      );
      queryClient.invalidateQueries({ queryKey: ["leader-groups"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const [range, setRange] = useState<RangeKey>("month");
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

      <div className="surface-card flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm text-muted-foreground">
          Showing reading logs for{" "}
          <span className="font-medium text-foreground">
            {range === "today"
              ? "today"
              : range === "week"
                ? "this week"
                : range === "month"
                  ? "this month"
                  : "all time"}
          </span>
          . Older months stay archived below each member.
        </p>
        <LogRangeFilter value={range} onChange={setRange} />
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
              <MemberRow
                key={member.userId}
                member={member}
                range={range}
                groupId={entry.group.id}
                groups={groups.map((groupEntry) => groupEntry.group)}
                pending={manageGroupMember.isPending}
                onAction={(action, targetGroupId) =>
                  manageGroupMember.mutate({
                    action,
                    groupId: entry.group.id,
                    memberId: member.userId,
                    targetGroupId,
                  })
                }
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

type MemberStat = {
  userId: string;
  isLeader: boolean;
  name: string;
  streak: number;
  weekDays: number;
  missedDays: number;
  doneToday: boolean;
  lastStudied: string | null;
  logs: {
    book: string;
    chapter: number;
    chapter_end: number | null;
    minutes: number | null;
    reflection: string;
    source: string;
    studied_on: string;
    user_id: string;
  }[];
};

function MemberRow({
  member,
  range,
  groupId,
  groups,
  pending,
  onAction,
}: {
  member: MemberStat;
  range: RangeKey;
  groupId: string;
  groups: { id: string; name: string }[];
  pending: boolean;
  onAction: (action: "promote" | "demote" | "remove" | "move", targetGroupId?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const sessions = groupSessions(filterByRange(member.logs, range));
  const chapters = sessions.reduce((sum, s) => sum + s.chapters, 0);
  const minutes = sessions.reduce((sum, s) => sum + (s.minutes ?? 0), 0);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CollapsibleTrigger className="flex min-w-0 items-center gap-2 text-left">
          <ChevronDown
            className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium">{member.name}</p>
            <p className="text-xs text-muted-foreground">
              {sessions.length} session{sessions.length === 1 ? "" : "s"} · {chapters} chapters ·{" "}
              {formatMinutes(minutes)} · last studied {member.lastStudied ?? "never"}
            </p>
          </div>
        </CollapsibleTrigger>
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
          <GroupMemberActions
            memberName={member.name}
            isLeader={member.isLeader}
            groupId={groupId}
            groups={groups}
            pending={pending}
            onAction={onAction}
          />
        </div>
      </div>
      <CollapsibleContent className="mt-2">
        <SessionLogList sessions={sessions} emptyText="No study recorded in this period." />
      </CollapsibleContent>
    </Collapsible>
  );
}
