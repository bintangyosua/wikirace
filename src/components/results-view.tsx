"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SerializedRoom, Player } from "@/lib/types";
import { rankPlayers, formatTime } from "@/lib/game-utils";
import { StepHistory } from "@/components/step-history";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Trophy,
  Medal,
  Footprints,
  Clock,
  ArrowRight,
  Home,
  RotateCcw,
  Flag,
  Loader2,
} from "lucide-react";

interface ResultsViewProps {
  roomId: string;
}

const rankIcons: Record<number, React.ReactNode> = {
  0: <Trophy className="size-5 text-amber-500" />,
  1: <Medal className="size-5 text-gray-400" />,
  2: <Medal className="size-5 text-amber-700" />,
};

const rankColors: Record<number, string> = {
  0: "from-amber-500/20 to-amber-500/5 border-amber-500/30",
  1: "from-gray-400/20 to-gray-400/5 border-gray-400/30",
  2: "from-amber-700/20 to-amber-700/5 border-amber-700/30",
};

export function ResultsView({ roomId }: ResultsViewProps) {
  const router = useRouter();
  const [room, setRoom] = useState<SerializedRoom | null>(null);
  const [playerId, setPlayerId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    const id = sessionStorage.getItem("wikirace_player_id") || "";
    setPlayerId(id);

    async function fetchRoom() {
      try {
        const res = await fetch(`/api/rooms/${roomId}`);
        if (res.ok) {
          const data = await res.json();
          setRoom(data.room);
        }
      } catch (err) {
        console.error("Failed to fetch room:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchRoom();
  }, [roomId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading results...</div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-muted-foreground">Room not found</p>
        <Button variant="outline" onClick={() => router.push("/")}>
          Back to Lobby
        </Button>
      </div>
    );
  }

  const players = Object.values(room.players);
  const ranked = rankPlayers(players);

  return (
    <div className="flex flex-col items-center min-h-screen p-6 md:p-10">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="text-5xl">🏁</div>
          <h1 className="text-3xl font-bold">Race Results</h1>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">{room.startPage}</Badge>
            <ArrowRight className="size-4" />
            <Badge variant="outline">{room.targetPage}</Badge>
          </div>
        </div>

        {/* Podium / Rankings */}
        <div className="space-y-3">
          {ranked.map((player, index) => (
            <Card
              key={player.id}
              className={`overflow-hidden transition-all ${
                index < 3 && player.finished && !player.gaveUp
                  ? `bg-gradient-to-r ${rankColors[index] ?? ""} border`
                  : player.gaveUp
                    ? "border-destructive/20 bg-destructive/5"
                    : "border-border/40"
              } ${player.id === playerId ? "ring-1 ring-primary/30" : ""}`}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  {/* Rank */}
                  <div className="flex items-center justify-center size-9 rounded-full bg-muted shrink-0">
                    {player.gaveUp ? (
                      <Flag className="size-5 text-destructive" />
                    ) : player.finished && index < 3 ? (
                      rankIcons[index]
                    ) : (
                      <span className="text-sm font-bold text-muted-foreground">
                        #{index + 1}
                      </span>
                    )}
                  </div>

                  {/* Name */}
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="truncate">{player.name}</span>
                      {player.id === playerId && (
                        <span className="text-xs text-muted-foreground">
                          (you)
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {player.gaveUp
                        ? "Gave Up"
                        : player.finished
                          ? "Finished"
                          : `Still on: ${player.currentPage}`}
                    </CardDescription>
                  </div>

                  {/* Stats */}
                  {player.finished && (
                    <div className="flex items-center gap-4 text-sm shrink-0">
                      <div className="flex items-center gap-1">
                        <Footprints className="size-4 text-muted-foreground" />
                        <span className="font-mono font-bold">
                          {player.steps}
                        </span>
                      </div>
                      {!player.gaveUp && player.finishTime !== null && (
                        <div className="flex items-center gap-1">
                          <Clock className="size-4 text-muted-foreground" />
                          <span className="font-mono font-bold">
                            {formatTime(player.finishTime)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <Separator className="mb-3" />
                <StepHistory
                  path={player.path}
                  currentPage={player.currentPage}
                  targetPage={room.targetPage}
                />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3 pt-4">
          <Button
            variant="outline"
            onClick={() => {
              sessionStorage.removeItem("wikirace_room_id");
              router.push("/");
            }}
            className="gap-2"
          >
            <Home className="size-4" />
            New Room
          </Button>
          {room.hostId === playerId ? (
            <Button
              onClick={async () => {
                setRestarting(true);
                try {
                  const res = await fetch(`/api/rooms/${roomId}/restart`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ playerId }),
                  });
                  if (res.ok) {
                    router.push(`/room/${roomId}`);
                  }
                } catch (err) {
                  console.error("Failed to restart:", err);
                } finally {
                  setRestarting(false);
                }
              }}
              disabled={restarting}
              className="gap-2"
            >
              {restarting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RotateCcw className="size-4" />
              )}
              Play Again
            </Button>
          ) : (
            <Button
              onClick={() => router.push(`/room/${roomId}`)}
              className="gap-2"
            >
              <ArrowRight className="size-4" />
              Back to Room
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
