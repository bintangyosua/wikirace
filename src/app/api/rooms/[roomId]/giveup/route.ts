import { giveUpPlayer, getRoom, serializeRoom } from "@/lib/session-store";

export const dynamic = "force-dynamic";

/**
 * POST /api/rooms/[roomId]/giveup
 * Player gives up the race.
 * Body: { playerId: string }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const body = await request.json();
  const { playerId } = body;

  if (!playerId) {
    return Response.json(
      { error: "playerId is required" },
      { status: 400 }
    );
  }

  const room = await getRoom(roomId);

  if (!room) {
    return Response.json({ error: "Room not found" }, { status: 404 });
  }

  if (room.status !== "playing") {
    return Response.json(
      { error: "Game is not in progress" },
      { status: 400 }
    );
  }

  const player = await giveUpPlayer(roomId, playerId);

  if (!player) {
    return Response.json(
      { error: "Player not found or already finished" },
      { status: 400 }
    );
  }

  const updatedRoom = await getRoom(roomId);

  return Response.json({
    player,
    room: updatedRoom ? serializeRoom(updatedRoom) : null,
  });
}
