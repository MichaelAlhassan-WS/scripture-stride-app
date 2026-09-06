import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Plus, Trash2, Wand2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
import { supabase } from "@/integrations/supabase/client";
import { BIBLE_BOOKS, findBook } from "@/lib/bible-books";

type PlanOption = { id: string; name: string; start_date?: string };

function reference(book: string, start: number, end: number): string {
  return end > start ? `${book} ${start}-${end}` : `${book} ${start}`;
}

export function PlanDaysManager({ plans }: { plans: PlanOption[] }) {
  const queryClient = useQueryClient();
  const [planId, setPlanId] = useState("");
  const [book, setBook] = useState("John");
  const [chapterStart, setChapterStart] = useState("1");
  const [chapterEnd, setChapterEnd] = useState("1");
  const [perDay, setPerDay] = useState("1");

  const selectedBook = findBook(book);

  const days = useQuery({
    queryKey: ["plan-days", planId],
    enabled: Boolean(planId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reading_assignments")
        .select("id, day_number, book, chapter_start, chapter_end, reference")
        .eq("plan_id", planId)
        .order("day_number");
      if (error) throw error;
      return data ?? [];
    },
  });

  const nextDay = (days.data?.length ? Math.max(...days.data.map((d) => d.day_number)) : 0) + 1;

  const addDay = useMutation({
    mutationFn: async () => {
      if (!planId) throw new Error("Choose a reading plan first");
      const start = Number(chapterStart);
      const end = Math.max(start, Number(chapterEnd) || start);
      if (!Number.isFinite(start) || start < 1) throw new Error("Enter a valid starting chapter");
      if (selectedBook && end > selectedBook.chapters) {
        throw new Error(`${book} has only ${selectedBook.chapters} chapters`);
      }
      const { error } = await supabase.from("reading_assignments").insert({
        plan_id: planId,
        day_number: nextDay,
        book,
        chapter_start: start,
        chapter_end: end,
        reference: reference(book, start, end),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Day added to plan");
      queryClient.invalidateQueries({ queryKey: ["plan-days", planId] });
      queryClient.invalidateQueries({ queryKey: ["my-plan"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const autoFill = useMutation({
    mutationFn: async () => {
      if (!planId) throw new Error("Choose a reading plan first");
      const start = Number(chapterStart) || 1;
      const end = Math.max(start, Number(chapterEnd) || start);
      const step = Math.max(1, Number(perDay) || 1);
      if (selectedBook && end > selectedBook.chapters) {
        throw new Error(`${book} has only ${selectedBook.chapters} chapters`);
      }
      const rows: {
        plan_id: string;
        day_number: number;
        book: string;
        chapter_start: number;
        chapter_end: number;
        reference: string;
      }[] = [];
      let day = nextDay;
      for (let c = start; c <= end; c += step) {
        const last = Math.min(end, c + step - 1);
        rows.push({
          plan_id: planId,
          day_number: day,
          book,
          chapter_start: c,
          chapter_end: last,
          reference: reference(book, c, last),
        });
        day += 1;
      }
      if (!rows.length) throw new Error("Nothing to add");
      const { error } = await supabase.from("reading_assignments").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} day${count === 1 ? "" : "s"} added`);
      queryClient.invalidateQueries({ queryKey: ["plan-days", planId] });
      queryClient.invalidateQueries({ queryKey: ["my-plan"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeDay = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("reading_assignments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Day removed");
      queryClient.invalidateQueries({ queryKey: ["plan-days", planId] });
      queryClient.invalidateQueries({ queryKey: ["my-plan"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section className="surface-card space-y-4 p-5">
      <div>
        <h2 className="flex items-center gap-2 text-lg">
          <CalendarDays className="size-4 text-primary" />
          Plan days
        </h2>
        <p className="text-xs text-muted-foreground">
          Add the passage for each day. Members see the current day on their dashboard.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label>Reading plan</Label>
        <Select value={planId} onValueChange={setPlanId}>
          <SelectTrigger>
            <SelectValue placeholder="Choose a plan" />
          </SelectTrigger>
          <SelectContent>
            {plans.map((plan) => (
              <SelectItem key={plan.id} value={plan.id}>
                {plan.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {planId ? (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Book</Label>
              <Select
                value={book}
                onValueChange={(value) => {
                  setBook(value);
                  setChapterStart("1");
                  setChapterEnd("1");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {BIBLE_BOOKS.map((b) => (
                    <SelectItem key={b.name} value={b.name}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-chapter-start">From chapter</Label>
              <Input
                id="plan-chapter-start"
                type="number"
                min={1}
                max={selectedBook?.chapters ?? 150}
                value={chapterStart}
                onChange={(e) => setChapterStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-chapter-end">To chapter</Label>
              <Input
                id="plan-chapter-end"
                type="number"
                min={1}
                max={selectedBook?.chapters ?? 150}
                value={chapterEnd}
                onChange={(e) => setChapterEnd(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <Button disabled={addDay.isPending} onClick={() => addDay.mutate()}>
              <Plus className="mr-1 size-4" />
              Add as day {nextDay}
            </Button>
            <div className="flex items-end gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="plan-per-day">Chapters per day</Label>
                <Input
                  id="plan-per-day"
                  className="w-24"
                  type="number"
                  min={1}
                  value={perDay}
                  onChange={(e) => setPerDay(e.target.value)}
                />
              </div>
              <Button
                variant="secondary"
                disabled={autoFill.isPending}
                onClick={() => autoFill.mutate()}
              >
                <Wand2 className="mr-1 size-4" />
                Split range into days
              </Button>
            </div>
          </div>

          <div className="divide-y divide-border rounded-lg border border-border">
            {days.isLoading ? (
              <p className="p-3 text-sm text-muted-foreground">Loading days…</p>
            ) : (days.data ?? []).length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">
                No days yet. Add the first passage above.
              </p>
            ) : (
              (days.data ?? []).map((day) => (
                <div key={day.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Day {day.day_number}</span>
                    <span className="ml-2 text-foreground">
                      {day.reference || reference(day.book, day.chapter_start, day.chapter_end)}
                    </span>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Remove day ${day.day_number}`}
                    disabled={removeDay.isPending}
                    onClick={() => removeDay.mutate(day.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </>
      ) : null}
    </section>
  );
}
