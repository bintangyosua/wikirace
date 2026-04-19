"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Search, Loader2, X } from "lucide-react";

interface SearchResult {
  title: string;
  description: string;
}

interface ArticleSearchProps {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (title: string) => void;
  id?: string;
}

export function ArticleSearch({
  label,
  placeholder = "Search Wikipedia...",
  value,
  onChange,
  id,
}: ArticleSearchProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search
  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/wiki/search?q=${encodeURIComponent(q.trim())}`
      );
      const data = await res.json();
      setResults(data.results || []);
      setIsOpen(data.results?.length > 0);
      setActiveIndex(-1);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      doSearch(query);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectResult = (title: string) => {
    setQuery(title);
    onChange(title);
    setIsOpen(false);
    setResults([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < results.length) {
        selectResult(results[activeIndex].title);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    setQuery("");
    onChange("");
    setResults([]);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          id={id}
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value !== value) {
              onChange(""); // Clear selection when typing
            }
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          className="pl-9 pr-8"
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <X className="size-4" />
            )}
          </button>
        )}
      </div>

      {/* Selected indicator */}
      {value && (
        <p className="text-xs text-emerald-600 flex items-center gap-1">
          <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
          Selected: {value}
        </p>
      )}

      {/* Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
          <ul className="py-1 max-h-64 overflow-y-auto">
            {results.map((result, i) => (
              <li key={result.title}>
                <button
                  type="button"
                  onClick={() => selectResult(result.title)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`w-full text-left px-3 py-2 transition-colors ${
                    i === activeIndex
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/50"
                  }`}
                >
                  <span className="text-sm font-medium block">
                    {result.title}
                  </span>
                  {result.description && (
                    <span className="text-xs text-muted-foreground block mt-0.5">
                      {result.description.split(/\s+/).slice(0, 15).join(" ")}
                      {result.description.split(/\s+/).length > 15 ? "…" : ""}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
