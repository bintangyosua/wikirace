import { createRoom, serializeRoom, addPlayer } from "@/lib/session-store";
import { getRandomArticles } from "@/lib/wikipedia";
import type { Player } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * POST /api/rooms
 * Create a new game room.
 * Body: { hostId: string, hostName: string, startPage?: string, targetPage?: string }
 *
 * If startPage/targetPage are provided, use those.
 * Otherwise, generate random Wikipedia articles.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { hostId, hostName, startPage: customStart, targetPage: customTarget } = body;

    if (!hostId || !hostName) {
      return Response.json(
        { error: "hostId and hostName are required" },
        { status: 400 }
      );
    }

    let startPage: string;
    let targetPage: string;

    if (customStart && customTarget) {
      // Use custom articles chosen by the host
      startPage = customStart;
      targetPage = customTarget;
    } else {
      // Get 2 random Wikipedia articles for start and target
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

    const room = await createRoom(startPage, targetPage, hostId);

    // Auto-join the host
    const hostPlayer: Player = {
      id: hostId,
      name: hostName,
      currentPage: startPage,
      path: [startPage],
      finished: false,
      gaveUp: false,
      finishTime: null,
      steps: 0,
    };

    await addPlayer(room.id, hostPlayer);

    return Response.json({
      roomId: room.id,
      startPage: room.startPage,
      targetPage: room.targetPage,
      room: serializeRoom(room),
    });
  } catch (error) {
    console.error("Failed to create room:", error);
    return Response.json(
      { error: "Failed to create room" },
      { status: 500 }
    );
  }
}
