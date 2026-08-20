import { BIBLE_BOOKS, findBook, type BibleBook } from "./bible-books";

export { BIBLE_BOOKS, findBook };
export type { BibleBook };

export type Verse = { verse: string; text: string };
export type Chapter = { chapter: string; verses: Verse[] };
export type BookText = { book: string; chapters: Chapter[] };

const cache = new Map<string, Promise<BookText>>();

export function loadBook(bookName: string): Promise<BookText> {
  const book = findBook(bookName);
  if (!book) return Promise.reject(new Error(`Unknown book: ${bookName}`));
  const existing = cache.get(book.file);
  if (existing) return existing;
  const promise = fetch(`/bible/${book.file}.json`).then((res) => {
    if (!res.ok) throw new Error(`Could not load ${book.name}`);
    return res.json() as Promise<BookText>;
  });
  cache.set(book.file, promise);
  return promise;
}

export async function loadChapter(bookName: string, chapter: number): Promise<Verse[]> {
  const data = await loadBook(bookName);
  const found = data.chapters.find((c) => Number(c.chapter) === chapter);
  return found?.verses ?? [];
}

export type SearchHit = { book: string; chapter: number; verse: number; text: string };

/** Searches the loaded/available books for a phrase. Scans a limited set to stay fast. */
export async function searchScripture(
  query: string,
  books: BibleBook[] = BIBLE_BOOKS,
  limit = 60,
): Promise<SearchHit[]> {
  const needle = query.trim().toLowerCase();
  if (needle.length < 3) return [];
  const hits: SearchHit[] = [];
  for (const book of books) {
    const data = await loadBook(book.name);
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
