import type { GameEvent, Player, Room, SerializedRoom } from "./types";
import { generateRoomId } from "./game-utils";
import { connectDB } from "./mongodb";
import { RoomModel } from "./models/room";

// ─── SSE Subscribers (in-memory only — can't persist connections) ──
const globalForSubs = globalThis as unknown as {
  __subscribers?: Map<string, Set<ReadableStreamDefaultController>>;
};

if (!globalForSubs.__subscribers) {
  globalForSubs.__subscribers = new Map();
}

const subscribers = globalForSubs.__subscribers;

// ─── Helper: Convert Mongoose doc → Room type ─────────────
function docToRoom(doc: InstanceType<typeof RoomModel>): Room {
  const players = new Map<string, Player>();
  if (doc.players) {
    for (const [key, val] of doc.players.entries()) {
      players.set(key, {
        id: val.id,
        name: val.name,
        currentPage: val.currentPage,
        path: [...val.path],
        finished: val.finished,
        gaveUp: val.gaveUp,
        finishTime: val.finishTime,
        steps: val.steps,
      });
    }
  }

  return {
    id: doc.roomId,
    startPage: doc.startPage,
    targetPage: doc.targetPage,
    startTime: doc.startTime,
    players,
    status: doc.status,
    hostId: doc.hostId,
  };
}

// ─── Room CRUD ────────────────────────────────────────────

export async function createRoom(
  startPage: string,
  targetPage: string,
  hostId: string
): Promise<Room> {
  await connectDB();

  let id = generateRoomId();
  // Ensure unique ID
  while (await RoomModel.exists({ roomId: id })) {
    id = generateRoomId();
  }

  const doc = await RoomModel.create({
    roomId: id,
    startPage,
    targetPage,
    startTime: null,
    players: new Map(),
    status: "waiting",
    hostId,
  });

  subscribers.set(id, new Set());

  return docToRoom(doc);
}

export async function getRoom(roomId: string): Promise<Room | undefined> {
  await connectDB();
  const doc = await RoomModel.findOne({ roomId });
  if (!doc) return undefined;
  return docToRoom(doc);
}

export async function deleteRoom(roomId: string): Promise<void> {
  await connectDB();
  await RoomModel.deleteOne({ roomId });
  subscribers.delete(roomId);
}

// ─── Player Management ───────────────────────────────────

export async function addPlayer(
  roomId: string,
  player: Player
): Promise<Room | null> {
  await connectDB();

  const doc = await RoomModel.findOneAndUpdate(
    { roomId },
    { $set: { [`players.${player.id}`]: player } },
    { new: true }
  );

  if (!doc) return null;

  // Broadcast to other players
  broadcastToRoom(roomId, {
    type: "player_joined",
    player,
  });

  return docToRoom(doc);
}

export async function startGame(roomId: string): Promise<Room | null> {
  await connectDB();

  const doc = await RoomModel.findOne({ roomId });
  if (!doc || doc.status !== "waiting") return null;

  const startTime = Date.now();
  doc.status = "playing";
  doc.startTime = startTime;

  // Reset all players to start page
  for (const [, player] of doc.players.entries()) {
    player.currentPage = doc.startPage;
    player.path = [doc.startPage];
    player.steps = 0;
    player.gaveUp = false;
  }

  await doc.save();

  broadcastToRoom(roomId, {
    type: "game_started",
    startTime,
  });

  return docToRoom(doc);
}

export async function updatePlayerNavigation(
  roomId: string,
  playerId: string,
  newPage: string
): Promise<Player | null> {
  await connectDB();

  const doc = await RoomModel.findOne({ roomId });
  if (!doc) return null;

  const player = doc.players.get(playerId);
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
  if (newPage === doc.targetPage) {
    return finishPlayerInternal(doc, playerId);
  }

  await doc.save();

  return {
    id: player.id,
    name: player.name,
    currentPage: player.currentPage,
    path: [...player.path],
    finished: player.finished,
    gaveUp: player.gaveUp,
    finishTime: player.finishTime,
    steps: player.steps,
  };
}

