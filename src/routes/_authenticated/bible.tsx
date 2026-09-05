import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bookmark, CheckCircle2, Highlighter, Search, Timer } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { BIBLE_BOOKS, findBook } from "@/lib/bible-books";
import {
  BIBLE_VERSIONS,
  DEFAULT_VERSION,
  findVersion,
  loadChapter,
  searchScripture,
  type SearchHit,
} from "@/lib/bible";
import { todayKey } from "@/lib/stats";
import { cn } from "@/lib/utils";

type BibleSearch = { book: string; chapter: number; version: string };

export const Route = createFileRoute("/_authenticated/bible")({
  validateSearch: (search: Record<string, unknown>): BibleSearch => ({
    book: findBook(String(search["book"] ?? "John"))?.name ?? "John",
    chapter: Math.max(1, Number(search["chapter"] ?? 1) || 1),
    version: findVersion(String(search["version"] ?? DEFAULT_VERSION)).code,
  }),
  head: () => ({
    meta: [
      { title: "Bible reader — KJV, WEB & ASV — FaithTrack" },
      {
        name: "description",
        content:
          "Read the KJV, World English Bible or ASV in FaithTrack: browse books and chapters, search scripture, bookmark and highlight verses.",
      },
      { property: "og:title", content: "Bible reader — KJV, WEB & ASV — FaithTrack" },
      { property: "og:description", content: "Browse, search, bookmark and highlight three public-domain translations." },
    ],
  }),
  component: BiblePage,
});

