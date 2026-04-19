// ─── Player ───────────────────────────────────────────────
export interface Player {
  id: string;
  name: string;
  currentPage: string;
  path: string[];
  finished: boolean;
  gaveUp: boolean;
  finishTime: number | null; // elapsed ms from startTime
  steps: number; // path.length - 1
}

// ─── Room ─────────────────────────────────────────────────
export type RoomStatus = "waiting" | "playing" | "finished";

export interface Room {
  id: string;
  startPage: string;
  targetPage: string;
  startTime: number | null; // Date.now() when game starts
  players: Map<string, Player>;
  status: RoomStatus;
  hostId: string; // player who created the room
}

// Serialized version for JSON transport (Map → Record)
export interface SerializedRoom {
  id: string;
  startPage: string;
  targetPage: string;
  startTime: number | null;
  players: Record<string, Player>;
  status: RoomStatus;
  hostId: string;
}

// ─── SSE Events ───────────────────────────────────────────
export type GameEvent =
  | { type: "player_joined"; player: Player }
  | {
      type: "player_navigated";
      playerId: string;
      page: string;
      steps: number;
      path: string[];
    }
  | {
      type: "player_finished";
      playerId: string;
      finishTime: number;
      steps: number;
    }
  | {
      type: "player_gave_up";
      playerId: string;
    }
  | { type: "game_started"; startTime: number }
  | {
      type: "game_restarted";
      room: SerializedRoom;
    }
  | { type: "full_state"; room: SerializedRoom };

// ─── API Request/Response types ───────────────────────────
export interface CreateRoomResponse {
  roomId: string;
  startPage: string;
  targetPage: string;
}

export interface JoinRoomRequest {
  playerId: string;
  playerName: string;
}

export interface NavigateRequest {
  playerId: string;
  page: string;
}

export interface FinishRequest {
  playerId: string;
}

export interface WikiArticle {
  title: string;
  html: string;
}
