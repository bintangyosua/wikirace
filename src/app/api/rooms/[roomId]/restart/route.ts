import { getRoom, restartRoom, serializeRoom } from "@/lib/session-store";
import { getRandomArticles } from "@/lib/wikipedia";

export const dynamic = "force-dynamic";

/**
 * POST /api/rooms/[roomId]/restart
 * Restart the room for a new game (host only).
 * Body: { playerId: string, startPage?: string, targetPage?: string }
 *
 * If startPage/targetPage not provided, random articles are used.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const body = await request.json();
  const { playerId, startPage: customStart, targetPage: customTarget } = body;

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

  if (room.hostId !== playerId) {
    return Response.json(
      { error: "Only the host can restart the game" },
      { status: 403 }
    );
  }

  let startPage: string;
  let targetPage: string;

  if (customStart && customTarget) {
    startPage = customStart;
    targetPage = customTarget;
  } else {
    const articles = await getRandomArticles(2);
    if (articles.length < 2) {
      return Response.json(
        { error: "Failed to get random Wikipedia articles" },
        { status: 500 }
      );
    }
    startPage = articles[0];
    targetPage = articles[1];
  }

  const updatedRoom = await restartRoom(roomId, startPage, targetPage);

  if (!updatedRoom) {
    return Response.json(
      { error: "Failed to restart room" },
      { status: 500 }
    );
  }

  return Response.json({ room: serializeRoom(updatedRoom) });
}
