"use client";

import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";

interface StepHistoryProps {
  path: string[];
  currentPage: string;
  targetPage: string;
}

export function StepHistory({ path, currentPage, targetPage }: StepHistoryProps) {
  const [open, setOpen] = useState(false);

  if (path.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full">
        <ChevronRight
          className={`size-3 transition-transform ${open ? "rotate-90" : ""}`}
        />
        <span>
          {path.length} page{path.length !== 1 ? "s" : ""} visited
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 ml-1.5 border-l-2 border-border/60 pl-3 space-y-1">
          {path.map((page, i) => {
            const isCurrent = page === currentPage;
            const isTarget = page === targetPage;
            const isStart = i === 0;

            return (
              <div
                key={`${page}-${i}`}
                className={`flex items-center gap-2 text-xs py-0.5 ${
                  isCurrent
                    ? "text-foreground font-medium"
                    : "text-muted-foreground"
                }`}
              >
                <span
                  className={`inline-block size-1.5 rounded-full shrink-0 ${
                    isTarget
                      ? "bg-emerald-500"
                      : isCurrent
                        ? "bg-primary"
                        : isStart
                          ? "bg-amber-500"
                          : "bg-muted-foreground/40"
                  }`}
                />
                <span className="truncate" title={page}>
                  {page}
                </span>
                {isStart && (
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 shrink-0">
                    START
                  </span>
                )}
                {isTarget && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 shrink-0">
                    TARGET
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
