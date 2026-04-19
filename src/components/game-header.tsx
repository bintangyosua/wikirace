"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Clock, Footprints, Target } from "lucide-react";
import { formatTime } from "@/lib/game-utils";

interface GameHeaderProps {
  startPage: string;
  targetPage: string;
  currentPage: string;
  startTime: number | null;
  steps: number;
  finished: boolean;
  finishTime: number | null;
}

export function GameHeader({
  startPage,
  targetPage,
  currentPage,
  startTime,
  steps,
  finished,
  finishTime,
}: GameHeaderProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (finished || !startTime) {
      return;
    }

    const intervalId = setInterval(() => {
      setNow(Date.now());
    }, 50);

    return () => {
      clearInterval(intervalId);
    };
  }, [startTime, finished]);

  const elapsed =
    finished && finishTime !== null
      ? finishTime
      : startTime
        ? now - startTime
        : 0;

  const isOnTarget = currentPage === targetPage;

  return (
    <div className="flex flex-col gap-1 min-w-0">
      {/* Row 1: Timer + Steps (+ route on desktop) */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <div className="flex items-center gap-1 text-sm shrink-0">
          <Clock className="size-3.5 text-muted-foreground" />
          <span className="font-mono font-medium tabular-nums text-xs">
            {formatTime(elapsed)}
          </span>
        </div>
        <div className="flex items-center gap-1 text-sm shrink-0">
          <Footprints className="size-3.5 text-muted-foreground" />
          <span className="font-mono font-medium text-xs">{steps}</span>
        </div>

        {/* Route on desktop — inline after stats */}
        <div className="w-px h-4 bg-border/60 shrink-0 hidden sm:block" />
        <div className="hidden sm:flex items-center gap-1.5 min-w-0 overflow-hidden">
          <Badge
            variant="secondary"
            className="gap-1 shrink-0 max-w-35 text-xs"
          >
            <span className="truncate" title={startPage}>
              {startPage}
            </span>
          </Badge>
          <ArrowRight className="size-3 text-muted-foreground shrink-0" />
          <Badge
            variant={isOnTarget ? "default" : "outline"}
            className={`gap-1 shrink min-w-0 text-xs ${isOnTarget ? "animate-pulse" : ""}`}
          >
            <Target className="size-3 shrink-0" />
            <span className="truncate" title={targetPage}>
              {targetPage}
            </span>
          </Badge>
        </div>

        {/* Finished badge */}
        {finished && (
          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400 shrink-0 text-xs">
            🏁 Done
          </Badge>
        )}
      </div>

      {/* Row 2: Route on mobile only */}
      <div className="flex items-center gap-1.5 sm:hidden min-w-0 overflow-hidden">
        <Badge
          variant="secondary"
          className="gap-1 shrink min-w-0 text-[10px] px-1.5 py-0"
        >
          <span className="truncate" title={startPage}>
            {startPage}
          </span>
        </Badge>
        <ArrowRight className="size-3 text-muted-foreground shrink-0" />
        <Badge
          variant={isOnTarget ? "default" : "outline"}
          className={`gap-1 shrink min-w-0 text-[10px] px-1.5 py-0 ${isOnTarget ? "animate-pulse" : ""}`}
        >
          <Target className="size-2.5 shrink-0" />
          <span className="truncate" title={targetPage}>
            {targetPage}
          </span>
        </Badge>
      </div>
    </div>
  );
}
