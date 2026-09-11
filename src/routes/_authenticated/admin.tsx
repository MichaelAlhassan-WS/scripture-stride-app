import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, ChevronDown, Plus, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { LogRangeFilter } from "@/components/LogRangeFilter";
import { DeleteUserButton } from "@/components/DeleteUserButton";
import { GroupMemberActions } from "@/components/GroupMemberActions";
import { PlanDaysManager } from "@/components/PlanDaysManager";

import { RoleGate } from "@/components/RoleGate";
import { SessionLogList } from "@/components/SessionLogList";
import { StatCard } from "@/components/StatCard";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useProfile, useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { filterByRange, groupSessions, type RangeKey, type RawLog } from "@/lib/log-groups";
import { formatMinutes, todayKey } from "@/lib/stats";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administrator dashboard — FaithTrack" },
      {
        name: "description",
        content:
          "Manage FaithTrack members, groups, leaders and reading plans across your whole church community.",
      },
      { property: "og:title", content: "Administrator dashboard — FaithTrack" },
      { property: "og:description", content: "Members, groups and reading plan management." },
    ],
  }),
  component: () => (
    <RoleGate require="admin">
      <AdminPage />
    </RoleGate>
  ),
});

type Visibility = "private" | "anonymous" | "group";

function AdminPage() {
  const { user } = useSession();
  const { data: profileData } = useProfile();
  const queryClient = useQueryClient();

  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("group");
  const [planName, setPlanName] = useState("");
  const [planDescription, setPlanDescription] = useState("");
  const [assignGroup, setAssignGroup] = useState("");
  const [assignUser, setAssignUser] = useState("");
  const [assignLeader, setAssignLeader] = useState("false");
  const [range, setRange] = useState<RangeKey>("month");

  const isAdmin = Boolean(profileData?.isAdmin);

  const data = useQuery({
    queryKey: ["admin-overview"],
    enabled: isAdmin,
    queryFn: async () => {
      const [profiles, roles, groups, members, plans, logs] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, created_at"),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("groups").select("id, name, description, visibility_mode, plan_id"),
        supabase.from("group_members").select("id, group_id, user_id, is_leader"),
        supabase.from("reading_plans").select("id, name, description, start_date, is_active"),
        supabase
          .from("study_logs")
          .select("user_id, studied_on, book, chapter, chapter_end, minutes, reflection, source")
          .order("studied_on", { ascending: false })
          .limit(1000),
      ]);
      return {
        profiles: profiles.data ?? [],
        roles: roles.data ?? [],
        groups: groups.data ?? [],
        members: members.data ?? [],
        plans: plans.data ?? [],
        logs: logs.data ?? [],
      };
    },
  });

  const createGroup = useMutation({
    mutationFn: async () => {
      if (groupName.trim().length < 2) throw new Error("Group name is too short");
      const { error } = await supabase.from("groups").insert({
        name: groupName.trim().slice(0, 100),
        description: groupDescription.trim().slice(0, 500),
        visibility_mode: visibility,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Group created");
      setGroupName("");
      setGroupDescription("");
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createPlan = useMutation({
    mutationFn: async () => {
      if (planName.trim().length < 2) throw new Error("Plan name is too short");
      const { error } = await supabase.from("reading_plans").insert({
        name: planName.trim().slice(0, 100),
        description: planDescription.trim().slice(0, 500),
        start_date: todayKey(),
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reading plan created");
      setPlanName("");
      setPlanDescription("");
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addMember = useMutation({
    mutationFn: async () => {
      if (!assignGroup || !assignUser) throw new Error("Choose a group and a member");
      const { error } = await supabase.from("group_members").insert({
        group_id: assignGroup,
        user_id: assignUser,
        is_leader: assignLeader === "true",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Member assigned");
      setAssignUser("");
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const attachPlan = useMutation({
    mutationFn: async ({ groupId, planId }: { groupId: string; planId: string }) => {
      const { error } = await supabase
        .from("groups")
        .update({ plan_id: planId === "none" ? null : planId })
        .eq("id", groupId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plan updated for group");
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const setRole = useMutation({
    mutationFn: async ({
      userId,
      role,
    }: {
      userId: string;
      role: "admin" | "leader" | "member";
    }) => {
      const { error: delError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .in("role", ["admin", "leader"]);
      if (delError) throw delError;
      const { error } = await supabase.from("user_roles").upsert(
        role === "member"
          ? { user_id: userId, role: "member" as const }
          : [
              { user_id: userId, role: "member" as const },
              { user_id: userId, role },
            ],
        { onConflict: "user_id,role", ignoreDuplicates: true },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role updated");
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const manageGroupMember = useMutation({
    mutationFn: async ({
      action,
      groupId,
      userId,
      targetGroupId,
    }: {
      action: "promote" | "demote" | "remove" | "move";
      groupId: string;
      userId: string;
      targetGroupId?: string;
    }) => {
      const { error } = await supabase.rpc("manage_group_member", {
        _action: action,
        _group_id: groupId,
        _user_id: userId,
        _target_group_id: targetGroupId,
      });
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success(
        variables.action === "promote"
          ? "Member promoted to group leader"
          : variables.action === "demote"
            ? "Member changed to group member"
            : variables.action === "remove"
              ? "Member removed from group"
              : "Member moved to the new group",
      );
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["leader-groups"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc("admin_delete_user", { _user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("User account deleted");
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const overview = data.data;
  const activeToday = new Set(
    (overview?.logs ?? []).filter((l) => l.studied_on === todayKey()).map((l) => l.user_id),
  ).size;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl text-foreground sm:text-3xl">Administrator dashboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage members, groups, leaders and reading plans.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Members" value={overview?.profiles.length ?? 0} icon={Users} />
        <StatCard label="Groups" value={overview?.groups.length ?? 0} />
        <StatCard label="Reading plans" value={overview?.plans.length ?? 0} icon={BookOpen} />
        <StatCard label="Studied today" value={activeToday} tone="gold" />
      </div>

      <section className="surface-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg">Reading activity report</h2>
            <p className="text-xs text-muted-foreground">
              Grouped by reading session. Expand a member to see monthly summaries and details.
            </p>
          </div>
          <LogRangeFilter value={range} onChange={setRange} />
        </div>
        <div className="mt-4 divide-y divide-border">
          {(overview?.profiles ?? []).map((profile) => {
            const memberLogs = (overview?.logs ?? []).filter((l) => l.user_id === profile.id);
            if (!memberLogs.length) return null;
            return (
              <AdminMemberLogs
                key={profile.id}
                name={profile.full_name || profile.email || "Member"}
                logs={memberLogs}
                range={range}
              />
            );
          })}
          {(overview?.logs ?? []).length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">No study logged yet.</p>
          ) : null}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="surface-card space-y-3 p-5">
          <h2 className="text-lg">Create a group</h2>
          <div className="space-y-1.5">
            <Label htmlFor="group-name">Name</Label>
            <Input
              id="group-name"
              maxLength={100}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Tuesday Discipleship"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="group-desc">Description</Label>
            <Textarea
              id="group-desc"
              maxLength={500}
              value={groupDescription}
              onChange={(e) => setGroupDescription(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Visibility mode</Label>
            <Select value={visibility} onValueChange={(v) => setVisibility(v as Visibility)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">Private — only leaders see progress</SelectItem>
                <SelectItem value="anonymous">Anonymous — stats without names</SelectItem>
                <SelectItem value="group">Group — members encourage each other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button disabled={createGroup.isPending} onClick={() => createGroup.mutate()}>
            <Plus className="mr-1 size-4" />
            Create group
          </Button>
        </section>

        <section className="surface-card space-y-3 p-5">
          <h2 className="text-lg">Create a reading plan</h2>
          <div className="space-y-1.5">
            <Label htmlFor="plan-name">Name</Label>
            <Input
              id="plan-name"
              maxLength={100}
              value={planName}
              onChange={(e) => setPlanName(e.target.value)}
              placeholder="Gospel of John in 21 days"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-desc">Description</Label>
            <Textarea
              id="plan-desc"
              maxLength={500}
              value={planDescription}
              onChange={(e) => setPlanDescription(e.target.value)}
            />
          </div>
          <Button
            variant="secondary"
            disabled={createPlan.isPending}
            onClick={() => createPlan.mutate()}
          >
            <Plus className="mr-1 size-4" />
            Create plan
          </Button>
        </section>
      </div>

      <PlanDaysManager plans={overview?.plans ?? []} />

      <section className="surface-card space-y-3 p-5">
        <h2 className="text-lg">Assign a member to a group</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Member</Label>
            <Select value={assignUser} onValueChange={setAssignUser}>
              <SelectTrigger>
                <SelectValue placeholder="Choose member" />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {(overview?.profiles ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name || p.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Group</Label>
            <Select value={assignGroup} onValueChange={setAssignGroup}>
              <SelectTrigger>
                <SelectValue placeholder="Choose group" />
              </SelectTrigger>
              <SelectContent>
                {(overview?.groups ?? []).map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Role in group</Label>
            <Select value={assignLeader} onValueChange={setAssignLeader}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="false">Member</SelectItem>
                <SelectItem value="true">Group leader</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button disabled={addMember.isPending} onClick={() => addMember.mutate()}>
          Assign
        </Button>
      </section>

      <section className="surface-card p-5">
        <h2 className="text-lg">Groups</h2>
        <div className="mt-3 divide-y divide-border">
          {(overview?.groups ?? []).map((group) => {
            const groupMembers = (overview?.members ?? []).filter((m) => m.group_id === group.id);
            const leaders = groupMembers.filter((m) => m.is_leader).length;
            return (
              <div
                key={group.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{group.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {groupMembers.length} members · {leaders} leader{leaders === 1 ? "" : "s"} ·{" "}
                    {group.visibility_mode} mode
                  </p>
                  <div className="mt-3 space-y-2">
                    {groupMembers.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No members assigned.</p>
                    ) : (
                      groupMembers.map((membership) => {
                        const member = overview?.profiles.find((p) => p.id === membership.user_id);
                        if (!member) return null;
                        return (
                          <GroupMemberActions
                            key={membership.id}
                            memberName={member.full_name || member.email || "Member"}
                            isLeader={membership.is_leader}
                            groupId={group.id}
                            groups={overview?.groups ?? []}
                            pending={manageGroupMember.isPending}
                            onAction={(action, targetGroupId) =>
                              manageGroupMember.mutate({
                                action,
                                groupId: group.id,
                                userId: member.id,
                                targetGroupId,
                              })
                            }
                          />
                        );
                      })
                    )}
                  </div>
                </div>
                <div className="w-56">
                  <Select
                    value={group.plan_id ?? "none"}
                    onValueChange={(planId) => attachPlan.mutate({ groupId: group.id, planId })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Reading plan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No plan</SelectItem>
                      {(overview?.plans ?? []).map((plan) => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="surface-card p-5">
        <h2 className="text-lg">Members &amp; roles</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Administrators grant access here. Roles apply the next time the member loads a page.
        </p>
        <div className="mt-3 divide-y divide-border">
          {(overview?.profiles ?? []).map((p) => {
            const roles = (overview?.roles ?? [])
              .filter((r) => r.user_id === p.id)
              .map((r) => r.role);
            const effective = roles.includes("admin")
              ? "admin"
              : roles.includes("leader")
                ? "leader"
                : "member";
            return (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="text-sm font-medium">{p.full_name || "Unnamed"}</p>
                  <p className="text-xs text-muted-foreground">{p.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize">
                    {effective}
                  </Badge>
                  <div className="w-40">
                    <Select
                      value={effective}
                      disabled={setRole.isPending || p.id === user?.id}
                      onValueChange={(role) =>
                        setRole.mutate({
                          userId: p.id,
                          role: role as "admin" | "leader" | "member",
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="leader">Group leader</SelectItem>
                        <SelectItem value="admin">Administrator</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Delete user account"
                      disabled={deleteUser.isPending || p.id === user?.id}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete ${p.full_name || p.email || "this user"} permanently? This removes the account and its associated data.`,
                          )
                        ) {
                          deleteUser.mutate(p.id);
                        }
                      }}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function AdminMemberLogs({ name, logs, range }: { name: string; logs: RawLog[]; range: RangeKey }) {
  const [open, setOpen] = useState(false);
  const sessions = groupSessions(filterByRange(logs, range));
  const chapters = sessions.reduce((sum, s) => sum + s.chapters, 0);
  const minutes = sessions.reduce((sum, s) => sum + (s.minutes ?? 0), 0);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="py-3">
      <CollapsibleTrigger className="flex w-full items-center gap-2 text-left">
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
        <div className="min-w-0">
          <p className="text-sm font-medium">{name}</p>
          <p className="text-xs text-muted-foreground">
            {sessions.length} session{sessions.length === 1 ? "" : "s"} · {chapters} chapters ·{" "}
            {formatMinutes(minutes)}
          </p>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2">
        <SessionLogList sessions={sessions} emptyText="No study recorded in this period." />
      </CollapsibleContent>
    </Collapsible>
  );
}
