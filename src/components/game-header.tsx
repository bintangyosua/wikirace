"use client";

import { useEffect, useState, useRef } from "react";
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
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (finished && finishTime !== null) {
      setElapsed(finishTime);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    if (!startTime) {
      setElapsed(0);
      return;
    }

    // Start timer
    setElapsed(Date.now() - startTime);
    intervalRef.current = setInterval(() => {
      setElapsed(Date.now() - startTime);
    }, 50);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startTime, finished, finishTime]);

  const isOnTarget = currentPage === targetPage;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/40 bg-card/80 p-4 backdrop-blur-sm">
      {/* Route: Start → Target */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="secondary" className="gap-1 shrink-0 max-w-[200px]">
          <span className="truncate" title={startPage}>{startPage}</span>
        </Badge>
        <ArrowRight className="size-4 text-muted-foreground shrink-0" />
        <Badge
          variant={isOnTarget ? "default" : "outline"}
          className={`gap-1 shrink-0 max-w-[200px] ${isOnTarget ? "animate-pulse" : ""}`}
        >
          <Target className="size-3" />
          <span className="truncate" title={targetPage}>{targetPage}</span>
        </Badge>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-sm">
          <Clock className="size-4 text-muted-foreground" />
          <span className="font-mono font-medium tabular-nums">
            {formatTime(elapsed)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <Footprints className="size-4 text-muted-foreground" />
          <span className="font-mono font-medium">{steps}</span>
          <span className="text-muted-foreground">steps</span>
        </div>
        {finished && (
          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400">
            🏁 Finished!
          </Badge>
        )}
      </div>

      {/* Current Page */}
      <div className="text-xs text-muted-foreground">
        Current:{" "}
        <span className="font-medium text-foreground">{currentPage}</span>
      </div>
    </div>
  );
}
