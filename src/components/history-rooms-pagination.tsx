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
import { Separator } from "@/components/ui/separator";

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

  return (
    <div className="space-y-4">
      <Card className="border-border/50 bg-card/85">
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-lg">Archived Rooms</CardTitle>
            <Badge variant="outline">{rooms.length} room</Badge>
          </div>
          <CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
            <span>
              Showing room{" "}
              {table.getState().pagination.pageIndex *
                table.getState().pagination.pageSize +
                1}
              -
              {Math.min(
                table.getState().pagination.pageIndex *
                  table.getState().pagination.pageSize +
                  table.getState().pagination.pageSize,
                rooms.length,
              )}
            </span>
            <div className="flex items-center gap-2">
              <span>Rows per page</span>
              <select
                className="h-8 rounded-md border border-border bg-background px-2 text-xs"
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
            <CardHeader className="gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-lg">
                  Room {roomGroup.roomCode}
                </CardTitle>
                <Badge variant="outline">{roomGroup.games.length} game</Badge>
                <Badge variant="outline">
                  {totalPlayers} total player entries
                </Badge>
              </div>
              <CardDescription className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <span>Host: {roomGroup.hostId}</span>
                <span>Latest Archive: {formatDate(latestGame.createdAt)}</span>
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {roomGroup.games.map((game) => {
                const snapshot = game.snapshot;
                const roomSnapshot = snapshot?.room;
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
                    className="rounded-xl border border-border/40 bg-background/70 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold">
                        Game #{game.gameNumber}
                      </p>
                      <Badge variant={statusBadgeVariant(game.status)}>
                        {game.status.toUpperCase()}
                      </Badge>
                      <Badge variant="outline">{game.playerCount} player</Badge>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Archived: {formatDate(game.createdAt)}</span>
                      <span>Start: {game.startPage}</span>
                      <span>Target: {game.targetPage}</span>
                      <span>
                        Start Time:{" "}
                        {game.startTime === null
                          ? "-"
                          : formatElapsed(game.startTime)}
                      </span>
                      {roomSnapshot?.updatedAt && (
                        <span>
                          Last Updated: {formatDate(roomSnapshot.updatedAt)}
                        </span>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          Finished
                        </p>
                        <p className="text-lg font-semibold">
                          {finishedPlayers}
                        </p>
                      </div>
                      <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          Gave Up
                        </p>
                        <p className="text-lg font-semibold">{gaveUpPlayers}</p>
                      </div>
                      <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          Still Playing
                        </p>
                        <p className="text-lg font-semibold">
                          {players.length - finishedPlayers - gaveUpPlayers}
                        </p>
                      </div>
                      <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          Host
                        </p>
                        <p className="text-sm font-semibold">{game.hostId}</p>
                      </div>
                    </div>

                    <Separator className="my-3" />

                    {players.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No players in this game snapshot.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {players.map((player, index) => {
                          const path = toPath(player.path);
                          const pathLength = path.length;

                          return (
                            <div
                              key={`${player.playerId}-${index}`}
                              className="rounded-lg border border-border/40 bg-muted/20 p-3"
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold">{player.name}</p>
                                <Badge variant="outline">
                                  ID: {player.playerId}
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
                              </div>

                              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                <span>Current: {player.currentPage}</span>
                                <span>Steps: {player.steps}</span>
                                <span>
                                  Finish Time:{" "}
                                  {formatElapsed(player.finishTime)}
                                </span>
                              </div>

                              <div className="mt-3 rounded-lg border border-border/40 bg-background/70 p-3">
                                <p className="mb-2 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                                  Path ({pathLength})
                                </p>
                                {pathLength === 0 ? (
                                  <p className="text-sm text-muted-foreground">
                                    No saved path yet.
                                  </p>
                                ) : (
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {path.map((page, pathIndex) => {
                                      const isFirst = pathIndex === 0;
                                      const isLast =
                                        pathIndex === path.length - 1;

                                      return (
                                        <span
                                          key={`${player.playerId}-${pathIndex}`}
                                          className="flex items-center gap-1.5"
                                        >
                                          <Badge
                                            variant={
                                              isFirst
                                                ? "secondary"
                                                : isLast
                                                  ? "default"
                                                  : "outline"
                                            }
                                            className="max-w-55 truncate"
                                            title={page}
                                          >
                                            {page}
                                          </Badge>
                                          {!isLast && (
                                            <span className="text-muted-foreground/60">
                                              →
                                            </span>
                                          )}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
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

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/50 bg-card/85 px-4 py-3">
        <p className="text-sm text-muted-foreground">
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
