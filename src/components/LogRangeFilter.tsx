import { Button } from "@/components/ui/button";
import { RANGE_LABELS, type RangeKey } from "@/lib/log-groups";

const ORDER: RangeKey[] = ["today", "week", "month", "all"];

export function LogRangeFilter({
  value,
  onChange,
}: {
  value: RangeKey;
  onChange: (range: RangeKey) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ORDER.map((key) => (
        <Button
          key={key}
          size="sm"
          variant={value === key ? "default" : "outline"}
          onClick={() => onChange(key)}
        >
          {RANGE_LABELS[key]}
        </Button>
      ))}
    </div>
  );
}
