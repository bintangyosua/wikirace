import type { WikiArticle } from "./types";

const WIKI_API = "https://en.wikipedia.org/w/api.php";

/**
 * Fetch and parse a Wikipedia article by title.
 * Uses action=parse to get rendered HTML.
 */
export async function fetchArticle(title: string): Promise<WikiArticle> {
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
    next: { revalidate: 3600 }, // cache for 1 hour
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

  return {
    title: cleanTitle,
    html,
  };
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