function BiblePage() {
  const { book, chapter, version } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useSession();
  const queryClient = useQueryClient();
  const userId = user?.id;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const startedAt = useRef(Date.now());

  const bookMeta = findBook(book) ?? BIBLE_BOOKS[42]!;
  const chapterCount = bookMeta.chapters;
  const safeChapter = Math.min(chapter, chapterCount);

  useEffect(() => {
    startedAt.current = Date.now();
    setSeconds(0);
    const timer = setInterval(() => {
      setSeconds(Math.round((Date.now() - startedAt.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [book, safeChapter]);

  const versionMeta = findVersion(version);

  const verses = useQuery({
    queryKey: ["chapter", version, book, safeChapter],
    queryFn: () => loadChapter(book, safeChapter, version),
  });

  const marks = useQuery({
    queryKey: ["marks", userId, book, safeChapter],
    enabled: Boolean(userId),
    queryFn: async () => {
      const [bookmarks, highlights, sessions] = await Promise.all([
        supabase
          .from("bookmarks")
          .select("verse")
          .eq("user_id", userId!)
          .eq("book", book)
          .eq("chapter", safeChapter),
        supabase
          .from("highlights")
          .select("verse")
          .eq("user_id", userId!)
          .eq("book", book)
          .eq("chapter", safeChapter),
        supabase
          .from("reading_sessions")
          .select("id, completed")
          .eq("user_id", userId!)
          .eq("book", book)
          .eq("chapter", safeChapter),
      ]);
      return {
        bookmarks: new Set((bookmarks.data ?? []).map((b) => b.verse)),
        highlights: new Set((highlights.data ?? []).map((h) => h.verse)),
        completed: (sessions.data ?? []).some((s) => s.completed),
      };
    },
  });

  const viewedCount = useQuery({
    queryKey: ["viewed-count", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("reading_sessions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId!);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const toggleMark = useMutation({
    mutationFn: async ({ table, verse }: { table: "bookmarks" | "highlights"; verse: number }) => {
      const exists =
        table === "bookmarks"
          ? marks.data?.bookmarks.has(verse)
          : marks.data?.highlights.has(verse);
      if (exists) {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq("user_id", userId!)
          .eq("book", book)
          .eq("chapter", safeChapter)
          .eq("verse", verse);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from(table)
        .insert({ user_id: userId!, book, chapter: safeChapter, verse });
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["marks", userId, book, safeChapter] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const markChapter = useMutation({
    mutationFn: async () => {
      const spent = Math.max(seconds, 1);
      const { error } = await supabase.from("reading_sessions").insert({
        user_id: userId!,
        book,
        chapter: safeChapter,
        seconds_spent: spent,
        completed: true,
      });
      if (error) throw error;
      const { error: logError } = await supabase.from("study_logs").insert({
        user_id: userId!,
        book,
        chapter: safeChapter,
        minutes: Math.max(1, Math.round(spent / 60)),
        source: "in_app",
        studied_on: todayKey(),
      });
      if (logError) throw logError;
    },
    onSuccess: () => {
      toast.success(`${book} ${safeChapter} marked complete`);
      queryClient.invalidateQueries({ queryKey: ["marks", userId, book, safeChapter] });
      queryClient.invalidateQueries({ queryKey: ["my-logs", userId] });
      queryClient.invalidateQueries({ queryKey: ["viewed-count", userId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function runSearch() {
    if (query.trim().length < 3) {
      toast.error("Enter at least 3 characters");
      return;
    }
    setSearching(true);
    try {
      const hits = await searchScripture(query, version);
      setResults(hits);
      if (hits.length === 0) toast.info("No verses matched that search");
    } finally {
      setSearching(false);
    }
  }

  const chapterOptions = useMemo(
    () => Array.from({ length: chapterCount }, (_, i) => i + 1),
    [chapterCount],
  );

  function go(nextBook: string, nextChapter: number, nextVersion = version) {
    setResults(null);
    navigate({
      to: "/bible",
      search: { book: nextBook, chapter: nextChapter, version: nextVersion },
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl text-foreground sm:text-3xl">Bible reader</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {versionMeta.name} · {viewedCount.data ?? 0} chapters tracked
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Timer className="size-4" />
          {Math.floor(seconds / 60)}m {seconds % 60}s on this chapter
        </div>
      </div>

      <div className="surface-card flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <div className="w-full space-y-1.5 sm:w-44">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Version
          </span>
          <Select value={versionMeta.code} onValueChange={(value) => go(book, safeChapter, value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BIBLE_VERSIONS.map((v) => (
                <SelectItem key={v.code} value={v.code}>
                  {v.shortName} — {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 space-y-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Book
          </span>
          <Select value={book} onValueChange={(value) => go(value, 1)}>
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
        <div className="w-full space-y-1.5 sm:w-32">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Chapter
          </span>
          <Select value={String(safeChapter)} onValueChange={(value) => go(book, Number(value))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {chapterOptions.map((c) => (
                <SelectItem key={c} value={String(c)}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          className="sm:w-auto"
          variant={marks.data?.completed ? "outline" : "default"}
          disabled={markChapter.isPending}
          onClick={() => markChapter.mutate()}
        >
          <CheckCircle2 className="mr-1 size-4" />
          {marks.data?.completed ? "Completed — log again" : "Mark chapter completed"}
        </Button>
      </div>

      <div className="surface-card flex flex-col gap-2 p-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={`Search the ${versionMeta.shortName}, e.g. abide in me`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") runSearch();
            }}
          />
        </div>
        <Button variant="secondary" disabled={searching} onClick={runSearch}>
          {searching ? "Searching…" : "Search"}
        </Button>
        {results ? (
          <Button variant="ghost" onClick={() => setResults(null)}>
            Clear
          </Button>
        ) : null}
      </div>

      {results ? (
        <div className="surface-card p-5">
          <h2 className="text-lg text-foreground">
            {results.length} result{results.length === 1 ? "" : "s"} for “{query}”
          </h2>
          <div className="mt-3 divide-y divide-border">
            {results.map((hit) => (
              <button
                key={`${hit.book}-${hit.chapter}-${hit.verse}`}
                type="button"
                onClick={() => go(hit.book, hit.chapter)}
                className="block w-full py-3 text-left hover:bg-secondary/60"
              >
                <p className="text-sm font-medium text-primary">
                  {hit.book} {hit.chapter}:{hit.verse}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{hit.text}</p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="surface-card p-5 sm:p-7">
          <h2 className="font-display text-2xl text-primary">
            {book} {safeChapter}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{versionMeta.note}</p>
          {verses.isLoading ? (
            <p className="mt-4 text-sm text-muted-foreground">Loading chapter…</p>
          ) : null}
          <div className="mt-4 space-y-3">
            {(verses.data ?? []).map((verse) => {
              const number = Number(verse.verse);
              const highlighted = marks.data?.highlights.has(number);
              const bookmarked = marks.data?.bookmarks.has(number);
              return (
                <div key={verse.verse} className="group flex gap-3">
                  <span className="mt-0.5 w-6 shrink-0 text-right text-xs font-semibold text-accent-foreground/70">
                    {verse.verse}
                  </span>
                  <p
                    className={cn(
                      "flex-1 text-[15px] leading-relaxed text-foreground",
                      highlighted && "rounded-md bg-accent-soft px-2 py-1",
                    )}
                  >
                    {verse.text}
                  </p>
                  <div className="flex shrink-0 gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      aria-label="Highlight verse"
                      onClick={() => toggleMark.mutate({ table: "highlights", verse: number })}
                      className={cn(
                        "rounded-md p-1.5 hover:bg-secondary",
                        highlighted ? "text-accent-foreground" : "text-muted-foreground",
                      )}
                    >
                      <Highlighter className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Bookmark verse"
                      onClick={() => toggleMark.mutate({ table: "bookmarks", verse: number })}
                      className={cn(
                        "rounded-md p-1.5 hover:bg-secondary",
                        bookmarked ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      <Bookmark className="size-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="outline"
              disabled={safeChapter <= 1}
              onClick={() => go(book, safeChapter - 1)}
            >
              Previous
            </Button>
            <Button
              variant={marks.data?.completed ? "outline" : "default"}
              disabled={markChapter.isPending}
              onClick={() => markChapter.mutate()}
            >
              <CheckCircle2 className="mr-1 size-4" />
              {marks.data?.completed ? "Completed — log again" : "Mark chapter completed"}
            </Button>
            <Button
              variant="outline"
              disabled={safeChapter >= chapterCount}
              onClick={() => go(book, safeChapter + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
