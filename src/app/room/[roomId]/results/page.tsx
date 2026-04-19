import { ResultsView } from "@/components/results-view";

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;

  return <ResultsView roomId={roomId} />;
}
