import { getRoom, startGame, serializeRoom } from "@/lib/session-store";

export const dynamic = "force-dynamic";

/**
 * POST /api/rooms/[roomId]/start
 * Start the game (host only).
 * Body: { playerId: string }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const body = await request.json();
  const { playerId } = body;

  const room = await getRoom(roomId);

  if (!room) {
    return Response.json({ error: "Room not found" }, { status: 404 });
  }

  if (room.hostId !== playerId) {
    return Response.json(
      { error: "Only the host can start the game" },
      { status: 403 }
    );
  }

  if (room.status !== "waiting") {
    return Response.json(
      { error: "Game already started" },
      { status: 400 }
    );
  }

  const updatedRoom = await startGame(roomId);

  if (!updatedRoom) {
    return Response.json(
      { error: "Failed to start game" },
      { status: 500 }
    );
  }

  return Response.json({ room: serializeRoom(updatedRoom) });
}
