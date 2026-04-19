"use client";

import { useEffect, useRef, useCallback, useReducer } from "react";
import type { GameEvent, SerializedRoom, Player } from "@/lib/types";

// ─── State ────────────────────────────────────────────────
export interface GameState {
  room: SerializedRoom | null;
  connected: boolean;
  error: string | null;
}

type GameAction =
  | { type: "SET_ROOM"; room: SerializedRoom }
  | { type: "PLAYER_JOINED"; player: Player }
  | {
      type: "PLAYER_NAVIGATED";
      playerId: string;
      page: string;
      steps: number;
      path: string[];
    }
  | {
      type: "PLAYER_FINISHED";
      playerId: string;
      finishTime: number;
      steps: number;
    }
  | {
      type: "PLAYER_GAVE_UP";
      playerId: string;
    }
  | { type: "GAME_STARTED"; startTime: number }
  | {
      type: "PLAYER_LEFT";
      playerId: string;
      newHostId?: string;
    }
  | { type: "SET_CONNECTED"; connected: boolean }
  | { type: "SET_ERROR"; error: string };

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "SET_ROOM":
      return { ...state, room: action.room, error: null };

    case "PLAYER_JOINED":
      if (!state.room) return state;
      return {
        ...state,
        room: {
          ...state.room,
          players: {
            ...state.room.players,
            [action.player.id]: action.player,
          },
        },
      };

    case "PLAYER_NAVIGATED":
      if (!state.room) return state;
      return {
        ...state,
        room: {
          ...state.room,
          players: {
            ...state.room.players,
            [action.playerId]: {
              ...state.room.players[action.playerId],
              currentPage: action.page,
              steps: action.steps,
              path: action.path,
            },
          },
        },
      };

    case "PLAYER_FINISHED":
      if (!state.room) return state;
      return {
        ...state,
        room: {
          ...state.room,
          players: {
            ...state.room.players,
            [action.playerId]: {
              ...state.room.players[action.playerId],
              finished: true,
              finishTime: action.finishTime,
              steps: action.steps,
            },
          },
        },
      };

    case "PLAYER_GAVE_UP":
      if (!state.room) return state;
      return {
        ...state,
        room: {
          ...state.room,
          players: {
            ...state.room.players,
            [action.playerId]: {
              ...state.room.players[action.playerId],
              finished: true,
              gaveUp: true,
              finishTime: null,
            },
          },
        },
      };

    case "GAME_STARTED":
      if (!state.room) return state;
      return {
        ...state,
        room: {
          ...state.room,
          status: "playing",
          startTime: action.startTime,
        },
      };

    case "PLAYER_LEFT":
      if (!state.room) return state;
      const newPlayers = { ...state.room.players };
      delete newPlayers[action.playerId];
      return {
        ...state,
        room: {
          ...state.room,
          players: newPlayers,
          hostId: action.newHostId || state.room.hostId,
        },
      };

    case "SET_CONNECTED":
      return { ...state, connected: action.connected };

    case "SET_ERROR":
      return { ...state, error: action.error };

    default:
      return state;
  }
}

// ─── Hook ─────────────────────────────────────────────────
export function useGameStream(roomId: string) {
  const [state, dispatch] = useReducer(gameReducer, {
    room: null,
    connected: false,
    error: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const connectRef = useRef<() => void>(() => {});

  const connect = useCallback(() => {
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`/api/rooms/${roomId}/stream`);
    eventSourceRef.current = es;

    es.onopen = () => {
      dispatch({ type: "SET_CONNECTED", connected: true });
    };

    es.onmessage = (e) => {
      try {
        const event: GameEvent = JSON.parse(e.data);

        switch (event.type) {
          case "full_state":
            dispatch({ type: "SET_ROOM", room: event.room });
            break;
          case "player_joined":
            dispatch({ type: "PLAYER_JOINED", player: event.player });
            break;
          case "player_navigated":
            dispatch({
              type: "PLAYER_NAVIGATED",
              playerId: event.playerId,
              page: event.page,
              steps: event.steps,
              path: event.path,
            });
            break;
          case "player_finished":
            dispatch({
              type: "PLAYER_FINISHED",
              playerId: event.playerId,
              finishTime: event.finishTime,
              steps: event.steps,
            });
            break;
          case "player_gave_up":
            dispatch({
              type: "PLAYER_GAVE_UP",
              playerId: event.playerId,
            });
            break;
          case "game_started":
            dispatch({
              type: "GAME_STARTED",
              startTime: event.startTime,
            });
            break;
          case "game_restarted":
            dispatch({ type: "SET_ROOM", room: event.room });
            break;
          case "player_left":
            dispatch({
              type: "PLAYER_LEFT",
              playerId: event.playerId,
              newHostId: event.newHostId,
            });
            break;
        }
      } catch (err) {
        console.error("Failed to parse SSE event:", err);
      }
    };

    es.onerror = () => {
      dispatch({ type: "SET_CONNECTED", connected: false });
      es.close();

      // Reconnect after 2 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connectRef.current();
      }, 2000);
    };
  }, [roomId]);

  useEffect(() => {
    connectRef.current = connect;
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  return state;
}
