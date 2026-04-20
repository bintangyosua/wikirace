import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  HistoryRoomsPagination,
  type HistoryRoomGroupData,
} from "@/components/history-rooms-pagination";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

interface HistoryByRoom {
  roomId: string;
  roomCode: string;
  hostId: string;
  games: Awaited<ReturnType<typeof prisma.roomHistory.findMany>>;
}

function toHistoryByRoom(
  games: Awaited<ReturnType<typeof prisma.roomHistory.findMany>>,
): HistoryByRoom[] {
  const grouped = new Map<string, HistoryByRoom>();

  for (const game of games) {
    const key = game.roomId;
    const existing = grouped.get(key);

    if (existing) {
      existing.games.push(game);
      continue;
    }

    grouped.set(key, {
      roomId: game.roomId,
      roomCode: game.roomCode,
      hostId: game.hostId,
      games: [game],
    });
  }

  return Array.from(grouped.values()).map((room) => ({
    ...room,
    games: [...room.games].sort((a, b) => b.gameNumber - a.gameNumber),
  }));
}

export default async function HistoryPage() {
  const historyGames = await prisma.roomHistory.findMany({
    orderBy: { createdAt: "desc" },
    take: 120,
  });

  const historyByRoom = toHistoryByRoom(historyGames);
  const paginatedRoomHistory: HistoryRoomGroupData[] = historyByRoom.map(
    (room) => ({
      roomId: room.roomId,
      roomCode: room.roomCode,
      hostId: room.hostId,
      games: room.games.map((game) => ({
        id: game.id,
        gameNumber: game.gameNumber,
        startPage: game.startPage,
        targetPage: game.targetPage,
        startTime: game.startTime === null ? null : Number(game.startTime),
        status: game.status,
        hostId: game.hostId,
        playerCount: game.playerCount,
        createdAt: game.createdAt.toISOString(),
        snapshot: game.snapshot as {
          room?: {
            roomCode: string;
            status: "waiting" | "playing" | "finished";
            startPage: string;
            targetPage: string;
            startTime: number | null;
            hostId: string;
            createdAt?: string;
            updatedAt?: string;
          };
          players?: {
            playerId: string;
            name: string;
            currentPage: string;
            path?: unknown;
            finished: boolean;
            gaveUp: boolean;
            finishTime: number | null;
            steps: number;
            createdAt?: string;
          }[];
        },
      })),
    }),
  );

  return (
    <main className="min-h-screen bg-linear-to-b from-background via-background to-muted/30 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-border/50 bg-card/80 p-6 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              WikiRace Archive
            </p>
            <h1 className="text-3xl font-bold tracking-tight">Game History</h1>
            <p className="text-sm text-muted-foreground">
              Browse history by room, then inspect each game with player results
              and article paths.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
          >
            Back to Lobby
          </Link>
        </div>

        {historyByRoom.length === 0 ? (
          <Card className="border-dashed border-border/50 bg-card/70">
            <CardHeader>
              <CardTitle>No Archived Games Yet</CardTitle>
              <CardDescription>
                No games have been archived yet. Archives are created
                automatically when you press Play Again.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <HistoryRoomsPagination rooms={paginatedRoomHistory} />
        )}
      </div>
    </main>
  );
}
