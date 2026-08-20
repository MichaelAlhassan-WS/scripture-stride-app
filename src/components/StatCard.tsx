import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: "default" | "gold";
}) {
  return (
    <div className="surface-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {Icon ? (
          <span
            className={
              tone === "gold"
                ? "rounded-lg bg-accent-soft p-1.5 text-accent-foreground"
                : "rounded-lg bg-primary-soft p-1.5 text-primary"
            }
          >
            <Icon className="size-4" />
          </span>
        ) : null}
      </div>
      <p className="font-display mt-3 text-3xl text-foreground">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}