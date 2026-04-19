"use client";

import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight, ArrowRight } from "lucide-react";

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
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {path.map((page, i) => {
            const isCurrent = page === currentPage;
            const isTarget = page === targetPage;
            const isStart = i === 0;
            const isLast = i === path.length - 1;

            return (
              <span key={`${page}-${i}`} className="flex items-center gap-1">
                <span
                  className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-md ${
                    isTarget
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium"
                      : isCurrent
                        ? "bg-primary/10 text-primary font-medium"
                        : isStart
                          ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                          : "bg-muted text-muted-foreground"
                  }`}
                  title={page}
                >
                  <span className="max-w-[120px] truncate">{page}</span>
                  {isStart && (
                    <span className="text-[9px] font-bold uppercase opacity-60">
                      start
                    </span>
                  )}
                  {isTarget && (
                    <span className="text-[9px] font-bold uppercase opacity-60">
                      🏁
                    </span>
                  )}
                </span>
                {!isLast && (
                  <ArrowRight className="size-3 text-muted-foreground/50 shrink-0" />
                )}
              </span>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
