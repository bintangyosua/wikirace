import { getRoom, addPlayer, serializeRoom } from "@/lib/session-store";
import type { Player } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/rooms/[roomId]
 * Get room state.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const room = getRoom(roomId);

  if (!room) {
    return Response.json({ error: "Room not found" }, { status: 404 });
  }

  return Response.json({ room: serializeRoom(room) });
}

/**
 * POST /api/rooms/[roomId]
 * Join an existing room.
 * Body: { playerId: string, playerName: string }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const body = await request.json();
  const { playerId, playerName } = body;

  if (!playerId || !playerName) {
    return Response.json(
      { error: "playerId and playerName are required" },
      { status: 400 }
    );
  }

  const room = getRoom(roomId);

  if (!room) {
    return Response.json({ error: "Room not found" }, { status: 404 });
  }

  // Check if player already in room
  if (room.players.has(playerId)) {
    return Response.json({ room: serializeRoom(room) });
  }

  if (room.status !== "waiting") {
    return Response.json(
      { error: "Game already started" },
      { status: 400 }
    );
  }

  const player: Player = {
    id: playerId,
    name: playerName,
    currentPage: room.startPage,
    path: [room.startPage],
    finished: false,
    finishTime: null,
    steps: 0,
  };

  addPlayer(roomId, player);

  return Response.json({ room: serializeRoom(room) });
}
