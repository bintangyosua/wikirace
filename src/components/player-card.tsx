"use client";

import type { Player } from "@/lib/types";
import { StepHistory } from "@/components/step-history";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatTime } from "@/lib/game-utils";
import { Crown, CheckCircle2, Navigation } from "lucide-react";

interface PlayerCardProps {
  player: Player;
  isCurrentUser: boolean;
  isHost: boolean;
  targetPage: string;
  gameStatus: string;
}

export function PlayerCard({
  player,
  isCurrentUser,
  isHost,
  targetPage,
  gameStatus,
}: PlayerCardProps) {
  return (
    <div
      className={`rounded-lg border p-3 transition-all ${
        isCurrentUser
          ? "border-primary/30 bg-primary/5"
          : "border-border/40 bg-card/50"
      } ${player.finished ? "ring-1 ring-emerald-500/30" : ""}`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        {/* Avatar / Initial */}
        <div
          className={`flex items-center justify-center size-7 rounded-full text-xs font-bold shrink-0 ${
            player.finished
              ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
              : isCurrentUser
                ? "bg-primary/20 text-primary"
                : "bg-muted text-muted-foreground"
          }`}
        >
          {player.name.charAt(0).toUpperCase()}
        </div>

        {/* Name */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span
            className={`text-sm font-medium truncate ${isCurrentUser ? "text-primary" : ""}`}
          >
            {player.name}
          </span>
          {isCurrentUser && (
            <span className="text-[10px] text-muted-foreground">(you)</span>
          )}
          {isHost && (
            <Crown className="size-3 text-amber-500 shrink-0" />
          )}
        </div>

        {/* Status Badge */}
        {player.finished ? (
          <Badge
            variant="secondary"
            className="gap-1 shrink-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
          >
            <CheckCircle2 className="size-3" />
            Done
          </Badge>
        ) : gameStatus === "playing" ? (
          <Badge variant="outline" className="gap-1 shrink-0">
            <Navigation className="size-3" />
            Playing
          </Badge>
        ) : null}
      </div>

      {/* Stats */}
      {gameStatus !== "waiting" && (
        <>
          <Separator className="my-2" />
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              <span className="font-mono font-medium text-foreground">
                {player.steps}
              </span>{" "}
              steps
            </span>
            {player.finished && player.finishTime !== null && (
              <span>
                <span className="font-mono font-medium text-foreground">
                  {formatTime(player.finishTime)}
                </span>
              </span>
            )}
          </div>

          {/* Step History */}
          <div className="mt-2">
            <StepHistory
              path={player.path}
              currentPage={player.currentPage}
              targetPage={targetPage}
            />
          </div>
        </>
      )}
    </div>
  );
}
