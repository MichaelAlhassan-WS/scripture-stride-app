import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

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
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { BIBLE_BOOKS, findBook } from "@/lib/bible-books";
import { todayKey } from "@/lib/stats";

export const Route = createFileRoute("/_authenticated/log-study")({
  head: () => ({
    meta: [
      { title: "Log a study session — FaithTrack" },
      {
        name: "description",
        content: "Record Bible study you completed outside the app: passage, minutes and reflection.",
      },
      { property: "og:title", content: "Log a study session — FaithTrack" },
      { property: "og:description", content: "Record study completed outside the app." },
    ],
  }),
  component: LogStudyPage,
});

const schema = z.object({
  book: z.string().min(1, "Choose a Bible book"),
  chapter: z.number().int().min(1, "Chapter is required"),
  verseStart: z.number().int().min(1).optional(),
  verseEnd: z.number().int().min(1).optional(),
  minutes: z.number().int().min(0).max(1440),
  reflection: z.string().trim().max(2000, "Keep reflections under 2000 characters"),
  studiedOn: z.string().min(1),
});

function LogStudyPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [book, setBook] = useState("John");
  const [chapter, setChapter] = useState("15");
  const [verseStart, setVerseStart] = useState("");
  const [verseEnd, setVerseEnd] = useState("");
  const [minutes, setMinutes] = useState("20");
  const [reflection, setReflection] = useState("");
  const [studiedOn, setStudiedOn] = useState(todayKey());

  const chapterCount = findBook(book)?.chapters ?? 150;

  const save = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse({
        book,
        chapter: Number(chapter),
        verseStart: verseStart ? Number(verseStart) : undefined,
        verseEnd: verseEnd ? Number(verseEnd) : undefined,
        minutes: Number(minutes || 0),
        reflection,
        studiedOn,
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0]!.message);
      if (parsed.data.chapter > chapterCount) {
        throw new Error(`${book} has ${chapterCount} chapters`);
      }
      const { error } = await supabase.from("study_logs").insert({
        user_id: user!.id,
        book: parsed.data.book,
        chapter: parsed.data.chapter,
        verse_start: parsed.data.verseStart ?? null,
        verse_end: parsed.data.verseEnd ?? null,
        minutes: parsed.data.minutes,
        reflection: parsed.data.reflection,
        source: "external",
        studied_on: parsed.data.studiedOn,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Study logged. Keep it up!");
      queryClient.invalidateQueries({ queryKey: ["my-logs", user?.id] });
      navigate({ to: "/dashboard" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl text-foreground sm:text-3xl">Log external study</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Studied in your physical Bible, a group meeting or a devotional? Record it here so your
          streak and your group's progress stay accurate.
        </p>
      </div>

      <div className="surface-card space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Bible book</Label>
            <Select value={book} onValueChange={setBook}>
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
          <div className="space-y-2">
            <Label htmlFor="chapter">Chapter</Label>
            <Input
              id="chapter"
              type="number"
              min={1}
              max={chapterCount}
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="verse-start">Verse from</Label>
            <Input
              id="verse-start"
              type="number"
              min={1}
              placeholder="1"
              value={verseStart}
              onChange={(e) => setVerseStart(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="verse-end">Verse to</Label>
            <Input
              id="verse-end"
              type="number"
              min={1}
              placeholder="17"
              value={verseEnd}
              onChange={(e) => setVerseEnd(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="minutes">Minutes studied</Label>
            <Input
              id="minutes"
              type="number"
              min={0}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="studied-on">Date studied</Label>
          <Input
            id="studied-on"
            type="date"
            max={todayKey()}
            value={studiedOn}
            onChange={(e) => setStudiedOn(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="reflection">Reflection notes</Label>
          <Textarea
            id="reflection"
            rows={5}
            maxLength={2000}
            placeholder="Abiding in Christ produces fruit."
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
          />
        </div>

        <Button className="w-full" disabled={save.isPending} onClick={() => save.mutate()}>
          Save study log
        </Button>
      </div>
    </div>
  );
}