import type { GameEvent, Player, Room, SerializedRoom } from "./types";
import { generateRoomId } from "./game-utils";

// ─── In-Memory Store ──────────────────────────────────────
// Using global to persist across hot reloads in development
const globalForStore = globalThis as unknown as {
  __rooms?: Map<string, Room>;
  __subscribers?: Map<string, Set<ReadableStreamDefaultController>>;
};

if (!globalForStore.__rooms) {
  globalForStore.__rooms = new Map();
}
if (!globalForStore.__subscribers) {
  globalForStore.__subscribers = new Map();
}

const rooms = globalForStore.__rooms;
const subscribers = globalForStore.__subscribers;

// ─── Room CRUD ────────────────────────────────────────────

export function createRoom(
  startPage: string,
  targetPage: string,
  hostId: string
): Room {
  let id = generateRoomId();
  // Ensure unique ID
  while (rooms.has(id)) {
    id = generateRoomId();
  }

  const room: Room = {
    id,
    startPage,
    targetPage,
    startTime: null,
    players: new Map(),
    status: "waiting",
    hostId,
  };

  rooms.set(id, room);
  subscribers.set(id, new Set());

  return room;
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

export function deleteRoom(roomId: string): void {
  rooms.delete(roomId);
  subscribers.delete(roomId);
}

// ─── Player Management ───────────────────────────────────

export function addPlayer(roomId: string, player: Player): Room | null {
  const room = rooms.get(roomId);
  if (!room) return null;

  room.players.set(player.id, player);

  // Broadcast to other players
  broadcastToRoom(roomId, {
    type: "player_joined",
    player,
  });

  return room;
}

export function startGame(roomId: string): Room | null {
  const room = rooms.get(roomId);
  if (!room || room.status !== "waiting") return null;

  room.status = "playing";
  room.startTime = Date.now();

  // Set all players to start page
  for (const player of room.players.values()) {
    player.currentPage = room.startPage;
    player.path = [room.startPage];
    player.steps = 0;
  }

  broadcastToRoom(roomId, {
    type: "game_started",
    startTime: room.startTime,
  });

  return room;
}

export function updatePlayerNavigation(
  roomId: string,
  playerId: string,
  newPage: string
): Player | null {
  const room = rooms.get(roomId);
  if (!room) return null;

  const player = room.players.get(playerId);
  if (!player || player.finished) return null;

  player.currentPage = newPage;
  player.path.push(newPage);
  player.steps = player.path.length - 1;

  broadcastToRoom(roomId, {
    type: "player_navigated",
    playerId,
    page: newPage,
    steps: player.steps,
    path: [...player.path],
  });

  // Check if player reached target
  if (newPage === room.targetPage) {
    return finishPlayer(roomId, playerId);
  }

  return player;
}

export function finishPlayer(
  roomId: string,
  playerId: string
): Player | null {
  const room = rooms.get(roomId);
  if (!room || !room.startTime) return null;

  const player = room.players.get(playerId);
  if (!player || player.finished) return null;

  player.finished = true;
  player.finishTime = Date.now() - room.startTime;

  broadcastToRoom(roomId, {
    type: "player_finished",
    playerId,
    finishTime: player.finishTime,
    steps: player.steps,
  });

  // Check if all players finished
  const allFinished = Array.from(room.players.values()).every(
    (p) => p.finished
  );
  if (allFinished) {
    room.status = "finished";
  }

  return player;
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

// ─── SSE Subscriptions ───────────────────────────────────

export function addSubscriber(
  roomId: string,
  controller: ReadableStreamDefaultController
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
  controller: ReadableStreamDefaultController
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
