import { type NextRequest } from "next/server";
import { searchArticles } from "@/lib/wikipedia";

export const dynamic = "force-dynamic";

/**
 * GET /api/wiki/search?q=...
 * Search Wikipedia articles for autocomplete suggestions.
 * Returns titles with descriptions.
 */
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q");

  if (!query || query.trim().length < 2) {
    return Response.json({ results: [] });
  }

  try {
    const results = await searchArticles(query.trim());
    return Response.json({ results });
  } catch (error) {
    console.error("Wikipedia search failed:", error);
    return Response.json({ results: [] });
  }
}
