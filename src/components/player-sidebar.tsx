"use client";

import type { Player } from "@/lib/types";
import { PlayerCard } from "@/components/player-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users } from "lucide-react";

interface PlayerSidebarProps {
  players: Record<string, Player>;
  currentPlayerId: string;
  hostId: string;
  targetPage: string;
  gameStatus: string;
}

export function PlayerSidebar({
  players,
  currentPlayerId,
  hostId,
  targetPage,
  gameStatus,
}: PlayerSidebarProps) {
  const playerList = Object.values(players);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40">
        <Users className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">Players</span>
        <span className="text-xs text-muted-foreground">
          ({playerList.length})
        </span>
      </div>

      <ScrollArea className="flex-1 p-3">
        <div className="space-y-2">
          {playerList.map((player) => (
            <PlayerCard
              key={player.id}
              player={player}
              isCurrentUser={player.id === currentPlayerId}
              isHost={player.id === hostId}
              targetPage={targetPage}
              gameStatus={gameStatus}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
