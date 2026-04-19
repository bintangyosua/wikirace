import { finishPlayer, getRoom, serializeRoom } from "@/lib/session-store";

export const dynamic = "force-dynamic";

/**
 * POST /api/rooms/[roomId]/finish
 * Mark a player as finished (reached the target page).
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

  const player = await finishPlayer(roomId, playerId);

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
