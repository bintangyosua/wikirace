import type { Player } from "./types";

/**
 * Generate a 6-character uppercase alphanumeric room code.
 */
export function generateRoomId(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * Rank players by:
 * 1. Finished (not gave up) first, by fewest steps then fastest time
 * 2. Gave up players next, by most steps (more effort)
 * 3. Still playing last, by steps
 */
export function rankPlayers(players: Player[]): Player[] {
  return [...players].sort((a, b) => {
    const aFinished = a.finished && !a.gaveUp;
    const bFinished = b.finished && !b.gaveUp;
    const aGaveUp = a.finished && a.gaveUp;
    const bGaveUp = b.finished && b.gaveUp;

    // Finished (not gave up) come first
    if (aFinished && !bFinished) return -1;
    if (!aFinished && bFinished) return 1;

    // Both finished — sort by steps, then time
    if (aFinished && bFinished) {
      if (a.steps !== b.steps) return a.steps - b.steps;
      return (a.finishTime ?? Infinity) - (b.finishTime ?? Infinity);
    }

    // Gave up before still playing
    if (aGaveUp && !bGaveUp) return -1;
    if (!aGaveUp && bGaveUp) return 1;

    // Both gave up — more steps = more effort = higher
    if (aGaveUp && bGaveUp) {
      return b.steps - a.steps;
    }

    // Both still playing — sort by steps
    return a.steps - b.steps;
  });
}

/**
 * Format milliseconds into a human-readable timer string (MM:SS.ms)
 */
export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${centiseconds.toString().padStart(2, "0")}`;
}

/**
 * Generate a random player ID
 */
export function generatePlayerId(): string {
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
