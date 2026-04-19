import { type NextRequest } from "next/server";
import { fetchArticle } from "@/lib/wikipedia";

export const dynamic = "force-dynamic";

/**
 * GET /api/wiki?title=...
 * Proxy endpoint to fetch Wikipedia article content.
 * Avoids CORS issues by fetching server-side.
 */
export async function GET(request: NextRequest) {
  const title = request.nextUrl.searchParams.get("title");

  if (!title) {
    return Response.json(
      { error: "title query parameter is required" },
      { status: 400 }
    );
  }

  try {
    const article = await fetchArticle(title);
    return Response.json(article);
  } catch (error) {
    console.error("Failed to fetch Wikipedia article:", error);
    return Response.json(
      { error: `Failed to fetch article: ${title}` },
      { status: 500 }
    );
  }
}
