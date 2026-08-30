import { BIBLE_BOOKS, findBook, type BibleBook } from "./bible-books";

export { BIBLE_BOOKS, findBook };
export type { BibleBook };

export type BibleVersion = {
  code: string;
  name: string;
  shortName: string;
  /** Folder under /public/bible; empty string means the files sit at the root (KJV). */
  path: string;
  note: string;
};

export const BIBLE_VERSIONS: BibleVersion[] = [
  {
    code: "KJV",
    name: "King James Version",
    shortName: "KJV",
    path: "",
    note: "Classic 1611 translation · public domain",
  },
  {
    code: "WEB",
    name: "World English Bible",
    shortName: "WEB",
    path: "WEB",
    note: "Modern English update of the ASV · public domain",
  },
  {
    code: "ASV",
    name: "American Standard Version",
    shortName: "ASV",
    path: "ASV",
    note: "Literal 1901 translation · public domain",
  },
];

export const DEFAULT_VERSION = "KJV";

export function findVersion(code: string | undefined | null): BibleVersion {
  const match = BIBLE_VERSIONS.find(
    (v) => v.code.toLowerCase() === String(code ?? "").trim().toLowerCase(),
  );
  return match ?? BIBLE_VERSIONS[0]!;
}

export type Verse = { verse: string; text: string };
export type Chapter = { chapter: string; verses: Verse[] };
export type BookText = { book: string; chapters: Chapter[] };

const cache = new Map<string, Promise<BookText>>();

export function loadBook(bookName: string, versionCode = DEFAULT_VERSION): Promise<BookText> {
  const book = findBook(bookName);
  if (!book) return Promise.reject(new Error(`Unknown book: ${bookName}`));
  const version = findVersion(versionCode);
  const key = `${version.code}:${book.file}`;
  const existing = cache.get(key);
  if (existing) return existing;
  const url = version.path ? `/bible/${version.path}/${book.file}.json` : `/bible/${book.file}.json`;
  const promise = fetch(url).then((res) => {
    if (!res.ok) throw new Error(`Could not load ${book.name} (${version.shortName})`);
    return res.json() as Promise<BookText>;
  });
  cache.set(key, promise);
  return promise;
}

export async function loadChapter(
  bookName: string,
  chapter: number,
  versionCode = DEFAULT_VERSION,
): Promise<Verse[]> {
  const data = await loadBook(bookName, versionCode);
  const found = data.chapters.find((c) => Number(c.chapter) === chapter);
  return found?.verses ?? [];
}

export type SearchHit = { book: string; chapter: number; verse: number; text: string };

/** Searches the loaded/available books for a phrase. Scans a limited set to stay fast. */
export async function searchScripture(
  query: string,
  versionCode = DEFAULT_VERSION,
  books: BibleBook[] = BIBLE_BOOKS,
  limit = 60,
): Promise<SearchHit[]> {
  const needle = query.trim().toLowerCase();
  if (needle.length < 3) return [];
  const hits: SearchHit[] = [];
  for (const book of books) {
    const data = await loadBook(book.name, versionCode);
    for (const chapter of data.chapters) {
      for (const verse of chapter.verses) {
        if (verse.text.toLowerCase().includes(needle)) {
          hits.push({
            book: data.book,
            chapter: Number(chapter.chapter),
            verse: Number(verse.verse),
            text: verse.text,
          });
          if (hits.length >= limit) return hits;
        }
      }
    }
  }
  return hits;
}
