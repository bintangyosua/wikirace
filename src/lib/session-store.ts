import type { GameEvent, Player, Room, SerializedRoom } from "./types";
import { generateRoomId } from "./game-utils";
import { prisma } from "./prisma";

// ─── SSE Subscribers (in-memory only — can't persist connections) ──
const globalForSubs = globalThis as unknown as {
  __subscribers?: Map<string, Set<ReadableStreamDefaultController>>;
};

if (!globalForSubs.__subscribers) {
  globalForSubs.__subscribers = new Map();
}

const subscribers = globalForSubs.__subscribers;

async function fetchRoomWithPlayers(roomId: string) {
  return prisma.room.findUnique({
    where: { roomId },
    include: {
      players: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

type DbRoom = NonNullable<Awaited<ReturnType<typeof fetchRoomWithPlayers>>>;
type DbPlayer = DbRoom["players"][number];

type HistoryTx = Pick<typeof prisma, "room" | "roomHistory" | "roomPlayer">;

async function createRoomHistorySnapshot(
  tx: HistoryTx,
  room: DbRoom,
): Promise<void> {
  const latestHistory = await tx.roomHistory.aggregate({
    where: { roomId: room.id },
    _max: { gameNumber: true },
  });

  const nextGameNumber = (latestHistory._max.gameNumber ?? 0) + 1;

  await tx.roomHistory.create({
    data: {
      roomId: room.id,
      roomCode: room.roomId,
      gameNumber: nextGameNumber,
      startPage: room.startPage,
      targetPage: room.targetPage,
      startTime: room.startTime,
      status: room.status,
      hostId: room.hostId,
      playerCount: room.players.length,
      snapshot: {
        room: {
          roomCode: room.roomId,
          status: room.status,
          startPage: room.startPage,
          targetPage: room.targetPage,
          startTime: room.startTime === null ? null : Number(room.startTime),
          hostId: room.hostId,
          createdAt: room.createdAt.toISOString(),
          updatedAt: room.updatedAt.toISOString(),
        },
        players: room.players.map((player) => ({
          playerId: player.playerId,
          name: player.name,
          currentPage: player.currentPage,
          path: [...player.path],
          finished: player.finished,
          gaveUp: player.gaveUp,
          finishTime:
            player.finishTime === null ? null : Number(player.finishTime),
          steps: player.steps,
          createdAt: player.createdAt.toISOString(),
          updatedAt: player.updatedAt.toISOString(),
        })),
      },
    },
  });
}

async function archiveRoomById(tx: HistoryTx, roomId: string): Promise<void> {
  const room = await tx.room.findUnique({
    where: { id: roomId },
    include: {
      players: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!room) {
    return;
  }

  await createRoomHistorySnapshot(tx, room as DbRoom);
}

function shouldArchiveRoomBeforeRestart(
  room: Pick<DbRoom, "status" | "startTime" | "players">,
): boolean {
  if (room.status === "finished") {
    return false;
  }

  if (room.startTime !== null || room.status !== "waiting") {
    return true;
  }

  return room.players.some(
    (player) =>
      player.steps > 0 ||
      player.finished ||
      player.gaveUp ||
      player.path.length > 1,
  );
}

function dbPlayerToPlayer(player: DbPlayer): Player {
  return {
    id: player.playerId,
    name: player.name,
    currentPage: player.currentPage,
    path: [...player.path],
    finished: player.finished,
    gaveUp: player.gaveUp,
    finishTime: player.finishTime === null ? null : Number(player.finishTime),
    steps: player.steps,
  };
}

function dbRoomToRoom(room: DbRoom): Room {
  const players = new Map<string, Player>();

  for (const player of room.players) {
    players.set(player.playerId, dbPlayerToPlayer(player));
  }

  return {
    id: room.roomId,
    startPage: room.startPage,
    targetPage: room.targetPage,
    startTime: room.startTime === null ? null : Number(room.startTime),
    players,
    status: room.status,
    hostId: room.hostId,
  };
}

// ─── Room CRUD ────────────────────────────────────────────

export async function createRoom(
  startPage: string,
  targetPage: string,
  hostId: string,
): Promise<Room> {
  let id = generateRoomId();

  while (await prisma.room.findUnique({ where: { roomId: id } })) {
    id = generateRoomId();
  }

  const room = await prisma.room.create({
    data: {
      roomId: id,
      startPage,
      targetPage,
      startTime: null,
      status: "waiting",
      hostId,
    },
    include: {
      players: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  subscribers.set(id, new Set());

  return dbRoomToRoom(room);
}

export async function getRoom(roomId: string): Promise<Room | undefined> {
  const room = await fetchRoomWithPlayers(roomId);
  if (!room) return undefined;
  return dbRoomToRoom(room);
}

export async function deleteRoom(roomId: string): Promise<void> {
  await prisma.room.deleteMany({ where: { roomId } });
  subscribers.delete(roomId);
}

// ─── Player Management ───────────────────────────────────

export async function addPlayer(
  roomId: string,
  player: Player,
): Promise<Room | null> {
  const room = await prisma.room.findUnique({
    where: { roomId },
    select: { id: true },
  });

  if (!room) return null;

  await prisma.roomPlayer.upsert({
    where: {
      roomId_playerId: {
        roomId: room.id,
        playerId: player.id,
      },
    },
    update: {
      name: player.name,
      currentPage: player.currentPage,
      path: {
        set: player.path,
      },
      finished: player.finished,
      gaveUp: player.gaveUp,
      finishTime: player.finishTime === null ? null : BigInt(player.finishTime),
      steps: player.steps,
    },
    create: {
      roomId: room.id,
      playerId: player.id,
      name: player.name,
      currentPage: player.currentPage,
      path: player.path,
      finished: player.finished,
      gaveUp: player.gaveUp,
      finishTime: player.finishTime === null ? null : BigInt(player.finishTime),
      steps: player.steps,
    },
  });

  const updatedRoom = await fetchRoomWithPlayers(roomId);
  if (!updatedRoom) return null;

  broadcastToRoom(roomId, {
    type: "player_joined",
    player,
  });

  return dbRoomToRoom(updatedRoom);
}

export async function startGame(roomId: string): Promise<Room | null> {
  const room = await fetchRoomWithPlayers(roomId);
  if (!room || room.status !== "waiting") return null;

  const startTime = Date.now();

  await prisma.$transaction(async (tx) => {
    await tx.room.update({
      where: { id: room.id },
      data: {
        status: "playing",
        startTime: BigInt(startTime),
      },
    });

    await tx.roomPlayer.updateMany({
      where: { roomId: room.id },
      data: {
        currentPage: room.startPage,
        path: {
          set: [room.startPage],
        },
        steps: 0,
        finished: false,
        gaveUp: false,
        finishTime: null,
      },
    });
  });

  const updatedRoom = await fetchRoomWithPlayers(roomId);
  if (!updatedRoom) return null;

  broadcastToRoom(roomId, {
    type: "game_started",
    startTime,
  });

  return dbRoomToRoom(updatedRoom);
}

export async function updatePlayerNavigation(
  roomId: string,
  playerId: string,
  newPage: string,
): Promise<Player | null> {
  const now = Date.now();

  const result = await prisma.$transaction(async (tx) => {
    const room = await tx.room.findUnique({
      where: { roomId },
      select: {
        id: true,
        roomId: true,
        targetPage: true,
        startTime: true,
      },
    });

    if (!room) {
      return { ok: false as const };
    }

    const player = await tx.roomPlayer.findUnique({
      where: {
        roomId_playerId: {
          roomId: room.id,
          playerId,
        },
      },
    });

    if (!player || player.finished) {
      return { ok: false as const };
    }

    const path = [...player.path, newPage];
    const steps = path.length - 1;

    const navigationUpdate = await tx.roomPlayer.updateMany({
      where: {
        id: player.id,
        finished: false,
        updatedAt: player.updatedAt,
      },
      data: {
        currentPage: newPage,
        path: {
          set: path,
        },
        steps,
      },
    });

    if (navigationUpdate.count === 0) {
      return { ok: false as const };
    }

    const playerAfterNavigation = await tx.roomPlayer.findUnique({
      where: { id: player.id },
    });

    if (!playerAfterNavigation) {
      return { ok: false as const };
    }

    let updatedPlayer = playerAfterNavigation;

    let finishTime: number | null = null;

    if (newPage === room.targetPage && room.startTime !== null) {
      finishTime = now - Number(room.startTime);

      const finishUpdate = await tx.roomPlayer.updateMany({
        where: {
          id: player.id,
          finished: false,
          updatedAt: updatedPlayer.updatedAt,
        },
        data: {
          finished: true,
          finishTime: BigInt(finishTime),
        },
      });

      if (finishUpdate.count === 0) {
        return { ok: false as const };
      }

      const finishedPlayer = await tx.roomPlayer.findUnique({
        where: { id: player.id },
      });

      if (!finishedPlayer) {
        return { ok: false as const };
      }

      updatedPlayer = finishedPlayer;

      const unfinished = await tx.roomPlayer.count({
        where: {
          roomId: room.id,
          finished: false,
        },
      });

      if (unfinished === 0) {
        const roomTransition = await tx.room.updateMany({
          where: {
            id: room.id,
            status: {
              not: "finished",
            },
          },
          data: { status: "finished" },
        });

        if (roomTransition.count > 0) {
          await archiveRoomById(tx, room.id);
        }
      }
    }

    return {
      ok: true as const,
      roomId: room.roomId,
      player: updatedPlayer,
      finishTime,
    };
  });

  if (!result.ok) {
    return null;
  }

  broadcastToRoom(result.roomId, {
    type: "player_navigated",
    playerId,
    page: newPage,
    steps: result.player.steps,
    path: [...result.player.path],
  });

  if (result.finishTime !== null) {
    broadcastToRoom(result.roomId, {
      type: "player_finished",
      playerId,
      finishTime: result.finishTime,
      steps: result.player.steps,
    });
  }

  return dbPlayerToPlayer(result.player as DbPlayer);
}

export async function goBackPlayer(
  roomId: string,
  playerId: string,
): Promise<Player | null> {
  const result = await prisma.$transaction(async (tx) => {
    const room = await tx.room.findUnique({
      where: { roomId },
      select: { id: true, roomId: true },
    });

    if (!room) return { ok: false as const };

    const player = await tx.roomPlayer.findUnique({
      where: {
        roomId_playerId: {
          roomId: room.id,
          playerId,
        },
      },
    });

    if (!player || player.finished) {
      return { ok: false as const };
    }

    const currentPath = player.path;

    if (currentPath.length <= 1) {
      return { ok: false as const };
    }

    const path = currentPath.slice(0, -1);
    const currentPage = path[path.length - 1];
    const steps = path.length - 1;

    const goBackUpdate = await tx.roomPlayer.updateMany({
      where: {
        id: player.id,
        finished: false,
        updatedAt: player.updatedAt,
      },
      data: {
        currentPage,
        path: {
          set: path,
        },
        steps,
      },
    });

    if (goBackUpdate.count === 0) {
      return { ok: false as const };
    }

    const updatedPlayer = await tx.roomPlayer.findUnique({
      where: { id: player.id },
    });

    if (!updatedPlayer) {
      return { ok: false as const };
    }

    return {
      ok: true as const,
      roomId: room.roomId,
      player: updatedPlayer,
    };
  });

  if (!result.ok) {
    return null;
  }

  broadcastToRoom(result.roomId, {
    type: "player_navigated",
    playerId,
    page: result.player.currentPage,
    steps: result.player.steps,
    path: [...result.player.path],
  });

  return dbPlayerToPlayer(result.player as DbPlayer);
}

async function finishPlayerInternal(
  roomId: string,
  playerId: string,
): Promise<Player | null> {
  const now = Date.now();

  const result = await prisma.$transaction(async (tx) => {
    const room = await tx.room.findUnique({
      where: { roomId },
      select: {
        id: true,
        roomId: true,
        startTime: true,
      },
    });

    if (!room || room.startTime === null) {
      return { ok: false as const };
    }

    const player = await tx.roomPlayer.findUnique({
      where: {
        roomId_playerId: {
          roomId: room.id,
          playerId,
        },
      },
    });

    if (!player || player.finished) {
      return { ok: false as const };
    }

    const finishTime = now - Number(room.startTime);

    await tx.roomPlayer.update({
      where: { id: player.id },
      data: {
        finished: true,
        finishTime: BigInt(finishTime),
      },
    });

    const updatedPlayer = await tx.roomPlayer.findUnique({
      where: { id: player.id },
    });

    if (!updatedPlayer) {
      return { ok: false as const };
    }

    const unfinished = await tx.roomPlayer.count({
      where: {
        roomId: room.id,
        finished: false,
      },
    });

    if (unfinished === 0) {
      const roomTransition = await tx.room.updateMany({
        where: {
          id: room.id,
          status: {
            not: "finished",
          },
        },
        data: { status: "finished" },
      });

      if (roomTransition.count > 0) {
        await archiveRoomById(tx, room.id);
      }
    }

    return {
      ok: true as const,
      roomId: room.roomId,
      player: updatedPlayer,
      finishTime,
    };
  });

  if (!result.ok) {
    return null;
  }

  broadcastToRoom(result.roomId, {
    type: "player_finished",
    playerId,
    finishTime: result.finishTime,
    steps: result.player.steps,
  });

  return dbPlayerToPlayer(result.player as DbPlayer);
}

export async function finishPlayer(
  roomId: string,
  playerId: string,
): Promise<Player | null> {
  return finishPlayerInternal(roomId, playerId);
}

export async function giveUpPlayer(
  roomId: string,
  playerId: string,
): Promise<Player | null> {
  const result = await prisma.$transaction(async (tx) => {
    const room = await tx.room.findUnique({
      where: { roomId },
      select: {
        id: true,
        roomId: true,
        startTime: true,
      },
    });

    if (!room || room.startTime === null) {
      return { ok: false as const };
    }

    const player = await tx.roomPlayer.findUnique({
      where: {
        roomId_playerId: {
          roomId: room.id,
          playerId,
        },
      },
    });

    if (!player || player.finished) {
      return { ok: false as const };
    }

    await tx.roomPlayer.update({
      where: { id: player.id },
      data: {
        finished: true,
        gaveUp: true,
        finishTime: null,
      },
    });

    const updatedPlayer = await tx.roomPlayer.findUnique({
      where: { id: player.id },
    });

    if (!updatedPlayer) {
      return { ok: false as const };
    }

    const unfinished = await tx.roomPlayer.count({
      where: {
        roomId: room.id,
        finished: false,
      },
    });

    if (unfinished === 0) {
      const roomTransition = await tx.room.updateMany({
        where: {
          id: room.id,
          status: {
            not: "finished",
          },
        },
        data: { status: "finished" },
      });

      if (roomTransition.count > 0) {
        await archiveRoomById(tx, room.id);
      }
    }

    return {
      ok: true as const,
      roomId: room.roomId,
      player: updatedPlayer,
    };
  });

  if (!result.ok) {
    return null;
  }

  broadcastToRoom(result.roomId, {
    type: "player_gave_up",
    playerId,
  });

  return dbPlayerToPlayer(result.player as DbPlayer);
}

export async function restartRoom(
  roomId: string,
  startPage: string,
  targetPage: string,
): Promise<Room | null> {
  const room = await prisma.room.findUnique({
    where: { roomId },
    include: {
      players: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!room) return null;

  const shouldArchive = shouldArchiveRoomBeforeRestart(room as DbRoom);

  await prisma.$transaction(async (tx) => {
    if (shouldArchive) {
      await createRoomHistorySnapshot(tx, room as DbRoom);
    }

    await tx.room.update({
      where: { id: room.id },
      data: {
        status: "waiting",
        startTime: null,
        startPage,
        targetPage,
      },
    });

    await tx.roomPlayer.updateMany({
      where: { roomId: room.id },
      data: {
        currentPage: startPage,
        path: {
          set: [startPage],
        },
        steps: 0,
        finished: false,
        gaveUp: false,
        finishTime: null,
      },
    });
  });

  const updatedRoom = await fetchRoomWithPlayers(roomId);
  if (!updatedRoom) return null;

  const serialized = serializeRoom(dbRoomToRoom(updatedRoom));

  broadcastToRoom(roomId, {
    type: "game_restarted",
    room: serialized,
  });

  return dbRoomToRoom(updatedRoom);
}

export async function removePlayer(
  roomId: string,
  playerId: string,
): Promise<Room | null> {
  const result = await prisma.$transaction(async (tx) => {
    const room = await tx.room.findUnique({
      where: { roomId },
      include: {
        players: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!room) {
      return { state: "missing" as const };
    }

    const leavingPlayer = room.players.find(
      (player) => player.playerId === playerId,
    );
    if (!leavingPlayer) {
      return { state: "unchanged" as const, room };
    }

    await tx.roomPlayer.delete({ where: { id: leavingPlayer.id } });

    const remainingPlayers = await tx.roomPlayer.findMany({
      where: { roomId: room.id },
      orderBy: { createdAt: "asc" },
    });

    if (remainingPlayers.length === 0) {
      await tx.room.delete({ where: { id: room.id } });
      return { state: "deleted" as const };
    }

    let newHostId: string | undefined;
    if (room.hostId === playerId) {
      newHostId = remainingPlayers[0].playerId;
      await tx.room.update({
        where: { id: room.id },
        data: { hostId: newHostId },
      });
    }

    const updatedRoom = await tx.room.findUnique({
      where: { id: room.id },
      include: {
        players: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!updatedRoom) {
      return { state: "missing" as const };
    }

    return {
      state: "updated" as const,
      room: updatedRoom,
      newHostId,
    };
  });

  if (result.state === "missing") {
    return null;
  }

  if (result.state === "deleted") {
    subscribers.delete(roomId);
    return null;
  }

  if (result.state === "unchanged") {
    return dbRoomToRoom(result.room as DbRoom);
  }

  const updatedRoom = dbRoomToRoom(result.room as DbRoom);

  broadcastToRoom(roomId, {
    type: "player_left",
    playerId,
    newHostId: result.newHostId,
  });

  return updatedRoom;
}

// ─── Serialization ────────────────────────────────────────

export function serializeRoom(room: Room): SerializedRoom {
  return {
    id: room.id,
    startPage: room.startPage,
    targetPage: room.targetPage,
    startTime: room.startTime,
    players: Object.fromEntries(room.players),
    status: room.status,
    hostId: room.hostId,
  };
}

// ─── SSE Subscriptions (in-memory) ───────────────────────

export function addSubscriber(
  roomId: string,
  controller: ReadableStreamDefaultController,
): void {
  let subs = subscribers.get(roomId);
  if (!subs) {
    subs = new Set();
    subscribers.set(roomId, subs);
  }
  subs.add(controller);
}

export function removeSubscriber(
  roomId: string,
  controller: ReadableStreamDefaultController,
): void {
  const subs = subscribers.get(roomId);
  if (subs) {
    subs.delete(controller);
  }
}

export function broadcastToRoom(roomId: string, event: GameEvent): void {
  const subs = subscribers.get(roomId);
  if (!subs) return;

  const data = `data: ${JSON.stringify(event)}\n\n`;
  const encoder = new TextEncoder();

  for (const controller of subs) {
    try {
      controller.enqueue(encoder.encode(data));
    } catch {
      // Controller closed, remove it
      subs.delete(controller);
    }
  }
}
