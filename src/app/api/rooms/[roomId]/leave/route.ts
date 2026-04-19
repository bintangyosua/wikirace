import { NextResponse } from "next/server";
import { removePlayer } from "@/lib/session-store";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;

    // sendBeacon sends application/x-www-form-urlencoded or text/plain often, but we try json.
    let playerId = "";
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await request.json();
      playerId = body.playerId;
    } else {
      // Fallback for text/plain (sendBeacon default for string)
      const text = await request.text();
      try {
        const body = JSON.parse(text);
        playerId = body.playerId;
      } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
      }
    }

    if (!playerId) {
      return NextResponse.json(
        { error: "Player ID required" },
        { status: 400 },
      );
    }

    // Optional: Only allow leaving if the game hasn't started yet
    // If the game is playing, we might want to keep the player so they can rejoin.
    // Uncomment this if we only want cleanup during waiting phase:
    // const room = await getRoom(roomId);
    // if (!room || room.status !== "waiting") {
    //   return NextResponse.json({ success: true, ignored: true });
    // }

    await removePlayer(roomId, playerId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to process leave request:", err);
    return NextResponse.json(
      { error: "Failed to leave room" },
      { status: 500 },
    );
  }
}
