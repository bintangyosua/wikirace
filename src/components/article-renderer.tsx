"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { WikiArticle } from "@/lib/types";
import { Loader2 } from "lucide-react";

const ZERO_WIDTH_SEPARATORS = ["\u2060", "\u200b", "\u200c"] as const;

function obfuscateForFindInPage(text: string): string {
  let out = "";

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    out += ch;

    if (/\s/.test(ch)) {
      continue;
    }

    out += ZERO_WIDTH_SEPARATORS[i % ZERO_WIDTH_SEPARATORS.length];
  }

  return out;
}

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

  // Anti-cheat: replace text nodes with CSS-rendered spans (unsearchable by Find in Page)
  useLayoutEffect(() => {
    if (!contentRef.current || !article) return;

    // Mobile Find-in-page may match text from attributes, so strip common searchable attrs.
    for (const el of contentRef.current.querySelectorAll("[title],[aria-label],[alt],[placeholder]")) {
      el.removeAttribute("title");
      el.removeAttribute("aria-label");
      el.removeAttribute("alt");
      el.removeAttribute("placeholder");
    }

    const walker = document.createTreeWalker(
      contentRef.current,
      NodeFilter.SHOW_TEXT
    );

    // Collect all text nodes first (can't modify DOM while walking)
    const textNodes: Text[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      textNodes.push(node as Text);
    }

    for (const textNode of textNodes) {
      const text = textNode.textContent;
      if (!text || !text.trim()) continue;

      const span = document.createElement('span');
      span.setAttribute('data-text', obfuscateForFindInPage(text));
      textNode.parentNode?.replaceChild(span, textNode);
    }
  }, [article]);

  // Block Ctrl+F / Cmd+F browser search while article is displayed
  useEffect(() => {
    if (!article) return;

    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
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

      // Handle hash-only links (scroll within the article)
      if (href.startsWith("#")) {
        const el = contentRef.current?.querySelector(href);
        if (el) el.scrollIntoView({ behavior: "smooth" });
        return;
      }

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

      // Skip self-referencing links — compare against BOTH currentPage
      // AND the article's actual title (handles Wikipedia redirects)
      const normalise = (s: string) => s.replace(/_/g, " ").toLowerCase().trim();
      const normTitle = normalise(title);
      if (
        normTitle === normalise(currentPage) ||
        (article && normTitle === normalise(article.title))
      ) {
        // If the link has a hash, scroll to that section instead
        const hashMatch = href.match(/#(.+)$/);
        if (hashMatch) {
          const el = contentRef.current?.querySelector(`#${CSS.escape(hashMatch[1])}`);
          if (el) el.scrollIntoView({ behavior: "smooth" });
        }
        return;
      }

      onNavigate(title);
    },
    [onNavigate, disabled, currentPage, article]
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
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      style={{ userSelect: 'none', WebkitUserSelect: 'none' } as React.CSSProperties}
    >
      <h1 className="wiki-title">{article.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: article.html }} />
    </div>
  );
}
