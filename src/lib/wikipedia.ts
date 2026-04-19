import type { WikiArticle } from "./types";

const WIKI_API = "https://en.wikipedia.org/w/api.php";

// Wikipedia requires a descriptive User-Agent to avoid aggressive rate-limiting
const WIKI_HEADERS = {
  "User-Agent": "WikiRace/1.0 (https://github.com/wikirace; multiplayer game)",
  "Api-User-Agent": "WikiRace/1.0",
};

// ─── In-memory article cache ──────────────────────────────
// Persisted across hot reloads via globalThis
const globalCache = globalThis as typeof globalThis & {
  __wikiArticleCache?: Map<string, { article: WikiArticle; cachedAt: number }>;
};

if (!globalCache.__wikiArticleCache) {
  globalCache.__wikiArticleCache = new Map();
}

const articleCache = globalCache.__wikiArticleCache;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const MAX_CACHE_SIZE = 200; // max entries to prevent memory leak

function getCachedArticle(title: string): WikiArticle | null {
  const key = title.trim().toLowerCase();
  const entry = articleCache.get(key);
  if (!entry) return null;

  // Check if expired
  if (Date.now() - entry.cachedAt > CACHE_TTL) {
    articleCache.delete(key);
    return null;
  }

  return entry.article;
}

function setCachedArticle(title: string, article: WikiArticle): void {
  const key = title.trim().toLowerCase();

  // Evict oldest entries if cache is full
  if (articleCache.size >= MAX_CACHE_SIZE) {
    const firstKey = articleCache.keys().next().value;
    if (firstKey) articleCache.delete(firstKey);
  }

  articleCache.set(key, { article, cachedAt: Date.now() });
}

/**
 * Fetch and parse a Wikipedia article by title.
 * Uses action=parse to get rendered HTML.
 * Results are cached in-memory for 30 minutes.
 */
export async function fetchArticle(title: string): Promise<WikiArticle> {
  // Check cache first
  const cached = getCachedArticle(title);
  if (cached) return cached;

  const params = new URLSearchParams({
    action: "parse",
    page: title,
    format: "json",
    prop: "text|displaytitle",
    disableeditsection: "true",
    disabletoc: "false",
    origin: "*",
  });

  const res = await fetch(`${WIKI_API}?${params}`, {
    headers: WIKI_HEADERS,
    next: { revalidate: 3600 }, // Next.js cache for 1 hour
  });

  if (!res.ok) {
    throw new Error(`Wikipedia API error: ${res.status}`);
  }

  const data = await res.json();

  if (data.error) {
    throw new Error(`Wikipedia API error: ${data.error.info}`);
  }

  const html = data.parse.text["*"] as string;
  const displayTitle = data.parse.displaytitle as string;

  // Clean the title (remove HTML tags that Wikipedia sometimes includes)
  const cleanTitle = displayTitle.replace(/<[^>]*>/g, "");

  const article: WikiArticle = {
    title: cleanTitle,
    html,
  };

  // Store in cache
  setCachedArticle(title, article);

  return article;
}

/**
 * Get random Wikipedia article titles.
 * Filters out very short articles and disambiguation pages.
 */
export async function getRandomArticles(count: number): Promise<string[]> {
  // Request more than needed to filter
  const requestCount = count * 3;

  const params = new URLSearchParams({
    action: "query",
    list: "random",
    rnnamespace: "0", // main namespace only
    rnlimit: requestCount.toString(),
    format: "json",
    origin: "*",
  });

  const res = await fetch(`${WIKI_API}?${params}`, {
    headers: WIKI_HEADERS,
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Wikipedia API error: ${res.status}`);
  }

  const data = await res.json();
  const articles = data.query.random as Array<{ title: string }>;

  // Filter out articles with parentheses (usually disambiguations) and very specific topics
  const filtered = articles
    .map((a) => a.title)
    .filter(
      (title) =>
        !title.includes("(disambiguation)") &&
        !title.startsWith("List of") &&
        !title.startsWith("Template:") &&
        !title.startsWith("Category:")
    );

  return filtered.slice(0, count);
}

export interface SearchResult {
  title: string;
  description: string;
}

/**
 * Search Wikipedia articles by query (for autocomplete).
 * Uses action=query with prefixsearch + extracts for real descriptions.
 */
export async function searchArticles(query: string): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    action: "query",
    generator: "prefixsearch",
    gpssearch: query,
    gpslimit: "8",
    gpsnamespace: "0",
    prop: "extracts|pageprops",
    exintro: "true",
    explaintext: "true",
    exsentences: "2",
    exlimit: "8",
    ppprop: "disambiguation",
    redirects: "1",
    format: "json",
    origin: "*",
  });

  const res = await fetch(`${WIKI_API}?${params}`, {
    headers: WIKI_HEADERS,
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    throw new Error(`Wikipedia API error: ${res.status}`);
  }

  const data = await res.json();

  if (!data.query?.pages) {
    return [];
  }

  const pages = Object.values(data.query.pages) as Array<{
    pageid: number;
    title: string;
    index: number;
    extract?: string;
    pageprops?: { disambiguation?: string };
  }>;

  // Sort by search relevance (index) and filter out disambig pages
  return pages
    .filter((p) => !p.pageprops?.disambiguation)
    .sort((a, b) => a.index - b.index)
    .map((page) => ({
      title: page.title,
      description: page.extract?.trim() || "",
    }));
}
