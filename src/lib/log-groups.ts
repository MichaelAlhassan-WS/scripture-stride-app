/**
 * Reading-log grouping: raw per-chapter rows are collapsed into reading sessions.
 * A session = one member, one day, one book, with consecutive/overlapping chapters merged.
 */

import { todayKey, lastNDays } from "./stats";

export type RawLog = {
  id?: string;
  user_id?: string;
  book: string;
  chapter: number;
  chapter_end?: number | null;
  minutes?: number | null;
  reflection?: string | null;
  source?: string | null;
  studied_on: string;
};

export type SessionLog = {
  key: string;
  userId?: string | undefined;
  book: string;
  chapterStart: number;
  chapterEnd: number;
  chapters: number;
  minutes: number | null;
  reflections: string[];
  inApp: boolean;
  studiedOn: string;
  entries: number;
};

export type RangeKey = "today" | "week" | "month" | "all";

export const RANGE_LABELS: Record<RangeKey, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
  all: "All Time",
};

export function filterByRange<T extends { studied_on: string }>(
  logs: T[],
  range: RangeKey,
): T[] {
  if (range === "all") return logs;
  if (range === "today") return logs.filter((l) => l.studied_on === todayKey());
  if (range === "week") {
    const week = new Set(lastNDays(7));
    return logs.filter((l) => week.has(l.studied_on));
  }
  const month = todayKey().slice(0, 7);
  return logs.filter((l) => l.studied_on.slice(0, 7) === month);
}

/** Merge raw rows into reading sessions. */
export function groupSessions(logs: RawLog[]): SessionLog[] {
  const buckets = new Map<string, RawLog[]>();
  for (const log of logs) {
    const key = `${log.user_id ?? "me"}|${log.studied_on}|${log.book}`;
    const list = buckets.get(key);
    if (list) list.push(log);
    else buckets.set(key, [log]);
  }

  const sessions: SessionLog[] = [];
  for (const [key, rows] of buckets) {
    const sorted = [...rows].sort((a, b) => a.chapter - b.chapter);
    let current: SessionLog | null = null;
    const flush = () => {
      if (current) sessions.push(current);
      current = null;
    };
    for (const row of sorted) {
      const start = row.chapter;
      const end = Math.max(row.chapter_end ?? row.chapter, row.chapter);
      const reflection = (row.reflection ?? "").trim();
      if (current && start <= current.chapterEnd + 1) {
        current.chapterEnd = Math.max(current.chapterEnd, end);
        current.chapters = current.chapterEnd - current.chapterStart + 1;
        current.minutes =
          row.minutes || current.minutes ? (current.minutes ?? 0) + (row.minutes ?? 0) : null;
        if (reflection) current.reflections.push(reflection);
        current.inApp = current.inApp || row.source === "in_app";
        current.entries += 1;
      } else {
        flush();
        current = {
          key: `${key}|${start}`,
          userId: row.user_id,
          book: row.book,
          chapterStart: start,
          chapterEnd: end,
          chapters: end - start + 1,
          minutes: row.minutes ?? null,
          reflections: reflection ? [reflection] : [],
          inApp: row.source === "in_app",
          studiedOn: row.studied_on,
          entries: 1,
        };
      }
    }
    flush();
  }

  return sessions.sort((a, b) =>
    a.studiedOn === b.studiedOn ? a.book.localeCompare(b.book) : b.studiedOn.localeCompare(a.studiedOn),
  );
}

export function formatSession(session: SessionLog): string {
  return session.chapterEnd > session.chapterStart
    ? `${session.book} ${session.chapterStart}-${session.chapterEnd}`
    : `${session.book} ${session.chapterStart}`;
}

export type MonthGroup = {
  month: string;
  label: string;
  sessions: SessionLog[];
  chapters: number;
  minutes: number;
  days: number;
  isCurrent: boolean;
};

export function groupByMonth(sessions: SessionLog[]): MonthGroup[] {
  const currentMonth = todayKey().slice(0, 7);
  const map = new Map<string, SessionLog[]>();
  for (const session of sessions) {
    const month = session.studiedOn.slice(0, 7);
    const list = map.get(month);
    if (list) list.push(session);
    else map.set(month, [session]);
  }
  return [...map.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, list]) => ({
      month,
      label: monthLabel(month),
      sessions: list,
      chapters: list.reduce((sum, s) => sum + s.chapters, 0),
      minutes: list.reduce((sum, s) => sum + (s.minutes ?? 0), 0),
      days: new Set(list.map((s) => s.studiedOn)).size,
      isCurrent: month === currentMonth,
    }));
}

export function monthLabel(month: string): string {
  const [year, m] = month.split("-");
  const date = new Date(Date.UTC(Number(year), Number(m) - 1, 1));
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
}
