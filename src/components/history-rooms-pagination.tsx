"use client";

import { useMemo, useState } from "react";
import {
  type ColumnDef,
  type PaginationState,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ArchivedPlayerSnapshot {
  playerId: string;
  name: string;
  currentPage: string;
  path?: unknown;
  finished: boolean;
  gaveUp: boolean;
  finishTime: number | null;
  steps: number;
  createdAt?: string;
}

interface ArchivedRoomSnapshot {
  roomCode: string;
  status: "waiting" | "playing" | "finished";
  startPage: string;
  targetPage: string;
  startTime: number | null;
  hostId: string;
  createdAt?: string;
  updatedAt?: string;
}

interface HistorySnapshot {
  room?: ArchivedRoomSnapshot;
  players?: ArchivedPlayerSnapshot[];
}

interface HistoryGameData {
  id: string;
  gameNumber: number;
  startPage: string;
  targetPage: string;
  startTime: number | null;
  status: "waiting" | "playing" | "finished";
  hostId: string;
  playerCount: number;
  createdAt: string;
  snapshot: HistorySnapshot;
}

export interface HistoryRoomGroupData {
  roomId: string;
  roomCode: string;
  hostId: string;
  games: HistoryGameData[];
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatElapsed(value: number | null): string {
  if (value === null) {
    return "-";
  }

  const totalSeconds = Math.floor(value / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function statusBadgeVariant(status: "waiting" | "playing" | "finished") {
  if (status === "finished") return "default" as const;
  if (status === "playing") return "secondary" as const;
  return "outline" as const;
}

function toPath(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function summarizePath(path: string[]): string {
  if (path.length === 0) return "No path";
  if (path.length <= 3) return path.join(" -> ");
  return `${path[0]} -> ... -> ${path[path.length - 1]} (${path.length} pages)`;
}

const columns: ColumnDef<HistoryRoomGroupData>[] = [
  {
    accessorKey: "roomCode",
    header: "Room",
  },
  {
    id: "games",
    accessorFn: (row) => row.games.length,
    header: "Games",
  },
];

export function HistoryRoomsPagination({
  rooms,
}: {
  rooms: HistoryRoomGroupData[];
}) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 5,
  });

  const sortedRooms = useMemo(
    () =>
      [...rooms].sort((a, b) =>
        b.games[0].createdAt.localeCompare(a.games[0].createdAt),
      ),
    [rooms],
  );

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: sortedRooms,
    columns,
    state: {
      pagination,
    },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const roomRows = table.getRowModel().rows;
  const currentPage = table.getState().pagination.pageIndex + 1;
  const pageCount = table.getPageCount();
  const fromIndex =
    table.getState().pagination.pageIndex *
    table.getState().pagination.pageSize;
  const toIndex = Math.min(
    fromIndex + table.getState().pagination.pageSize,
    rooms.length,
  );

  return (
    <div className="space-y-4">
      <Card className="border-border/50 bg-card/85">
        <CardHeader className="gap-2 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">Archived Rooms</CardTitle>
            <Badge variant="outline">{rooms.length} rooms</Badge>
          </div>
          <CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            <span>
              Showing {rooms.length === 0 ? 0 : fromIndex + 1}-{toIndex}
            </span>
            <div className="flex items-center gap-2">
              <span>Rows</span>
              <select
                className="h-7 rounded-md border border-border bg-background px-2 text-xs"
                value={table.getState().pagination.pageSize}
                onChange={(event) => {
                  table.setPageSize(Number(event.target.value));
                  table.setPageIndex(0);
                }}
              >
                {[3, 5, 10, 20].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          </CardDescription>
        </CardHeader>
      </Card>

      {roomRows.map((row) => {
        const roomGroup = row.original;
        const totalPlayers = roomGroup.games.reduce(
          (sum, game) => sum + game.playerCount,
          0,
        );
        const latestGame = roomGroup.games[0];

        return (
          <Card key={roomGroup.roomId} className="border-border/50 bg-card/85">
            <CardHeader className="gap-2 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">
                  Room {roomGroup.roomCode}
                </CardTitle>
                <Badge variant="outline">{roomGroup.games.length} games</Badge>
                <Badge variant="outline">{totalPlayers} player entries</Badge>
              </div>
              <CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <span>Host: {roomGroup.hostId}</span>
                <span>Latest: {formatDate(latestGame.createdAt)}</span>
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-2 pt-0">
              {roomGroup.games.map((game) => {
                const snapshot = game.snapshot;
                const players = Array.isArray(snapshot?.players)
                  ? snapshot.players
                  : [];
                const finishedPlayers = players.filter(
                  (player) => player.finished && !player.gaveUp,
                ).length;
                const gaveUpPlayers = players.filter(
                  (player) => player.gaveUp,
                ).length;

                return (
                  <div
                    key={game.id}
                    className="rounded-lg border border-border/40 bg-background/70 p-3"
                  >
                    <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
                      <p className="text-sm font-semibold">
                        Game #{game.gameNumber}
                      </p>
                      <Badge variant={statusBadgeVariant(game.status)}>
                        {game.status.toUpperCase()}
                      </Badge>
                      <Badge variant="outline">
                        {game.playerCount} players
                      </Badge>
                      <span className="text-muted-foreground">
                        {game.startPage} to {game.targetPage}
                      </span>
                      <span className="text-muted-foreground">
                        Archived {formatDate(game.createdAt)}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>Finished: {finishedPlayers}</span>
                      <span>Give Up: {gaveUpPlayers}</span>
                      <span>
                        Active:{" "}
                        {players.length - finishedPlayers - gaveUpPlayers}
                      </span>
                      <span>
                        Duration:{" "}
                        {game.startTime === null
                          ? "-"
                          : formatElapsed(game.startTime)}
                      </span>
                    </div>

                    {players.length === 0 ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        No players in this game snapshot.
                      </p>
                    ) : (
                      <div className="mt-2 space-y-1.5">
                        {players.map((player, index) => {
                          const path = toPath(player.path);

                          return (
                            <div
                              key={`${player.playerId}-${index}`}
                              className="rounded-md border border-border/40 bg-muted/20 px-2.5 py-2"
                            >
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                                <p className="font-medium text-foreground">
                                  {player.name}
                                </p>
                                <Badge variant="outline">
                                  {player.playerId}
                                </Badge>
                                {game.hostId === player.playerId && (
                                  <Badge variant="secondary">Host</Badge>
                                )}
                                {player.gaveUp ? (
                                  <Badge variant="destructive">Give Up</Badge>
                                ) : player.finished ? (
                                  <Badge variant="default">Finished</Badge>
                                ) : (
                                  <Badge variant="outline">In Progress</Badge>
                                )}
                                <span className="text-muted-foreground">
                                  Page: {player.currentPage}
                                </span>
                                <span>Steps: {player.steps}</span>
                                <span>
                                  Finish: {formatElapsed(player.finishTime)}
                                </span>
                                <span className="truncate text-muted-foreground">
                                  Path: {summarizePath(path)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-card/85 px-4 py-2.5">
        <p className="text-xs text-muted-foreground">
          Page {currentPage} of {pageCount}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.firstPage()}
            disabled={!table.getCanPreviousPage()}
          >
            First
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.lastPage()}
            disabled={!table.getCanNextPage()}
          >
            Last
          </Button>
        </div>
      </div>
    </div>
  );
}
