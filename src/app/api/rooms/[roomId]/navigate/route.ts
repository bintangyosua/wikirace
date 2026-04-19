import { updatePlayerNavigation, getRoom, serializeRoom } from "@/lib/session-store";

export const dynamic = "force-dynamic";

/**
 * POST /api/rooms/[roomId]/navigate
 * Player navigates to a new Wikipedia page.
 * Body: { playerId: string, page: string }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const body = await request.json();
  const { playerId, page } = body;

  if (!playerId || !page) {
    return Response.json(
      { error: "playerId and page are required" },
      { status: 400 }
    );
  }

  const room = getRoom(roomId);

  if (!room) {
    return Response.json({ error: "Room not found" }, { status: 404 });
  }

  if (room.status !== "playing") {
    return Response.json(
      { error: "Game is not in progress" },
      { status: 400 }
    );
  }

  const player = updatePlayerNavigation(roomId, playerId, page);

  if (!player) {
    return Response.json(
      { error: "Player not found or already finished" },
      { status: 400 }
    );
  }

  return Response.json({
    player,
    finished: player.finished,
    room: serializeRoom(room),
  });
}
