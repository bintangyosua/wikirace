"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WikiArticle } from "@/lib/types";
import { Loader2 } from "lucide-react";

interface ArticleRendererProps {
  currentPage: string;
  onNavigate: (title: string) => void;
  disabled?: boolean;
}

export function ArticleRenderer({
  currentPage,
  onNavigate,
  disabled = false,
}: ArticleRendererProps) {
  const [article, setArticle] = useState<WikiArticle | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

  // Fetch article when currentPage changes
  useEffect(() => {
    let cancelled = false;

    async function loadArticle() {
      setLoading(true);
      setError("");

      try {
        const res = await fetch(
          `/api/wiki?title=${encodeURIComponent(currentPage)}`
        );
        if (!res.ok) throw new Error("Failed to fetch article");

        const data = await res.json();
        if (!cancelled) {
          setArticle(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load article"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadArticle();

    return () => {
      cancelled = true;
    };
  }, [currentPage]);

  // Scroll to top when article changes
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, [article]);

  // Intercept link clicks
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;

      const target = e.target as HTMLElement;
      const anchor = target.closest("a");

      if (!anchor) return;

      e.preventDefault();
      e.stopPropagation();

      const href = anchor.getAttribute("href");
      if (!href) return;

      // Only handle internal /wiki/ links
      const wikiMatch = href.match(/^\/wiki\/([^#]+)/);
      if (!wikiMatch) return;

      const title = decodeURIComponent(wikiMatch[1].replace(/_/g, " "));

      // Skip special pages
      if (
        title.startsWith("File:") ||
        title.startsWith("Wikipedia:") ||
        title.startsWith("Special:") ||
        title.startsWith("Help:") ||
        title.startsWith("Template:") ||
        title.startsWith("Category:") ||
        title.startsWith("Portal:") ||
        title.startsWith("Talk:")
      ) {
        return;
      }

      onNavigate(title);
    },
    [onNavigate, disabled]
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Loading {currentPage}...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (!article) return null;

  return (
    <div
      ref={contentRef}
      className="wiki-content overflow-y-auto"
      onClick={handleClick}
    >
      <h1 className="wiki-title">{article.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: article.html }} />
    </div>
  );
}
