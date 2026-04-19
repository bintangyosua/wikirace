import { GameView } from "@/components/game-view";

export default async function GamePage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;

  return <GameView roomId={roomId} />;
}
