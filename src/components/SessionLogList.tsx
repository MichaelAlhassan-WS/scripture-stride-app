import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { formatSession, groupByMonth, type SessionLog } from "@/lib/log-groups";
import { formatMinutes } from "@/lib/stats";

function SessionRow({ session }: { session: SessionLog }) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 py-2 text-xs">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{formatSession(session)}</p>
        {session.reflections.length ? (
          <p className="mt-0.5 line-clamp-2 italic text-muted-foreground">
            {session.reflections.join(" · ")}
          </p>
        ) : null}
      </div>
      <div className="shrink-0 text-right text-muted-foreground">
        <p>
          {session.chapters} chapter{session.chapters === 1 ? "" : "s"} ·{" "}
          {formatMinutes(session.minutes)}
        </p>
        <p>
          {session.studiedOn}
          {session.inApp ? " · in app" : ""}
        </p>
      </div>
    </li>
  );
}

function MonthBlock({
  month,
}: {
  month: ReturnType<typeof groupByMonth>[number];
}) {
  const [open, setOpen] = useState(month.isCurrent);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-lg bg-secondary/40 px-3 py-2">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-left">
        <div>
          <p className="text-sm font-medium text-foreground">
            {month.label}
            {month.isCurrent ? null : (
              <Badge variant="secondary" className="ml-2 align-middle text-[10px]">
                Archived
              </Badge>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {month.sessions.length} session{month.sessions.length === 1 ? "" : "s"} ·{" "}
            {month.chapters} chapters · {formatMinutes(month.minutes)} · {month.days} day
            {month.days === 1 ? "" : "s"}
          </p>
        </div>
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="mt-1 divide-y divide-border">
          {month.sessions.map((session) => (
            <SessionRow key={session.key} session={session} />
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Monthly summaries first; the current month opens by default, older months stay archived. */
export function SessionLogList({
  sessions,
  emptyText = "No study recorded yet.",
}: {
  sessions: SessionLog[];
  emptyText?: string;
}) {
  const months = groupByMonth(sessions);
  if (!months.length) return <p className="py-3 text-xs text-muted-foreground">{emptyText}</p>;
  return (
    <div className="space-y-2">
      {months.map((month) => (
        <MonthBlock key={month.month} month={month} />
      ))}
    </div>
  );
}
