/** Streak + progress maths shared by member, leader and admin views. */

export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayKey(): string {
  return toDateKey(new Date());
}

function shiftDays(key: string, days: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateKey(d);
}

/** Consecutive days ending today (or yesterday, so a streak survives until midnight). */
export function currentStreak(dateKeys: string[]): number {
  const set = new Set(dateKeys);
  const today = todayKey();
  let cursor = set.has(today) ? today : shiftDays(today, -1);
  if (!set.has(cursor)) return 0;
  let streak = 0;
  while (set.has(cursor)) {
    streak += 1;
    cursor = shiftDays(cursor, -1);
  }
  return streak;
}

export function longestStreak(dateKeys: string[]): number {
  const sorted = [...new Set(dateKeys)].sort();
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const key of sorted) {
    run = previous && shiftDays(previous, 1) === key ? run + 1 : 1;
    best = Math.max(best, run);
    previous = key;
  }
  return best;
}

export function isThisMonth(dateKey: string): boolean {
  return dateKey.slice(0, 7) === todayKey().slice(0, 7);
}

export function lastNDays(n: number): string[] {
  const today = todayKey();
  return Array.from({ length: n }, (_, i) => shiftDays(today, -(n - 1 - i)));
}

export function percent(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

/** Day index (1-based) inside a plan that started on startDate. */
export function planDayNumber(startDate: string, totalDays: number): number {
  if (!totalDays) return 1;
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const today = new Date(`${todayKey()}T00:00:00Z`).getTime();
  const diff = Math.floor((today - start) / 86_400_000);
  if (diff < 0) return 1;
  return (diff % totalDays) + 1;
}