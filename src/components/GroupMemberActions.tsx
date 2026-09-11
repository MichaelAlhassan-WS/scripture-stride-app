import { ArrowRight, ShieldCheck, UserRoundCog, UserRoundMinus } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type GroupMemberAction = "promote" | "demote" | "remove" | "move";

type GroupOption = { id: string; name: string };

type GroupMemberActionsProps = {
  memberName: string;
  isLeader: boolean;
  groupId: string;
  groups: GroupOption[];
  pending: boolean;
  onAction: (action: GroupMemberAction, targetGroupId?: string) => void;
};

export function GroupMemberActions({
  memberName,
  isLeader,
  groupId,
  groups,
  pending,
  onAction,
}: GroupMemberActionsProps) {
  const [open, setOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"remove" | null>(null);
  const [targetGroupId, setTargetGroupId] = useState("");
  const otherGroups = groups.filter((group) => group.id !== groupId);

  const close = () => {
    setOpen(false);
    setConfirmAction(null);
    setTargetGroupId("");
  };

  const submit = (action: GroupMemberAction, target?: string) => {
    onAction(action, target);
    close();
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <UserRoundCog className="size-3.5" />
        Manage
      </Button>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) close();
          else setOpen(true);
        }}
      >
        <DialogContent className="max-w-md">
          {confirmAction === "remove" ? (
            <>
              <DialogHeader>
                <DialogTitle>Remove member from this group?</DialogTitle>
                <DialogDescription>
                  <span className="font-medium text-foreground">{memberName}</span> will leave this
                  group, but their account, study history, and other group memberships will stay.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmAction(null)}>
                  Keep member
                </Button>
                <Button variant="destructive" disabled={pending} onClick={() => submit("remove")}>
                  <UserRoundMinus className="size-4" />
                  Remove from group
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Manage group member</DialogTitle>
                <DialogDescription>
                  Update <span className="font-medium text-foreground">{memberName}</span> without
                  changing their account.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-primary">
                      <ShieldCheck className="size-4" />
                    </span>
                    <div>
                      <p className="text-sm font-medium">Role in this group</p>
                      <p className="text-xs text-muted-foreground">
                        This does not change the account’s global role.
                      </p>
                    </div>
                  </div>
                  <Badge variant={isLeader ? "default" : "secondary"}>
                    {isLeader ? "Leader" : "Member"}
                  </Badge>
                </div>
                <Button
                  variant="secondary"
                  className="w-full justify-between"
                  disabled={pending}
                  onClick={() => submit(isLeader ? "demote" : "promote")}
                >
                  {isLeader ? "Change to member" : "Promote to leader"}
                  <ArrowRight className="size-4" />
                </Button>

                <div className="space-y-2">
                  <div>
                    <p className="text-sm font-medium">Move to another group</p>
                    <p className="text-xs text-muted-foreground">
                      Their current group membership will be replaced.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Select value={targetGroupId} onValueChange={setTargetGroupId}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Choose destination" />
                      </SelectTrigger>
                      <SelectContent>
                        {otherGroups.length === 0 ? (
                          <SelectItem value="none" disabled>
                            No other groups
                          </SelectItem>
                        ) : (
                          otherGroups.map((group) => (
                            <SelectItem key={group.id} value={group.id}>
                              {group.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <Button
                      disabled={pending || !targetGroupId || targetGroupId === "none"}
                      onClick={() => submit("move", targetGroupId)}
                    >
                      Move
                    </Button>
                  </div>
                </div>
              </div>

              <DialogFooter className="border-t border-border pt-4 sm:justify-between">
                <Button
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={pending}
                  onClick={() => setConfirmAction("remove")}
                >
                  <UserRoundMinus className="size-4" />
                  Remove from group
                </Button>
                <Button variant="outline" onClick={close}>
                  Done
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
