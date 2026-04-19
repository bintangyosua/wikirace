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
 * 1. Finished players first
 * 2. Fewest steps
 * 3. Fastest time
 */
export function rankPlayers(players: Player[]): Player[] {
  return [...players].sort((a, b) => {
    // Finished players come first
    if (a.finished && !b.finished) return -1;
    if (!a.finished && b.finished) return 1;

    // Both finished — sort by steps, then time
    if (a.finished && b.finished) {
      if (a.steps !== b.steps) return a.steps - b.steps;
      return (a.finishTime ?? Infinity) - (b.finishTime ?? Infinity);
    }

    // Both not finished — sort by steps (more progress = fewer steps? no, just by steps count)
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