export async function goBackPlayer(
  roomId: string,
  playerId: string
): Promise<Player | null> {
  await connectDB();

  const doc = await RoomModel.findOne({ roomId });
  if (!doc) return null;

  const player = doc.players.get(playerId);
  if (!player || player.finished) return null;

  // Can't go back past the start page
  if (player.path.length <= 1) return null;

  player.path.pop();
  player.currentPage = player.path[player.path.length - 1];
  player.steps = player.path.length - 1;

  await doc.save();

  broadcastToRoom(roomId, {
    type: "player_navigated",
    playerId,
    page: player.currentPage,
    steps: player.steps,
    path: [...player.path],
  });

  return {
    id: player.id,
    name: player.name,
    currentPage: player.currentPage,
    path: [...player.path],
    finished: player.finished,
    gaveUp: player.gaveUp,
    finishTime: player.finishTime,
    steps: player.steps,
  };
}

// Internal finish — used when player reaches target during navigation
async function finishPlayerInternal(
  doc: InstanceType<typeof RoomModel>,
  playerId: string
): Promise<Player | null> {
  const player = doc.players.get(playerId);
  if (!player || player.finished || !doc.startTime) return null;

  player.finished = true;
  player.finishTime = Date.now() - doc.startTime;

  broadcastToRoom(doc.roomId, {
    type: "player_finished",
    playerId,
    finishTime: player.finishTime,
    steps: player.steps,
  });

  // Check if all players finished
  const allFinished = Array.from(doc.players.values()).every(
    (p) => p.finished
  );
  if (allFinished) {
    doc.status = "finished";
  }

  await doc.save();

  return {
    id: player.id,
    name: player.name,
    currentPage: player.currentPage,
    path: [...player.path],
    finished: player.finished,
    gaveUp: player.gaveUp,
    finishTime: player.finishTime,
    steps: player.steps,
  };
}

export async function finishPlayer(
  roomId: string,
  playerId: string
): Promise<Player | null> {
  await connectDB();
  const doc = await RoomModel.findOne({ roomId });
  if (!doc) return null;
  return finishPlayerInternal(doc, playerId);
}

export async function giveUpPlayer(
  roomId: string,
  playerId: string
): Promise<Player | null> {
  await connectDB();

  const doc = await RoomModel.findOne({ roomId });
  if (!doc || !doc.startTime) return null;

  const player = doc.players.get(playerId);
  if (!player || player.finished) return null;

  player.finished = true;
  player.gaveUp = true;
  player.finishTime = null;

  broadcastToRoom(doc.roomId, {
    type: "player_gave_up",
    playerId,
  });

  // Check if all players finished
  const allFinished = Array.from(doc.players.values()).every(
    (p) => p.finished
  );
  if (allFinished) {
    doc.status = "finished";
  }

  await doc.save();

  return {
    id: player.id,
    name: player.name,
    currentPage: player.currentPage,
    path: [...player.path],
    finished: player.finished,
    gaveUp: player.gaveUp,
    finishTime: player.finishTime,
    steps: player.steps,
  };
}

export async function restartRoom(
  roomId: string,
  startPage: string,
  targetPage: string
): Promise<Room | null> {
  await connectDB();

  const doc = await RoomModel.findOne({ roomId });
  if (!doc) return null;

  doc.status = "waiting";
  doc.startTime = null;
  doc.startPage = startPage;
  doc.targetPage = targetPage;

  // Reset all players' game state
  for (const [, player] of doc.players.entries()) {
    player.currentPage = startPage;
    player.path = [startPage];
    player.steps = 0;
    player.finished = false;
    player.gaveUp = false;
    player.finishTime = null;
  }

  await doc.save();

  const room = docToRoom(doc);

  broadcastToRoom(roomId, {
    type: "game_restarted",
    room: serializeRoom(room),
  });

  return room;
}

export async function removePlayer(roomId: string, playerId: string): Promise<Room | null> {
  await connectDB();
  const doc = await RoomModel.findOne({ roomId });
  if (!doc) return null;

  if (!doc.players.has(playerId)) return docToRoom(doc);

  doc.players.delete(playerId);

  if (doc.players.size === 0) {
    await RoomModel.deleteOne({ roomId });
    subscribers.delete(roomId);
    return null;
  }

  let newHostId: string | undefined;
  if (doc.hostId === playerId) {
    const remainingPlayers = Array.from(doc.players.keys());
    if (remainingPlayers.length > 0) {
      newHostId = remainingPlayers[0];
      doc.hostId = newHostId;
    }
  }

  await doc.save();
  const updatedRoom = docToRoom(doc);

  broadcastToRoom(roomId, {
    type: "player_left",
    playerId,
    newHostId,
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
