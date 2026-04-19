import {
  getRoom,
  addSubscriber,
  removeSubscriber,
  serializeRoom,
} from "@/lib/session-store";

export const dynamic = "force-dynamic";

/**
 * GET /api/rooms/[roomId]/stream
 * Server-Sent Events endpoint for real-time game updates.
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

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial full state
      const initialEvent = `data: ${JSON.stringify({
        type: "full_state",
        room: serializeRoom(room),
      })}\n\n`;

      controller.enqueue(encoder.encode(initialEvent));

      // Register this controller as a subscriber
      addSubscriber(roomId, controller);

      // Send heartbeat every 15 seconds to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15000);

      // Cleanup on abort is handled by the cancel callback
    },
    cancel(controller) {
      removeSubscriber(roomId, controller as ReadableStreamDefaultController);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
